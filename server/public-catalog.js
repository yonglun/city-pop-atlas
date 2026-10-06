import {readCatalog} from './storage.js';

// A snapshot belongs to one database binding and exact source revision. Every
// lookup reads the transactionally updated epoch; there is deliberately no TTL.
// A single in-flight read avoids rebuilding the whole graph for parallel API /
// crawler requests. Waiters recheck the epoch so a mutation committed while an
// older read was in flight cannot make them reuse that older snapshot.
const snapshots = new WeakMap();
const stateSQL = "SELECT epoch,(SELECT id FROM imports ORDER BY rowid DESC LIMIT 1) AS revision FROM catalog_state WHERE id='graph'";
export async function readPublicCatalog(db, seed) {
 let entry = snapshots.get(db);
 if (!entry) { entry = {catalog:null,loading:null}; snapshots.set(db,entry); }
 for (;;) {
  const state = await db.prepare(stateSQL).first();
  const catalog = entry.catalog;
  if (catalog && state && state.revision === seed.revision && catalog.revision === seed.revision && catalog.epoch === state.epoch) return catalog;
  if (entry.loading) { await entry.loading; continue; }
  // readCatalog's tables, approved operations and epoch are read in one atomic
  // batch. Never stamp a catalog with an epoch read separately from its rows.
  const loading = readCatalog(db,seed);
  entry.loading = loading;
  try { entry.catalog = await loading; }
  finally { if (entry.loading === loading) entry.loading = null; }
  // Verify after a miss too: an approval may have committed just after the
  // snapshot batch completed. Failed loads leave no rejected promise behind.
 }
}
