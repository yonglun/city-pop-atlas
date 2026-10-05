import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const articles=JSON.parse(fs.readFileSync('public/articles.json','utf8'));
const songs=data.nodes.filter(n=>n.type==='song');
const songIds=new Set(songs.map(n=>n.id));
const essays=articles.filter(a=>songIds.has(a.entityId));
assert(songs.length>=44);assert.equal(essays.length,songs.length);
assert.equal(new Set(essays.map(a=>a.entityId)).size,songs.length);
const report=[];
for(const locale of ['zh','en','ja']){
 const titles=new Set(),paragraphs=new Set();
 for(const a of essays){
  const copy=a.locales[locale];
  assert(!titles.has(copy.title),'Repeated title '+a.entityId);titles.add(copy.title);
  for(const p of copy.paragraphs){assert(!paragraphs.has(p),'Repeated song-essay paragraph '+a.entityId);paragraphs.add(p);assert(!/\b(?:TODO|TBD|lorem ipsum)\b/i.test(p),'Placeholder '+a.entityId)}
  assert.deepEqual(a.lyricQuotes,[],'No lyrics are reproduced in the song essays');
  assert.equal(a.illustration.src,'/illustrations/'+a.entityId+'.webp','Use this song’s own original illustration');
  assert(/AI/.test(copy.caption),'Disclose AI illustration provenance');
  assert(a.sources.length>=1);assert.equal(new Set(a.sources.map(s=>s.url)).size,a.sources.length,'Duplicate sources');
  for(const s of a.sources){const url=new URL(s.url);assert.equal(url.protocol,'https:');assert(!url.username&&!url.password);assert(!/example\.(?:com|org)|localhost/.test(url.hostname));}
  const length=locale==='en'?copy.paragraphs.join(' ').split(/\s+/).length:[...copy.paragraphs.join('')].length;
  report.push({id:a.entityId,locale,length,paragraphs:copy.paragraphs.length});
 }
}
assert.equal(report.length,songs.length*3);
console.log(`PASS all ${songs.length} songs / ${report.length} language versions: complete coverage, unique paragraphs and titles, source hygiene, zero lyric excerpts, accurate art provenance`);
