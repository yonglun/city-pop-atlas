import operationSeeds from '../data/operations.json';
import {previewOperations,importOperations,listOperations,decideOperation} from './operations.js';
import seed from '../data/catalog.json';
import candidateSeeds from '../data/candidates.json';
import {canReview,mutationGuard,readBody,importCandidates,previewCandidates,importCandidateBatch,listReview,decideCandidate,undoApproval} from './review.js';
import assets from './assets.generated.js';
import {readCatalog} from './storage.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request,env) {
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/operations'||path.startsWith('/api/operations/')) {
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
