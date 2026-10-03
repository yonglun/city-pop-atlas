// Real local HTTP/SQLite upgrade drill. Supply an independently verified old
// release directory: node tests/linux-upgrade.mjs /path/to/old-release
// Only temporary synthetic data is written. No Docker or deployed DB is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as sleep} from 'node:timers/promises';

if(process.argv.length!==3)throw Error('Usage: node tests/linux-upgrade.mjs VERIFIED_OLD_RELEASE_DIRECTORY');
const oldRelease=path.resolve(process.argv[2]);
const newRelease=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
for(const release of [oldRelease,newRelease])for(const file of ['production/server.mjs','dist/server/index.js','release.json'])assert(fs.statSync(path.join(release,file)).isFile(),file);
const oldMeta=JSON.parse(fs.readFileSync(path.join(oldRelease,'release.json'))),newMeta=JSON.parse(fs.readFileSync(path.join(newRelease,'release.json')));
assert.equal(oldMeta.schemaVersion,newMeta.schemaVersion,'This drill covers a same-schema code-only rollback');
for(const name of fs.readdirSync(path.join(oldRelease,'drizzle')).filter(x=>x.endsWith('.sql')))assert.deepEqual(fs.readFileSync(path.join(oldRelease,'drizzle',name)),fs.readFileSync(path.join(newRelease,'drizzle',name)),`Changed historical migration: ${name}`);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-upgrade-test-'));
const database=path.join(temp,'catalog.sqlite'),passwordFile=path.join(temp,'password');
const password=randomBytes(32).toString('hex'),fixture=randomBytes(12).toString('hex');
fs.writeFileSync(passwordFile,password,{mode:0o600});
const authorization='Basic '+Buffer.from('citypop:'+password).toString('base64');
async function unusedPort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
const publicPort=await unusedPort(),adminPort=await unusedPort();
const publicOrigin=`http://127.0.0.1:${publicPort}`,adminOrigin=`http://127.0.0.1:${adminPort}`;
let child,logs='';
async function stop(){if(!child||child.exitCode!==null)return;const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await closed;assert.equal(child.exitCode,0,logs)}
async function start(release){
 logs='';child=spawn(process.execPath,['production/server.mjs'],{cwd:release,env:{...process.env,PUBLIC_ORIGIN:publicOrigin,ADMIN_ORIGIN:adminOrigin,PORT:String(publicPort),ADMIN_PORT:String(adminPort),BIND_ADDRESS:'127.0.0.1',DATABASE_PATH:database,ADMIN_ENABLED:'true',ADMIN_PASSWORD_FILE:passwordFile}});
 child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(publicOrigin+'/healthz')).ok&&(await fetch(adminOrigin+'/',{headers:{Authorization:authorization}})).ok)return}catch{}await sleep(50)}
 throw Error('Server start timeout: '+logs);
}
async function api(route,body){
 const response=await fetch(adminOrigin+route,{method:body?'POST':'GET',headers:{Authorization:authorization,...(body?{Origin:adminOrigin,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const json=await response.json();assert.equal(response.status,200,route+': '+JSON.stringify(json));return json;
}
const tables=['attribute_overrides','candidates','review_events','approval_snapshots','catalog_operations','operation_events'];
function snapshot(file=database){const db=new DatabaseSync(file,{readOnly:true});try{assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);return Object.fromEntries(tables.map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]))}finally{db.close()}}
function preserved(before,after){for(const table of tables)for(const row of before[table]){const key=table==='approval_snapshots'?'event_id':'id';assert.deepEqual(after[table].find(other=>other[key]===row[key]),row,`Lost/changed ${table} ${row[key]}`)}}
function backup(release,name){const destination=path.join(temp,name);const result=spawnSync(process.execPath,['production/database-tool.mjs','backup',database,destination],{cwd:release,encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);return destination}
const evidence={sourceUrl:'https://example.invalid/disposable-upgrade-fixture',sourceType:'isolated regression fixture',checkedAt:'2026-10-03',note:'Synthetic local data; never publish in catalog'};
let baseline,newWrites,oldGraph,newGraph,afterRollback;
try{
 await start(oldRelease);
 oldGraph=await api('/api/graph');assert(oldGraph.nodes.some(n=>n.id==='album_sunshower'));
 const claims=['approved','rejected','pending'].map(kind=>({entityId:'album_sunshower',field:kind==='approved'?'catalogNumber':'label',value:`${fixture}-${kind}`,...evidence}));
 const imported=await api('/api/review/import',{candidates:claims});assert.equal(imported.ids.length,3);
 await api('/api/review/'+imported.ids[0],{decision:'approve',expectedVersion:1,note:'Preserve this fictional user correction'});
 await api('/api/review/'+imported.ids[1],{decision:'reject',expectedVersion:1,note:'Preserve this fictional rejection'});
 const personId='fixture_person_'+fixture,labels={zh:'临时测试人物',en:'Temporary test person',ja:'一時テスト人物'};
 await api('/api/operations/import',{operations:[{kind:'entity',...evidence,node:{id:personId,type:'person',labels,description:labels}}]});
 let queue=await api('/api/operations'),row=queue.operations.find(o=>o.operation.node?.id===personId);assert(row);
 await api('/api/operations/'+row.id,{decision:'approve',expectedVersion:row.version,expectedEpoch:queue.epoch,graphToken:queue.graphToken,note:'Preserve this fictional structural edit'});
 // Online backup while the source server is running must include WAL writes.
 baseline=snapshot();const online=backup(oldRelease,'online-before-upgrade.sqlite');preserved(baseline,snapshot(online));
 await stop();
 await start(newRelease);
 newGraph=await api('/api/graph');assert.equal(newGraph.revision,JSON.parse(fs.readFileSync(path.join(newRelease,'data/catalog.json'))).revision);
 assert.equal(newGraph.nodes.find(n=>n.id==='album_sunshower').attributes.catalogNumber.value,claims[0].value);
 assert(newGraph.nodes.some(n=>n.id===personId));preserved(baseline,snapshot());
 for(const route of ['/api/review','/api/review/history','/api/operations','/api/operations/audit'])for(const method of ['GET','POST'])assert.equal((await fetch(publicOrigin+route,{method,headers:{Authorization:authorization,Origin:publicOrigin,'oai-authenticated-user-id':'fixture-owner','Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})})).status,403);
 // Writes made after upgrade must survive code-only rollback; restoring the
 // pre-upgrade database here would silently discard these and fail the test.
 const postUpgrade=await api('/api/review/import',{candidates:[{...claims[0],field:'label',value:fixture+'-written-after-upgrade'}]});
 await api('/api/review/'+postUpgrade.ids[0],{decision:'approve',expectedVersion:1,note:'Keep this newer correction through rollback'});
 newWrites=snapshot();assert(newWrites.review_events.length>baseline.review_events.length);
 await stop();backup(newRelease,'before-code-rollback.sqlite');
 await start(oldRelease);
 afterRollback=await api('/api/graph');assert.equal(afterRollback.revision,oldGraph.revision);
 assert.equal(afterRollback.nodes.find(n=>n.id==='album_sunshower').attributes.catalogNumber.value,claims[0].value);
 assert.equal(afterRollback.nodes.find(n=>n.id==='album_sunshower').attributes.label.value,fixture+'-written-after-upgrade');
 assert(afterRollback.nodes.some(n=>n.id===personId));preserved(newWrites,snapshot());
 await stop();
 // Re-upgrade, covering repeated imports/restarts as well as one-way migration.
 await start(newRelease);assert.equal((await api('/api/graph')).revision,newGraph.revision);preserved(newWrites,snapshot());await stop();
 console.log(JSON.stringify({passed:true,checks:['actual-old-release','same-schema migrations unchanged','real HTTP approvals/rejection/pending queue','structural edit and audit persistence','WAL-aware online backup','upgrade preserves user edits and audits','public read/write denial','code-only rollback preserves newer writes','re-upgrade preserves all prior audit rows'],oldEntities:oldGraph.nodes.length,newEntities:newGraph.nodes.length-1,retainedRows:Object.fromEntries(tables.map(table=>[table,newWrites[table].length]))}));
}finally{await stop();fs.rmSync(temp,{recursive:true,force:true})}
