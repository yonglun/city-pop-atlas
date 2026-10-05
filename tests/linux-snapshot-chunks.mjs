// Production SQLite adapter checks. Uses one disposable synthetic local DB;
// never opens deployed data or an environment/credential file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openDatabase} from '../production/sqlite.mjs';
import {seedCatalog,readCatalog} from '../server/storage.js';
import {SNAPSHOT_JSON_LIMIT} from '../server/snapshot-json.js';
import {importCandidates,decideCandidate} from '../server/review.js';

const root=new URL('../',import.meta.url);
const seed=JSON.parse(fs.readFileSync(new URL('data/catalog.json',root)));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-linux-chunks-'));
const db=openDatabase(path.join(temporary,'synthetic.sqlite'));
const baseBatch=db.batch.bind(db),imports=[];
let maxParameterBytes=0;
db.batch=async statements=>{
 for(const statement of statements)for(const value of statement.args)if(typeof value==='string'){
  const size=Buffer.byteLength(value);maxParameterBytes=Math.max(maxParameterBytes,size);
  assert(size<=SNAPSHOT_JSON_LIMIT,'Every import parameter must fit the safe UTF-8 bound');
 }
 if(statements.some(statement=>statement.sql==='DELETE FROM entities'))imports.push(statements);
 return baseBatch(statements);
};
const tables=['entities','relationships','media','external_links','property_definitions','imports','catalog_state','attribute_overrides','candidates','review_events','approval_snapshots','catalog_operations','operation_events','_linux_migrations'];
const snapshot=()=>Object.fromEntries(tables.map(table=>[table,db.sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
try{
 const graph=await readCatalog(db,seed);
 assert.equal(graph.nodes.length,seed.nodes.length);assert.equal(graph.edges.length,seed.edges.length);
 assert.equal(imports.length,1);assert(imports[0].length<=32);
 assert(imports[0].filter(statement=>statement.sql.startsWith('INSERT INTO entities')).length>=2,'Expanded release must exercise multiple entity chunks');
 const candidate={entityId:'album_sunshower',field:'catalogNumber',value:'SYNTHETIC-CHUNK-OVERLAY',sourceUrl:'https://example.invalid/atomic-chunk-fixture',sourceType:'isolated regression fixture',checkedAt:'2026-10-05',note:'Never publish this synthetic correction'};
 const [id]=await importCandidates(db,[candidate],graph);
 assert.equal((await decideCandidate(db,id,{decision:'approve',expectedVersion:1,note:'Keep user history through failed seed replacement'},graph)).status,200);
 const before=snapshot();
 await readCatalog(db,seed);assert.equal(imports.length,1);assert.deepEqual(snapshot(),before,'Same revision must be fully idempotent');
 const duplicate=structuredClone(seed);duplicate.revision='synthetic-later-chunk-failure';duplicate.nodes.push(structuredClone(seed.nodes[0]));
 await assert.rejects(()=>seedCatalog(db,duplicate),/UNIQUE/);
 assert.equal(imports.length,2);assert(imports[1].filter(statement=>statement.sql.startsWith('INSERT INTO entities')).length>=2);
 assert.deepEqual(snapshot(),before,'A later-chunk error rolls back deletes, earlier chunks, revision, epoch and all user history');
 const oversized=structuredClone(seed);oversized.revision='synthetic-oversized-row';oversized.nodes[0].extra='界'.repeat(600000);
 await assert.rejects(()=>seedCatalog(db,oversized),/row exceeds/);assert.equal(imports.length,2);assert.deepEqual(snapshot(),before);
 // 26 rows of >900 kB each require 26 separate chunks. With control and
 // definition statements this exceeds the 32-query budget, while no row itself
 // exceeds the parameter limit. Rejection must happen before executing DELETE.
 const budget={...seed,revision:'synthetic-query-budget',nodes:Array.from({length:26},(_,i)=>({id:'synthetic_budget_'+i,type:'person',extra:'x'.repeat(900000)})),edges:[]};
 await assert.rejects(()=>seedCatalog(db,budget),/safe atomic import query budget/);assert.equal(imports.length,2);assert.deepEqual(snapshot(),before);
 assert.equal(db.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 // Also exercise a successful replacement and confirm editorial state survives.
 const newer={...seed,revision:seed.revision+'-synthetic-reseed'};
 await seedCatalog(db,newer);assert.equal(imports.length,3);
 const after=snapshot();
 for(const table of ['attribute_overrides','candidates','review_events','approval_snapshots','catalog_operations','operation_events','_linux_migrations'])assert.deepEqual(after[table],before[table],table+' must survive successful snapshot replacement');
 assert.equal(after.catalog_state[0].epoch,before.catalog_state[0].epoch+1);
 assert.equal((await readCatalog(db,newer)).nodes.find(node=>node.id===candidate.entityId).attributes.catalogNumber.value,candidate.value);
 console.log(JSON.stringify({passed:true,adapter:'production/sqlite.mjs',entities:seed.nodes.length,atomicStatements:imports[0].length,entityChunks:imports[0].filter(statement=>statement.sql.startsWith('INSERT INTO entities')).length,maxParameterBytes,checks:['real expanded snapshot','safe UTF-8 bound','same-revision idempotency','later-chunk failure full rollback','oversized-row rejection before delete','query-budget rejection before delete','editorial data survives successful reseed','SQLite integrity and foreign keys']}));
}finally{db.close();fs.rmSync(temporary,{recursive:true,force:true})}
