// Public projections are explicit allowlists. Heavy provenance and editorial
// copy remain available through the existing full graph and detail endpoints.
const nodeFields = ['id','type','labels','aliases','year','slotLabel','albumId','editionId','position'];
const articleFields = ['entityId','kind','canonicalEntityId','displayYear'];
const pick = (value,fields) => Object.fromEntries(fields.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
const projections = new WeakMap();
const articleIndexes = new WeakMap();
export function articleIndex(articles) {
 let index = articleIndexes.get(articles);
 if (!index) {
  index = articles.map(article=>pick(article,articleFields));
  articleIndexes.set(articles,index);
 }
 return index;
}
export function publicGraph(catalog,editorialIndex,{compact=false}={}) {
 let cached = projections.get(catalog);
 if (!cached) { cached = {}; projections.set(catalog,cached); }
 if(!cached.articleIndex){const existing=new Set(catalog.nodes.map(node=>node.id));cached.articleIndex=editorialIndex.filter(article=>existing.has(article.entityId));}
 if (!compact) return cached.full ??= {...Object.fromEntries(Object.entries(catalog).filter(([key])=>key!=='operationConflicts')),articleIndex:cached.articleIndex};
 if (!cached.compact) {
  cached.compact = {
   ...pick(catalog,['schemaVersion','revision','epoch','updatedAt','storage','entityAliases']),view:'compact',
   nodes:catalog.nodes.map(node=>{
    const result=pick(node,nodeFields), title=node.attributes?.trackTitle;
    if (title) result.attributes={trackTitle:pick(title,['value','reviewStatus'])};
    return result;
   }),
   edges:catalog.edges.map(edge=>pick(edge,['source','target','type'])),
   articleIndex:cached.articleIndex
  };
 }
 return cached.compact;
}
const indexes = new WeakMap();
function nodeIndex(catalog) {
 let index=indexes.get(catalog);
 if(!index){index=new Map(catalog.nodes.map(node=>[node.id,node]));indexes.set(catalog,index);}
 return index;
}
export function resolveEntity(catalog,id) {
 const resolved=Object.hasOwn(catalog.entityAliases||{},id)?catalog.entityAliases[id]:id;
 return nodeIndex(catalog).get(resolved);
}
export function entityDetail(catalog,id) {
 const entity=resolveEntity(catalog,id);if(!entity)return null;
 const relationships=catalog.edges.filter(edge=>edge.source===entity.id||edge.target===entity.id);
 const ids=new Set(relationships.flatMap(edge=>[edge.source,edge.target]));
 for(const key of ['artistId','albumId','editionId','compositionEntryId','recordingId','legacyEntryId'])if(entity[key])ids.add(entity[key]);
 ids.delete(entity.id);
 const index=nodeIndex(catalog);
 return {entity,relationships,relatedNodes:[...ids].map(id=>index.get(id)).filter(Boolean),properties:catalog.properties,revision:catalog.revision,epoch:catalog.epoch};
}
export function localizedArticle(catalog,articles,id,lang) {
 const entity=resolveEntity(catalog,id);if(!entity)return null;
 const source=articles.find(article=>article.entityId===entity.id);
 if(!source?.locales?.[lang])return null;
 const {locales,...article}=source;
 const related=source.canonicalEntityId&&resolveEntity(catalog,source.canonicalEntityId),relatedArticle=related&&articles.find(item=>item.entityId===related.id);
 return {article:{...article,locales:{[lang]:locales[lang]}},...(relatedArticle?.locales?.[lang]?{relatedArticle:{entityId:relatedArticle.entityId,locales:{[lang]:pick(relatedArticle.locales[lang],['title','dek'])}}}:{}),revision:catalog.revision,epoch:catalog.epoch};
}
