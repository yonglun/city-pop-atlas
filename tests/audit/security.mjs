// Linux unit-fixture adapter: fixture identity presence models the trusted listener auth result. HTTP security is tested separately in deployment.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url).pathname.replace(/\/$/,'');process.chdir(root);
const {openDatabase}=await import(root+'/scripts/sqlite-adapter.mjs');
const {default:worker}=await import(root+'/dist/server/index.js');
const {readCatalog}=await import(root+'/server/storage.js');
const {validateCandidate,mutationGuard,readBody}=await import(root+'/server/review.js');
const seed=JSON.parse(fs.readFileSync('data/catalog.json')); const DB=openDatabase();await readCatalog(DB,seed);
const env={DB,LINUX_AUTHENTICATED_ADMIN:true,SITE_REVIEW_ORIGIN:'https://review.test'};
const good={'Content-Type':'application/json',Origin:'https://review.test','oai-authenticated-user-id':'fixture','Sec-Fetch-Site':'same-origin'};
const row={entityId:'album_sunshower',field:'catalogNumber',value:'audit fixture',sourceUrl:'https://example.org/audit',checkedAt:'2026-10-02'};
let count=0;
for(const path of ['/api/review/import','/api/review/preview','/api/operations/import','/api/operations/preview']){
 for(const headers of [{...good,Origin:'null'},{...good,Origin:'https://review.test.attacker.test'},{...good,Origin:'https://review.test/'},{...good,'Sec-Fetch-Site':'cross-site'},{...good,'oai-authenticated-user-id':''}]){
  const r=await worker.fetch(new Request('https://review.test'+path,{method:'POST',headers,body:JSON.stringify({candidates:[row],operations:[]})}),{...env,LINUX_AUTHENTICATED_ADMIN:!!headers['oai-authenticated-user-id']});
  assert([403,405].includes(r.status),`${path} unsafe response ${r.status}`);count++;
 }
}
assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM candidates').get().n,0);
for(const method of ['PUT','PATCH','DELETE','OPTIONS']){
 const r=await worker.fetch(new Request('https://review.test/api/review/import',{method,headers:good,body:'{}'}),env);assert.equal(r.status,405);count++;
}
for(const field of ['__proto__','constructor','prototype','toString'])assert.throws(()=>validateCandidate({...row,field},seed));
for(const sourceUrl of ['javascript:alert(1)','http://example.org','https://user:pass@example.org','data:text/html,ok'])assert.throws(()=>validateCandidate({...row,sourceUrl},seed));
for(const value of [null,{},Infinity,Array(31).fill('x'),'x'.repeat(1001)])assert.throws(()=>validateCandidate({...row,value},seed));
for(const value of ['2026-02-29','2026-04-31','2026-00','0000-01-01'])assert.throws(()=>validateCandidate({...row,field:'releaseDate',value},seed));
const req=new Request('https://review.test/api/review/preview',{method:'POST',headers:good,body:JSON.stringify({candidates:[row],padding:'界'.repeat(22000)})});
const response=await worker.fetch(req,env);assert.equal(response.status,400);assert.equal((await response.json()).error,'body_too_large');
const graph=await worker.fetch(new Request('https://review.test/api/graph'),env);assert.equal(graph.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(graph.headers.get('Cache-Control'),'no-store');
assert.equal((await worker.fetch(new Request('https://review.test/api/graph',{method:'POST',headers:good,body:'{}'}),env)).status,405);
DB.sqlite.close();console.log(`PASS independent security audit: ${count} cross-origin/identity/method cases, field/provenance/date/value bounds, UTF-8 byte limit, response headers, read-only graph`);
