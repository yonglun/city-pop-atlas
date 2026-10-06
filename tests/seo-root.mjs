import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import worker from '../dist/server/index.js';
const origin='https://city-pop.softmatrix.io';
for(const lang of ['en','zh','ja']){
 const response=await worker.fetch(new Request(origin+'/?view=graph&lang='+lang),{PUBLIC_ORIGIN:origin,SEO_INDEXABLE:true});
 const html=await response.text(),dom=new JSDOM(html,{url:origin});
 const style=dom.window.document.createElement('style');style.textContent=fs.readFileSync('public/style.css','utf8');dom.window.document.head.prepend(style);
 const doc=dom.window.document,computed=el=>dom.window.getComputedStyle(el);
 assert.equal(response.status,200);assert.match(response.headers.get('x-robots-tag'),/noindex/);
 assert.equal(doc.body.dataset.seoPublic,'true');assert.equal(computed(doc.querySelector('main')).visibility,'visible');
 assert.equal(computed(doc.querySelector('#load-status')).display,'none');
 assert.equal(computed(doc.querySelector('.workspace')).display,'none');
 assert(doc.querySelector('.search-discovery a[href="/'+lang+'/browse"]'));
 assert(doc.querySelector('.search-discovery').textContent.length>80);dom.window.close();
}
console.log('PASS no-JavaScript graph entry: loading overlay removed, meaningful directory visible, localized reading links and no database dependency');
