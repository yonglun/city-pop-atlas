#!/usr/bin/env python3
"""Convert explicit-MBID collector output into bounded review UI candidates; never approve."""
import argparse,json
from pathlib import Path

def convert(report,catalog):
    nodes={n['id']:n for n in catalog['nodes']};out=[];skipped=[]
    for c in report.get('candidates',[]):
        n=nodes.get(c.get('entityId'));prov=c.get('provenance',{});f=c.get('facts',{});kind=c.get('sourceType')
        if not n or not prov.get('fetchedAt') or prov.get('mode')=='fixture':
            skipped.append({'entityId':c.get('entityId'),'reason':'Missing live provenance or unknown entity'});continue
        source=prov.get('sourceUrl') or ('https://musicbrainz.org/'+kind+'/'+str(f.get('id','')))
        fields={}
        if kind=='artist' and f.get('type')=='Person':
            fields={'birthDate':f.get('life-span',{}).get('begin'),'deathDate':f.get('life-span',{}).get('end')}
        elif kind=='release-group' and n['type']=='album':fields={'releaseDate':f.get('first-release-date')}
        elif kind=='release' and n['type']=='edition':
            fields={'releaseDate':f.get('date')}
            labels=f.get('label-info',[])
            if len(labels)==1:fields.update(catalogNumber=labels[0].get('catalog-number'),label=labels[0].get('label',{}).get('name'))
            media=f.get('media',[])
            if len(media)==1:fields['format']=media[0].get('format')
        else:skipped.append({'entityId':n['id'],'reason':'Mapping type unsupported; physical release facts require an edition entity'})
        for field,value in fields.items():
            if value is None or value=='':continue
            if n.get('attributes',{}).get(field,{}).get('value')==value:continue
            out.append(dict(entityId=n['id'],field=field,value=value,sourceUrl=source,checkedAt=prov['fetchedAt'][:10],sourceType='MusicBrainz',note='Explicit MBID candidate. Inspect source and edition identity before approval.'))
    if len(out)>50:raise ValueError('More than 50 candidates; split the collection input')
    return {'candidates':out,'skipped':skipped,'status':'pending_review'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--catalog',type=Path,default=Path('data/catalog.json'));p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    result=convert(json.loads(a.input.read_text()),json.loads(a.catalog.read_text()))
    with a.output.open('x',encoding='utf8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print(str(len(result['candidates']))+' pending candidates written')
