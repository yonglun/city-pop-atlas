import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {openDatabase} from '../scripts/sqlite-adapter.mjs';
import {readCatalog} from '../server/storage.js';
import {importCandidates,decideCandidate,undoApproval} from '../server/review.js';
import assets,{assetURLs,editorialIndexJSON} from '../server/assets.generated.js';
import worker from '../dist/server/index.js';
import {publicGraph,articleIndex} from '../server/public-data.js';
const seed=JSON.parse(fs.readFileSync('data/catalog.json')),articles=JSON.parse(fs.readFileSync('public/articles.json'));
const origin='https://atlas.example.org',DB=openDatabase(),env={DB,PUBLIC_ORIGIN:origin,SEO_INDEXABLE:true,LINUX_AUTHENTICATED_ADMIN:false};
const call=(target,options={},settings=env)=>worker.fetch(new Request(origin+target,options),settings);
const privateKeys=['operationConflicts','candidates','review_events','approval_snapshots','operation_events'];
const compactResponse=await call('/api/graph?view=compact'),compactBody=await compactResponse.text(),compact=JSON.parse(compactBody);
const fullResponse=await call('/api/graph'),fullBody=await fullResponse.text(),full=JSON.parse(fullBody);
assert.equal(compactResponse.status,200);assert.equal(compact.view,'compact');assert.equal(compact.nodes.length,full.nodes.length);assert.equal(compact.edges.length,full.edges.length);
assert.deepEqual(compact.entityAliases,full.entityAliases);assert.deepEqual(full.articleIndex,compact.articleIndex,'Full refresh carries the same current metadata-only essay index');
for(const node of compact.nodes){assert(!('description'in node));assert(!('sources'in node));assert(!('media'in node));assert(!('serviceLinks'in node));assert(!('externalIds'in node));assert(Object.keys(node.attributes||{}).every(key=>key==='trackTitle'));}
for(const edge of compact.edges)assert.deepEqual(Object.keys(edge).sort(),['source','target','type']);
for(const article of compact.articleIndex){assert(!('sources'in article));assert(!('illustration'in article));assert(!('locales'in article));assert(!JSON.stringify(article).includes('paragraphs'));}
assert.deepEqual(compact.articleIndex,JSON.parse(editorialIndexJSON));
for(const key of privateKeys){assert(!(key in compact));assert(!(key in full));}
const {articleIndex:currentIndex,...legacyGraph}=full;
const previousBytes=Buffer.byteLength(JSON.stringify(legacyGraph))+fs.statSync('public/articles.json').size+fs.statSync('public/about.json').size;
assert(Buffer.byteLength(compactBody)<previousBytes*.10,'Homepage bootstrap must be at least 90% smaller');
assert.match(compactResponse.headers.get('cache-control'),/no-cache/);assert.doesNotMatch(compactResponse.headers.get('cache-control'),/max-age/);
const etag=compactResponse.headers.get('etag');assert(etag);
for(const match of [etag,'W/'+etag,'"nonmatching", '+etag,'*']){const response=await call('/api/graph?view=compact',{headers:{'If-None-Match':match}});assert.equal(response.status,304);assert.equal(await response.text(),'');assert.equal(response.headers.get('etag'),etag);}
assert.equal((await call('/api/graph?view=compact',{headers:{'If-None-Match':'"obsolete"'}})).status,200);

// A fresh catalog/source revision gets a whole new index, with removed entries
// absent and new article metadata included in both full and compact views.
const replacement=structuredClone(seed),removed=replacement.nodes.shift().id;replacement.revision+='-index-refresh';replacement.nodes.push({id:'artist_new_essay',type:'artist',labels:{en:'New essay'}});
const replacementArticles=articleIndex(articles).concat([{entityId:'artist_new_essay',kind:'essay'}]);
for(const compact of [false,true]){const current=publicGraph(replacement,replacementArticles,{compact});assert(!current.articleIndex.some(article=>article.entityId===removed));assert(current.articleIndex.some(article=>article.entityId==='artist_new_essay'));assert(current.articleIndex.every(article=>!article.locales));}

const id='person_tatsuro_yamashita',sourceArticle=articles.find(article=>article.entityId===id);
for(const lang of ['en','zh','ja']){
 const response=await call('/api/articles/'+id+'?lang='+lang),value=await response.json();assert.equal(response.status,200);assert.deepEqual(Object.keys(value.article.locales),[lang]);assert.deepEqual(value.article.locales[lang],sourceArticle.locales[lang]);assert.deepEqual(value.article.sources,sourceArticle.sources);assert.equal(value.revision,full.revision);assert.equal(value.epoch,full.epoch);
}
const contextual=articles.find(article=>article.canonicalEntityId&&articles.some(related=>related.entityId===article.canonicalEntityId));
if(contextual){const value=await (await call('/api/articles/'+contextual.entityId+'?lang=ja')).json(),related=articles.find(article=>article.entityId===contextual.canonicalEntityId);assert.deepEqual(value.relatedArticle,{entityId:related.entityId,locales:{ja:{title:related.locales.ja.title,dek:related.locales.ja.dek}}});}
for(const target of ['/api/articles/not-found','/api/articles/%','/api/entities/%','/api/entities/a%2Fb','/api/articles/constructor','/api/entities/__proto__'])assert.equal((await call(target)).status,404,target);
for(const query of ['lang=','lang=de','lang=en&lang=ja'])assert.equal((await call('/api/articles/'+id+'?'+query)).status,400);
const detail=await (await call('/api/entities/'+id)).json();assert.deepEqual(detail.entity,full.nodes.find(node=>node.id===id));assert.deepEqual(detail.properties,full.properties);
assert.deepEqual(detail.relationships,full.edges.filter(edge=>edge.source===id||edge.target===id));
for(const edge of detail.relationships)for(const related of [edge.source,edge.target].filter(value=>value!==id))assert.deepEqual(detail.relatedNodes.find(node=>node.id===related),full.nodes.find(node=>node.id===related));
const alias=Object.entries(full.entityAliases||{}).find(([,target])=>full.nodes.some(node=>node.id===target));
if(alias)assert.equal((await (await call('/api/entities/'+alias[0])).json()).entity.id,alias[1]);

const marker='PRIVATE-PERFORMANCE-REVIEW-NOTE',candidate={entityId:'album_sunshower',field:'catalogNumber',value:'PERFORMANCE-APPROVED-FIXTURE',sourceUrl:'https://example.org/performance',checkedAt:'2026-10-06',note:marker};
const catalog=await readCatalog(DB,seed),[candidateId]=await importCandidates(DB,[candidate],catalog);
assert.equal((await decideCandidate(DB,candidateId,{decision:'approve',expectedVersion:1,note:marker},catalog)).status,200);
const changedResponse=await call('/api/graph?view=compact',{headers:{'If-None-Match':etag}}),changedBody=await changedResponse.text(),changed=JSON.parse(changedBody);
assert.equal(changedResponse.status,200);assert(changed.epoch>compact.epoch);assert.notEqual(changedResponse.headers.get('etag'),etag);assert(!changedBody.includes(marker));assert(!changedBody.includes(candidateId));
const corrected=await (await call('/api/entities/'+candidate.entityId)).json();assert.equal(corrected.entity.attributes.catalogNumber.value,candidate.value);
const event=DB.sqlite.prepare("SELECT id FROM review_events WHERE candidate_id=? AND action='approve'").get(candidateId);
assert.equal((await undoApproval(DB,event.id,{expectedVersion:2,note:marker},await readCatalog(DB,seed))).status,200);
const undone=await call('/api/graph?view=compact',{headers:{'If-None-Match':changedResponse.headers.get('etag')}});assert.equal(undone.status,200);assert((await undone.json()).epoch>changed.epoch);

const home=await (await call('/')).text();
for(const original of ['/style.css','/bootstrap.js','/routes.js','/analytics.js'])assert(home.includes(assetURLs[original]),original+' versioned in root HTML');
const seoHTML=await (await call('/en/artists/person-tatsuro-yamashita')).text();
for(const original of ['/routes.js','/analytics.js'])assert(seoHTML.includes(assetURLs[original]),original+' versioned in server-rendered HTML');
assert(assets[assetURLs['/bootstrap.js']].body.includes(assetURLs['/app.js']),'Dynamic app script and preload use content version');
for(const [original,versioned]of Object.entries(assetURLs)){
 const first=await call(versioned),body=Buffer.from(await first.arrayBuffer()),expected=assets[versioned].body;
 assert.equal(assets[original].body,fs.readFileSync('public'+original,'utf8'),'Legacy source bytes unchanged');
 assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/max-age=31536000, immutable/);
 assert.equal(body.toString(),expected);assert.equal(first.headers.get('etag'),'"sha256-'+createHash('sha256').update(body).digest('hex')+'"');
 assert.equal((await call(versioned,{headers:{'If-None-Match':first.headers.get('etag')}})).status,304);
 const head=await call(versioned,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),first.headers.get('etag'));
 const alias=await call(original);assert.match(alias.headers.get('cache-control'),/no-cache/);assert.doesNotMatch(alias.headers.get('cache-control'),/immutable/);
}
for(const settings of [{...env,SEO_INDEXABLE:false},{...env,LINUX_AUTHENTICATED_ADMIN:true},{...env,SITE_REVIEW_MODE:'owner-private'}]){
 for(const target of ['/api/graph?view=compact','/api/graph','/api/entities/'+id,'/api/articles/'+id+'?lang=en',assetURLs['/app.js'],'/app.js','/articles.json']){
  const response=await call(target,{headers:{'If-None-Match':'*'}},settings);assert.equal(response.status,200,target);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('etag'),null);assert.match(response.headers.get('x-robots-tag'),/noindex/);
 }
}
assert.equal((await call('/assets/app.00000000000000000000.js')).status,404,'Unknown content hashes never return newer bytes');

// Build an isolated synthetic source tree twice. Changing a leaf changes its
// caller and HTML references; unchanged assets retain URLs. No real source edit.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-assets-'));
try{
 fs.mkdirSync(path.join(temporary,'public'));fs.mkdirSync(path.join(temporary,'server'));fs.mkdirSync(path.join(temporary,'drizzle')); // Site builds also package the unchanged migration directory.
 for(const [name,body]of Object.entries({'index.html':'<link href="/style.css?v=old"><script src="/bootstrap.js?v=old"></script>','style.css':'body{color:green}','app.js':'globalThis.version=1;','bootstrap.js':'const APP="/app.js?v=old";globalThis.appURL=APP;','articles.json':'[]'}))fs.writeFileSync(path.join(temporary,'public',name),body);
 fs.writeFileSync(path.join(temporary,'server/worker.js'),"export {default} from './assets.generated.js';");
 const buildScript=fileURLToPath(new URL('../scripts/build.mjs',import.meta.url));
 const build=()=>{const result=spawnSync(process.execPath,[buildScript],{cwd:temporary,encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
 build();const initial=await import(pathToFileURL(path.join(temporary,'server/assets.generated.js'))+'?first');
 fs.writeFileSync(path.join(temporary,'public/app.js'),'globalThis.version=2;');build();
 const update=await import(pathToFileURL(path.join(temporary,'server/assets.generated.js'))+'?second');
 assert.notEqual(initial.assetURLs['/app.js'],update.assetURLs['/app.js']);assert.notEqual(initial.assetURLs['/bootstrap.js'],update.assetURLs['/bootstrap.js']);assert.equal(initial.assetURLs['/style.css'],update.assetURLs['/style.css']);
 assert.equal(update.default['/index.html'].body,fs.readFileSync(path.join(temporary,'public/index.html'),'utf8'));assert(update.default[update.assetURLs['/bootstrap.js']].body.includes(update.assetURLs['/app.js']));assert.equal(update.default['/bootstrap.js'].body,fs.readFileSync(path.join(temporary,'public/bootstrap.js'),'utf8'));assert(!update.default[initial.assetURLs['/app.js']]);
}finally{fs.rmSync(temporary,{recursive:true,force:true});DB.sqlite.close();}
console.log(JSON.stringify({passed:true,suite:'public-performance',legacyBootstrapBytes:previousBytes,compactBytes:Buffer.byteLength(compactBody),compactGzipBytes:gzipSync(compactBody).length,checks:['lean graph','complete single-language editorial','complete related entity details','epoch approval/undo validators','malformed and alias IDs','private/admin no-store','versioned static and conditional HEAD','source-change content hash invalidation']}));
