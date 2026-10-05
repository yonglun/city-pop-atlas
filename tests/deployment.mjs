import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
// Generate a fresh disposable password only for this isolated loopback test.
// No fixture credential is committed or usable by a deployed instance.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-prod-test-')), password=randomBytes(32).toString('hex'), passwordFile=path.join(temp,'password');fs.writeFileSync(passwordFile,password,{mode:0o600});
const pub='http://127.0.0.1:19080',admin='http://127.0.0.1:19081',auth='Basic '+Buffer.from('citypop:'+password).toString('base64');
let processHandle,logs='';
async function start(enabled){processHandle=spawn(process.execPath,['production/server.mjs'],{env:{...process.env,GA_MEASUREMENT_ID:'G-LINUX1234',CLARITY_PROJECT_ID:'linux1234',PUBLIC_ORIGIN:pub,ADMIN_ORIGIN:admin,PORT:'19080',ADMIN_PORT:'19081',ADMIN_ENABLED:String(enabled),ADMIN_PASSWORD_FILE:passwordFile,DATABASE_PATH:path.join(temp,'catalog.sqlite'),BIND_ADDRESS:'127.0.0.1',LOCAL_REVIEW:'1',LINUX_AUTHENTICATED_ADMIN:true,SITE_REVIEW_MODE:'owner-private',SITE_REVIEW_ADMIN_USER_IDS:'["fixture-owner"]'}});processHandle.stdout.on('data',c=>logs+=c);processHandle.stderr.on('data',c=>logs+=c);for(let i=0;i<100;i++){try{if((await fetch(pub+'/healthz')).ok)return}catch{}if(processHandle.exitCode!==null)throw Error(logs);await sleep(100)}throw Error('Server start timeout: '+logs)}
async function stop(){if(!processHandle||processHandle.exitCode!==null)return;const done=new Promise(resolve=>processHandle.once('exit',resolve));processHandle.kill('SIGTERM');await done}
try{
 for(const [name,configuration,expected] of [
  ['missing-secret',{ADMIN_PASSWORD_FILE:''},'ADMIN_PASSWORD_FILE is required'],
  ['non-loopback-http',{ADMIN_ORIGIN:'http://admin.example.invalid'},'HTTP administration must use a loopback origin'],
 ]){
  const invalid=spawnSync(process.execPath,['production/server.mjs'],{env:{...process.env,PUBLIC_ORIGIN:pub,ADMIN_ORIGIN:admin,ADMIN_ENABLED:'true',ADMIN_PASSWORD_FILE:passwordFile,DATABASE_PATH:path.join(temp,name+'.sqlite'),...configuration},encoding:'utf8',timeout:5000});
  assert.notEqual(invalid.status,0);assert.match(invalid.stderr,new RegExp(expected));assert(!fs.existsSync(path.join(temp,name+'.sqlite')));
 }
 await start(false);
 assert.equal((await fetch(pub+'/')).status,200);
 assert.deepEqual(await (await fetch(pub+'/api/public-config')).json(),{gaMeasurementId:'G-LINUX1234',clarityProjectId:'linux1234',blocked:false});
 for(const headers of [{DNT:'1'},{'Sec-GPC':'1'}])assert.deepEqual(await (await fetch(pub+'/api/public-config',{headers})).json(),{gaMeasurementId:'',clarityProjectId:'',blocked:true});
 assert.equal((await fetch(pub+'/api/public-config',{method:'POST'})).status,405);
 assert.deepEqual(await (await fetch(pub+'/api/review-session',{headers:{'oai-authenticated-user-id':'fixture-owner','x-admin':'true',Authorization:auth}})).json(),{canReview:false,state:'forbidden',provider:'linux'});
 for(const route of ['/api/review','/api/review/preview','/api/review/import','/api/review/history','/api/review/unknown','/api/operations','/api/operations/preview','/api/operations/import','/api/operations/unknown'])for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal((await fetch(pub+route,{method,headers:{'oai-authenticated-user-id':'fixture-owner',Authorization:auth,Origin:pub,'Content-Type':'application/json'},...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})})).status,403);
 const graph=await (await fetch(pub+'/api/graph')).json();assert.ok(graph.nodes.length>0);
 for(const route of ['/.env','/secrets/admin-password','/runtime/catalog.sqlite','/production/server.mjs','/deploy/scripts/citypop.sh','/data/candidates.json'])assert.equal((await fetch(pub+route)).status,404);
 const articles=await (await fetch(pub+'/articles.json')).json();fs.writeFileSync(path.join(temp,'articles.json'),JSON.stringify(articles));
 for(const route of ['/api/review','/api/review/preview','/api/operations','/api/operations/preview'])assert.equal((await fetch(pub+route)).status,403);
 let response=await fetch(pub+'/api/review',{headers:{'oai-authenticated-user-id':'spoof','authorization':auth}});assert.equal(response.status,403);
 response=await fetch(pub+'/api/review/import',{method:'POST',headers:{Origin:pub,'Content-Type':'application/json','oai-authenticated-user-id':'spoof'},body:'{"candidates":[]}'});assert.equal(response.status,403);
 assert.equal(await new Promise((resolve,reject)=>http.get(pub+'/',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)),421);
 assert.equal((await fetch(pub+'/api/graph',{method:'POST',body:'x'.repeat(65537)})).status,413);
 await stop();await start(true);
 response=await fetch(admin+'/');assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.match(response.headers.get('WWW-Authenticate'),/^Basic /);
 for(const credential of ['citypop:wrong','wrong-user:'+password])assert.equal((await fetch(admin+'/',{headers:{Authorization:'Basic '+Buffer.from(credential).toString('base64')}})).status,401);
 assert.equal(await new Promise((resolve,reject)=>http.get(admin+'/',{headers:{Host:'evil.example',Authorization:auth}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)),421);
 assert.deepEqual(await (await fetch(admin+'/api/public-config',{headers:{Authorization:auth}})).json(),{gaMeasurementId:'',clarityProjectId:'',blocked:true});
 assert.deepEqual(await (await fetch(admin+'/api/review-session',{headers:{Authorization:auth}})).json(),{canReview:true,state:'admin',provider:'linux'});
 response=await fetch(admin+'/api/review',{headers:{Authorization:auth}});assert.equal((await response.json()).canReview,true);
 response=await fetch(pub+'/api/review',{headers:{Authorization:auth}});assert.equal(response.status,403);
 for(const bad of [undefined,'null','https://evil.example']){response=await fetch(admin+'/api/review/preview',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json',...(bad?{Origin:bad}:{})},body:'{"candidates":[]}'});assert.equal(response.status,403)}
 response=await fetch(admin+'/api/review/preview',{method:'POST',headers:{Authorization:auth,Origin:admin,'Sec-Fetch-Site':'cross-site','Content-Type':'application/json'},body:'{"candidates":[]}'});assert.equal(response.status,403);
 response=await fetch(admin+'/api/review/preview',{method:'POST',headers:{Authorization:auth,Origin:admin,'Content-Type':'text/plain'},body:'{"candidates":[]}'});assert.equal(response.status,415);
 response=await fetch(admin+'/api/review/preview',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json',Origin:admin},body:'{"candidates":[]}'});assert.equal(response.status,400);assert.equal((await response.json()).error,'candidate_limit');
 const after=await (await fetch(pub+'/api/graph')).json();assert.equal(after.revision,graph.revision);
 await stop();
 const {openDatabase}=await import('../production/sqlite.mjs');const db=openDatabase(path.join(temp,'catalog.sqlite'));assert.equal(db.sqlite.prepare('SELECT count(*) n FROM _linux_migrations').get().n,4);db.close();
 console.log(JSON.stringify({passed:true,checks:['unsafe admin configuration refused before DB creation','public analytics configuration and DNT/GPC suppression','administrator analytics excluded','boot/read-only','private editorial GET denied','forged identity denied','internal files denied','public/admin host validation','body limit','admin password and username authentication','public listener isolation','CSRF Origin and Fetch-Site','JSON content type','admin authorized preview','restart persistence','idempotent migrations'],entities:graph.nodes.length}));
}finally{await stop();fs.rmSync(temp,{recursive:true,force:true})}
