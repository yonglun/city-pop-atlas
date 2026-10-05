import http from 'node:http';
import fs from 'node:fs';
import {openDatabase} from './sqlite-adapter.mjs';
import worker from '../dist/server/index.js';
// Node 22 loads optional .env locally; explicitly supplied environment wins.
try{process.loadEnvFile('.env')}catch(error){if(error.code!=='ENOENT')throw error}
fs.mkdirSync('.local',{recursive:true});
const DB=openDatabase('.local/catalog.sqlite');
const port=Number(process.env.PORT||8000),origin='http://127.0.0.1:'+port;
// The local-only mock is opt-in, strips caller-supplied identity, and never ships in the Worker.
const reviews=process.env.LOCAL_REVIEW==='1';
http.createServer(async(req,res)=>{
 try {
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(!k.startsWith('oai-authenticated-user-')&&v)headers.set(k,Array.isArray(v)?v.join(','):v);
  if(reviews)headers.set('oai-authenticated-user-id','local-reviewer');
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);res.end('Body too large');return}chunks.push(chunk)}
  const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,{DB,GA_MEASUREMENT_ID:process.env.GA_MEASUREMENT_ID,CLARITY_PROJECT_ID:process.env.CLARITY_PROJECT_ID,SITE_REVIEW_MODE:reviews?'owner-private':'disabled',SITE_REVIEW_ADMIN_USER_IDS:reviews?'["local-reviewer"]':'[]',SITE_REVIEW_ORIGIN:origin});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Local server error')}
}).listen(port,'127.0.0.1',()=>console.log('City Pop Atlas: '+origin+' · review '+(reviews?'enabled locally':'read-only')));
