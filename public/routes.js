/* Shared browser/server routes. URLs depend on immutable entity IDs, never labels.
   The ID codec is injective: underscores become -, literal - becomes ~h, and
   every other unsafe character has its own escaped Unicode code point. */
(function (root) {
  'use strict';
  const languages = Object.freeze(['en', 'zh', 'ja']);
  const segments = Object.freeze({artist:'artists', person:'people', album:'albums', song:'songs', edition:'editions', track:'tracks', work:'works', recording:'recordings', label:'labels'});
  const types = Object.freeze(Object.keys(segments));
  function language(lang) { if (!languages.includes(lang)) throw new TypeError('Unsupported language'); return lang; }
  function slug(id) {
    if (typeof id !== 'string' || !id.length || id.length > 512) throw new TypeError('Invalid entity ID');
    return Array.from(id, c => c === '_' ? '-' : c === '-' ? '~h' : /^[a-zA-Z0-9]$/.test(c) ? c : '~' + c.codePointAt(0).toString(16) + '~').join('');
  }
  function pathFor(node, lang = 'en') {
    if (!node || !Object.hasOwn(segments, node.type)) throw new TypeError('Unsupported entity type');
    return '/' + language(lang) + '/' + segments[node.type] + '/' + slug(node.id);
  }
  const homePath = (lang = 'en') => '/' + language(lang) + '/';
  const aboutPath = (lang = 'en') => '/' + language(lang) + '/about';
  function browsePath(lang = 'en', type = null, page = 1) {
    if (type != null && !Object.hasOwn(segments, type)) throw new TypeError('Unsupported entity type');
    if (!Number.isSafeInteger(page) || page < 1 || (!type && page !== 1)) throw new TypeError('Invalid page');
    return '/' + language(lang) + '/browse' + (type ? '/' + segments[type] : '') + (page > 1 ? '/page/' + page : '');
  }
  function parsePath(input, catalog = {nodes:[]}) {
    if (typeof input !== 'string' || !input.startsWith('/') || input.length > 2048 || /[?#\\\u0000-\u0020\u007f]/.test(input) || /%2f|%5c|%00/i.test(input) || input.includes('//')) return null;
    let path; try { path = decodeURIComponent(input); } catch { return null; }
    if (/[?#\\\u0000-\u0020\u007f]/.test(path) || path.includes('//') || path.split('/').some(x => x === '.' || x === '..')) return null;
    const parts = path.split('/');
    const lang = parts[1];
    if (!languages.includes(lang)) return null;
    const clean = path.endsWith('/') ? path.slice(0, -1) : path;
    const result = (route, canonical) => ({...route, lang, path:canonical, ...(input !== canonical ? {redirect:canonical} : {})});
    if (clean === '/' + lang) return result({kind:'home'}, homePath(lang));
    if (clean === aboutPath(lang)) return result({kind:'about'}, aboutPath(lang));
    if (clean === browsePath(lang)) return result({kind:'browse', type:null, page:1}, browsePath(lang));
    const directory = clean.match(/^\/(en|zh|ja)\/browse\/([a-z]+)(?:\/page\/([1-9][0-9]*))?$/);
    if (directory) {
      const type = types.find(t => segments[t] === directory[2]);
      const page = directory[3] ? Number(directory[3]) : 1;
      if (!type || !Number.isSafeInteger(page)) return null;
      return result({kind:'browse', type, page}, browsePath(lang, type, page));
    }
    if (!/^\/(en|zh|ja)\/[a-z]+\/[^/]+$/.test(clean)) return null;
    const nodes = Array.isArray(catalog.nodes) ? catalog.nodes : [];
    for (const node of nodes) {
      if (!Object.hasOwn(segments, node.type)) continue;
      const canonical = pathFor(node, lang);
      if (canonical === clean) return result({kind:'entity', node, entityId:node.id}, canonical);
    }
    // Only explicit catalog aliases redirect. Display-name aliases are ambiguous
    // and are never treated as entity identities. Resolve chains, reject cycles.
    const aliases = catalog.entityAliases || {};
    for (const oldId of Object.keys(aliases)) {
      let id = oldId;
      const seen = new Set();
      while (Object.hasOwn(aliases, id) && !seen.has(id)) { seen.add(id); id = aliases[id]; }
      if (seen.has(id) || typeof id !== 'string') continue;
      const node = nodes.find(n => n.id === id);
      if (!node || !Object.hasOwn(segments, node.type)) continue;
      const prefix = oldId.split('_')[0];
      const aliasTypes = new Set([node.type, ...(Object.hasOwn(segments, prefix) ? [prefix] : []), ...(prefix === 'person' ? ['artist'] : [])]);
      if (![...aliasTypes].some(type => pathFor({id:oldId, type}, lang) === clean)) continue;
      return {...result({kind:'entity', node, entityId:node.id, aliasId:oldId}, pathFor(node, lang)), redirect:pathFor(node, lang)};
    }
    return null;
  }
  root.CityPopRoutes = Object.freeze({languages, types, segments, pathFor, homePath, aboutPath, browsePath, parsePath});
})(globalThis);
