import fs from 'node:fs';import assert from 'node:assert/strict';
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8')),index=new Map(catalog.nodes.map(n=>[n.id,n]));
for(const edition of catalog.nodes.filter(n=>n.type==='edition')){
 assert.equal(index.get(edition.albumId)?.type,'album',edition.id+' album concept');
 const tracks=catalog.nodes.filter(n=>n.type==='track'&&n.editionId===edition.id).sort((a,b)=>a.position-b.position);
 assert.equal(tracks.length,edition.attributes.trackCount.value,edition.id+' complete track count');
 assert.deepEqual(tracks.map(t=>t.position),Array.from({length:tracks.length},(_,i)=>i+1),edition.id+' contiguous order');
 assert.equal(new Set(tracks.map(t=>t.slotLabel)).size,tracks.length,edition.id+' unique slots');
 assert(catalog.edges.some(e=>e.source===edition.id&&e.target===edition.albumId&&e.type==='edition_of'));
 for(const track of tracks){assert(track.attributes.trackTitle.value,track.id);assert(catalog.edges.some(e=>e.source===track.id&&e.target===edition.id&&e.type==='track_on'));if(track.compositionEntryId)assert.equal(index.get(track.compositionEntryId)?.type,'song');if(track.recordingId)assert.equal(index.get(track.recordingId)?.type,'recording');}
}
for(const work of catalog.nodes.filter(n=>n.type==='work'))if(work.legacyEntryId)assert.equal(index.get(work.legacyEntryId)?.type,'song');
for(const node of catalog.nodes)for(const link of node.serviceLinks||[]){const same=(node.serviceLinks||[]).filter(l=>l.url===link.url);assert.equal(same.length,1,node.id+' duplicate link')}
console.log('PASS edition identity, contiguous track order, complete counts, link uniqueness and referenced entity layers');

// Known edition boundaries: interludes, bonuses and names shared by different artists.
for(const [id,count] of [['edition_for_you_2023_bvjl90',12],['edition_ride_on_time_2023_bvjl91',9],['edition_variety_2014_wpcl12007',18],['edition_request_2017_wpcl12756',16]])assert.equal(index.get(id).attributes.trackCount.value,count);
assert.equal(index.get('edition_ride_on_time_2023_bvjl91_track_a3').compositionEntryId,null);
assert.equal(index.get('edition_for_you_2023_bvjl90_track_a4').compositionEntryId,'song_morning_glory');
assert.equal(index.get('edition_variety_2014_wpcl12007_track_2').compositionEntryId,'song_plastic_love');
for(const number of [13,14,17])assert.equal(index.get('edition_variety_2014_wpcl12007_track_'+number).compositionEntryId,null);
assert.equal(catalog.nodes.filter(n=>n.editionId==='edition_for_you_2023_bvjl90'&&n.attributes.trackKind?.value==='interlude').length,4);
assert.equal(catalog.nodes.filter(n=>['edition_variety_2014_wpcl12007','edition_request_2017_wpcl12756'].includes(n.editionId)&&n.attributes.trackKind?.value==='anniversary_bonus').length,13);
assert.equal(index.get('album_variety').attributes.releaseDate.value,'1984-04-25');assert.equal(index.get('album_request').attributes.releaseDate.value,'1987-08-12');

assert.equal(index.get('edition_a_long_vacation_2021_srgl1000').attributes.trackCount.value,10);
assert.equal(index.get('edition_each_time_2024_srgl888').attributes.trackCount.value,11);
assert.equal(index.get('edition_a_long_vacation_2021_srgl1000_track_01').attributes.trackTitle.sourceType,'retailer');
assert.equal(index.get('edition_a_long_vacation_2021_srgl1000').attributes.releaseDate.value,'2021-08-04');
assert.equal(index.get('album_a_long_vacation').attributes.releaseDate.value,'1981-03-21');
assert.equal(index.get('album_each_time').attributes.releaseDate.value,'1984-03-21');
for(const i of ['10','11'])assert.equal(index.get('edition_each_time_2024_srgl888_track_'+i).attributes.trackKind.value,'bonus_track');

// New songs link to compositions and edition slots without asserting recording equivalence.
for(const id of ['kimi_wa_tennenshoku','canaria_shoto_nite','ame_no_wednesday','koisuru_karen','natsu_no_paperback','peppermint_blue']){assert.equal(index.get('song_'+id).type,'song');assert.equal(index.get('work_'+id).type,'work');assert(catalog.edges.some(e=>e.source==='song_'+id&&e.target==='work_'+id&&e.type==='represents_work'));assert(catalog.nodes.some(n=>n.type==='track'&&n.compositionEntryId==='song_'+id&&n.recordingId===null))}
assert(index.get('person_eiichi_ohtaki').aliases.includes('多羅尾伴内'));
for(const id of ['song_natsu_no_paperback','song_peppermint_blue'])assert(!catalog.edges.some(e=>e.target===id&&e.type==='arranger'));
assert.equal(catalog.edges.filter(e=>e.type==='arranger'&&e.attributes?.creditedAs==='多羅尾伴内').length,4);
