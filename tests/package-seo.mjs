// npm-free, real HTTP crawl of the release's public sitemap. All sockets stay
// on loopback; PUBLIC_ORIGIN is the intended production domain, not contacted.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import http from 'node:http';import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const root=path.resolve(process.argv[2]||'.');
const origin='https://city-pop.softmatrix.io',host=new URL(origin).host;
const metadata=JSON.parse(fs.readFileSync(path.join(root,'release.json')));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-package-seo-'));
const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const call=(target,headers={},method='GET')=>new Promise((resolve,reject)=>{
 const request=http.request({hostname:'127.0.0.1',port,path:target,method,headers:{Host:host,...headers}},response=>{const chunks=[];response.on('data',c=>chunks.push(c));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString('utf8')}))});
 request.on('error',reject);request.setTimeout(10000,()=>request.destroy(Error('Local test timeout')));request.end();
});
let logs='';const child=spawn(process.execPath,['production/server.mjs'],{cwd:root,env:{PATH:process.env.PATH,TZ:'UTC',PUBLIC_ORIGIN:origin,PORT:String(port),BIND_ADDRESS:'127.0.0.1',DATABASE_PATH:path.join(temporary,'catalog.sqlite'),ADMIN_ENABLED:'false',GA_MEASUREMENT_ID:'',CLARITY_PROJECT_ID:''}});
child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
try{
 for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error(logs);try{if((await call('/healthz')).status===200)break}catch{}await sleep(100);if(i===149)throw Error(logs)}
 const sitemap=await call('/sitemap.xml');assert.equal(sitemap.status,200);assert.match(sitemap.headers['content-type'],/xml/);
 const parse=spawnSync('python3',['-c',`import sys,json,xml.etree.ElementTree as E
root=E.fromstring(sys.stdin.read())
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','x':'http://www.w3.org/1999/xhtml'}
assert root.tag=='{'+ns['s']+'}urlset'
print(json.dumps([{'loc':r.find('s:loc',ns).text,'alternates':[a.attrib for a in r.findall('x:link',ns)]} for r in root]))`],{input:sitemap.body,encoding:'utf8'});
 assert.equal(parse.status,0,parse.stderr);const entries=JSON.parse(parse.stdout);assert.equal(entries.length,metadata.indexableSitemapURLs);assert.equal(new Set(entries.map(e=>e.loc )).size,metadata.indexableSitemapURLs);
 let htmlPages=0,languageAlternates=0,jsonLdGraphs=0;
 for(const entry of entries){
  const url=new URL(entry.loc);assert.equal(url.origin,origin);assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(entry.alternates.length,4);
  for(const alternate of entry.alternates){assert.equal(new URL(alternate.href).origin,origin);assert(['en','zh-CN','ja','x-default'].includes(alternate.hreflang));languageAlternates++;}
  const response=await call(url.pathname);assert.equal(response.status,200,url.pathname);assert.match(response.headers['content-type'],/text\/html/);assert.doesNotMatch(response.headers['x-robots-tag']||'',/noindex/i);
  const html=response.body;assert(html.includes('<link rel="canonical" href="'+entry.loc+'"'),url.pathname+' canonical');assert.match(html,/<h1[^>]*>.+?<\/h1>/s);assert.match(html,/<title>.+?<\/title>/s);
  const schema=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);assert(schema,url.pathname+' schema');const data=JSON.parse(schema[1]);assert(data['@graph'].length>0);jsonLdGraphs++;
  assert.equal((html.match(/rel="alternate" hreflang=/g)||[]).length,4,url.pathname+' alternates');assert(!html.includes('src="/app.js"'));assert(!html.includes('src="https://www.googletagmanager.com'));assert(!html.includes('https://www.clarity.ms/tag/'));htmlPages++;
 }
 const robots=await call('/robots.txt');assert.equal(robots.status,200);assert(robots.body.includes('Sitemap: '+origin+'/sitemap.xml'));assert(!robots.body.includes('Disallow: /\n'));
 for(const target of ['/en/not-an-entity','/en/artists/missing-person','/this-does-not-exist','/sitemap.xml?x=1']){const response=await call(target);assert.equal(response.status,404,target);assert.match(response.headers['x-robots-tag'],/noindex/);}
 const track=await call('/en/tracks/edition-sunshower-1977-gw4029-track-a1');assert.equal(track.status,200);assert.match(track.headers['x-robots-tag'],/noindex/);assert(track.body.includes('rel="canonical"'));
 const spoof=await call('/en/',{'X-Forwarded-Host':'evil.example','X-Forwarded-Proto':'http'});assert.equal(spoof.status,200);assert(!spoof.body.includes('evil.example'));assert.equal((await call('/en/',{Host:'evil.example'})).status,421);
 assert.equal((await call('/api/review')).status,403);
 console.log(JSON.stringify({passed:true,release:metadata.version,origin,network:'loopback-only; no production connection',sitemapUrls:entries.length,htmlPages,languageAlternates,jsonLdGraphs,xmlValid:true,checks:['all public sitemap URLs HTTP200','self canonicals','hreflang','visible raw HTML','JSON-LD parse','contextual noindex','unknown routes404','Host and forwarded-host isolation','public review denied','no real analytics IDs']}));
}finally{if(child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await ended;}fs.rmSync(temporary,{recursive:true,force:true});}
