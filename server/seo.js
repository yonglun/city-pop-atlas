import '../public/routes.js';

const R = globalThis.CityPopRoutes;
export const PAGE_SIZE = 24;
const HREFLANG = {en:'en', zh:'zh-CN', ja:'ja'};
const GROUPS = new Set(['person_yellow_magic_orchestra','person_happy_end','person_sugar_babe','person_piper']);
const COPY = {
 en:{home:'Home',about:'About City Pop',browse:'Browse the archive',graph:'Explore the interactive graph',essay:'Editorial essay',context:'Catalog context',facts:'Current catalog facts',sources:'Sources and evidence',related:'Related entries and credits',updated:'Catalog last updated',year:'Catalog year',type:'Entry type',id:'Stable entry ID',original:'Original title',romanization:'Romanization',external:'External identifiers',credit:'Source',checked:'Checked',more:'Read entry',previous:'Previous',next:'Next',page:'Page',of:'of',scope:'A source-linked selection of Japanese popular music. Albums, compositions, recordings, release editions and ordered tracks are distinct entries; the entry count is not a count of unique songs.',intro:'Explore Japanese City Pop through artists, albums, songs and the people behind the credits. Read original essays, check the evidence and follow the connections.',count:'entries',read:'Start reading',privacy:'Privacy choices',note:'Editorial note',fullEssay:'Read the related full essay',changed:'Catalog evidence has changed since this introduction was prepared. The current facts below take precedence; the original essay is retained as editorial context.',ai:'Original AI-generated editorial illustration. A visual metaphor, not a historical photograph, portrait or original record cover.',notFound:'Page not found',missing:'This address does not identify an entry in the current public catalog.',services:'Verified platform links',playback:'Platform metadata was checked; playback, regional availability and audio-master equivalence are not guaranteed.',photo:'Photograph source and license',types:{artist:'Artists',person:'People and contributors',album:'Albums',song:'Songs',edition:'Release editions',track:'Ordered tracks',work:'Compositions',recording:'Recordings',label:'Labels'}},
 zh:{home:'首页',about:'关于 City Pop',browse:'浏览档案',graph:'探索交互图谱',essay:'原创专文',context:'目录背景',facts:'当前目录事实',sources:'来源与证据',related:'相关条目与署名',updated:'目录最后更新',year:'目录年份',type:'条目类型',id:'稳定条目标识',original:'原题',romanization:'罗马字',external:'外部标识',credit:'来源',checked:'核对日期',more:'阅读条目',previous:'上一页',next:'下一页',page:'第',of:'/',scope:'这是一份附有来源的日本流行音乐选集。专辑、词曲作品、录音、发行版本与有序曲目分别记录；条目数量不等于独立歌曲数量。',intro:'从艺人、专辑、歌曲与幕后署名探索日本 City Pop。阅读原创文章，核对资料来源，沿着关系发现更多音乐。',count:'个条目',read:'开始阅读',privacy:'隐私选择',note:'编辑说明',fullEssay:'阅读相关完整专文',changed:'目录证据自本篇介绍编写后已有变化。以下当前事实优先适用；原文保留为编辑性背景。',ai:'原创 AI 编辑插画。图像为视觉隐喻，并非历史照片、人物肖像或唱片原封面。',notFound:'页面不存在',missing:'此地址未对应当前公开目录中的条目。',services:'已核实的平台链接',playback:'已核对平台元数据；不保证可播放性、地区可用性或音频母带等同性。',photo:'照片来源与许可',types:{artist:'艺人',person:'人物与参与者',album:'专辑',song:'歌曲',edition:'发行版本',track:'有序曲目',work:'词曲作品',recording:'录音',label:'厂牌'}},
 ja:{home:'ホーム',about:'City Popについて',browse:'アーカイブを閲覧',graph:'インタラクティブなグラフへ',essay:'オリジナルエッセイ',context:'カタログの背景',facts:'現在のカタログ情報',sources:'出典と根拠',related:'関連項目とクレジット',updated:'カタログ最終更新',year:'カタログの年',type:'項目の種類',id:'固定項目ID',original:'原題',romanization:'ローマ字表記',external:'外部識別子',credit:'出典',checked:'確認日',more:'項目を読む',previous:'前へ',next:'次へ',page:'ページ',of:'/',scope:'出典に結び付けた日本のポピュラー音楽の選集です。アルバム、詞曲作品、録音、発売版、収録位置を区別し、項目数を独立した曲数とは見なしません。',intro:'アーティスト、アルバム、楽曲とクレジットを通して日本のCity Popを探索。オリジナルの文章を読み、出典を確認し、音楽のつながりをたどれます。',count:'項目',read:'読み始める',privacy:'プライバシー設定',note:'編集注記',fullEssay:'関連する長文を読む',changed:'この紹介文の作成後にカタログの根拠が更新されました。以下の現行情報を優先し、元の文章は編集上の背景として残しています。',ai:'AI生成のオリジナル編集イラスト。視覚的な比喩であり、歴史写真、人物の肖像、実際のレコードジャケットではありません。',notFound:'ページが見つかりません',missing:'このアドレスは現在の公開カタログの項目に対応していません。',services:'確認済みの配信リンク',playback:'配信元のメタデータを確認しています。再生、地域別配信、音源マスターの同一性は保証しません。',photo:'写真の出典とライセンス',types:{artist:'アーティスト',person:'人物と参加者',album:'アルバム',song:'楽曲',edition:'発売版',track:'収録位置',work:'詞曲作品',recording:'録音',label:'レーベル'}}
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsonScript = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
const label = (node, lang) => localized(node.labels, lang) || node.id;
const display = value => Array.isArray(value) ? value.map(display).join(', ') : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
const link = (path, text, attributes = '') => `<a href="${esc(path)}"${attributes}>${esc(text)}</a>`;
const paragraphs = values => (Array.isArray(values) ? values : []).map(p => `<p>${esc(p)}</p>`).join('');
function safeURL(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } }
function localImage(value) { return typeof value === 'string' && /^\/(?:illustrations|photos)\/[a-zA-Z0-9_.-]+\.(?:webp|png|jpg|jpeg|avif)$/.test(value) ? value : null; }
function date(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
 const day = value.slice(0,10); return new Date(day).toISOString().slice(0,10) === day ? value : null;
}
function latest(...values) { return values.flat().map(date).filter(Boolean).sort((a,b) => Date.parse(a) - Date.parse(b)).at(-1) || null; }

// An explicit, operator-configured public HTTPS DNS origin is required. Do not
// derive this value from Host, forwarded headers, browser state or Site URLs.
export function publicOrigin(env = {}) {
 if (typeof env.PUBLIC_ORIGIN !== 'string' || env.PUBLIC_ORIGIN !== env.PUBLIC_ORIGIN.trim()) return null;
 try {
  const u = new URL(env.PUBLIC_ORIGIN), host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash || !host.includes('.') || host.endsWith('.') || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host) || host === 'chatgpt.site' || host.endsWith('.chatgpt.site') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host) || !/^[a-z0-9.-]+$/.test(host)) return null;
  return u.origin;
 } catch { return null; }
}
export function isPublicSEO(request, env = {}) { return env.SEO_INDEXABLE === true && env.LINUX_AUTHENTICATED_ADMIN !== true && env.SITE_REVIEW_MODE !== 'owner-private' && publicOrigin(env) !== null && new URL(request.url).origin === publicOrigin(env); }
function schemaType(node) {
 if (node.type === 'artist') return GROUPS.has(node.id) || node.artistType === 'group' || node.attributes?.artistType?.value === 'group' ? 'MusicGroup' : 'Person';
 return {person:'Person',album:'MusicAlbum',song:'CreativeWork',edition:'MusicRelease',track:'ListItem',work:'MusicComposition',recording:'MusicRecording',label:'Organization'}[node.type] || 'Thing';
}
function articleFor(articles, id) { return articles instanceof Map ? articles.get(id) : Array.isArray(articles) ? articles.find(a => a.entityId === id) : null; }
function completeEssay(article, lang) {
 const copy = article?.locales?.[lang];
 return !!copy?.title && Array.isArray(copy.paragraphs) && copy.paragraphs.length >= 2 && copy.paragraphs.every(p => typeof p === 'string' && p.trim().length > 0) && Array.isArray(article.sources) && article.sources.some(s => safeURL(s.url));
}
export function isIndexableEntity(node, article, lang) {
 // Contextual introductions share text patterns and artwork. Keep them fully
 // accessible but noindex until an explicit editorial quality review changes
 // this policy. canonicalEntityId is an essay relationship, not an SEO canonical.
 return node.type !== 'track' && article?.kind !== 'contextual' && completeEssay(article, lang);
}
function sourceList(values, lang, heading = true) {
 const sources = new Map();
 for (const raw of values || []) { const s = typeof raw === 'string' ? {url:raw} : raw; const url = safeURL(s?.url || s?.sourceUrl); if (url && !sources.has(url)) sources.set(url, {...s,url}); }
 if (!sources.size) return '';
 return `${heading ? `<h2>${COPY[lang].sources}</h2>` : ''}<ul class="sources">${[...sources.values()].map(s => `<li>${link(s.url,s.title || new URL(s.url).hostname,' rel="noopener noreferrer"')}${s.publisher ? ` <span>${esc(s.publisher)}</span>` : ''}</li>`).join('')}</ul>`;
}
function sourceEvidence(value, lang) {
 const t = COPY[lang], url = safeURL(value?.sourceUrl);
 return `${url ? ` ${link(url, value.sourceType || t.credit,' rel="noopener noreferrer"')}` : ''}${date(value?.checkedAt) ? ` <small>${t.checked}: <time datetime="${esc(value.checkedAt)}">${esc(value.checkedAt)}</time></small>` : ''}`;
}
function entityFacts(node, catalog, lang) {
 const t = COPY[lang], definitions = new Map((catalog.properties || []).map(p => [p.key,localized(p.labels,lang)]));
 const rows = [[t.type,t.types[node.type] || node.type],[t.id,node.id]];
 if (node.originalJapanese) rows.push([t.original,node.originalJapanese]);
 if (node.romanization) rows.push([t.romanization,node.romanization]);
 if (node.year) rows.push([t.year,node.year]);
 const attrs = Object.entries(node.attributes || {}).filter(([,v]) => v && Object.hasOwn(v,'value'));
 return `<section id="facts"><h2>${t.facts}</h2><dl class="facts">${rows.map(([key,value]) => `<div><dt>${esc(key)}</dt><dd>${esc(display(value))}</dd></div>`).join('')}${attrs.map(([key,v]) => `<div><dt>${esc(definitions.get(key) || key)}</dt><dd>${esc(display(v.value))}${sourceEvidence(v,lang)}${localized(v.noteLabels || v.note,lang) ? `<p>${esc(localized(v.noteLabels || v.note,lang))}</p>` : ''}</dd></div>`).join('')}</dl>${Object.keys(node.externalIds || {}).length ? `<h3>${t.external}</h3><dl class="facts">${Object.entries(node.externalIds).map(([key,value]) => `<div><dt>${esc(key)}</dt><dd>${esc(display(value))}${sourceEvidence(node.externalIdEvidence?.[key],lang)}</dd></div>`).join('')}</dl>` : ''}</section>`;
}
const RELATIONS = {
 en:{released:'released',produced:'produced',producer:'producer',co_produced:'co-produced',member_of:'member of',performer:'performed',lyricist:'lyrics',composer:'composition',arranger:'arrangement',track_on:'track on',edition_of:'edition of',corresponds_to:'corresponds to',represents_work:'represents composition',recording_entry_for:'recording entry for',recording_of:'recording of'},
 zh:{released:'发行',produced:'制作',producer:'制作人',co_produced:'共同制作',member_of:'成员',performer:'演唱／演奏',lyricist:'作词',composer:'作曲',arranger:'编曲',track_on:'收录于',edition_of:'发行版本',corresponds_to:'对应',represents_work:'对应词曲作品',recording_entry_for:'对应录音条目',recording_of:'录音作品'},
 ja:{released:'発表',produced:'プロデュース',producer:'プロデューサー',co_produced:'共同制作',member_of:'メンバー',performer:'歌唱・演奏',lyricist:'作詞',composer:'作曲',arranger:'編曲',track_on:'収録',edition_of:'発売版',corresponds_to:'対応',represents_work:'詞曲作品に対応',recording_entry_for:'録音項目に対応',recording_of:'作品の録音'}
};
function relatedLinks(node, catalog, lang) {
 const index = new Map(catalog.nodes.map(n => [n.id,n]));
 const edges = (catalog.edges || []).filter(e => (e.source === node.id || e.target === node.id) && index.has(e.source) && index.has(e.target));
 const references = ['artistId','albumId','editionId','compositionEntryId','recordingId','legacyEntryId'].map(key => index.get(node[key])).filter(Boolean);
 if (!edges.length && !references.length) return '';
 return `<section id="related"><h2>${COPY[lang].related}</h2><ul class="relations">${references.map(n => `<li>${link(R.pathFor(n,lang),label(n,lang))} <small>${esc(COPY[lang].types[n.type])}</small></li>`).join('')}${edges.map(e => `<li>${link(R.pathFor(index.get(e.source),lang),label(index.get(e.source),lang))} <span>${esc(RELATIONS[lang][e.type] || e.type)}</span> ${link(R.pathFor(index.get(e.target),lang),label(index.get(e.target),lang))}${sourceList(e.sources,lang,false)}${Object.entries(e.attributes || {}).map(([k,v]) => `<small>${esc(k)}: ${esc(display(v?.value ?? v))}${sourceEvidence(v,lang)}</small>`).join('')}</li>`).join('')}</ul></section>`;
}
function art(article, lang, assets) {
 const src = localImage(article?.illustration?.src);
 if (!src || (assets && !assets[src])) return '';
 const copy = article.locales?.[lang];
 return `<figure><img src="${esc(src)}" alt="${esc(localized(article.illustration.alt,lang) || COPY[lang].ai)}" width="${Number(article.illustration.width) || 1000}" height="${Number(article.illustration.height) || 750}" fetchpriority="high"><figcaption>${esc(copy?.caption || COPY[lang].ai)}</figcaption></figure>`;
}
function entityBody(node, article, catalog, lang, assets) {
 const t = COPY[lang], copy = article?.locales?.[lang], canonical = catalog.nodes.find(n => n.id === article?.canonicalEntityId);
 const changed = Object.entries(node.attributes || {}).some(([key,value]) => value.reviewStatus === 'approved' || article?.contextEvidence?.authoredAttributes && JSON.stringify(value.value) !== JSON.stringify(article.contextEvidence.authoredAttributes[key]));
 const services = (node.serviceLinks || []).filter(s => s.status === 'verified' && safeURL(s.url));
 return `<article><header class="entry-header"><p class="eyebrow">${esc(t.types[node.type])}</p><h1>${esc(label(node,lang))}</h1><p class="dek">${esc(localized(node.description,lang))}</p>${date(node.updatedAt) ? `<p class="updated">${t.updated}: <time datetime="${esc(node.updatedAt)}">${esc(node.updatedAt)}</time></p>` : ''}</header>${changed ? `<aside class="notice"><p>${t.changed}</p></aside>` : ''}${entityFacts(node,catalog,lang)}${copy ? `<section id="essay"><p class="eyebrow">${article.kind === 'contextual' ? t.context : t.essay}</p><h2>${esc(copy.title)}</h2><p class="dek">${esc(copy.dek)}</p>${art(article,lang,assets)}<div class="essay-body">${paragraphs(copy.paragraphs)}</div>${localized(article.editorialNote,lang) ? `<aside><h3>${t.note}</h3><p>${esc(localized(article.editorialNote,lang))}</p></aside>` : ''}${canonical ? `<p>${link(R.pathFor(canonical,lang),t.fullEssay + ': ' + label(canonical,lang))}</p>` : ''}</section>` : ''}${relatedLinks(node,catalog,lang)}${services.length ? `<section><h2>${t.services}</h2><p>${t.playback}</p><ul>${services.map(s => `<li>${link(safeURL(s.url),s.service + (localized(s.versionLabels || s.version,lang) ? ': ' + localized(s.versionLabels || s.version,lang) : ''),' rel="noopener noreferrer"')}</li>`).join('')}</ul></section>` : ''}<section id="sources">${sourceList([...(node.sources || []),...(article?.sources || []),...Object.values(node.attributes || {}).filter(x=>x?.sourceUrl).map(x=>({url:x.sourceUrl,title:x.sourceType}))],lang)}</section></article>`;
}
// Keep pagination membership identical across languages so hreflang pages are
// genuine translations. Immutable IDs also avoid label-edit pagination drift.
function sortedNodes(catalog, type) { return catalog.nodes.filter(n => !type || n.type === type).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }
function listing(nodes,lang) { return `<ul class="entries">${nodes.map(n => `<li><h2>${link(R.pathFor(n,lang),label(n,lang))}</h2><p>${esc(localized(n.description,lang))}</p><small>${esc(COPY[lang].types[n.type] || n.type)}${n.year ? ' · ' + esc(n.year) : ''}</small></li>`).join('')}</ul>`; }
function directory(catalog,lang) { return `<ul class="directory">${R.types.map(type=>[type,catalog.nodes.filter(n=>n.type===type).length]).filter(([,count])=>count).map(([type,count])=>`<li>${link(R.browsePath(lang,type),COPY[lang].types[type])} <span>${count} ${COPY[lang].count}</span></li>`).join('')}</ul>`; }
function photosFor(about, position, lang, assets) {
 return (about.photos || []).filter(p=>p.afterParagraph===position && localImage(p.src) && (!assets || assets[p.src])).map(p=>`<figure><img loading="lazy" src="${esc(p.src)}" alt="${esc(localized(p.alt,lang))}" width="${Number(p.displayWidth)||1000}" height="${Number(p.displayHeight)||750}"><figcaption>${esc(localized(p.caption,lang))} ${safeURL(p.sourcePage) ? link(safeURL(p.sourcePage),COPY[lang].credit,' rel="noopener noreferrer"') : ''} ${safeURL(p.licenseUrl) ? link(safeURL(p.licenseUrl),p.license,' rel="license noopener noreferrer"') : ''}<p>${esc(localized(p.derivativeChanges,lang))}</p></figcaption></figure>`).join('');
}
const CSS = `:root{color-scheme:light;--ink:#171717;--muted:#626262;--line:#ddd;--accent:#006a83}*{box-sizing:border-box}body{margin:0;background:#fafafa;color:var(--ink);font:17px/1.7 system-ui,sans-serif}a{color:var(--accent);text-underline-offset:.2em}a:hover{text-decoration-thickness:2px}a:focus-visible,button:focus-visible{outline:3px solid #a75224;outline-offset:4px}.site-header,.site-footer{max-width:1120px;margin:auto;padding:24px;display:flex;flex-wrap:wrap;gap:18px;align-items:center}.brand{font-weight:800;letter-spacing:.08em;color:var(--ink);text-decoration:none}.site-header nav{display:flex;gap:18px;flex-wrap:wrap}.languages{margin-left:auto;display:flex;gap:14px}main{max-width:940px;margin:auto;padding:25px 24px 64px}h1{font-size:clamp(2rem,5vw,3.7rem);line-height:1.15;letter-spacing:-.035em}h2{font-size:1.65rem;line-height:1.3;margin-top:2rem}h3{font-size:1.15rem}.dek{font-size:1.15rem;color:var(--muted);max-width:76ch}.eyebrow,small,.updated,figcaption{color:var(--muted)}.eyebrow{letter-spacing:.08em}.breadcrumbs{font-size:.87rem;margin:1rem 0}.breadcrumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:.6em;padding:0}.breadcrumbs li+li:before{content:' / ';margin-right:.6em}section{margin:2.5rem 0}figure{margin:2rem 0}img{display:block;max-width:100%;height:auto;border-radius:12px}figcaption{font-size:.82rem;margin-top:12px}.facts{border-top:1px solid var(--line)}.facts>div{display:grid;grid-template-columns:minmax(150px,1fr) 3fr;border-bottom:1px solid var(--line);padding:14px 0;gap:20px}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}dd small{display:block}p{overflow-wrap:anywhere}.entries,.directory{padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.entries>li,.directory>li{padding:20px;border:1px solid var(--line);border-radius:12px;background:white}.entries h2{font-size:1.18rem;margin:0}.entries p{font-size:.94rem}.directory>li{display:flex;flex-direction:column}.sources{overflow-wrap:anywhere;font-size:.92rem}.relations>li{margin:15px 0}.relations .sources{margin-top:5px}.notice{padding:16px 24px;border-left:4px solid #aa6b1a;background:#fff5df}.essay-body{max-width:75ch}.pagination{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.pagination ol{display:flex;list-style:none;gap:12px;padding:0;flex-wrap:wrap}.site-footer{border-top:1px solid var(--line);font-size:.86rem}.skip-link{position:absolute;left:20px;top:-100px;background:white;padding:10px}.skip-link:focus{top:10px}.privacy-settings{border:1px solid var(--line);background:white;padding:8px 12px;border-radius:8px;color:var(--ink);cursor:pointer}.privacy-panel{position:fixed;z-index:10;bottom:15px;right:15px;background:white;border:1px solid var(--line);box-shadow:0 10px 50px #0003;border-radius:16px;max-width:min(530px,calc(100vw - 30px));max-height:80vh;overflow:auto;padding:24px}.privacy-panel h2{margin-top:0}.privacy-panel button{margin:6px;padding:9px}.privacy-links{font-size:.85rem}@media(max-width:600px){.entries,.directory{grid-template-columns:1fr}.facts>div{grid-template-columns:1fr;gap:5px}.languages{margin-left:0}.site-header{gap:10px}main{padding-top:10px}}`;
function routePath(route, lang) { return route.kind === 'entity' ? R.pathFor(route.node,lang) : route.kind === 'about' ? R.aboutPath(lang) : route.kind === 'browse' ? R.browsePath(lang,route.type,route.page) : R.homePath(lang); }
function breadcrumbs(route,lang) {
 const t=COPY[lang], crumbs=[{name:t.home,path:R.homePath(lang)}];
 if (route.kind==='entity') crumbs.push({name:t.browse,path:R.browsePath(lang)},{name:t.types[route.node.type],path:R.browsePath(lang,route.node.type)},{name:label(route.node,lang),path:route.path});
 else if(route.kind==='about') crumbs.push({name:t.about,path:route.path});
 else if(route.kind==='browse') {crumbs.push({name:t.browse,path:R.browsePath(lang)});if(route.type)crumbs.push({name:t.types[route.type]+(route.page>1?' · '+t.page+' '+route.page:''),path:route.path});}
 return crumbs;
}
function documentHTML({route,title,description,body,origin,indexable,modified,article,catalog}) {
 const lang=route.lang,t=COPY[lang],canonical=origin?origin+route.path:null,crumbs=breadcrumbs(route,lang);
 const robots=indexable?'index,follow,max-image-preview:large':'noindex,follow';
 const descriptor={kind:route.kind,lang,path:route.path,...(route.node?{entityId:route.node.id,node:{id:route.node.id,type:route.node.type}}:{}),...(route.kind==='browse'?{type:route.type,page:route.page}:{})};
 const webpage={'@type':route.kind==='about'?'AboutPage':route.kind==='browse'?'CollectionPage':'WebPage',...(canonical?{'@id':canonical+'#page',url:canonical}:{}),name:title,description,inLanguage:HREFLANG[lang],...(modified?{dateModified:modified}:{})};
 const graph=[webpage];
 if(canonical){graph.push({'@type':'WebSite','@id':origin+'/#website',url:origin+R.homePath('en'),name:'City Pop Atlas',inLanguage:['en','zh-CN','ja']});webpage.isPartOf={'@id':origin+'/#website'};graph.push({'@type':'BreadcrumbList',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.name,item:origin+c.path}))});}
 if(route.node){
  const node=route.node,entity={'@type':schemaType(node),...(canonical?{'@id':canonical+'#entity',url:canonical}:{}),name:label(node,lang),description:localized(node.description,lang),identifier:node.id};
  if(node.type==='track'&&Number.isSafeInteger(node.position)&&node.position>0)entity.position=node.position;
  if(canonical&&node.type==='edition'&&node.albumId){const album=catalog.nodes.find(n=>n.id===node.albumId);if(album)entity.releaseOf={'@id':origin+R.pathFor(album,lang)+'#entity'};}
  graph.push(entity);if(canonical)webpage.mainEntity={'@id':canonical+'#entity'};
  if(article?.locales?.[lang]){const copy=article.locales[lang];graph.push({'@type':'Article',headline:copy.title,description:copy.dek,inLanguage:HREFLANG[lang],...(canonical?{'@id':canonical+'#essay',mainEntityOfPage:{'@id':canonical+'#page'},about:{'@id':canonical+'#entity'}}:{}),citation:(article.sources||[]).map(s=>safeURL(s.url)).filter(Boolean),...(date(article.updatedAt)?{dateModified:article.updatedAt}:{})});}
 }
 return `<!doctype html><html lang="${HREFLANG[lang]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${robots}">${canonical?`<link rel="canonical" href="${esc(canonical)}">${R.languages.map(l=>`<link rel="alternate" hreflang="${HREFLANG[l]}" href="${esc(origin+routePath(route,l))}">`).join('')}<link rel="alternate" hreflang="x-default" href="${esc(origin+routePath(route,'en'))}">`:''}<meta property="og:type" content="${route.kind==='entity'?'article':'website'}"><meta property="og:site_name" content="City Pop Atlas"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:locale" content="${{en:'en_US',zh:'zh_CN',ja:'ja_JP'}[lang]}">${canonical?`<meta property="og:url" content="${esc(canonical)}">`:''}<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><link rel="icon" href="/favicon.svg"><style>${CSS}</style><script type="application/ld+json">${jsonScript({'@context':'https://schema.org','@graph':graph})}</script></head><body data-clarity-mask="true"><a class="skip-link" href="#main">${esc(t.more)}</a><header class="site-header"><a class="brand" href="${R.homePath(lang)}">CITY POP ATLAS</a><nav aria-label="${esc(t.browse)}">${link(R.browsePath(lang),t.browse)}${link(R.aboutPath(lang),t.about)}</nav><div class="languages" aria-label="Language">${R.languages.map(l=>link(routePath(route,l),{en:'English',zh:'中文',ja:'日本語'}[l],` lang="${HREFLANG[l]}" hreflang="${HREFLANG[l]}"${l===lang?' aria-current="page"':''}`)).join('')}</div></header><main id="main"><nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs.map((c,i)=>`<li>${i===crumbs.length-1?`<span aria-current="page">${esc(c.name)}</span>`:link(c.path,c.name)}</li>`).join('')}</ol>${body}<p>${link('/?view=graph'+(route.node?'&entity='+encodeURIComponent(route.node.id):'')+'&lang='+lang,t.graph)}</p></main><footer class="site-footer"><span>CITY POP ATLAS</span>${link(R.aboutPath(lang),t.about)}${link(R.browsePath(lang),t.browse)}<button id="privacy-settings" class="privacy-settings" aria-controls="privacy-panel" aria-expanded="false">${t.privacy}</button></footer><script src="/routes.js"></script><script>globalThis.CityPopPage=${jsonScript(descriptor)};</script><script src="/analytics.js"></script></body></html>`;
}
function response(request,body,status=200,type='text/html; charset=utf-8',headers={}) { return new Response(request.method==='HEAD'?null:body,{status,headers:{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}}); }
function notFound(request,lang='en') { const t=COPY[lang]||COPY.en;return response(request,`<!doctype html><html lang="${HREFLANG[lang]||'en'}"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>${esc(t.notFound)} · City Pop Atlas</title></head><body><main><h1>${t.notFound}</h1><p>${t.missing}</p>${link(R.browsePath(lang),t.browse)}</main></body></html>`,404,undefined,{'X-Robots-Tag':'noindex, follow'}); }
export function sitemapEntries({catalog,articles,about}) {
 const entries=[];
 for(const lang of R.languages){
  // A catalog-wide change is not evidence that this particular hub changed.
  // Omit hub modification dates until a page-specific revision is recorded.
  entries.push({path:R.homePath(lang),lastmod:null});
  if(about?.locales?.[lang])entries.push({path:R.aboutPath(lang),lastmod:date(about.updatedAt)});
  entries.push({path:R.browsePath(lang),lastmod:null});
  for(const type of R.types){const nodes=sortedNodes(catalog,type,lang);for(let page=1;page<=Math.ceil(nodes.length/PAGE_SIZE);page++)entries.push({path:R.browsePath(lang,type,page),lastmod:null});}
  for(const node of catalog.nodes){if(!R.types.includes(node.type))continue;const article=articleFor(articles,node.id);if(isIndexableEntity(node,article,lang))entries.push({path:R.pathFor(node,lang),lastmod:date(article?.updatedAt)?latest(node.updatedAt,article.updatedAt):null});}
 }
 return entries;
}

/** Same SSR HTML for people and crawlers. Only supplied public catalog rows are
 * rendered; request headers never select content. Worker owns DB reads/auth. */
export async function serveSEO(request,env={},context={}) {
 const url=new URL(request.url),path=url.pathname,publicMode=isPublicSEO(request,env),origin=publicMode?publicOrigin(env):null;
 const special=path==='/robots.txt'||path==='/sitemap.xml';
 if(!special&&!/^\/(?:en|zh|ja)(?:\/|$)/.test(path))return null;
 if(!['GET','HEAD'].includes(request.method))return response(request,'Method not allowed',405,'text/plain; charset=utf-8',{'Allow':'GET, HEAD','X-Robots-Tag':'noindex, follow'});
 if(path==='/robots.txt')return response(request,publicMode?`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n',200,'text/plain; charset=utf-8',{'X-Robots-Tag':'noindex, follow'});
 const {catalog,articles=[],about=null,assets}=context;
 if(!catalog||!Array.isArray(catalog.nodes))return response(request,'Catalog temporarily unavailable',503,'text/plain; charset=utf-8',{'Retry-After':'60','X-Robots-Tag':'noindex, follow'});
 if(path==='/sitemap.xml'){
  if(!publicMode||url.search)return notFound(request);
  const entries=sitemapEntries({catalog,articles,about});
  return response(request,`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.map(e=>`<url><loc>${esc(origin+e.path)}</loc>${R.languages.map(lang=>`<xhtml:link rel="alternate" hreflang="${HREFLANG[lang]}" href="${esc(origin+e.path.replace(/^\/(?:en|zh|ja)(?=\/)/,'/'+lang))}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${esc(origin+e.path.replace(/^\/(?:en|zh|ja)(?=\/)/,'/en'))}"/>${e.lastmod?`<lastmod>${esc(e.lastmod)}</lastmod>`:''}</url>`).join('')}</urlset>`,200,'application/xml; charset=utf-8',{'X-Robots-Tag':'noindex, follow'});
 }
 const route=R.parsePath(path,catalog);
 if(!route)return notFound(request,path.split('/')[1]);
 if(route.kind==='about'&&!about?.locales?.[route.lang])return notFound(request,route.lang);
 if(route.kind==='browse'&&route.type){const count=catalog.nodes.filter(n=>n.type===route.type).length;if(!count||route.page>Math.ceil(count/PAGE_SIZE))return notFound(request,route.lang);}
 if(route.redirect)return response(request,'',308,'text/plain; charset=utf-8',{'Location':route.redirect+url.search,'X-Robots-Tag':'noindex, follow'});
 const lang=route.lang,t=COPY[lang];let title,description,body,article=null,indexable=publicMode&&!url.search,modified=null;
 if(route.kind==='entity'){
  article=articleFor(articles,route.node.id);indexable=indexable&&isIndexableEntity(route.node,article,lang);
  title=label(route.node,lang)+' · '+t.types[route.node.type]+' · City Pop Atlas';description=localized(route.node.description,lang)||article?.locales?.[lang]?.dek||t.intro;
  body=entityBody(route.node,article,catalog,lang,assets);modified=article?(date(article.updatedAt)?latest(route.node.updatedAt,article.updatedAt):null):date(route.node.updatedAt);
 }else if(route.kind==='about'){
  const copy=about?.locales?.[lang];if(!copy)return notFound(request,lang);
  title=copy.title+' · City Pop Atlas';description=copy.dek;modified=date(about.updatedAt);
  body=`<article><header><p class="eyebrow">${esc(copy.eyebrow)}</p><h1>${esc(copy.title)}</h1><p class="dek">${esc(copy.dek)}</p></header><div class="essay-body">${copy.paragraphs.map((p,i)=>`<p>${esc(p)}</p>${photosFor(about,i+1,lang,assets)}`).join('')}</div>${copy.scope?`<section><h2>${esc(copy.scope.title)}</h2>${paragraphs(copy.scope.paragraphs)}</section>`:''}<section id="sources">${sourceList(about.sources,lang)}</section></article>`;
 }else if(route.kind==='browse'){
  title=(route.type?t.types[route.type]:t.browse)+(route.page>1?' · '+t.page+' '+route.page:'')+' · City Pop Atlas';description=t.scope;
  if(!route.type){body=`<h1>${t.browse}</h1><p class="dek">${t.scope}</p>${directory(catalog,lang)}`;modified=null;}
  else{
   const nodes=sortedNodes(catalog,route.type,lang),pages=Math.ceil(nodes.length/PAGE_SIZE);if(route.page>pages||!pages)return notFound(request,lang);
   const pageNodes=nodes.slice((route.page-1)*PAGE_SIZE,route.page*PAGE_SIZE);modified=null;
   body=`<h1>${esc(t.types[route.type])}${route.page>1?' · '+t.page+' '+route.page:''}</h1><p class="dek">${nodes.length} ${t.count}. ${t.scope}</p>${listing(pageNodes,lang)}${pages>1?`<nav class="pagination" aria-label="${esc(t.page)}">${route.page>1?link(R.browsePath(lang,route.type,route.page-1),t.previous,' rel="prev"'):''}<span>${t.page} ${route.page} ${t.of} ${pages}</span>${route.page<pages?link(R.browsePath(lang,route.type,route.page+1),t.next,' rel="next"'):''}<ol>${Array.from({length:pages},(_,i)=>`<li>${i+1===route.page?`<span aria-current="page">${i+1}</span>`:link(R.browsePath(lang,route.type,i+1),i+1)}</li>`).join('')}</ol></nav>`:''}`;
  }
 }else{
  title='City Pop Atlas · '+t.browse;description=t.intro;modified=null;
  const featured=catalog.nodes.filter(n=>isIndexableEntity(n,articleFor(articles,n.id),lang)).slice(0,12);
  body=`<h1>City Pop Atlas</h1><p class="dek">${t.intro}</p><p>${t.scope}</p><p>${catalog.nodes.length} ${t.count}</p><h2>${t.browse}</h2>${directory(catalog,lang)}<h2>${t.read}</h2>${listing(featured,lang)}`;
 }
 return response(request,documentHTML({route,title,description,body,origin,indexable,modified,article,catalog}),200,undefined,{'X-Robots-Tag':indexable?'index, follow, max-image-preview:large':'noindex, follow','Content-Language':HREFLANG[lang]});
}
