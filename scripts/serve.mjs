import http from 'node:http';
import fs from 'node:fs';
import {openDatabase} from './sqlite-adapter.mjs';
import worker from '../dist/server/index.js';
fs.mkdirSync('.local',{recursive:true});
const DB=openDatabase('.local/catalog.sqlite');
const port=Number(process.env.PORT||8000);
http.createServer(async(req,res)=>{
 try{const response=await worker.fetch(new Request('http://localhost:'+port+req.url,{method:req.method}),{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(e){console.error(e);res.writeHead(500);res.end('Local server error')}
}).listen(port,'0.0.0.0',()=>console.log('City Pop Atlas: http://127.0.0.1:'+port));
