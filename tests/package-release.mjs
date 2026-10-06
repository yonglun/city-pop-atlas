// Run against an extracted release, without npm install:
// node /path/to/release/tests/package-release.mjs /path/to/release FULL_SOURCE_COMMIT
// Only isolated loopback listeners and disposable synthetic SQLite data are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {createHash,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

assert.equal(process.argv.length,4,'Usage: node tests/package-release.mjs EXTRACTED_RELEASE FULL_SOURCE_COMMIT');
const root=fs.realpathSync(process.argv[2]),commit=process.argv[3];
assert.match(commit,/^[0-9a-f]{40}$/);
assert(!fs.existsSync(path.join(root,'node_modules')),'Package must not contain node_modules');
assert(!fs.existsSync(path.join(root,'server/assets.generated.js')),'Generated duplicate assets must not ship');
const metadata=JSON.parse(fs.readFileSync(path.join(root,'release.json')));
assert.equal(metadata.sourceCommit,commit);
assert.deepEqual(metadata.runtimeDependencies,[]);
if(metadata.sourceProvenance==='private-seo-source-plus-portable-adaptation'){
 assert.equal(metadata.privateSeoSourceCommit,commit);
 assert.equal(metadata.githubSeoPublished,false);
 assert.match(metadata.publicGithubBaseCommit,/^[0-9a-f]{40}$/);
 assert.match(metadata.portableSeoPatchSha256,/^[0-9a-f]{64}$/);
 assert.match(metadata.buildInputTreeSha256,/^[0-9a-f]{64}$/);
}
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json')));
const articles=JSON.parse(fs.readFileSync(path.join(root,'public/articles.json')));
assert.equal(catalog.nodes.length,metadata.catalogEntities);
assert.equal(catalog.edges.length,metadata.catalogRelationships);
assert.equal(articles.length,metadata.articles);
assert.equal(articles.filter(a=>a.kind!=='contextual').length,metadata.canonicalEssays);
assert.equal(articles.filter(a=>a.kind==='contextual').length,metadata.contextualIntroductions);
assert.equal(metadata.canonicalEssays+metadata.contextualIntroductions,metadata.articles);
assert.equal(new Set(articles.map(a=>a.entityId)).size,metadata.articles);
for(const article of articles)assert.deepEqual(Object.keys(article.locales).sort(),['en','ja','zh']);
const aboutPhotos=JSON.parse(fs.readFileSync(path.join(root,'data/about-photo-provenance.json')));
assert.equal(aboutPhotos.length,metadata.aboutPhotographs);
assert.match(metadata.version,/^\d{8}-(?:(?:seo|catalog|performance)-)?v\d+$/);
assert.equal(metadata.packageRoot,path.basename(root));
assert(!fs.existsSync(path.join(root,'.env')),'Package must not contain private .env');
assert(!fs.existsSync(path.join(root,'runtime')),'Package must not contain runtime databases');
assert.deepEqual(fs.readdirSync(path.join(root,'secrets')),['.gitkeep']);

assert.equal(articles.reduce((n,a)=>n+Object.keys(a.locales).length,0),metadata.articleVersions);
assert.equal(catalog.nodes.filter(n=>n.type==='edition').length,metadata.editions);
assert.equal(catalog.nodes.filter(n=>n.type==='track').length,metadata.trackPositions);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=fs.readFileSync(path.join(root,'SHA256SUMS'),'utf8');
for(const line of manifest.trimEnd().split('\n')){
 const match=/^([0-9a-f]{64})  (.+)$/.exec(line);assert(match,'Malformed file checksum');
 const file=path.join(root,match[2]);assert(file.startsWith(root+path.sep));
 assert.equal(sha256(fs.readFileSync(file)),match[1],match[2]);
}
if(metadata.buildInputTreeSha256){
 const rows=manifest.trimEnd().split('\n').map(line=>/^([0-9a-f]{64})  (.+)$/.exec(line)).filter(row=>row[2]!=='release.json');
 const fingerprint=rows.map(row=>`${fs.statSync(path.join(root,row[2])).mode&0o111?'0755':'0644'} ${row[1]}  ${row[2]}\n`).join('');
 assert.equal(sha256(Buffer.from(fingerprint)),metadata.buildInputTreeSha256,'Build input bytes and mode fingerprint');
}
function filesIn(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesIn(path.join(directory,entry.name)):[path.join(directory,entry.name)])}
const publicFiles=filesIn(path.join(root,'public'));
// Independently reconstruct versioned JS dependency bytes from packaged sources,
// so a valid hash of an accidentally stale bundle cannot satisfy the test.
const expectedStatic=new Map(),computingStatic=new Set();
function expectedVersionedAsset(route){
 if(expectedStatic.has(route))return expectedStatic.get(route);
 assert(!computingStatic.has(route),'Static dependency cycle');computingStatic.add(route);
 const file=path.join(root,'public',route.slice(1));let body=fs.readFileSync(file,'utf8');
 if(route.endsWith('.js'))body=body.replace(/(['"])(\/[^'"?#\s<>]+)(?:\?[^'"#\s<>]*)?\1/g,(match,quote,target)=>{
  if(!/\.(?:js|css|svg)$/.test(target)||!publicFiles.includes(path.join(root,'public',target.slice(1))))return match;
  return quote+expectedVersionedAsset(target).route+quote;
 });
 const digest=sha256(Buffer.from(body)),extension=path.posix.extname(route),stem=route.slice(1,-extension.length).replaceAll('/','-');
 const result={body:Buffer.from(body),route:'/assets/'+stem+'.'+digest.slice(0,20)+extension};expectedStatic.set(route,result);computingStatic.delete(route);return result;
}

assert.equal(publicFiles.filter(f=>f.includes('/illustrations/')&&/\.(webp|png|jpe?g)$/.test(f)).length,metadata.rasterIllustrations);
async function unusedPort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-package-test-'));
const password=randomBytes(32).toString('hex'),passwordFile=path.join(temp,'password');
fs.writeFileSync(passwordFile,password,{mode:0o600});
const publicPort=await unusedPort(),adminPort=await unusedPort();
const publicOrigin=`http://127.0.0.1:${publicPort}`,adminOrigin=`http://127.0.0.1:${adminPort}`;
const authorization='Basic '+Buffer.from('citypop:'+password).toString('base64');
let child,logs='';
async function stop(){if(!child||child.exitCode!==null)return;const exit=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exit;assert.equal(child.exitCode,0,logs)}
async function start(enabled){
 logs='';child=spawn(process.execPath,['production/server.mjs'],{cwd:root,env:{PATH:process.env.PATH,TZ:'UTC',GA_MEASUREMENT_ID:'',CLARITY_PROJECT_ID:'',NODE_PATH:'',PUBLIC_ORIGIN:publicOrigin,ADMIN_ORIGIN:adminOrigin,PORT:String(publicPort),ADMIN_PORT:String(adminPort),BIND_ADDRESS:'127.0.0.1',DATABASE_PATH:path.join(temp,'catalog.sqlite'),ADMIN_ENABLED:String(enabled),ADMIN_PASSWORD_FILE:passwordFile}});
 child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(publicOrigin+'/healthz')).ok&&(!enabled||(await fetch(adminOrigin+'/')).status===401))return}catch{}await sleep(50)}
 throw Error('Package runtime start timed out: '+logs);
}
try{
 await start(false);
 const graph=await(await fetch(publicOrigin+'/api/graph')).json();
 assert.equal(graph.revision,catalog.revision);
 assert.deepEqual(graph.nodes.map(n=>n.id).sort(),catalog.nodes.map(n=>n.id).sort());
 assert.deepEqual(graph.edges.map(e=>e.id).sort(),catalog.edges.map(e=>e.id).sort());
 for(const file of publicFiles){
  const route='/'+path.relative(path.join(root,'public'),file).split(path.sep).map(encodeURIComponent).join('/');
  const response=await fetch(publicOrigin+route);assert.equal(response.status,200,route);
  if(route==='/index.html'){
   const html=await response.text();
   assert(html.includes('class="search-discovery"'));assert(html.includes('<noscript>'));
   const original=html.replace('<meta name="robots" content="noindex,follow">','').replace(/<noscript><style>[\s\S]*?<\/style><\/noscript>/,'').replace(' data-seo-public="false"','').replace(/<section class="search-discovery"[\s\S]*?<\/section>/,'');
   const source=fs.readFileSync(file,'utf8');let normalized=original;
   for(const match of source.matchAll(/\b(src|href)=(["'])(\/[^"'?#\s<>]+)(?:\?[^"'#\s<>]*)?\2/g)){
    const [,attribute,quote,pathname]=match;if(!/\.(?:js|css|svg)$/.test(pathname))continue;
    const extension=path.posix.extname(pathname),stem=pathname.slice(1,-extension.length).replaceAll('/','-');
    const escaped=stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=new RegExp(attribute+'='+quote+'/assets/'+escaped+'\\.([0-9a-f]{20})'+extension.replace('.','\\.')+quote);
    const hashed=normalized.match(pattern);assert(hashed,'Versioned root asset missing: '+pathname);
    const route=hashed[0].slice(attribute.length+2,-1),assetResponse=await fetch(publicOrigin+route);assert.equal(assetResponse.status,200,route);
    const assetBytes=Buffer.from(await assetResponse.arrayBuffer());assert.equal(sha256(assetBytes).slice(0,20),hashed[1],'Content hash mismatch: '+route);
    const expected=expectedVersionedAsset(pathname);assert.equal(route,expected.route,'Versioned URL must describe current source');assert.deepEqual(assetBytes,expected.body,'Versioned bytes must match current source');
    normalized=normalized.replace(pattern,match[0]);
   }
   assert.equal(sha256(Buffer.from(normalized)),sha256(Buffer.from(source)),'Frozen root asset matches after verified version URLs and documented SEO additions');continue;
  }
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())),sha256(fs.readFileSync(file)),'Frozen runtime asset differs: '+route);
 }
 for(const expected of expectedStatic.values()){
  const response=await fetch(publicOrigin+expected.route);assert.equal(response.status,200,expected.route);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected.body,'Dependency alias must serve exact current source: '+expected.route);
 }
 const home=await fetch(publicOrigin+'/');assert.equal(home.status,200);assert.match(await home.text(),/City Pop/);
 assert.equal((await fetch(publicOrigin+'/api/review-session')).status,200);
 assert.deepEqual(await(await fetch(publicOrigin+'/api/review-session')).json(),{canReview:false,state:'forbidden',provider:'linux'});
 for(const route of ['/api/review','/api/review/history','/api/operations','/api/operations/audit']){
  for(const method of ['GET','POST'])assert.equal((await fetch(publicOrigin+route,{method,headers:{Authorization:authorization,Origin:publicOrigin,'oai-authenticated-user-id':'synthetic-fixture-owner','Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})})).status,403);
 }
 await stop();await start(true);
 assert.equal((await fetch(adminOrigin+'/')).status,401);
 assert.equal((await fetch(adminOrigin+'/',{headers:{Authorization:'Basic '+Buffer.from('citypop:invalid-fixture').toString('base64')}})).status,401);
 assert.deepEqual(await(await fetch(adminOrigin+'/api/review-session',{headers:{Authorization:authorization}})).json(),{canReview:true,state:'admin',provider:'linux'});
 assert.equal((await fetch(adminOrigin+'/api/review',{headers:{Authorization:authorization}})).status,200);
 for(const origin of [undefined,'https://invalid.example'])assert.equal((await fetch(adminOrigin+'/api/review/preview',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:'{"candidates":[]}'})).status,403);
 assert.equal((await fetch(adminOrigin+'/api/review/preview',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json',Origin:adminOrigin},body:'{"candidates":[]}'})).status,400);
 await stop();
 console.log(JSON.stringify({passed:true,sourceCommit:commit,checks:['no installed npm dependencies','every file checksum','all source-identical legacy public assets; versioned dependencies match current source; dynamic root normalized','catalog node/relation IDs and revision','article/version/illustration counts','read-only public listener','admin authentication','public/private separation','CSRF protection','restart persistence'],publicAssets:publicFiles.length,sourceIdenticalLegacyAssetResponses:publicFiles.length-1,versionedDependencies:expectedStatic.size,normalizedDynamicRootAssets:1,entities:catalog.nodes.length,relationships:catalog.edges.length,articles:articles.length,articleVersions:metadata.articleVersions,illustrations:metadata.rasterIllustrations}));
}finally{await stop();fs.rmSync(temp,{recursive:true,force:true})}
