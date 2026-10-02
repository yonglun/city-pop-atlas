import seed from '../data/catalog.json';
import candidateSeeds from '../data/candidates.json';
import {canReview,mutationGuard,readBody,importCandidates,listReview,decideCandidate} from './review.js';
import assets from './assets.generated.js';
import {readCatalog} from './storage.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request,env) {
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/review'||path.startsWith('/api/review/')) {
   try {
    if(!env.DB)return json({error:'storage_unavailable'},503);
    if(request.method!=='GET'){const blocked=mutationGuard(request,env);if(blocked)return json({error:blocked.error},blocked.status)}
    const catalog=await readCatalog(env.DB,seed);
    if(candidateSeeds.length)await importCandidates(env.DB,candidateSeeds,catalog);
    if(request.method==='GET'&&path==='/api/review')return json({canReview:canReview(request,env),...await listReview(env.DB,catalog)});
    if(request.method==='POST') {
     let body;try{body=await readBody(request)}catch(e){return json({error:e.message==='body_too_large'?'body_too_large':'invalid_json'},400)}
     if(path==='/api/review/import'){try{const ids=await importCandidates(env.DB,body.candidates,catalog);return json({ids})}catch(e){return json({error:e.message},400)}}
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
    if(path==='/api/graph') return json(data);
    if(path==='/api/schema') return json({schemaVersion:3,properties:data.properties,entityTypes:['artist','person','album','song','edition','recording','work','track','label']});
    if(path==='/api/stats') return json({revision:data.revision,storage:'D1',entities:data.nodes.length,relationships:data.edges.length,images:data.nodes.filter(n=>n.media.some(m=>m.status==='verified')).length,links:data.nodes.reduce((s,n)=>s+n.serviceLinks.filter(l=>l.status==='verified').length,0)});
    if(path.startsWith('/api/entities/')) {const id=decodeURIComponent(path.slice('/api/entities/'.length));const resolved=data.entityAliases?.[id]||id;const entity=data.nodes.find(n=>n.id===resolved);return entity?json({entity,relationships:data.edges.filter(e=>e.source===resolved||e.target===resolved)}):json({error:'not_found'},404);}
    return json({error:'not_found'},404);
   } catch(error) {console.error('catalog_storage_error',error.message);return json({error:'storage_unavailable'},503);}
  }
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset) return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }
};
