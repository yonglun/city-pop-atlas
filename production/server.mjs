import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,timingSafeEqual} from 'node:crypto';
import {openDatabase} from './sqlite.mjs';
import worker from '../dist/server/index.js';
process.umask(0o077);
function origin(name,fallback){const value=process.env[name]||fallback;const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.origin!==value)throw Error(name+' must be an exact http(s) origin without a trailing slash');return u}
function port(name,fallback){const n=Number(process.env[name]||fallback);if(!Number.isInteger(n)||n<1||n>65535)throw Error('Invalid '+name);return n}
const publicOrigin=origin('PUBLIC_ORIGIN','http://localhost:8080'),adminOrigin=origin('ADMIN_ORIGIN','http://127.0.0.1:8081');
if(adminOrigin.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(adminOrigin.hostname))throw Error('HTTP administration must use a loopback origin and SSH tunnel');
const adminEnabled=process.env.ADMIN_ENABLED==='true';
let credentialHash;
if(adminEnabled){const file=process.env.ADMIN_PASSWORD_FILE;if(!file)throw Error('ADMIN_PASSWORD_FILE is required');const password=fs.readFileSync(file,'utf8').trimEnd();if(password.length<24||/[\r\n:]/.test(password))throw Error('Admin password must be at least 24 characters and contain no colon or newline');credentialHash=createHash('sha256').update('citypop:'+password).digest()}
const DB=openDatabase(path.resolve(process.env.DATABASE_PATH||'runtime/catalog.sqlite'));
// Warm the catalog before accepting requests. GET may initialize seed rows, but no visitor can mutate editorial decisions.
const warm=await worker.fetch(new Request(publicOrigin.origin+'/api/graph'),{DB,LINUX_AUTHENTICATED_ADMIN:false});
if(warm.status!==200)throw Error('Catalog initialization failed');
const servers=[];let closing=false;
function listener(isAdmin){const canonical=isAdmin?adminOrigin:publicOrigin;
 const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
  const send=(status,text,headers={})=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(text)};
  try{
   if(closing)return send(503,'Shutting down');
   if(req.url==='/healthz'&&['GET','HEAD'].includes(req.method)&&!isAdmin){DB.sqlite.prepare('SELECT 1').get();return send(200,'ok\n')}
   if(req.headers.host!==canonical.host)return send(421,'Unexpected Host');
   if(!req.url?.startsWith('/')||req.url.startsWith('//'))return send(400,'Invalid request target');
   const requestPath=new URL(canonical.origin+req.url).pathname;
   if(!isAdmin&&/^\/api\/(?:review|operations)(?:\/|$)/.test(requestPath))return send(403,'Administration endpoint is private');
   if(isAdmin){const match=/^Basic ([A-Za-z0-9+/=]+)$/.exec(req.headers.authorization||'');const decoded=match?Buffer.from(match[1],'base64'):Buffer.alloc(0);const hash=createHash('sha256').update(decoded).digest();if(!timingSafeEqual(hash,credentialHash))return send(401,'Authentication required',{'WWW-Authenticate':'Basic realm="CityPop admin", charset="UTF-8"'})}
   const length=Number(req.headers['content-length']||0);if(!Number.isFinite(length)||length>65536)return send(413,'Body too large');
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536){send(413,'Body too large');req.destroy();return}chunks.push(chunk)}
   const headers=new Headers();for(const [key,value]of Object.entries(req.headers)){if(/^(?:oai-|x-forwarded-|forwarded$|authorization$|host$|connection$|transfer-encoding$)/i.test(key)||!value)continue;headers.set(key,Array.isArray(value)?value.join(','):value)}
   const request=new Request(canonical.origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await worker.fetch(request,{DB,LINUX_AUTHENTICATED_ADMIN:isAdmin,SITE_REVIEW_ORIGIN:canonical.origin});
   res.writeHead(response.status,{...Object.fromEntries(response.headers),'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('request_failed',error.message);if(!res.headersSent)send(500,'Internal server error');else res.destroy()}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=1000;
 server.on('clientError',(_e,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
 server.listen(isAdmin?port('ADMIN_PORT',8001):port('PORT',8000),process.env.BIND_ADDRESS||'127.0.0.1',()=>console.log(isAdmin?'Admin listener enabled (authenticated; SSH tunnel only)':'Public listener ready (read-only)'));servers.push(server);
}
listener(false);if(adminEnabled)listener(true);
async function shutdown(){if(closing)return;closing=true;const timeout=setTimeout(()=>process.exit(1),20000);timeout.unref();await Promise.all(servers.map(server=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections()})));DB.close();clearTimeout(timeout)}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
