import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir=process.argv[2];if(!dir)throw Error('Supply the completed editorial artifact directory');
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const targets=catalog.nodes.filter(n=>['artist','person','album'].includes(n.type));
const essays=[1,2,3,4].flatMap(i=>JSON.parse(fs.readFileSync(path.join(dir,`essays-${i}.json`),'utf8')));
const art=JSON.parse(fs.readFileSync(path.join(dir,'illustrations/manifest.json'),'utf8'));
assert.equal(essays.length,84);assert.equal(art.length,84);assert.equal(new Set(essays.map(a=>a.entityId)).size,84);assert.equal(new Set(art.map(a=>a.entityId)).size,84);
const provenanceNote={zh:'本文依据下列资料撰写；评论与意象为原创编辑性解读。',en:'This original essay draws on the sources below; its imagery and criticism are editorial interpretation.',ja:'本文は以下の資料に基づくオリジナルエッセイです。比喩や批評は編集上の解釈です。'};
const byId=new Map(essays.map(a=>[a.entityId,a])),images=new Map(art.map(a=>[a.entityId,a]));let final=[],provenance=[];
for(const n of targets){const a=byId.get(n.id),img=images.get(n.id);assert(a&&img,'Missing '+n.id);for(const l of ['zh','en','ja'])assert(img.alt?.[l]&&img.caption?.[l]&&a.locales?.[l],'Incomplete '+n.id+' '+l);const original=path.isAbsolute(img.file)?img.file:path.join(dir,'illustrations',img.file);assert(fs.existsSync(original),'Missing actual raster '+n.id);const ext=path.extname(original).toLowerCase();assert(['.webp','.jpg','.png'].includes(ext));const filename=n.id+ext,asset='/illustrations/'+filename;const copy={entityId:a.entityId,locales:structuredClone(a.locales),sources:structuredClone(a.sources),editorialNote:Object.fromEntries(['zh','en','ja'].map(l=>[l,[provenanceNote[l],...(n.reviewNotes||[]).filter(x=>x.status==='unresolved').map(x=>x.messages?.[l]||x.message)].join(' ')])),...(a.displayYear===null?{displayYear:null}:{})};copy.illustration={src:asset,alt:img.alt};for(const l of ['zh','en','ja'])copy.locales[l].caption=img.caption[l];final.push(copy);provenance.push({entityId:n.id,asset,kind:'original-conceptual-illustration',width:1000,height:750,sha256:crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex')});}
// Validate all joins before touching the Site's artifact files.
fs.mkdirSync('public/illustrations',{recursive:true});for(const n of targets){const img=images.get(n.id);const original=path.isAbsolute(img.file)?img.file:path.join(dir,'illustrations',img.file);fs.copyFileSync(original,'public/illustrations/'+n.id+path.extname(original).toLowerCase())}
fs.writeFileSync('public/articles.json',JSON.stringify(final,null,2)+'\n');fs.writeFileSync('data/illustration-provenance.json',JSON.stringify(provenance,null,2)+'\n');console.log(`Integrated ${final.length} trilingual essays and unique illustrated assets. Run tests/editorial.mjs before publishing.`);
