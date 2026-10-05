"""Integrate the bounded 2026-10-05 official CD edition evidence and matching introductions.

All facts come from the checked-in collection manifest. This script never changes
live review state or asserts recording equivalence. Existing articles are kept.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATE = '2026-10-05'
manifest = json.loads((ROOT / 'docs/COLLECTION-2026-10-05-CD-EDITIONS.json').read_text())
catalog = json.loads((ROOT / 'data/catalog.json').read_text())
articles = json.loads((ROOT / 'public/articles.json').read_text())
nodes = {n['id']: n for n in catalog['nodes']}
article_index = {a['entityId']: a for a in articles}
LANGS = ['zh', 'en', 'ja']


def translated(zh, en, ja):
    return dict(zip(LANGS, [zh, en, ja]))


def evidence(spec, key, value, notes=None, track=None):
    e = dict((track if track is not None else spec).get('attributeEvidence', {}).get(key, {}))
    result = dict(value=value, sourceUrl=e.get('sourceUrl', spec['sourceUrl']),
                  sourceType=e.get('sourceType', 'official'), checkedAt=DATE)
    if notes:
        result['noteLabels'] = notes
    if e.get('noteLabels'):
        result['noteLabels'] = e['noteLabels']
    return result


def add_node(n):
    assert n['id'] not in nodes, f"Refuse duplicate node {n['id']}"
    catalog['nodes'].append(n)
    nodes[n['id']] = n


def add_edge(source, target, kind, url):
    key = '|'.join([source, target, kind])
    edge = dict(id='rel_' + hashlib.sha256(key.encode()).hexdigest()[:20],
                source=source, target=target, type=kind, sources=[url],
                status='sourced', checkedAt=DATE, attributes={})
    assert not any(e['source'] == source and e['target'] == target and e['type'] == kind for e in catalog['edges'])
    catalog['edges'].append(edge)


def article_base(node, spec):
    canonical = article_index[spec['albumId']]
    title = spec['title']
    return dict(entityId=node['id'], kind='contextual', canonicalEntityId=spec['albumId'],
        locales={}, sources=[dict(title=spec['sourceTitle'] if url == spec['sourceUrl'] else
               ('Official artist/label evidence' if any(h in url for h in ['tatsuro.co.jp','sonymusic','universal-music']) else 'Additional release evidence'), url=url)
               for url in dict.fromkeys([*node['sources'], *spec.get('sources',[])])],
        editorialNote=translated(
            '本条目根据所列来源，说明具体发行版与曲目位置；保留官方附加曲及版本标记，不把目录资料当作独立音频鉴定。完整主题文章见相关长文。',
            'This introduction describes the exact edition and track position using the sources below. Source-specific bonus and version labels are retained; catalog metadata is not independent audio verification. The linked essay gives the broader musical context.',
            '以下の出典から個別の発売版と収録位置を説明します。公式のボーナス曲・バージョン表記を保持し、カタログ情報を独立した音源鑑定とは見なしません。音楽的な背景は関連する長文をご覧ください。'),
        illustration=dict(shared=True, sharedFromEntityId=spec['albumId'], src=canonical['illustration']['src'],
            width=canonical['illustration'].get('width',1000), height=canonical['illustration'].get('height',750),
            alt=translated(f'与《{title}》长文共用的象征性编辑插画', f'Symbolic editorial illustration shared with the {title} essay', f'「{title}」の長文と共用する象徴的な編集イラスト')),
        sharedIllustration=dict(kind='shared', canonicalEntityId=spec['albumId'], sourceArticleEntityId=spec['albumId'],isArchival=False,isOriginalCover=False),
        contextEvidence=dict(mappingBasis='albumId' if node['type']=='edition' else 'editionId → albumId',
            sourceSnapshotDate=DATE, authoredAttributes={k:v['value'] for k,v in node['attributes'].items()}, independentAudioVerification=False))


def caption(spec, lang):
    name=article_index[spec['albumId']]['locales'][lang]['title']
    return translated(
        f'共用长文《{name}》的原创AI编辑插画。这是视觉隐喻，并非本发行版的原始封面、历史照片或母带图像。',
        f'Shared original AI editorial illustration from “{name}”. A visual metaphor, not this edition’s original cover, an archival photograph or a master-tape image.',
        f'長文「{name}」と共用するAI生成のオリジナル編集イラスト。視覚的な比喩であり、本盤の実際のジャケット、歴史写真、マスターの画像ではありません。')[lang]


for spec in manifest['editions']:
    assert spec['albumId'] in nodes and nodes[spec['albumId']]['type']=='album'
    album=nodes[spec['albumId']]
    artist=nodes[spec['artistId']]
    tracks=spec['tracks']
    assert [t['position'] for t in tracks] == list(range(1,len(tracks)+1))
    assert spec['trackCount']==len(tracks)
    cat=spec['catalogNumber']; title=spec['title']; date=spec['releaseDate']; fmt=spec['format']; count=len(tracks)
    sources=list(dict.fromkeys([spec['sourceUrl'], *spec.get('sources',[]), *[e['sourceUrl'] for e in spec.get('attributeEvidence',{}).values()]]))
    attrs={key:evidence(spec,key,spec[key]) for key in ['releaseDate','catalogNumber','format','editionKind','trackCount','discCount','label','country','recordingVersion'] if key in spec}
    attrs['releaseDate']['noteLabels']=translated('此日期属于所列CD发行版，不改写专辑首次发行日期。','This date belongs to the listed CD edition; it does not replace the album’s original release date.','この日付は記載したCD版の発売日であり、アルバム初出日を置き換えません。')
    attrs['recordingVersion']['noteLabels']=spec['caveats']
    edition=dict(id=spec['id'],type='edition',labels={l:f'{title} · {date} · {cat}' for l in LANGS},description=spec['description'],
        sources=sources,aliases=[],attributes=attrs,externalIds={},media=[],serviceLinks=[],schemaVersion=3,updatedAt=DATE,year=int(date[:4]),albumId=spec['albumId'])
    add_node(edition);add_edge(edition['id'],spec['albumId'],'edition_of',spec['sourceUrl'])
    a=article_base(edition,spec)
    bonus=[t for t in tracks if t.get('bonus')]
    for lang in LANGS:
        artist_name=artist['labels'][lang]
        paragraphs=translated(
            f'这是{artist_name}《{title}》的{cat}版，于{date}以{fmt}形式发行，曲目表共{count}个位置。日期、介质与编号共同确定这个发行条目；专辑本身的首发年份仍为{album["year"]}年。',
            f'This is {artist_name}’s {title} in the {cat} edition, released on {date} as {fmt}, with {count} indexed positions. Date, format and catalog number identify the issue together; the original album remains dated to {album["year"]}.',
            f'これは{artist_name}の「{title}」の{cat}盤で、{date}発売の{fmt}、全{count}曲です。日付、媒体、規格品番で個別の発売版を特定し、アルバム自体の初出年{album["year"]}年とは区別します。')[lang]
        sequence=translated(
            f'本版以《{tracks[0]["title"]}》开场，以《{tracks[-1]["title"]}》结束。',
            f'The sequence opens with “{tracks[0]["title"]}” and ends with “{tracks[-1]["title"]}”.',
            f'曲順は「{tracks[0]["title"]}」で始まり、「{tracks[-1]["title"]}」で終わります。')[lang]
        if bonus:
            sequence+=' '+translated(f'来源明确将第{bonus[0]["position"]}至{bonus[-1]["position"]}曲列为附加内容；这{len(bonus)}个位置保留独立标记。',f'The source marks positions {bonus[0]["position"]}–{bonus[-1]["position"]} as bonus material; all {len(bonus)} positions retain that distinction.',f'出典が{bonus[0]["position"]}〜{bonus[-1]["position"]}曲目をボーナス内容と明記しているため、この{len(bonus)}曲の区分を保持します。')[lang]
        sequence+=' '+spec['context'][lang]
        a['locales'][lang]=dict(title=translated(f'{title}：{cat} CD版',f'{title}: the {cat} CD edition',f'{title}：{cat} CD盤')[lang],
            dek=translated(f'{date} · {fmt} · {count}个曲目位置，明确保留版本边界。',f'{date} · {fmt} · {count} indexed positions with edition-specific evidence.',f'{date}・{fmt}・全{count}曲、発売版ごとの根拠を保持。')[lang],
            paragraphs=[paragraphs,sequence,spec['caveats'][lang]],caption=caption(spec,lang))
    articles.append(a)
    for t in tracks:
        p=t['position']; track_title=t['title']; slot=t.get('slotLabel',str(p))
        attr={k:evidence(spec,k,v,track=t) for k,v in dict(trackTitle=track_title,trackNumber=p,slotLabel=slot,identityStatus='title_and_order_verified_recording_identity_unresolved').items()}
        if t.get('bonus'): attr['trackKind']=evidence(spec,'trackKind','bonus_track',track=t)
        elif t.get('interlude'): attr['trackKind']=evidence(spec,'trackKind','interlude',track=t)
        if t.get('version'): attr['recordingVersion']=evidence(spec,'recordingVersion',t['version'],t.get('versionNotes'),track=t)
        if t.get('noteLabels'): attr['trackTitle']['noteLabels']=t['noteLabels']
        desc=translated(f'《{title}》{cat} CD版的第{p}个曲目位置。仅记录本版的标题与次序，不推定跨版本录音同一性。',f'Indexed position {p} on the {cat} CD edition of {title}. The edition-specific title and sequence do not establish recording equivalence across editions.',f'「{title}」{cat} CD盤の{p}番目の収録位置です。この版の曲名と曲順を記録し、他版との録音同一性は推定しません。')
        track=dict(id=spec['id']+'_track_'+str(p).zfill(2),type='track',labels={l:f'{slot} · {track_title}' for l in LANGS},description=desc,
            sources=list(dict.fromkeys([spec['sourceUrl'],*[x['sourceUrl'] for x in attr.values()]])),aliases=[],attributes=attr,externalIds={},media=[],serviceLinks=[],schemaVersion=3,updatedAt=DATE,
            editionId=spec['id'],position=p,slotLabel=slot,compositionEntryId=None,recordingId=None)
        add_node(track);add_edge(track['id'],edition['id'],'track_on',spec['sourceUrl'])
        a=article_base(track,spec)
        for lang in LANGS:
            first=translated(f'《{track_title}》是{cat}版《{title}》的第{p}个位置，共{count}曲。本CD版于{date}发行；这里的曲序直接来自该版官方列表，不沿用黑胶面的编号。',f'“{track_title}” is position {p} of {count} on the {cat} edition of {title}, released on {date}. This position follows the CD’s official sequence rather than borrowing the side-based numbering of a vinyl edition.',f'「{track_title}」は{cat}盤「{title}」の全{count}曲中{p}番目、{date}発売のCDにおける位置です。曲順は本CDの公式一覧に従い、アナログ盤の面別番号を転用しません。')[lang]
            if p==1:
                neighbor=translated(f'这是本版的开场位置，下一曲为第2曲《{tracks[1]["title"]}》。',f'It opens this issue’s sequence, followed by “{tracks[1]["title"]}” at position 2.',f'本盤の冒頭に置かれ、次は2曲目の「{tracks[1]["title"]}」です。')[lang]
            elif p==count:
                neighbor=translated(f'这是本版的最后一个位置，承接第{p-1}曲《{tracks[p-2]["title"]}》。',f'It closes this issue’s sequence, following “{tracks[p-2]["title"]}” at position {p-1}.',f'本盤の最後の位置で、{p-1}曲目の「{tracks[p-2]["title"]}」に続きます。')[lang]
            else:
                neighbor=translated(f'它前面是第{p-1}曲《{tracks[p-2]["title"]}》，后面是第{p+1}曲《{tracks[p]["title"]}》。',f'It follows “{tracks[p-2]["title"]}” at position {p-1} and precedes “{tracks[p]["title"]}” at position {p+1}.',f'{p-1}曲目の「{tracks[p-2]["title"]}」に続き、次は{p+1}曲目の「{tracks[p]["title"]}」です。')[lang]
            if t.get('bonus'):
                neighbor+=' '+translated('来源明确把此位置列为附加曲；即使标题与正文曲目相似，也保留为独立的CD索引。','The source explicitly marks this position as a bonus track. Even when its title resembles a main-program track, its separate CD index is retained.','出典がこの位置をボーナス曲と明記しています。本編の曲名と似ていても、独立したCDの収録位置として保持します。')[lang]
            elif t.get('interlude'):
                neighbor+=' '+translated('官方标题将它标为间奏，它拥有独立的CD曲目索引，不与相邻歌曲合并。','The official title identifies it as an interlude with its own CD index, so it is not merged into the neighboring song.','公式の題名は間奏を示し、独立したCDトラック番号を持つため、隣接する曲に統合しません。')[lang]
            if t.get('noteLabels'): neighbor+=' '+t['noteLabels'][lang]
            third=translated(f'相关《{title}》长文提供专辑背景。本条目仅补充这个CD位置及来源明确的版本标记；没有据此新增词曲作者、演奏人员或跨版录音匹配。官方页面未确定的逐曲时长保持空缺。',f'The linked {title} essay provides album context. This entry adds this CD position and only the version labels stated by the sources. It does not infer writing credits, personnel or cross-edition recording matches. Per-track durations not established by the official page remain blank.',f'関連する「{title}」の長文でアルバムの背景を紹介しています。本項目はこのCD上の位置と出典に明記された版の表記を補い、作詞作曲、参加者、他版との録音一致は推定しません。公式ページで確認できない曲別時間は空欄とします。')[lang]
            if spec.get('attributeEvidence',{}).get('releaseDate',{}).get('sourceType')=='retailer':
                third+=' '+translated('本CD发行日和介质来自CDJapan与Tower Records的交叉资料，明确属于零售商证据；曲序以艺人官方列表为准。','The CD date and format are cross-checked retailer evidence from CDJapan and Tower Records; the sequence follows the artist’s official list.','本CDの発売日と媒体はCDJapanとTower Recordsの販売店資料で相互確認し、曲順は本人の公式一覧を優先します。')[lang]
            a['locales'][lang]=dict(title=translated(f'{track_title}：{cat}版第{p}曲',f'{track_title}: position {p} on {cat}',f'{track_title}：{cat}盤の{p}番')[lang],
                dek=translated(f'{title} · {date} · 全{count}曲中的CD位置{p}。',f'{title} · {date} · CD position {p} of {count}.',f'{title}・{date}・CD全{count}曲中{p}番目。')[lang],paragraphs=[first,neighbor,third],caption=caption(spec,lang))
        articles.append(a)

catalog['updatedAt']=DATE
catalog.pop('revision',None)
catalog['revision']='catalog-'+hashlib.sha256(json.dumps(catalog,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()[:16]
for a in articles:
    if a['entityId'] not in article_index:
        a['contextEvidence']['catalogRevision']=catalog['revision']
(ROOT/'data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(ROOT/'public/articles.json').write_text(json.dumps(articles,ensure_ascii=False,indent=2)+'\n')
coverage=json.loads((ROOT/'docs/EDITORIAL-COVERAGE.json').read_text())
coverage.update(entries=len(catalog['nodes']),contextualIntroductions=len(articles)-128,localeVersions=len(articles)*3,sharedIllustrationIntroductions=len(articles)-128)
(ROOT/'docs/EDITORIAL-COVERAGE.json').write_text(json.dumps(coverage,indent=2)+'\n')
print(json.dumps(dict(nodes=len(catalog['nodes']),edges=len(catalog['edges']),articles=len(articles),revision=catalog['revision'])))
