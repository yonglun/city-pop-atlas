import {readCatalog} from './storage.js';

// A full public snapshot is expensive to assemble for each crawled HTML page.
// Check the transactional epoch on every request, rather than using a timed TTL:
// approvals, undo, merges and source imports already advance this value atomically.
// The cache is scoped to the database binding and exact bundled source revision.
const snapshots = new WeakMap();
export async function readPublicCatalog(db, seed) {
 const state = await db.prepare("SELECT epoch,(SELECT id FROM imports ORDER BY rowid DESC LIMIT 1) AS revision FROM catalog_state WHERE id='graph'").first();
 const previous = snapshots.get(db);
 if (previous && state && state.revision === seed.revision && previous.revision === seed.revision && previous.epoch === state.epoch) return previous.catalog;
 const catalog = await readCatalog(db, seed);
 snapshots.set(db, {revision:catalog.revision,epoch:catalog.epoch,catalog});
 return catalog;
}
