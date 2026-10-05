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
assert.match(metadata.version,/^\d{8}-v\d+$/);
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
function filesIn(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?filesIn(path.join(directory,entry.name)):[path.join(directory,entry.name)])}
const publicFiles=filesIn(path.join(root,'public'));
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
 logs='';child=spawn(process.execPath,['production/server.mjs'],{cwd:root,env:{...process.env,NODE_PATH:'',PUBLIC_ORIGIN:publicOrigin,ADMIN_ORIGIN:adminOrigin,PORT:String(publicPort),ADMIN_PORT:String(adminPort),BIND_ADDRESS:'127.0.0.1',DATABASE_PATH:path.join(temp,'catalog.sqlite'),ADMIN_ENABLED:String(enabled),ADMIN_PASSWORD_FILE:passwordFile}});
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
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())),sha256(fs.readFileSync(file)),'Frozen runtime asset differs: '+route);
 }
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
 console.log(JSON.stringify({passed:true,sourceCommit:commit,checks:['no installed npm dependencies','every file checksum','exact frozen public asset bytes','catalog node/relation IDs and revision','article/version/illustration counts','read-only public listener','admin authentication','public/private separation','CSRF protection','restart persistence'],publicAssets:publicFiles.length,entities:catalog.nodes.length,relationships:catalog.edges.length,articles:articles.length,articleVersions:metadata.articleVersions,illustrations:metadata.rasterIllustrations}));
}finally{await stop();fs.rmSync(temp,{recursive:true,force:true})}
