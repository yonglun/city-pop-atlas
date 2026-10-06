// Independent, network-free crawler and security acceptance. Public seed data
// and an isolated temporary SQLite database are the only inputs. No user DB,
// credential, live account, analytics endpoint, or external URL is accessed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {openDatabase} from '../production/sqlite.mjs';
import {readCatalog,seedCatalog} from '../server/storage.js';
import {importCandidates,decideCandidate,undoApproval} from '../server/review.js';
import {previewOperations,importOperations,decideOperation,graphToken} from '../server/operations.js';
import {serveSEO,publicOrigin} from '../server/seo.js';
import worker from '../dist/server/index.js';

const root=new URL('../',import.meta.url),read=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const seed=read('data/catalog.json'),articles=read('public/articles.json'),about=read('public/about.json');
const assetKeys=Object.fromEntries([...articles.map(article=>article.illustration?.src),...(about.photos||[]).map(photo=>photo.src)].filter(Boolean).filter(src=>/^\/(illustrations|photos)\/[\w.-]+$/.test(src)&&fs.existsSync(new URL('public'+src,root))).map(src=>[src,true]));
const origin='https://atlas.example.org',env={PUBLIC_ORIGIN:origin,SEO_INDEXABLE:true,LINUX_AUTHENTICATED_ADMIN:false};
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'citypop-seo-crawl-')),DB=openDatabase(path.join(temporary,'fixture.sqlite'));
let checks=0,crawled=0,structuredDocuments=0,context;
const request=(pathname,options={})=>new Request(origin+pathname,options);
const render=(pathname,settings=env,options={})=>serveSEO(request(pathname,options),settings,context);
const call=(pathname,settings=env,options={})=>worker.fetch(request(pathname,options),{...settings,DB});
const unescape=value=>String(value).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(match=>[match[1].toLowerCase(),unescape(match[3])]));
const tags=(html,name)=>[...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','gi'))].map(match=>attrs(match[0]));
const noindex=(response,label)=>{assert.match(response.headers.get('x-robots-tag')||'',/noindex/i,label);checks++};
const jsonld=html=>[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match=>JSON.parse(match[1]));
const absoluteURLs=new Set();
function gatherURLs(value){if(typeof value==='string'&&/^https?:\/\//.test(value))absoluteURLs.add(value);else if(value&&typeof value==='object')for(const item of Object.values(value))gatherURLs(item)}
gatherURLs(seed);gatherURLs(articles);gatherURLs(about);
function validateStructured(value,label){
 if(Array.isArray(value))for(const item of value)validateStructured(item,label);
 else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
  if(typeof item==='string'&&/^https?:\/\//.test(item)){
   const parsed=new URL(item);
   assert(parsed.origin===origin||['https://schema.org','http://schema.org'].includes(item)||absoluteURLs.has(item),label+' unexpected structured-data URL '+item);
   assert(!parsed.username&&!parsed.password,label+' structured credentials');
  }
  assert(!['candidateId','candidate_id','operationConflicts','review_events','approval_snapshots','before_override','after_override','decision_id'].includes(key),label+' private key '+key);
  validateStructured(item,label);
 }
}
function verifyHTML(html,url){
 const canonical=tags(html,'link').filter(tag=>tag.rel==='canonical');assert.equal(canonical.length,1,url+' one canonical');assert.equal(canonical[0].href,url,url+' self canonical');
 const description=tags(html,'meta').find(tag=>tag.name==='description');assert(description?.content?.trim().length>4,url+' useful description');
 assert.equal((html.match(/<h1\b/gi)||[]).length,1,url+' one H1');assert.match(html,/<title>[^<]+<\/title>/i,url+' title');assert.match(html,/<main\b/i,url+' main');
 assert(!/<h1[^>]*>\s*<\/h1>/i.test(html),url+' nonempty heading');
 const alternates=tags(html,'link').filter(tag=>tag.rel==='alternate'&&tag.hreflang);
 assert.deepEqual(alternates.map(tag=>tag.hreflang).sort(),['en','ja','x-default','zh-CN'],url+' language alternates');
 const suffix=new URL(url).pathname.replace(/^\/(?:en|zh|ja)/,'');
 for(const alternate of alternates){const language={'zh-CN':'zh','x-default':'en'}[alternate.hreflang]||alternate.hreflang;assert.equal(alternate.href,origin+'/'+language+suffix,url+' reciprocal alternate');}
 assert(!tags(html,'script').some(tag=>tag.src&&/^https?:/.test(tag.src)),url+' has no third-party executable script');
 for(const image of tags(html,'img')){assert(assetKeys[image.src],url+' existing local illustration/photo');assert(image.alt?.trim(),url+' image alt text');assert(Number(image.width)>0&&Number(image.height)>0,url+' image dimensions reserve layout');}
 const blocks=jsonld(html);assert(blocks.length>0,url+' structured data');for(const block of blocks){assert.equal(block['@context'],'https://schema.org',url+' schema context');validateStructured(block,url);structuredDocuments++;}
 return {canonical:canonical[0].href,blocks};
}
try{
 const catalog=await readCatalog(DB,seed);context={catalog,articles,about,assets:assetKeys};
 assert.equal(new URL(publicOrigin(env)).origin,origin);
 // Fixed origin may never come from Host, forwarded headers, a request URL, or
 // a superficially similar hostname. Bad configuration must fail closed.
 for(const value of ['','http://atlas.example.org','https://localhost','https://127.0.0.1','https://[::1]','https://192.168.1.2','https://10.0.0.1','https://172.16.0.1','https://user:pass@atlas.example.org','https://atlas.example.org/path','https://atlas.example.org?q=1','https://atlas.example.org#x','https://atlas.example.org:8443','https://fixture.chatgpt.site','//evil.example','javascript:alert(1)']){
  const privateEnv={...env,PUBLIC_ORIGIN:value};const robots=await render('/robots.txt',privateEnv);assert.equal(robots.status,200);assert.match(await robots.text(),/Disallow:\s*\//);assert.equal((await render('/sitemap.xml',privateEnv)).status,404);checks++;
 }
 const sitemap=await render('/sitemap.xml');assert.equal(sitemap.status,200);assert.match(sitemap.headers.get('content-type'),/xml/);
 const xml=await sitemap.text(),locations=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>unescape(match[1]));
 assert(locations.length>600,'Sitemap includes translated essays and editorial hubs');assert.equal(new Set(locations).size,locations.length,'Sitemap is duplicate-free');
 const locationSet=new Set(locations),externalSchemas=new Set();
 const xmlDOM=new JSDOM(xml,{contentType:'application/xml'}),xmlDocument=xmlDOM.window.document;
 assert.equal(xmlDocument.documentElement.namespaceURI,'http://www.sitemaps.org/schemas/sitemap/0.9');assert.equal(xmlDocument.querySelectorAll('url').length,locations.length);
 for(const entry of xmlDocument.querySelectorAll('url')){
  const location=entry.querySelector('loc').textContent,alternates=[...entry.getElementsByTagNameNS('http://www.w3.org/1999/xhtml','link')];
  assert.deepEqual(alternates.map(link=>link.getAttribute('hreflang')).sort(),['en','ja','x-default','zh-CN'],location+' XML alternates');
  for(const alternate of alternates){assert.equal(alternate.getAttribute('rel'),'alternate');assert(locationSet.has(alternate.getAttribute('href')),location+' XML alternate resolves');}
  const modified=entry.querySelector('lastmod')?.textContent;if(modified)assert(Number.isFinite(Date.parse(modified)),location+' valid source modification date');
 }
 xmlDOM.window.close();checks++;
 for(const location of locations){
  const parsed=new URL(location);assert.equal(parsed.origin,origin);assert.equal(parsed.search,'');assert.equal(parsed.hash,'');assert.match(parsed.pathname,/^\/(en|zh|ja)\//);
  const response=await render(parsed.pathname);assert.equal(response.status,200,location+' status');assert.match(response.headers.get('content-type'),/^text\/html/);assert.doesNotMatch(response.headers.get('x-robots-tag')||'',/noindex/i,location+' indexable');
  const html=await response.text();verifyHTML(html,location);assert(!tags(html,'meta').some(tag=>tag.name==='robots'&&/noindex/i.test(tag.content||'')),location+' HTML robots agrees');
  for(const alternate of tags(html,'link').filter(tag=>tag.rel==='alternate'&&tag.hreflang))assert(locationSet.has(alternate.href),location+' alternate included in sitemap');
  for(const block of jsonld(html))externalSchemas.add(JSON.stringify(block).length);
  crawled++;if(crawled%200===0)console.log('Crawled '+crawled+' raw HTML pages');
 }
 assert(externalSchemas.size>100,'Structured documents are page-specific');checks+=crawled;
 // HTML must include useful content before JS; inspect one real essay per
 // locale with scripts inert and no resource loader, plus navigable hubs.
 const artist='/artists/person-tatsuro-yamashita',article=articles.find(item=>item.entityId==='person_tatsuro_yamashita');
 for(const language of ['en','zh','ja']){
  const response=await call('/'+language+artist);assert.equal(response.status,200);const html=await response.text();verifyHTML(html,origin+'/'+language+artist);
  const dom=new JSDOM(html,{url:origin+'/'+language+artist});const document=dom.window.document;
  for(const paragraph of article.locales[language].paragraphs)assert(document.body.textContent.includes(paragraph),'Complete '+language+' essay before JS');
  assert(document.querySelectorAll('a[href]').length>10,'Useful real anchors');for(const source of article.sources)assert([...document.querySelectorAll('a[href]')].some(anchor=>anchor.href===source.url),'Visible cited source '+source.url);
  assert.equal(document.querySelector('html').lang,language==='zh'?'zh-CN':language);dom.window.close();checks++;
 }
 const canonicalPath='/en'+artist;
 for(const pathname of ['/en/','/en/about','/en/browse','/en/browse/albums',canonicalPath]){
  const get=await call(pathname),head=await call(pathname,env,{method:'HEAD'});assert.equal(get.status,200);assert.equal(head.status,get.status);assert.equal(await head.text(),'');
  for(const header of ['content-type','x-robots-tag','location'])assert.equal(head.headers.get(header),get.headers.get(header));checks++;
 }
 for(const [from,to] of [['/en','/en/'],['/en/about/','/en/about'],['/en/albums/album-timely-2008','/en/editions/edition-timely-2008-flcf4243']]){
  const response=await call(from);assert([301,308].includes(response.status),from+' redirect');assert.equal(new URL(response.headers.get('location'),origin).href,origin+to);checks++;
 }
 for(const pathname of ['/en/not-a-page','/de/about','/en/artists/not-found','/en/%','/en/%E0%A4%A','/en/%2f%2fevil.example','/en/%5cevil.example','/en/%00','/en/artists/%3Cscript%3Ealert(1)%3C/script%3E']){
  const response=await call(pathname);assert([400,404].includes(response.status),pathname+' status '+response.status);assert(!response.headers.get('location'));noindex(response,pathname);assert(!(await response.text()).includes('<script>alert(1)</script>'));checks++;
 }
 for(const suffix of ['?x=%3Cscript%3Ealert(1)%3C%2Fscript%3E','?utm_source=synthetic','?redirect=https://evil.example','?lang=ja']){
  const response=await call(canonicalPath+suffix);assert.equal(response.status,200);noindex(response,'query variant');const html=await response.text();assert.equal(tags(html,'link').find(tag=>tag.rel==='canonical').href,origin+canonicalPath);assert(!html.includes('<script>alert(1)</script>'));assert(!html.includes('evil.example'));checks++;
 }
 const privateEnvs=[{...env,SEO_INDEXABLE:false},{...env,LINUX_AUTHENTICATED_ADMIN:true},{...env,SITE_REVIEW_MODE:'owner-private',SITE_REVIEW_ADMIN_USER_IDS:'["synthetic-owner"]'}];
 for(const privateEnv of privateEnvs){
  const response=await call(canonicalPath,privateEnv);assert.equal(response.status,200);noindex(response,'private HTML');assert.equal(response.headers.get('cache-control'),'no-store');
  const robots=await call('/robots.txt',privateEnv);assert.match(await robots.text(),/Disallow:\s*\//);const map=await call('/sitemap.xml',privateEnv);assert.equal(map.status,404);noindex(map,'private sitemap');checks++;
 }
 const mismatched=await worker.fetch(new Request('https://evil.example'+canonicalPath,{headers:{Host:new URL(origin).host,'X-Forwarded-Host':new URL(origin).host}}),{...env,DB});noindex(mismatched,'mismatched request origin');assert(!(await mismatched.text()).includes('https://evil.example'));
 const protectedPaths=['/api/review','/api/review/preview','/api/review/import','/api/review/history','/api/operations','/api/operations/preview','/api/operations/import'];
 let dbTouches=0;const forbiddenDB=new Proxy({},{get(){dbTouches++;throw Error('Unauthenticated request reached database')}});
 for(const pathname of protectedPaths)for(const method of ['GET','HEAD','POST','PUT','DELETE','OPTIONS']){
  const response=await worker.fetch(request(pathname,{method,headers:{'oai-authenticated-user-id':'synthetic-owner','x-admin':'true'}}),{...env,DB:forbiddenDB});assert.equal(response.status,403);noindex(response,pathname+' '+method);checks++;
 }
 assert.equal(dbTouches,0,'Denied review reads never touch database');
 // Approved corrections are public facts. Pending/rejected payloads, reviewer
 // notes, audit IDs, and snapshots are not public document content.
 const privateMarker='PRIVATE-NOTE-DO-NOT-PUBLISH-SEO-REGRESSION';
 const approved={entityId:'album_sunshower',field:'catalogNumber',value:'PUBLIC-APPROVED-SEO-FIXTURE',sourceUrl:'https://example.invalid/seo-evidence',sourceType:'isolated regression fixture',checkedAt:'2026-10-05',note:privateMarker};
 const pending={...approved,field:'label',value:'PRIVATE-PENDING-SEO-FIXTURE'};
 const ids=await importCandidates(DB,[approved,pending],await readCatalog(DB,seed));
 assert.equal((await decideCandidate(DB,ids[0],{decision:'approve',expectedVersion:1,note:privateMarker},await readCatalog(DB,seed))).status,200);
 const albumPath='/en/albums/album-sunshower',approvedResponse=await call(albumPath);assert.equal(approvedResponse.status,200);const approvedHTML=await approvedResponse.text();assert(approvedHTML.includes(approved.value));assert(approvedHTML.includes(approved.sourceUrl));
 for(const secret of [privateMarker,pending.value,...ids,'approval_snapshots','operationConflicts'])assert(!approvedHTML.includes(secret),'private value absent: '+secret);checks++;
 for(const pathname of ['/api/graph','/api/entities/'+approved.entityId,'/en/','/en/browse/albums','/sitemap.xml']){
  const response=await call(pathname);assert.equal(response.status,200);const body=await response.text();for(const secret of [privateMarker,pending.value,...ids])assert(!body.includes(secret),pathname+' leaks private fixture');checks++;
 }
 // Approved structural additions and merges use exactly the existing review
 // functions. Similar IDs and identical display names must not collide.
 const operationIDs=[];
 async function approveOperation(input){
  const current=await readCatalog(DB,seed),proposal={...input,sourceUrl:'https://example.invalid/seo-structure',sourceType:'isolated regression fixture',checkedAt:'2026-10-05',note:privateMarker};
  const preview=await previewOperations(DB,[proposal],current);assert(preview.valid);const id=preview.rows[0].id;
  await importOperations(DB,[proposal],current);const result=await decideOperation(DB,id,{decision:'approve',expectedVersion:1,expectedEpoch:current.epoch,graphToken:await graphToken(current),note:privateMarker},current);assert.equal(result.status,200);operationIDs.push(id);
 }
 const fixtureIDs=['person_seo_a_b','person_seo_a-b'];
 for(const id of fixtureIDs)await approveOperation({kind:'entity',node:{id,type:'person',labels:{en:'Synthetic same name',zh:'合成同名',ja:'合成同名'},description:{en:'Isolated structural route fixture.',zh:'独立的结构路径测试。',ja:'独立した構造パステスト。'},attributes:{},externalIds:{}}});
 const fixturePaths=['/en/people/person-seo-a-b','/en/people/person-seo-a~hb'];
 for(let index=0;index<fixturePaths.length;index++){
  const response=await call(fixturePaths[index]);assert.equal(response.status,200);noindex(response,'supporting synthetic entry');const html=await response.text();assert(html.includes(fixtureIDs[index]));
  assert.equal(tags(html,'link').find(tag=>tag.rel==='canonical').href,origin+fixturePaths[index]);for(const secret of [privateMarker,...operationIDs])assert(!html.includes(secret));checks++;
 }
 await approveOperation({kind:'merge',fromId:fixtureIDs[0],intoId:fixtureIDs[1],confirmSameIdentity:true});
 const alias=await call(fixturePaths[0]);assert.equal(alias.status,308);assert.equal(new URL(alias.headers.get('location'),origin).href,origin+fixturePaths[1]);
 const merged=await call(fixturePaths[1]);assert.equal(merged.status,200);const mergedHTML=await merged.text();for(const secret of [privateMarker,...operationIDs])assert(!mergedHTML.includes(secret));
 const mergedMap=await (await call('/sitemap.xml')).text();assert(!mergedMap.includes(fixturePaths[0])&&!mergedMap.includes(fixturePaths[1]),'Unreviewed editorial quality remains out of sitemap even when structural changes are approved');checks++;
 const mergedCatalog=await readCatalog(DB,seed),mergeID=operationIDs.at(-1);
 assert.equal((await decideOperation(DB,mergeID,{expectedVersion:2,expectedEpoch:mergedCatalog.epoch,graphToken:await graphToken(mergedCatalog),note:privateMarker},mergedCatalog,true)).status,200);
 assert.equal((await call(fixturePaths[0])).status,200,'Undo immediately removes obsolete merge redirect');assert.equal((await call(fixturePaths[1])).status,200);checks++;
 const tables=['attribute_overrides','candidates','review_events','approval_snapshots','catalog_operations','operation_events'];
 const snapshot=()=>Object.fromEntries(tables.map(table=>[table,DB.sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 const before=snapshot();await seedCatalog(DB,{...seed,revision:seed.revision+'-seo-upgrade-fixture'});assert.deepEqual(snapshot(),before,'Base data upgrade preserves private editorial state');
 const after=await call(albumPath);assert((await after.text()).includes(approved.value));assert.deepEqual(snapshot(),before,'Rerender and source revision reconciliation preserve decisions');checks++;
 // Simulate an approved plain-text correction containing active markup. It is
 // legitimate text, so the renderer must escape it in HTML and JSON-LD.
 const payload='</script><img src=x onerror="globalThis.SEO_XSS=1"><script>globalThis.SEO_XSS=1</script>';
 const [xssID]=await importCandidates(DB,[{...approved,field:'label',value:payload,sourceUrl:'https://example.invalid/seo-escaping'}],await readCatalog(DB,seed));
 assert.equal((await decideCandidate(DB,xssID,{decision:'approve',expectedVersion:1,note:privateMarker},await readCatalog(DB,seed))).status,200);
 const xssResponse=await call(albumPath),xssHTML=await xssResponse.text();assert(!xssHTML.includes(payload));const dom=new JSDOM(xssHTML);assert(!dom.window.document.querySelector('[onerror]'));assert(!dom.window.document.querySelector('script:not([type="application/ld+json"]):not([src])')?.textContent.includes('SEO_XSS'));assert(dom.window.document.body.textContent.includes(payload));jsonld(xssHTML);dom.window.close();checks++;
 const event=DB.sqlite.prepare('SELECT id FROM review_events WHERE candidate_id=? AND action=?').get(xssID,'approve');
 assert.equal((await undoApproval(DB,event.id,{expectedVersion:2,note:privateMarker},await readCatalog(DB,seed))).status,200);
 const undoneHTML=await(await call(albumPath)).text();assert(!undoneHTML.includes('SEO_XSS'),'Undo immediately invalidates cached corrected facts');assert(undoneHTML.includes(approved.value),'Unrelated approved correction survives undo');checks++;
 assert.equal(DB.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(DB.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 console.log(JSON.stringify({passed:true,suite:'seo-http',checks,crawled,structuredDocuments,scope:'Every sitemap URL crawled as raw no-JS HTML; production Worker sampled for translations, source citations, HEAD, redirects, private mode, fixed origin, malformed routes, auth isolation, approved overrides, private metadata, XSS and source upgrades.'}));
}finally{DB.close();fs.rmSync(temporary,{recursive:true,force:true})}
