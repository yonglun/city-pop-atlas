import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';
import {articleIndex} from '../server/public-data.js';
const assets={},assetURLs={},assetOverrides={};
const mime={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',json:'application/json',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function collect(dir,prefix='') {
 for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
  const name=prefix+entry.name;
  if(entry.isDirectory()){await collect(dir+'/'+entry.name,name+'/');continue;}
  const ext=name.split('.').pop();if(!mime[ext])continue;
  const binary=['webp','jpg','jpeg','png'].includes(ext),bytes=await fs.readFile(dir+'/'+entry.name);
  assets['/'+name]={body:bytes.toString(binary?'base64':'utf8'),type:mime[ext]+(binary?'':'; charset=utf-8'),etag:'"sha256-'+hash(bytes)+'"',...(binary?{encoding:'base64'}:{})};
 }
}
await collect('public');
const versionable=new Set(Object.keys(assets).filter(name=>/\.(?:js|css|svg)$/.test(name))),visiting=new Set();
function versionAsset(name) {
 if(assetURLs[name])return assetURLs[name];
 if(visiting.has(name))throw Error('Cyclic static asset dependency: '+name);
 visiting.add(name);
 const asset=assets[name];let body=asset.body;
 // A dynamic script preload and its later script insertion must resolve to the
 // same content-hashed URL. Hash dependencies first, then the rewritten caller.
 if(/\.js$/.test(name))body=body.replace(/(['"])(\/[^'"?#\s<>]+)(?:\?[^'"#\s<>]*)?\1/g,(match,quote,target)=>versionable.has(target)?quote+versionAsset(target)+quote:match);
 const digest=hash(body),extension=path.posix.extname(name),stem=name.slice(1,-extension.length).replaceAll('/','-');
 if(body!==asset.body)assetOverrides[name]={body,etag:'"sha256-'+digest+'"'};
 assetURLs[name]='/assets/'+stem+'.'+digest.slice(0,20)+extension;
 visiting.delete(name);return assetURLs[name];
}
for(const name of versionable)versionAsset(name);
// Store bytes once, even though legacy paths and content-hashed paths both work.
const editorialIndexJSON=JSON.stringify(articleIndex(JSON.parse(assets['/articles.json'].body)));
await fs.writeFile('server/assets.generated.js','const assets='+JSON.stringify(assets)+';\nexport const assetURLs='+JSON.stringify(assetURLs)+';\nexport const editorialIndexJSON='+JSON.stringify(editorialIndexJSON)+';\nconst assetOverrides='+JSON.stringify(assetOverrides)+';\nfor(const [source,target] of Object.entries(assetURLs)) assets[target]={...assets[source],...assetOverrides[source],immutable:true};\nexport default assets;\n');
await fs.rm('dist',{recursive:true,force:true});await fs.mkdir('dist/server',{recursive:true});
await build({entryPoints:['server/worker.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js'});
console.log('Built Linux-compatible frozen worker bundle with '+Object.keys(assetURLs).length+' content-versioned assets');
