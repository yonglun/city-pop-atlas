import {serveSEO,isPublicSEO} from './seo.js';
import {readPublicCatalog} from './public-catalog.js';
import {analyticsConfig} from './analytics.js';
import {reviewSession,reviewGuard} from './auth.js';
import operationSeeds from '../data/operations.json';
import {previewOperations,importOperations,listOperations,decideOperation} from './operations.js';
import seed from '../data/catalog.json';
import candidateSeeds from '../data/candidates.json';
import {canReview,mutationGuard,readBody,importCandidates,previewCandidates,importCandidateBatch,listReview,decideCandidate,undoApproval} from './review.js';
import assets from './assets.generated.js';
import {readCatalog} from './storage.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
let editorialCache=null;
function editorial(){return editorialCache??= {articles:JSON.parse(assets['/articles.json'].body),about:JSON.parse(assets['/about.json'].body)}}
async function handleRequest(request,env) {
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/public-config') {
   if(request.method!=='GET')return json({error:'method_not_allowed'},405);
   return json(analyticsConfig(request,env,{isAdmin:reviewSession(request,env).canReview}));
  }
  if(path==='/api/review-session') {
   if(request.method!=='GET')return json({error:'method_not_allowed'},405);
   return json(reviewSession(request,env));
  }
  if(path==='/api/operations'||path.startsWith('/api/operations/')) {
   const denied=reviewGuard(request,env);if(denied)return json({error:denied.error},denied.status);
   try {
    if(!env.DB)return json({error:'storage_unavailable'},503);
    if(request.method!=='GET'){const blocked=mutationGuard(request,env);if(blocked)return json({error:blocked.error},blocked.status)}
    const catalog=await readCatalog(env.DB,seed);
    if(operationSeeds.length&&path!=='/api/operations/preview')for(let offset=0;offset<operationSeeds.length;offset+=50)await importOperations(env.DB,operationSeeds.slice(offset,offset+50),catalog);
    if(request.method==='GET'&&path==='/api/operations')return json({canReview:canReview(request,env),...await listOperations(env.DB,catalog)});
    if(request.method!=='POST')return json({error:'method_not_allowed'},405);
    let body;try{body=await readBody(request)}catch(e){return json({error:e.message==='body_too_large'?'body_too_large':'invalid_json'},400)}
    if(path==='/api/operations/preview'||path==='/api/operations/import'){try{return json(await (path.endsWith('/preview')?previewOperations:importOperations)(env.DB,body?.operations,catalog))}catch(e){return json({error:e.message},400)}}
    const match=path.match(/^\/api\/operations\/(operation_[a-f0-9]{64})(\/undo)?$/);if(!match)return json({error:'not_found'},404);
    const result=await decideOperation(env.DB,match[1],body,catalog,!!match[2]);return json(result.result||{error:result.error},result.status);
   }catch(e){console.error('operation_storage_error',e.message);return json({error:'operations_unavailable'},503)}
  }
  if(path==='/api/review'||path.startsWith('/api/review/')) {
   const denied=reviewGuard(request,env);if(denied)return json({error:denied.error},denied.status);
   try {
    if(!env.DB)return json({error:'storage_unavailable'},503);
    if(request.method!=='GET'){const blocked=mutationGuard(request,env);if(blocked)return json({error:blocked.error},blocked.status)}
    const catalog=await readCatalog(env.DB,seed);
    if(candidateSeeds.length&&path!=='/api/review/preview')await importCandidates(env.DB,candidateSeeds,catalog);
    if(request.method==='GET'&&path==='/api/review')return json({canReview:canReview(request,env),...await listReview(env.DB,catalog)});
    if(request.method==='POST') {
     let body;try{body=await readBody(request)}catch(e){return json({error:e.message==='body_too_large'?'body_too_large':'invalid_json'},400)}
     if(path==='/api/review/import'||path==='/api/review/preview'){try{const result=await (path.endsWith('/preview')?previewCandidates:importCandidateBatch)(env.DB,body?.candidates,catalog);return json(result)}catch(e){return json({error:e.message},400)}}
     const undo=path.match(/^\/api\/review\/undo\/([a-f0-9-]{36})$/);
     if(undo){const result=await undoApproval(env.DB,undo[1],body,catalog);return json(result.result||{error:result.error},result.status)}
     const match=path.match(/^\/api\/review\/(candidate_[a-f0-9]{64})$/);if(!match)return json({error:'not_found'},404);
     try{const result=await decideCandidate(env.DB,match[1],body,catalog);return json(result.result||{error:result.error},result.status)}catch(e){return json({error:'invalid_candidate'},400)}
    }
    return json({error:'method_not_allowed'},405);
   }catch(e){console.error('review_storage_error',e.message);return json({error:'review_unavailable'},503)}
  }
  if(!['GET','HEAD'].includes(request.method)) return json({error:'read_only_api'},405);
  if(path.startsWith('/api/')) {
   if(request.method==='HEAD')return new Response(null,{status:405,headers:{Allow:'GET'}});
   try {
    if(!env.DB) return json({error:'storage_unavailable'},503);
    if(!['/api/graph','/api/schema','/api/stats'].includes(path)&&!path.startsWith('/api/entities/')) return json({error:'not_found'},404);
    const data=await readCatalog(env.DB,seed);
    if(path==='/api/graph') {const {operationConflicts,...publicData}=data;return json(publicData);}
    if(path==='/api/schema') return json({schemaVersion:3,properties:data.properties,entityTypes:['artist','person','album','song','edition','recording','work','track','label']});
    if(path==='/api/stats') return json({revision:data.revision,storage:'D1',entities:data.nodes.length,relationships:data.edges.length,images:data.nodes.filter(n=>n.media.some(m=>m.status==='verified')).length,links:data.nodes.reduce((s,n)=>s+n.serviceLinks.filter(l=>l.status==='verified').length,0)});
    if(path.startsWith('/api/entities/')) {const id=decodeURIComponent(path.slice('/api/entities/'.length));const resolved=data.entityAliases?.[id]||id;const entity=data.nodes.find(n=>n.id===resolved);return entity?json({entity,relationships:data.edges.filter(e=>e.source===resolved||e.target===resolved)}):json({error:'not_found'},404);}
    return json({error:'not_found'},404);
   } catch(error) {console.error('catalog_storage_error',error.message);return json({error:'storage_unavailable'},503);}
  }
  if(path==='/robots.txt')return serveSEO(request,env,{});
  // Serve the same sourced HTML to people and crawlers. Runtime editorial decisions
  // use the same effective catalog as the public graph, never private review rows.
  if (/^\/(?:en|zh|ja)(?:\/|$)/i.test(path)||['/robots.txt','/sitemap.xml','/llms.txt'].includes(path)) {
   try {
    const catalog=env.DB?await readPublicCatalog(env.DB,seed):seed;
    const rendered=await serveSEO(request,env,{catalog,...editorial(),assets});
    if(rendered)return rendered;
   } catch(error) {console.error('seo_render_error',error.message);return new Response('Archive temporarily unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'60'}})}
  }
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset) return new Response('Not found',{status:404});
  if(path==='/'||path==='/index.html') {
   const lang=['en','zh','ja'].includes(url.searchParams.get('lang'))?url.searchParams.get('lang'):'en';
   const title={en:'Explore the City Pop archive',zh:'探索 City Pop 音乐档案',ja:'シティポップ・アーカイブを探索'}[lang];
   const browse={en:'Browse sourced artists, records and songs',zh:'浏览附有来源的艺人、唱片和歌曲',ja:'出典のあるアーティスト、レコード、楽曲を読む'}[lang];
   const copy={en:'This representative archive connects Japanese City Pop artists, recordings, compositions and release editions. Read the multilingual essays and their original sources, or use the interactive graph above.',zh:'这个代表性资料库连接日本 City Pop 的艺人、录音、作品和发行版本。你可以阅读三语专文及原始来源，也可以使用上方的交互图谱。',ja:'日本のシティポップのアーティスト、録音、作品、発売版をつなぐ代表的な資料集です。多言語の記事と原資料を読むことも、上のグラフで探索することもできます。'}[lang];
   const discovery=`<section class="search-discovery" style="max-width:960px;margin:3rem auto;padding:1.5rem;line-height:1.8" aria-labelledby="discovery-heading"><h2 id="discovery-heading">${title}</h2><p>${copy}</p><nav aria-label="Archive reading"><a href="/${lang}/browse">${browse}</a> · <a href="/${lang}/about">City Pop</a></nav><p><a href="/en/" hreflang="en">English</a> · <a href="/zh/" hreflang="zh-CN">中文</a> · <a href="/ja/" hreflang="ja">日本語</a></p></section>`;
   const seoPublic=isPublicSEO(request,env);
   const canonical=seoPublic?`<link rel="canonical" href="${new URL(env.PUBLIC_ORIGIN).origin}/">`:'';
   const noScript='<noscript><style>.loading main{visibility:visible}#load-status,.loading header,.loading .workspace,.loading .intro{display:none}</style></noscript>';
   const body=asset.body.replace('</head>','<meta name="robots" content="noindex,follow">'+canonical+noScript+'</head>').replace('<body ','<body data-seo-public="'+String(seoPublic)+'" ').replace('</main>',discovery+'</main>');
   return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Robots-Tag':'noindex, follow','Referrer-Policy':'no-referrer'}});
  }
  return new Response(request.method==='HEAD'?null:asset.encoding==='base64'?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
export default {async fetch(request,env={}) {
 const response=await handleRequest(request,env);
 const headers=new Headers(response.headers);
 const url=new URL(request.url);
 const publicSEO=isPublicSEO(request,env);
 if(!publicSEO||response.status>=400||url.pathname.startsWith('/api/')||url.pathname.endsWith('.json')||url.searchParams.get('view')==='review')headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 if(!publicSEO)headers.set('Cache-Control','no-store');
 headers.set('X-Content-Type-Options','nosniff');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}};
