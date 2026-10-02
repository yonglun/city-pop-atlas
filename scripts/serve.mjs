import http from 'node:http';
import fs from 'node:fs';
import {openDatabase} from './sqlite-adapter.mjs';
import worker from '../dist/server/index.js';
fs.mkdirSync('.local',{recursive:true});
const DB=openDatabase('.local/catalog.sqlite');
const port=Number(process.env.PORT||8000),origin='http://127.0.0.1:'+port;
// The local-only mock is opt-in, strips caller-supplied identity, and never ships in the Worker.
const reviews=false; // Linux package: the development server is always read-only.
http.createServer(async(req,res)=>{
 try {
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(!k.startsWith('oai-authenticated-user-')&&v)headers.set(k,Array.isArray(v)?v.join(','):v);
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);res.end('Body too large');return}chunks.push(chunk)}
  const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,{DB,LINUX_AUTHENTICATED_ADMIN:false,SITE_REVIEW_ORIGIN:origin});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Local server error')}
}).listen(port,'127.0.0.1',()=>console.log('City Pop Atlas: '+origin+' · review '+(reviews?'enabled locally':'read-only')));
