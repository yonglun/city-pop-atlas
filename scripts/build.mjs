import fs from 'node:fs/promises';
import {build} from 'esbuild';
const assets={};const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',json:'application/json',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
async function collect(dir,prefix=''){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory()){await collect(dir+'/'+entry.name,name+'/');continue}const ext=name.split('.').pop();if(!mime[ext])continue;const binary=['webp','jpg','jpeg','png'].includes(ext);const bytes=await fs.readFile(dir+'/'+entry.name);assets['/'+name]={body:bytes.toString(binary?'base64':'utf8'),type:mime[ext]+(binary?'':'; charset=utf-8'),...(binary?{encoding:'base64'}:{})}}}
await collect('public');
await fs.writeFile('server/assets.generated.js','export default '+JSON.stringify(assets)+';\n');
await fs.rm('dist',{recursive:true,force:true});await fs.mkdir('dist/server',{recursive:true});
await build({entryPoints:['server/worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js'});
await fs.mkdir('dist/.openai',{recursive:true});
try {await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json')} catch(error) {if(error.code!=='ENOENT')throw error;await fs.writeFile('dist/.openai/hosting.json',JSON.stringify({d1:'DB',r2:null}))}
await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Worker + D1 migrations');
