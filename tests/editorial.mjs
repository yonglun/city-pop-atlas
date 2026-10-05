import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const allArticles=JSON.parse(fs.readFileSync('public/articles.json','utf8'));
const articles=allArticles.filter(a=>a.kind!=='contextual');
assert.equal(allArticles.length,755);
const targets=catalog.nodes.filter(n=>['artist','person','album','song'].includes(n.type));
assert.equal(targets.filter(n=>n.type!=='song').length,84);assert.equal(targets.filter(n=>n.type==='song').length,44);assert.equal(targets.length,128);assert.equal(articles.length,targets.length);
const ids=new Set(),hashes=new Set();let report=[];
for(const a of articles){assert(!ids.has(a.entityId),'Duplicate essay '+a.entityId);ids.add(a.entityId);assert(targets.some(n=>n.id===a.entityId),'Unknown essay target '+a.entityId);assert(a.sources?.length,'Missing sources '+a.entityId);for(const src of a.sources){assert(/^https:\/\//.test(src.url),'Unsafe source');assert(src.title?.trim(),'Missing source title')}
 const isSong=targets.find(n=>n.id===a.entityId).type==='song';
 for(const l of ['zh','en','ja']){const c=a.locales?.[l];assert(c?.title?.trim()&&c.dek?.trim(),a.entityId+' incomplete '+l);assert(c.paragraphs?.length>=4,a.entityId+' needs substantive paragraphs');assert(c.paragraphs.every(p=>typeof p==='string'&&p.trim().length>30),a.entityId+' invalid paragraph');const length=l==='en'?c.paragraphs.join(' ').split(/\s+/).length:[...c.paragraphs.join('')].length;assert(length>=({zh:600,en:300,ja:700})[l],`${a.entityId} ${l} too short (${length})`);assert(c.caption?.trim(),'Missing art caption '+a.entityId);assert(a.illustration?.alt?.[l]?.trim(),'Missing art alt '+a.entityId);assert(a.editorialNote?.[l]?.trim(),'Missing editorial note '+a.entityId);report.push({entityId:a.entityId,language:l,length,paragraphs:c.paragraphs.length})}
 if(isSong){assert(a.illustration.src.includes('/song_'),'Song-specific art required');assert.deepEqual(a.lyricQuotes,[],'Song essays use original commentary without lyric excerpts')}
 assert(/^\/illustrations\/[a-z0-9_-]+\.(webp|jpg|png)$/.test(a.illustration.src),'Unsafe art path '+a.entityId);const filename=path.join('public',a.illustration.src);assert(fs.existsSync(filename),'Missing art '+a.entityId);const bytes=fs.readFileSync(filename);assert(bytes.length>1000,'Invalid illustration');assert(bytes.subarray(0,4).toString()==='RIFF'||bytes[0]===0xff||bytes.subarray(1,4).toString()==='PNG','Art must be real raster');const hash=crypto.createHash('sha256').update(bytes).digest('hex');assert(!hashes.has(hash),'Repeated illustration '+a.entityId);hashes.add(hash);
}
assert(targets.every(n=>ids.has(n.id)));assert.equal(report.length,384);assert.equal(hashes.size,128);console.log('PASS all 128 original essays × 3 substantial language versions, including all 44 songs, valid sources and 128 unique illustration slots');
console.log(JSON.stringify({essays:articles.length,versions:report.length,uniqueIllustrations:hashes.size,minimumLengths:Object.fromEntries(['zh','en','ja'].map(l=>[l,Math.min(...report.filter(x=>x.language===l).map(x=>x.length))]))}));
const corrected=catalog.nodes.find(n=>n.id==='album_a_long_vacation');assert.equal(corrected.attributes.releaseDate.value,'1981-03-21');for(const k of ['releaseDate','datePrecision'])assert.equal(corrected.attributes[k].sourceUrl,'https://www.sonymusic.co.jp/artist/EiichiOhtaki/info/522862');
