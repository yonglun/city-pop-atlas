import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
// Generate a fresh disposable password only for this isolated loopback test.
// No fixture credential is committed or usable by a deployed instance.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-prod-test-')), password=randomBytes(32).toString('hex'), passwordFile=path.join(temp,'password');fs.writeFileSync(passwordFile,password,{mode:0o600});
const pub='http://127.0.0.1:19080',admin='http://127.0.0.1:19081',auth='Basic '+Buffer.from('citypop:'+password).toString('base64');
let processHandle,logs='';
async function start(enabled){processHandle=spawn(process.execPath,['production/server.mjs'],{env:{...process.env,PUBLIC_ORIGIN:pub,ADMIN_ORIGIN:admin,PORT:'19080',ADMIN_PORT:'19081',ADMIN_ENABLED:String(enabled),ADMIN_PASSWORD_FILE:passwordFile,DATABASE_PATH:path.join(temp,'catalog.sqlite'),BIND_ADDRESS:'127.0.0.1',LOCAL_REVIEW:'1',LINUX_AUTHENTICATED_ADMIN:true,SITE_REVIEW_MODE:'owner-private',SITE_REVIEW_ADMIN_USER_IDS:'["fixture-owner"]'}});processHandle.stdout.on('data',c=>logs+=c);processHandle.stderr.on('data',c=>logs+=c);for(let i=0;i<100;i++){try{if((await fetch(pub+'/healthz')).ok)return}catch{}if(processHandle.exitCode!==null)throw Error(logs);await sleep(100)}throw Error('Server start timeout: '+logs)}
async function stop(){if(processHandle.exitCode!==null)return;const done=new Promise(resolve=>processHandle.once('exit',resolve));processHandle.kill('SIGTERM');await done}
try{
 await start(false);
 assert.equal((await fetch(pub+'/')).status,200);
 assert.deepEqual(await (await fetch(pub+'/api/review-session',{headers:{'oai-authenticated-user-id':'fixture-owner','x-admin':'true',Authorization:auth}})).json(),{canReview:false,state:'forbidden',provider:'linux'});
 for(const route of ['/api/review','/api/review/preview','/api/review/import','/api/review/history','/api/review/unknown','/api/operations','/api/operations/preview','/api/operations/import','/api/operations/unknown'])for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal((await fetch(pub+route,{method,headers:{'oai-authenticated-user-id':'fixture-owner',Authorization:auth,Origin:pub,'Content-Type':'application/json'},...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})})).status,403);
 const graph=await (await fetch(pub+'/api/graph')).json();assert.ok(graph.nodes.length>0);
 const articles=await (await fetch(pub+'/articles.json')).json();fs.writeFileSync(path.join(temp,'articles.json'),JSON.stringify(articles));
 for(const route of ['/api/review','/api/review/preview','/api/operations','/api/operations/preview'])assert.equal((await fetch(pub+route)).status,403);
 let response=await fetch(pub+'/api/review',{headers:{'oai-authenticated-user-id':'spoof','authorization':auth}});assert.equal(response.status,403);
 response=await fetch(pub+'/api/review/import',{method:'POST',headers:{Origin:pub,'Content-Type':'application/json','oai-authenticated-user-id':'spoof'},body:'{"candidates":[]}'});assert.equal(response.status,403);
 assert.equal(await new Promise((resolve,reject)=>http.get(pub+'/',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)),421);
 assert.equal((await fetch(pub+'/api/graph',{method:'POST',body:'x'.repeat(65537)})).status,413);
 await stop();await start(true);
 assert.equal((await fetch(admin+'/')).status,401);
 assert.equal((await fetch(admin+'/',{headers:{Authorization:'Basic '+Buffer.from('citypop:wrong').toString('base64')}})).status,401);
 assert.deepEqual(await (await fetch(admin+'/api/review-session',{headers:{Authorization:auth}})).json(),{canReview:true,state:'admin',provider:'linux'});
 response=await fetch(admin+'/api/review',{headers:{Authorization:auth}});assert.equal((await response.json()).canReview,true);
 response=await fetch(pub+'/api/review',{headers:{Authorization:auth}});assert.equal(response.status,403);
 for(const bad of [undefined,'https://evil.example']){response=await fetch(admin+'/api/review/preview',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json',...(bad?{Origin:bad}:{})},body:'{"candidates":[]}'});assert.equal(response.status,403)}
 response=await fetch(admin+'/api/review/preview',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json',Origin:admin},body:'{"candidates":[]}'});assert.equal(response.status,400);assert.equal((await response.json()).error,'candidate_limit');
 const after=await (await fetch(pub+'/api/graph')).json();assert.equal(after.revision,graph.revision);
 await stop();
 const {openDatabase}=await import('../production/sqlite.mjs');const db=openDatabase(path.join(temp,'catalog.sqlite'));assert.equal(db.sqlite.prepare('SELECT count(*) n FROM _linux_migrations').get().n,4);db.close();
 console.log(JSON.stringify({passed:true,checks:['boot/read-only','private editorial GET denied','forged identity denied','host validation','body limit','admin authentication','public listener isolation','CSRF','admin authorized preview','restart persistence','idempotent migrations'],entities:graph.nodes.length,temp}));
}finally{await stop()}
