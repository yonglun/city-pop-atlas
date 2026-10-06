// Real local HTTP/SQLite upgrade drill. Supply an independently verified old
// release directory: node tests/linux-upgrade.mjs /path/to/old-release
// Only temporary synthetic data is written. No Docker or deployed DB is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import '../public/routes.js';
import {spawn,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as sleep} from 'node:timers/promises';

if(process.argv.length!==3)throw Error('Usage: node tests/linux-upgrade.mjs VERIFIED_OLD_RELEASE_DIRECTORY');
const oldRelease=path.resolve(process.argv[2]);
const newRelease=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
for(const release of [oldRelease,newRelease]){
 for(const file of ['production/server.mjs','dist/server/index.js','release.json'])assert(fs.statSync(path.join(release,file)).isFile(),file);
 assert(!fs.existsSync(path.join(release,'.env')),'Run this isolated drill in a source checkout without an operator .env');
}
const oldMeta=JSON.parse(fs.readFileSync(path.join(oldRelease,'release.json'))),newMeta=JSON.parse(fs.readFileSync(path.join(newRelease,'release.json')));
const oldSeed=JSON.parse(fs.readFileSync(path.join(oldRelease,'data/catalog.json'))),newSeed=JSON.parse(fs.readFileSync(path.join(newRelease,'data/catalog.json')));
assert.notEqual(oldMeta.version,newMeta.version,'Distinct same-day releases must have distinct full version IDs');
// SEO/code-only releases may intentionally preserve the catalogue revision.
// A reused revision is safe only if the entire seed payload is unchanged.
if(oldSeed.revision===newSeed.revision)assert.deepEqual(newSeed,oldSeed,'A changed catalogue must have a distinct revision');
assert.equal(oldMeta.schemaVersion,newMeta.schemaVersion,'This drill covers a same-schema code-only rollback');
const migrations=release=>fs.readdirSync(path.join(release,'drizzle')).filter(name=>name.endsWith('.sql')).sort();
assert.deepEqual(migrations(oldRelease),migrations(newRelease),'Code-only rollback requires the exact same migration set');
for(const name of migrations(oldRelease))assert.deepEqual(fs.readFileSync(path.join(oldRelease,'drizzle',name)),fs.readFileSync(path.join(newRelease,'drizzle',name)),`Changed historical migration: ${name}`);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-upgrade-test-'));
const database=path.join(temp,'catalog.sqlite'),passwordFile=path.join(temp,'password');
const password=randomBytes(32).toString('hex'),fixture=randomBytes(12).toString('hex');
fs.writeFileSync(passwordFile,password,{mode:0o600});
const authorization='Basic '+Buffer.from('citypop:'+password).toString('base64');
async function unusedPort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
const publicPort=await unusedPort();let adminPort;do{adminPort=await unusedPort()}while(adminPort===publicPort);
const publicOrigin='https://upgrade.example.org',adminOrigin=`http://127.0.0.1:${adminPort}`;
// Canonicals use a synthetic HTTPS origin, but every request is sent directly
// to our isolated loopback listener. No DNS lookup or external request occurs.
async function request(input,options={}){
 const url=new URL(input);assert([publicOrigin,adminOrigin].includes(url.origin),'Only fixture origins are permitted');
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:url.origin===publicOrigin?publicPort:adminPort,path:url.pathname+url.search,method:options.method||'GET',headers:{Host:url.host,...(options.body?{'Content-Length':Buffer.byteLength(options.body)}:{}),...options.headers}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(options.method==='HEAD'?null:Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
  });req.on('error',reject);req.setTimeout(15000,()=>req.destroy(Error('Isolated HTTP request timeout')));req.end(options.body);
 });
}
// Do not pass private caller environment variables to the synthetic server.
const runtimeEnv={PATH:process.env.PATH,TZ:'UTC',PUBLIC_ORIGIN:publicOrigin,ADMIN_ORIGIN:adminOrigin,PORT:String(publicPort),ADMIN_PORT:String(adminPort),BIND_ADDRESS:'127.0.0.1',DATABASE_PATH:database,ADMIN_ENABLED:'true',ADMIN_PASSWORD_FILE:passwordFile,GA_MEASUREMENT_ID:'G-UPGRADE1234',CLARITY_PROJECT_ID:'upgrade1234'};
// Exercise Node's real .env loader using an operator-owned file. Mixed line
// endings, unknown options and the absence of a final LF must remain intact.
const environmentFile=path.join(temp,'.env');
const environmentBytes=Buffer.from('# synthetic operator settings; preserve every byte\r\n'+Object.entries(runtimeEnv).filter(([key])=>key!=='PATH').map(([key,value])=>key+'='+value).join('\n')+'\r\nCUSTOM_OPTION=" keep whitespace # literally "\n# 保留する\r\nUNRECOGNIZED_FUTURE_OPTION=unchanged');
fs.writeFileSync(environmentFile,environmentBytes,{mode:0o600});
function assertEnvironment(){assert.deepEqual(fs.readFileSync(environmentFile),environmentBytes,'Operator .env changed');assert.equal(fs.statSync(environmentFile).mode&0o777,0o600)}
let child,logs='',activeRelease;
async function stop(){assertEnvironment();if(!child||child.exitCode!==null)return;const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await closed;assert.equal(child.exitCode,0,logs)}
async function start(release){
 assertEnvironment();activeRelease=release;logs='';child=spawn(process.execPath,[path.join(release,'production/server.mjs')],{cwd:temp,env:{PATH:process.env.PATH,TZ:'UTC'}});
 child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);try{if((await request(publicOrigin+'/healthz')).ok&&(await request(adminOrigin+'/',{headers:{Authorization:authorization}})).ok)return}catch{}await sleep(50)}
 throw Error('Server start timeout: '+logs);
}
async function api(route,body){
 const response=await request(adminOrigin+route,{method:body?'POST':'GET',headers:{Authorization:authorization,...(body?{Origin:adminOrigin,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const json=await response.json();assert.equal(response.status,200,route+': '+JSON.stringify(json));return json;
}
const tables=['attribute_overrides','candidates','review_events','approval_snapshots','catalog_operations','operation_events'];
function snapshot(file=database){const db=new DatabaseSync(file,{readOnly:true});try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);return Object.fromEntries([...tables,'imports'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]))}finally{db.close()}}
function preserved(before,after){for(const table of [...tables,'imports'])for(const row of before[table]){const key=table==='approval_snapshots'?'event_id':'id';assert.deepEqual(after[table].find(other=>other[key]===row[key]),row,`Lost/changed ${table} ${row[key]}`)}}
function backup(release,name){const destination=path.join(temp,name);const result=spawnSync(process.execPath,['production/database-tool.mjs','backup',database,destination],{cwd:release,env:{PATH:process.env.PATH},encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);return destination}
const evidence={sourceUrl:'https://example.invalid/disposable-upgrade-fixture',sourceType:'isolated regression fixture',checkedAt:'2026-10-06',note:'Synthetic local data; never publish in catalog'};
const labels={zh:'临时测试人物',en:'Temporary test person',ja:'一時テスト人物'};
async function addPerson(id){const operation={kind:'entity',...evidence,node:{id,type:'person',labels,description:labels}};const preview=await api('/api/operations/preview',{operations:[operation]});assert.equal(preview.valid,true);await api('/api/operations/import',{operations:[operation]});return preview.rows[0].id}
async function decideOperation(id,undo=false){const queue=await api('/api/operations'),row=queue.operations.find(row=>row.id===id);assert(row);return api('/api/operations/'+id+(undo?'/undo':''),{decision:'approve',expectedVersion:row.version,expectedEpoch:queue.epoch,graphToken:queue.graphToken,note:undo?'Remove synthetic entity but keep history':'Approve synthetic structural fixture'})}
const removedPeople=[],removedOverrides=[];
async function createRemovalFixtures(suffix){
 const personId='fixture_removed_'+suffix+'_'+fixture,operationId=await addPerson(personId);
 await decideOperation(operationId);assert((await api('/api/graph')).nodes.some(node=>node.id===personId));
 await decideOperation(operationId,true);removedPeople.push({personId,operationId});
 // Approval undo physically deletes this override row while preserving both
 // immutable approval and undo history. This is the supported deletion path.
 const entityId='album_sunshower',field='releaseDate';
 const imported=await api('/api/review/import',{candidates:[{entityId,field,value:suffix==='before'?'2090-01-01':'2091-01-01',...evidence}]});
 await api('/api/review/'+imported.ids[0],{decision:'approve',expectedVersion:1,note:'Temporary correction, then remove its overlay'});
 const review=await api('/api/review'),candidate=review.candidates.find(row=>row.id===imported.ids[0]);assert(candidate.correction.canUndo);
 const eventId=candidate.correction.eventId;
 const undone=await api('/api/review/undo/'+eventId,{expectedVersion:candidate.version,note:'Delete temporary overlay; retain approval and undo history'});
 removedOverrides.push({id:entityId+':'+field,candidateId:candidate.id,eventId,undoEventId:undone.undoEventId});
}
function assertRemoved(graph,rows){
 for(const {personId,operationId} of removedPeople){assert(!graph.nodes.some(node=>node.id===personId),'Removed entity must not resurrect');assert.equal(rows.catalog_operations.find(row=>row.id===operationId).status,'pending');assert.deepEqual(rows.operation_events.filter(row=>row.operation_id===operationId).map(row=>row.action),['approve','undo'])}
 for(const {id,candidateId,eventId,undoEventId} of removedOverrides){assert(!rows.attribute_overrides.some(row=>row.id===id),'Deleted override must not resurrect');assert.equal(rows.approval_snapshots.find(row=>row.event_id===eventId).reverted_by,undoEventId);assert.deepEqual(rows.review_events.filter(row=>row.candidate_id===candidateId).map(row=>row.action),['approve','undo'])}
}
let publicDenials=0,csrfDenials=0;
async function securityBoundary(){
 const before=snapshot(),candidate='candidate_'+'a'.repeat(64),operation='operation_'+'a'.repeat(64),event='a'.repeat(8)+'-'+['a'.repeat(4),'a'.repeat(4),'a'.repeat(4),'a'.repeat(12)].join('-');
 const routes=['/api/review','/api/review/preview','/api/review/import','/api/review/history','/api/review/audit','/api/review/unknown','/api/review/'+candidate,'/api/review/undo/'+event,'/api/operations','/api/operations/preview','/api/operations/import','/api/operations/audit','/api/operations/unknown','/api/operations/'+operation,'/api/operations/'+operation+'/undo'];
 for(const route of routes)for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']){
  const response=await request(publicOrigin+route,{method,headers:{Authorization:authorization,Origin:publicOrigin,'oai-authenticated-user-id':'fixture-owner','x-linux-authenticated-admin':'true','x-admin':'true','Content-Type':'application/json'},...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})});
  assert.equal(response.status,403,method+' '+route);assert.equal(response.headers.get('Cache-Control'),'no-store');if(activeRelease===newRelease)assert.match(response.headers.get('X-Robots-Tag')||'',/noindex/);publicDenials++;
 }
 for(const port of [publicPort,adminPort])assert.equal(await new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port,path:'/',headers:{Host:'untrusted.invalid',Authorization:authorization}},response=>{response.resume();resolve(response.statusCode)}).on('error',reject)),421);
 for(const auth of ['', 'Basic '+Buffer.from('citypop:'+randomBytes(32).toString('hex')).toString('base64')])assert.equal((await request(adminOrigin+'/api/review',{headers:{Authorization:auth}})).status,401);
 assert.deepEqual(await api('/api/public-config'),{gaMeasurementId:'',clarityProjectId:'',blocked:true},'Admin tracking must remain blocked even when IDs are configured');
 assert.deepEqual(await(await request(publicOrigin+'/api/public-config')).json(),{gaMeasurementId:'G-UPGRADE1234',clarityProjectId:'upgrade1234',blocked:false});
 for(const headers of [{DNT:'1'},{'Sec-GPC':'1'}])assert.deepEqual(await(await request(publicOrigin+'/api/public-config',{headers})).json(),{gaMeasurementId:'',clarityProjectId:'',blocked:true});
 for(const route of routes.filter(route=>/\/(preview|import)$/.test(route)||route.includes(candidate)||route.includes(operation)||route.includes('/undo/'))){
  for(const extra of [{},{Origin:'null'},{Origin:'https://untrusted.invalid'},{Origin:adminOrigin,'Sec-Fetch-Site':'cross-site'}]){
   const response=await request(adminOrigin+route,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json',...extra},body:'{}'});assert.equal(response.status,403,route);csrfDenials++;
  }
  assert.equal((await request(adminOrigin+route,{method:'POST',headers:{Authorization:authorization,Origin:adminOrigin,'Content-Type':'text/plain'},body:'{}'})).status,415);
 }
 assert.deepEqual(snapshot(),before,'Rejected requests must not alter any editorial rows');
}
let seoChecks=0;
async function seoBoundary(graph,privateValues){
 const R=globalThis.CityPopRoutes;
 const noindex=(response,label)=>{assert.match(response.headers.get('X-Robots-Tag')||'',/^noindex/,label);seoChecks++};
 for(const lang of R.languages){
  const from=R.pathFor({id:mergeFrom,type:'person'},lang),to=R.pathFor(graph.nodes.find(node=>node.id===mergeInto),lang);
  for(const method of ['GET','HEAD']){
   const redirected=await request(publicOrigin+from,{method});assert.equal(redirected.status,308);assert.equal(redirected.headers.get('Location'),to);noindex(redirected,'merged alias redirect');assert.equal(await redirected.text(),'');seoChecks++;
  }
  const response=await request(publicOrigin+to),html=await response.text();assert.equal(response.status,200);assert(html.includes('<link rel="canonical" href="'+publicOrigin+to+'">'));noindex(response,'synthetic entry without essay');assert(!html.includes(mergeFrom));seoChecks++;
  const albumPath=R.pathFor(graph.nodes.find(node=>node.id==='album_sunshower'),lang),page=await request(publicOrigin+albumPath),body=await page.text();
  assert.equal(page.status,200);assert.match(page.headers.get('X-Robots-Tag'),/^index,/);assert(body.includes(graph.nodes.find(node=>node.id==='album_sunshower').attributes.catalogNumber.value));
  if(graph.nodes.find(node=>node.id==='album_sunshower').attributes.label?.value===fixture+'-written-after-upgrade')assert(body.includes(fixture+'-written-after-upgrade'),'Fresh post-upgrade correction must still render after rollback/re-upgrade');
  for(const value of privateValues)assert(!body.includes(value),'Pending/rejected editorial state leaked to public SEO');seoChecks++;
  const queried=await request(publicOrigin+albumPath+'?q=fixture-private-query');noindex(queried,'query-bearing SEO');assert((await queried.text()).includes('<link rel="canonical" href="'+publicOrigin+albumPath+'">'));seoChecks++;
 }
 const sitemap=await request(publicOrigin+'/sitemap.xml'),xml=await sitemap.text();assert.equal(sitemap.status,200);assert(xml.includes(publicOrigin+'/en/'));assert(!xml.includes('127.0.0.1'));assert(!xml.includes(mergeFrom));for(const value of privateValues)assert(!xml.includes(value));seoChecks++;
 for(const {personId}of removedPeople){const removed=await request(publicOrigin+R.pathFor({id:personId,type:'person'}));assert.equal(removed.status,404);noindex(removed,'removed entity');}
 for(const route of ['/.env','/secrets/admin-password','/runtime/catalog.sqlite','/data/candidates.json','/data/operations.json']){const denied=await request(publicOrigin+route);assert.equal(denied.status,404);noindex(denied,'private file');}
 for(const route of ['/','/en/','/api/review','/api/operations','/api/public-config']){
  const denied=await request(adminOrigin+route);assert.equal(denied.status,401);noindex(denied,'unauthenticated admin');
  const response=await request(adminOrigin+route,{headers:{Authorization:authorization}});assert.equal(response.status,200);noindex(response,'authenticated admin');assert.equal(response.headers.get('Cache-Control'),'no-store');
  if(route==='/en/'){const html=await response.text();assert(!html.includes('rel="canonical"'));assert(!html.includes('G-UPGRADE1234'));assert(!html.includes('upgrade1234'));seoChecks++;}
 }
 const robots=await request(adminOrigin+'/robots.txt',{headers:{Authorization:authorization}});noindex(robots,'admin robots');const robotsText=await robots.text();assert.match(robotsText,/Disallow: \//);assert(!robotsText.includes('Sitemap:'));seoChecks++;
 const blocked=await request(adminOrigin+'/sitemap.xml',{headers:{Authorization:authorization}});assert.equal(blocked.status,404);noindex(blocked,'admin sitemap');assertEnvironment();
}
let baseline,newWrites,oldGraph,newGraph,afterRollback;
const personId='fixture_person_'+fixture,mergeFrom='fixture_merge_from_'+fixture,mergeInto='fixture_merge_into_'+fixture;
function assertMerged(graph){assert(!graph.nodes.some(node=>node.id===mergeFrom));assert(graph.nodes.some(node=>node.id===mergeInto));assert.equal(graph.entityAliases[mergeFrom],mergeInto);assert(graph.nodes.find(node=>node.id===mergeInto).mergedRecords.some(node=>node.id===mergeFrom))}
try{
 await start(oldRelease);
 oldGraph=await api('/api/graph');assert.equal(oldGraph.revision,oldSeed.revision);assert(oldGraph.nodes.some(node=>node.id==='album_sunshower'));
 const claims=['approved','rejected','pending'].map(kind=>({entityId:'album_sunshower',field:kind==='approved'?'catalogNumber':'label',value:`${fixture}-${kind}`,...evidence}));
 const imported=await api('/api/review/import',{candidates:claims});assert.equal(imported.ids.length,3);
 await api('/api/review/'+imported.ids[0],{decision:'approve',expectedVersion:1,note:'Preserve this fictional user correction'});
 await api('/api/review/'+imported.ids[1],{decision:'reject',expectedVersion:1,note:'Preserve this fictional rejection'});
 await decideOperation(await addPerson(personId));
 await createRemovalFixtures('before');
 // Merge is a second supported entity-removal path. Its alias and complete
 // original record must survive reseeding, in addition to operation history.
 await decideOperation(await addPerson(mergeFrom));await decideOperation(await addPerson(mergeInto));
 const merge={kind:'merge',...evidence,fromId:mergeFrom,intoId:mergeInto,confirmSameIdentity:true};
 const preview=await api('/api/operations/preview',{operations:[merge]});await api('/api/operations/import',{operations:[merge]});await decideOperation(preview.rows[0].id);
 assertMerged(await api('/api/graph'));
 baseline=snapshot();assertRemoved(await api('/api/graph'),baseline);await securityBoundary();
 // An online backup must include committed WAL writes, including removal history.
 const online=backup(oldRelease,'online-before-upgrade.sqlite');assert.deepEqual(snapshot(online),baseline);
 await stop();await start(newRelease);
 newGraph=await api('/api/graph');assert.equal(newGraph.revision,newSeed.revision);
 assert.equal(newGraph.nodes.find(node=>node.id==='album_sunshower').attributes.catalogNumber.value,claims[0].value);
 assert(newGraph.nodes.some(node=>node.id===personId));preserved(baseline,snapshot());assertRemoved(newGraph,snapshot());assertMerged(newGraph);await securityBoundary();await seoBoundary(newGraph,[claims[1].value,claims[2].value,...imported.ids]);
 // New approvals and removals must survive code-only rollback. Restoring the
 // pre-upgrade database would discard these and fail the exact row comparisons.
 const postUpgrade=await api('/api/review/import',{candidates:[{...claims[0],field:'label',value:fixture+'-written-after-upgrade'}]});
 await api('/api/review/'+postUpgrade.ids[0],{decision:'approve',expectedVersion:1,note:'Keep this newer correction through rollback'});
 await createRemovalFixtures('after');newWrites=snapshot();assert(newWrites.review_events.length>baseline.review_events.length);
 assertRemoved(await api('/api/graph'),newWrites);
 await stop();assert.deepEqual(snapshot(backup(newRelease,'before-code-rollback.sqlite')),newWrites);
 await start(oldRelease);
 afterRollback=await api('/api/graph');assert.equal(afterRollback.revision,oldGraph.revision);
 assert.equal(afterRollback.nodes.find(node=>node.id==='album_sunshower').attributes.catalogNumber.value,claims[0].value);
 assert.equal(afterRollback.nodes.find(node=>node.id==='album_sunshower').attributes.label.value,fixture+'-written-after-upgrade');
 assert(afterRollback.nodes.some(node=>node.id===personId));preserved(newWrites,snapshot());assertRemoved(afterRollback,snapshot());assertMerged(afterRollback);await securityBoundary();
 await stop();await start(newRelease);
 const reupgraded=await api('/api/graph');assert.equal(reupgraded.revision,newGraph.revision);preserved(newWrites,snapshot());assertRemoved(reupgraded,snapshot());assertMerged(reupgraded);await securityBoundary();await seoBoundary(reupgraded,[claims[1].value,claims[2].value,...imported.ids]);
 await stop();
 console.log(JSON.stringify({passed:true,oldVersion:oldMeta.version,newVersion:newMeta.version,sameDay:oldMeta.version.slice(0,8)===newMeta.version.slice(0,8),oldRevision:oldSeed.revision,newRevision:newSeed.revision,checks:['actual-old-release','exact same-schema migration set and bytes','real HTTP approvals/rejection/pending queue','structural edit and audit persistence','override deletion and entity undo history persistence','merged entity removal and alias preservation','WAL-aware online backup','upgrade preserves user edits and audits','existing source import history preserved through upgrade rollback and re-upgrade','all public review/operations route-method denials','Basic Auth Host Origin Fetch-Site and JSON boundary','admin tracking and privacy-signal suppression','code-only rollback preserves newer writes and removals','re-upgrade preserves every prior audit row and removal','unchanged catalogue revision allowed only for identical seed data','operator .env bytes/mode preserved through every runtime transition','merged alias multilingual canonical redirects survive upgrade and re-upgrade','public SEO excludes private pending/rejected state and removed entities','admin/private endpoints noindex and no sitemap leakage'],publicDenials,csrfDenials,seoChecks,catalogRevisionChanged:oldSeed.revision!==newSeed.revision,environmentSHA256:createHash('sha256').update(environmentBytes).digest('hex'),oldEntities:oldSeed.nodes.length,newEntities:newSeed.nodes.length,sourceImportRowsAfterReupgrade:snapshot().imports.length,retainedRows:Object.fromEntries(tables.map(table=>[table,newWrites[table].length]))}));
}finally{await stop();fs.rmSync(temp,{recursive:true,force:true})}
