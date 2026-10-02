import seed from '../data/catalog.json';
import assets from './assets.generated.js';
import {readCatalog} from './storage.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
 async fetch(request,env) {
  const url=new URL(request.url), path=url.pathname;
  if(!['GET','HEAD'].includes(request.method)) return json({error:'read_only_api'},405);
  if(path.startsWith('/api/')) {
   if(request.method==='HEAD')return new Response(null,{status:405,headers:{Allow:'GET'}});
   try {
    if(!env.DB) return json({error:'storage_unavailable'},503);
    if(!['/api/graph','/api/schema','/api/stats'].includes(path)&&!path.startsWith('/api/entities/')) return json({error:'not_found'},404);
    const data=await readCatalog(env.DB,seed);
    if(path==='/api/graph') return json(data);
    if(path==='/api/schema') return json({schemaVersion:2,properties:data.properties,entityTypes:['artist','person','album','song','edition','recording','work','label']});
    if(path==='/api/stats') return json({revision:data.revision,storage:'D1',entities:data.nodes.length,relationships:data.edges.length,images:data.nodes.filter(n=>n.media.some(m=>m.status==='verified')).length,links:data.nodes.reduce((s,n)=>s+n.serviceLinks.filter(l=>l.status==='verified').length,0)});
    if(path.startsWith('/api/entities/')) {const id=decodeURIComponent(path.slice('/api/entities/'.length));const entity=data.nodes.find(n=>n.id===id);return entity?json({entity,relationships:data.edges.filter(e=>e.source===id||e.target===id)}):json({error:'not_found'},404);}
    return json({error:'not_found'},404);
   } catch(error) {console.error('catalog_storage_error',error.message);return json({error:'storage_unavailable'},503);}
  }
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset) return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }
};
