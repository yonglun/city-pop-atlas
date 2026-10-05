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

// Official edition collection: keep physical, digital and alternate-version boundaries.
const collectedEditions=[
 ['edition_fuyu_kukan_2022_wpcl13367','album_fuyu_kukan','2022-02-23','WPCL-13367','SACD hybrid'],
 ['edition_cologne_2016_vicl64506','album_cologne','2016-01-20','VICL-64506','CD'],
 ['edition_sexy_robot_2021_cokm43424','album_sexy_robot','2021-09-22','COKM-43424','Digital']
];
for(const [id,album,date,number,format] of collectedEditions){
 const edition=index.get(id);assert.equal(edition.albumId,album);
 assert.equal(edition.attributes.releaseDate.value,date);assert.equal(edition.attributes.catalogNumber.value,number);
 assert.equal(edition.attributes.format.value,format);assert.equal(edition.attributes.trackCount.value,10);
 const tracks=catalog.nodes.filter(n=>n.editionId===id);assert.equal(tracks.length,10);
 assert(tracks.every(t=>t.recordingId===null&&t.serviceLinks.length===0),'No inferred exact recording or playback identity');
}
assert.equal(index.get('edition_fuyu_kukan_2022_wpcl13367_track_04').attributes.recordingVersion.value,'3:32 version');
assert.equal(index.get('edition_fuyu_kukan_2022_wpcl13367_track_10').attributes.trackKind.value,'bonus_track');
assert.equal(index.get('edition_fuyu_kukan_2022_wpcl13367_track_05').compositionEntryId,'song_midnight_pretenders');
assert.equal(index.get('edition_cologne_2016_vicl64506_track_03').compositionEntryId,'song_dress_down');
assert.equal(index.get('album_fuyu_kukan').year,1983);assert.equal(index.get('album_cologne').year,1986);assert.equal(index.get('album_sexy_robot').year,1983);
for(const [person,role] of [['person_kaoru_akimoto','lyricist'],['person_satoshi_takebe','produced']])assert(catalog.edges.some(e=>e.source===person&&e.target==='album_cologne'&&e.type===role&&e.attributes.role==='original_album_scope'));
const semanticEdges=catalog.edges.map(e=>JSON.stringify([e.source,e.target,e.type,Object.entries(e.attributes||{}).sort()]));
assert.equal(new Set(semanticEdges).size,semanticEdges.length,'No duplicate semantic relationships');
const properties=new Map(catalog.properties.map(p=>[p.key,p]));assert.equal(properties.size,catalog.properties.length);
for(const n of catalog.nodes)for(const key of Object.keys(n.attributes||{})){assert(properties.has(key),n.id+' undefined property '+key);for(const lang of ['zh','en','ja'])assert(properties.get(key).labels[lang]);}
const hayashi=index.get('person_tetsuji_hayashi');assert(hayashi.media.some(m=>m.kind==='portrait'&&m.license==='CC BY 3.0'&&m.rightsVerification?.sourceUrl==='https://www.youtube.com/watch?v=sbdmjgzAoPY'));
assert.equal(hayashi.portraitEmbed.status,'verified','Preserve existing official provider portrait');
console.log('PASS new official editions, version boundaries, album-scope credits, portrait provenance and property localization');

// 2026-10-03 six-album coverage batch: exact official editions and 56 ordered slots.
const secondBatch=[
 ['edition_sea_breeze_1994_bvcr1517','album_sea_breeze','1994-12-16','BVCR-1517','CD',8],
 ['edition_after_5_clash_1994_bvcr1520','album_after_5_clash','1994-12-16','BVCR-1520','CD',9],
 ['edition_full_moon_2007_vicl62684','album_full_moon','2007-12-19','VICL-62684','CD',10],
 ['edition_flapper_2020_mhcl10125','album_flapper','2020-07-22','MHCL-10125','CD/SACD hybrid',10],
 ['edition_twilight_zone_2020_mhcl10126','album_twilight_zone','2020-07-22','MHCL-10126','CD/SACD hybrid',9],
 ['edition_down_town_2024_mhcl31017','album_down_town_album','2024-09-25','MHCL-31017','Blu-spec CD2 (BSCD2)',10]
];
for(const [id,album,date,number,format,count] of secondBatch){
 const edition=index.get(id);assert.equal(edition.albumId,album);assert.equal(edition.attributes.releaseDate.value,date);assert.equal(edition.attributes.catalogNumber.value,number);assert.equal(edition.attributes.format.value,format);assert.equal(edition.attributes.trackCount.value,count);
 const tracks=catalog.nodes.filter(n=>n.editionId===id);assert.equal(tracks.length,count);assert(tracks.every(n=>n.recordingId===null&&n.externalIds&&Object.keys(n.externalIds).length===0&&n.serviceLinks.length===0));
 for(const n of [edition,...tracks]){assert.equal(n.updatedAt,'2026-10-03');assert(n.sources.every(u=>/^https:\/\//.test(u)));for(const a of Object.values(n.attributes)){assert.equal(a.sourceType,'official');assert.equal(a.checkedAt,'2026-10-03');}for(const l of ['zh','en','ja'])assert(n.description[l]);}
}
const fullMoon=index.get('edition_full_moon_2007_vicl62684');for(const l of ['zh','en','ja'])assert(fullMoon.description[l].includes('2008-10-22'),'Shop-date discrepancy visible in every locale');
assert.equal(index.get('edition_twilight_zone_2020_mhcl10126_track_05').attributes.recordingVersion.value,'album version; 2020 remaster');
assert.notEqual(index.get('edition_twilight_zone_2020_mhcl10126_track_01').attributes.trackTitle.value,index.get('edition_twilight_zone_2020_mhcl10126_track_09').attributes.trackTitle.value);
assert.equal(index.get('edition_down_town_2024_mhcl31017_track_01').compositionEntryId,'song_down_town_epo');
const medley=index.get('edition_down_town_2024_mhcl31017_track_06');assert.equal(medley.attributes.trackTitle.value,'ポップ･ミュージック ～ DOWN TOWN');assert.equal(medley.compositionEntryId,null);assert.equal(medley.recordingId,null);
assert.equal(index.get('edition_down_town_2024_mhcl31017_track_07').attributes.trackTitle.value,'アスファルト・ひとり･･････');
assert(catalog.edges.some(e=>e.source==='person_epo'&&e.target==='album_down_town_album'&&e.type==='released'));

console.log('PASS six official edition identities, 56 slots, source-date discrepancy, album-version and composite-title boundaries');

// 2026-10-03: six previously uncovered albums, preserving physical edition boundaries.
const thirdBatch=[
 ['edition_circus_town_2023_bvjl95','album_circus_town','2023-08-02','BVJL-95','LP',8],
 ['edition_spacy_2023_bvjl94','album_spacy','2023-08-02','BVJL-94','LP',10],
 ['edition_love_songs_2019_bvcl942','album_love_songs','2019-01-23','BVCL-942','CD',16],
 ['edition_who_are_you_2009_pcca50027','album_who_are_you','2009-01-21','PCCA.50027','HQCD',10],
 ['edition_transit_2022_upcy90069','album_transit','2022-06-29','UPCY-90069','CD',10],
 ['edition_tea_for_tears_2009_upcy6535','album_tea_for_tears','2009-06-10','UPCY-6535','CD',14]
];
for(const [id,album,date,number,format,count] of thirdBatch){
 const e=index.get(id);assert.equal(e.albumId,album);assert.equal(e.attributes.releaseDate.value,date);assert.equal(e.attributes.catalogNumber.value,number);assert.equal(e.attributes.format.value,format);assert.equal(e.attributes.trackCount.value,count);
 const tracks=catalog.nodes.filter(n=>n.editionId===id);assert.equal(tracks.length,count);assert(tracks.every(n=>n.recordingId===null&&Object.keys(n.externalIds).length===0&&n.serviceLinks.length===0));
 for(const n of [e,...tracks]){for(const a of Object.values(n.attributes)){assert.equal(a.sourceType,'official');assert.equal(a.checkedAt,'2026-10-03');assert(n.sources.includes(a.sourceUrl));}for(const l of ['zh','en','ja'])assert(n.description[l]);}
}
for(const [id,sideCount] of [['edition_circus_town_2023_bvjl95',4],['edition_spacy_2023_bvjl94',5]]){
 const e=index.get(id);assert.equal(e.attributes.vinylWeightGrams.value,180);assert.equal(e.attributes.discCount.value,1);assert.equal(e.attributes.productionEdition.value,'limited edition');assert.equal(e.attributes.recordingVersion.value,'2023 remaster and vinyl cutting');
 const tracks=catalog.nodes.filter(n=>n.editionId===id).sort((a,b)=>a.position-b.position);
 assert.deepEqual(tracks.map(n=>n.slotLabel),['A','B'].flatMap(side=>Array.from({length:sideCount},(_,i)=>side+(i+1))));
}
assert.equal(index.get('edition_love_songs_2019_bvcl942_track_09').compositionEntryId,'song_september');
for(let p=12;p<=16;p++){
 const t=index.get('edition_love_songs_2019_bvcl942_track_'+p);assert.equal(t.attributes.trackKind.value,'anniversary_bonus');assert(t.attributes.trackTitle.value.includes('LIVE Ver.'));assert.equal(t.compositionEntryId,null);assert.equal(t.recordingId,null);assert(t.attributes.recordingVersion.value.includes(p<=14?'1981-08-25':'1981-12-22'));
 for(const l of ['zh','en','ja'])assert(t.attributes.recordingVersion.noteLabels[l]);
}
assert.equal(index.get('edition_who_are_you_2009_pcca50027').attributes.recordingVersion.value,'2009 digital remaster');
assert.equal(index.get('edition_transit_2022_upcy90069_track_07').compositionEntryId,'song_flyday_chinatown');
assert.equal(index.get('edition_tea_for_tears_2009_upcy6535_track_05').compositionEntryId,'song_telephone_number');
assert(catalog.nodes.filter(n=>n.editionId==='edition_tea_for_tears_2009_upcy6535').every(n=>!n.attributes.trackKind),'Tea bonus positions are not individually identified by source');
assert.equal(index.get('edition_transit_2022_upcy90069').attributes.recordingVersion,undefined,'No invented TRANSIT remaster');
assert(catalog.edges.some(e=>e.source==='person_yasuha'&&e.target==='album_transit'&&e.type==='composer'&&e.attributes.role==='original_album_scope'));
for(const [person,album] of [['person_mariya_takeuchi','album_love_songs'],['person_junko_ohashi','album_tea_for_tears']])assert(catalog.edges.some(e=>e.source===person&&e.target===album&&e.type==='released'));
assert(catalog.nodes.length>=826);assert(catalog.edges.length>=1188);
assert(catalog.nodes.filter(n=>n.type==='edition').length>=50);assert(catalog.nodes.filter(n=>n.type==='track').length>=541);
console.log('PASS six further official editions, 68 positions, LP sides, five qualified live bonuses and album-scope credits');

const exactThirdBatchOrder=JSON.parse(fs.readFileSync('tests/fixtures/official-editions-2026-10-03.json','utf8'));
for(const [id,expected] of Object.entries(exactThirdBatchOrder))assert.deepEqual(catalog.nodes.filter(n=>n.editionId===id).sort((a,b)=>a.position-b.position).map(n=>({position:n.position,slotLabel:n.slotLabel,title:n.attributes.trackTitle.value})),expected,id+' exact source-verified titles and side order');
console.log('PASS frozen official titles and side order for every one of the 68 new positions');
