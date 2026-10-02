import fs from 'node:fs/promises';
import {build} from 'esbuild';
const assets={};const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',json:'application/json'};
for(const name of await fs.readdir('public')) {if(!mime[name.split('.').pop()]) continue;assets['/'+name]={body:await fs.readFile('public/'+name,'utf8'),type:mime[name.split('.').pop()]+'; charset=utf-8'};}
await fs.writeFile('server/assets.generated.js','export default '+JSON.stringify(assets)+';\n');
await fs.rm('dist',{recursive:true,force:true});await fs.mkdir('dist/server',{recursive:true});
await build({entryPoints:['server/worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js'});
await fs.mkdir('dist/.openai',{recursive:true});
try {await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json')} catch(error) {if(error.code!=='ENOENT')throw error;await fs.writeFile('dist/.openai/hosting.json',JSON.stringify({d1:'DB',r2:null}))}
await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Worker + D1 migrations');
