// Real HTTP acceptance on disposable loopback listeners. This never loads a
// repository .env, deployed database, external URL, or real analytics account.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';

const entry=fileURLToPath(new URL('../production/server.mjs',import.meta.url));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-seo-http-'));
const password=randomBytes(32).toString('hex'),passwordFile=path.join(temporary,'password');
fs.writeFileSync(passwordFile,password,{mode:0o600});
const auth='Basic '+Buffer.from('citypop:'+password).toString('base64');
const origin='https://atlas.example.org';
let child,logs='',checks=0;
const takePort=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(error=>error?reject(error):resolve(port))})});
const publicPort=await takePort(),adminPort=await takePort();
const adminOrigin='http://127.0.0.1:'+adminPort;
const environment={PATH:process.env.PATH||'',NODE_NO_WARNINGS:'1',PUBLIC_ORIGIN:origin,
 SEO_INDEXABLE:'true',ADMIN_ORIGIN:adminOrigin,PORT:String(publicPort),ADMIN_PORT:String(adminPort),
 ADMIN_ENABLED:'true',ADMIN_PASSWORD_FILE:passwordFile,DATABASE_PATH:path.join(temporary,'catalog.sqlite'),
 BIND_ADDRESS:'127.0.0.1',GA_MEASUREMENT_ID:'',CLARITY_PROJECT_ID:''};
const call=(target='/',options={})=>new Promise((resolve,reject)=>{
 const admin=!!options.admin,request=http.request({hostname:'127.0.0.1',port:admin?adminPort:publicPort,
  path:target,method:options.method||'GET',headers:{Host:admin?new URL(adminOrigin).host:new URL(origin).host,
   ...(options.auth?{Authorization:auth}:{}),...(options.body?{'Content-Length':Buffer.byteLength(options.body)}:{}),...options.headers}},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString('utf8')}));
   });request.on('error',reject);request.setTimeout(15000,()=>request.destroy(Error('HTTP fixture timeout')));request.end(options.body);
});
function noindex(response,label){assert.match(response.headers['x-robots-tag']||'',/noindex/i,label+' must be noindex');checks++}
async function stop(){if(!child||child.exitCode!==null)return;const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited}
try{
 for(const [name,value] of Object.entries({credentials:'https://user:pass@atlas.example.org',path:'https://atlas.example.org/path',query:'https://atlas.example.org?x=1',fragment:'https://atlas.example.org#x',scheme:'javascript:alert(1)'})){
  const filename=path.join(temporary,'invalid-'+name+'.sqlite');
  const invalid=spawnSync(process.execPath,[entry],{cwd:temporary,env:{...environment,PUBLIC_ORIGIN:value,DATABASE_PATH:filename},encoding:'utf8',timeout:10000});
  assert.notEqual(invalid.status,0,name+' origin must fail startup');assert(!fs.existsSync(filename),name+' fails before database initialization');checks++;
 }
 child=spawn(process.execPath,[entry],{cwd:temporary,env:environment});
 child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
 for(let attempt=0;attempt<150;attempt++){
  if(child.exitCode!==null)throw Error('HTTP fixture exited: '+logs);
  try{if((await call('/healthz')).status===200)break}catch{}
  if(attempt===149)throw Error('HTTP fixture did not start: '+logs);await sleep(100);
 }
 const home=await call('/en/');assert.equal(home.status,200);assert.match(home.headers['content-type'],/^text\/html/);
 assert.match(home.body,new RegExp('<link[^>]+rel="canonical"[^>]+href="'+origin.replaceAll('.','\\.')+'/en/"'));
 assert.doesNotMatch(home.headers['x-robots-tag']||'',/noindex/i);checks++;
 const forged=await call('/en/',{headers:{Forwarded:'host=evil.example;proto=http','X-Forwarded-Host':'evil.example','X-Forwarded-Proto':'http','oai-authenticated-user-id':'fixture-admin','x-admin':'true'}});
 assert.equal(forged.status,200);assert(!forged.body.includes('evil.example'));assert.equal(forged.body,home.body,'spoofed headers cannot alter public document or canonical');checks++;
 assert.equal((await call('/en/',{headers:{Host:'evil.example'}})).status,421);checks++;
 const sitemap=await call('/sitemap.xml');assert.equal(sitemap.status,200);assert.match(sitemap.body,/<urlset|<sitemapindex/);assert(sitemap.body.includes(origin));assert(!sitemap.body.includes('127.0.0.1'));checks++;
 const robots=await call('/robots.txt');assert.equal(robots.status,200);assert(robots.body.includes('Sitemap: '+origin+'/sitemap.xml'));checks++;
 for(const target of ['/en/','/en','/en/about','/sitemap.xml','/robots.txt','/en/does-not-exist']){
  const get=await call(target),head=await call(target,{method:'HEAD'});assert.equal(head.status,get.status,target+' HEAD status');assert.equal(head.body,'',target+' HEAD must be bodyless');
  for(const name of ['content-type','location','x-robots-tag'])assert.equal(head.headers[name],get.headers[name],target+' HEAD '+name);checks++;
 }
 const redirect=await call('/en');assert([301,308].includes(redirect.status));assert.equal(new URL(redirect.headers.location,origin).href,origin+'/en/');checks++;
 for(const target of ['/\\evil.example/en/','//evil.example/en/','http://evil.example/en/','/en/%','/en/%E0%A4%A','/en/%2f%2fevil.example','/en/%5cevil.example','/en/%00','/en/<script>alert(1)</script>','/en/artists/%3Cscript%3Ealert(1)%3C/script%3E','/en/not-a-page','/de/about']){
  const response=await call(target);assert([400,404].includes(response.status),target+' unexpected '+response.status);assert(!response.headers.location,target+' cannot redirect');assert(!response.body.includes('<script>alert(1)</script>'));noindex(response,target);checks++;
 }
 for(const target of ['/api/review','/api/review/preview','/api/review/import','/api/review/history','/api/review/unknown','/api/operations','/api/operations/preview','/api/operations/import']){
  for(const method of ['GET','HEAD','POST','PUT','DELETE','OPTIONS']){
   const response=await call(target,{method,headers:{Authorization:auth,'oai-authenticated-user-id':'fixture-admin','Content-Type':'application/json',Origin:origin},...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})});
   assert.equal(response.status,403,target+' '+method);noindex(response,target);if(method==='HEAD')assert.equal(response.body,'');checks++;
  }
 }
 for(const target of ['/.env','/secrets/admin-password','/runtime/catalog.sqlite','/data/candidates.json','/data/operations.json','/production/server.mjs']){
  const response=await call(target);assert.equal(response.status,404,target);noindex(response,target);checks++;
 }
 for(const target of ['/','/en/','/api/review','/robots.txt','/sitemap.xml']){
  const denied=await call(target,{admin:true});assert.equal(denied.status,401);assert.match(denied.headers['www-authenticate'],/^Basic /);noindex(denied,'unauthenticated admin '+target);checks++;
 }
 for(const target of ['/','/en/','/api/review-session','/api/review','/api/operations']){
  const response=await call(target,{admin:true,auth:true});assert.equal(response.status,200,target);noindex(response,'authenticated admin '+target);assert.equal(response.headers['cache-control'],'no-store');checks++;
 }
 const adminRobots=await call('/robots.txt',{admin:true,auth:true});assert.equal(adminRobots.status,200);assert.match(adminRobots.body,/Disallow:\s*\//);assert(!adminRobots.body.includes('Sitemap:'));checks++;
 const adminSitemap=await call('/sitemap.xml',{admin:true,auth:true});assert.equal(adminSitemap.status,404);noindex(adminSitemap,'admin sitemap');checks++;
 const publicSession=await call('/api/review-session',{headers:{Authorization:auth,'oai-authenticated-user-id':'fixture-admin'}});
 assert.deepEqual(JSON.parse(publicSession.body),{canReview:false,state:'forbidden',provider:'linux'});noindex(publicSession,'public session');checks++;
 console.log(JSON.stringify({passed:true,suite:'seo-linux',checks,scope:'Real HTTP public/admin listeners; fixed origin, Host rejection, redirects, HEAD, malformed paths, protected endpoints, private robots and sitemap. Temporary database and synthetic password only.'}));
}finally{await stop();fs.rmSync(temporary,{recursive:true,force:true})}
