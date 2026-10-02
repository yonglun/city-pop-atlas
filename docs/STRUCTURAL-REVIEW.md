> Linux 部署说明：本文保留应用功能/历史架构说明。运行时、认证与运维配置以 [DEPLOYMENT.md](DEPLOYMENT.md) 为准；Linux 生产服务不接受 Sites 身份头，也不启用 LOCAL_REVIEW。

# Structural curation and exact-release review (v1.0)

The fourth section of the Chinese, English and Japanese interface contains the original field reviewer and a separate structural reviewer. Both use the same owner-private authentication and same-origin JSON boundary. This is not a public collaborative editor.

## Supported workflow

1. Open “Create candidate” and choose new entity, relationship, recording match or duplicate merge. The entity form has all three names/descriptions, stable ID, entity layer and optional sourced attribute/external-ID/context JSON. Existing IDs have a searchable datalist. For an edition use context `{"albumId":"..."}` and sourced releaseDate/catalogNumber; for a track use editionId, position, slotLabel and matching sourced trackTitle/trackNumber/slotLabel.
2. Supply a credential-free HTTPS source URL, source type, real checked date and evidence note. Every attribute needs its own source URL/date. Candidate submission does not fetch a URL or establish that its assertion is true.
3. Preview first. Inspect the complete candidate, original source, possible duplicate names/identifiers, blocked dependencies and merge reference/relationship counts. A normalized name or shared external identifier is a reason to investigate, never an automatic equivalence.
4. Explicitly add the preview to the pending queue. Or cancel without writing. JSON batches contain `{ "operations": [...] }` or an array, at most 50 operations / 64 KiB. Any structurally invalid row rejects the batch. Valid proposals with missing dependencies may be queued, but cannot be approved until dependencies exist.
5. Filter by kind/state. Approve or reject opens a separate confirmation; a reason is mandatory. The server validates the current graph, candidate version and global editorial epoch again in its transaction. Reload the graph after an accepted decision. Repeated concurrent requests cannot create a second approval/audit event.
6. Approve new entities before relationships or matches that depend on them. New editions automatically add edition_of; new tracks add track_on and any supplied composition correspondence. `corresponds_to` approval fills an unset track compositionEntryId. Track recordingId cannot bypass the dedicated match workflow.

## Repeatable offline preparation

The offline converter makes bounded, UI-ready batches from a curated manifest; it performs no network requests, database writes or approvals:

```sh
node scripts/prepare_operations.mjs manifest.json data/catalog.json new-output-directory
```

The output directory must not exist. Upload its numbered `operations-001.json` etc. to the structural review panel. `report.json` records the manifest hash, duplicate suggestions and dependencies that need prior approval. Keep the source collection evidence with the manifest. Collection is intentionally manual/on-demand; no schedule is installed.

Manifest sections, all optional but at least one item required:

```json
{
  "entities": [{"node": {"id":"stable_id","type":"person","labels":{"zh":"...","en":"...","ja":"..."},"description":{"zh":"...","en":"...","ja":"..."}}, "evidence":{"sourceUrl":"https://source.example/item","sourceType":"official","checkedAt":"2026-10-02","note":"Describe the exact supported assertion"}}],
  "relationships": [{"relationship":{"source":"person_id","target":"song_id","type":"composer","attributes":{"creditedAs":"Original printed credit"}},"evidence":{"sourceUrl":"https://source.example/credits","sourceType":"official","checkedAt":"2026-10-02","note":"Track-specific composition credit"}}],
  "recordingMatches": [],
  "merges": []
}
```

These names/URLs are illustrative placeholders, not research or a production data import. Recording-match manifest rows contain trackId, editionId, recordingId, releaseId, matchBasis and evidence. Merge rows contain fromId, intoId, confirmSameIdentity:true and evidence. Existing `collect_musicbrainz.py` retains rate limits, cache provenance and explicit-ID extraction. Review its source output and put only supported assertions in the manifest; it never promotes source results automatically. The converter accepts up to 500 operations and splits them below both size limits. It does not infer official translations, unprovided credits or merge identities.

## Conservative identity and merge rules

- Entities retain their distinct artist/person/album/edition/song/work/recording/track/label layers. A merge must use the same layer. For work/recording/edition/track, at least one exact external identifier must agree. Explicit same-identity confirmation and provenance are still required.
- Conflicting years, structural pointers, positions, scalar attribute values or external IDs block merging. Self-relationships and duplicate edition track slots block it. Resolve evidence first; no automatic winner is selected.
- The selected target ID remains canonical. Old IDs become redirects, existing redirects are flattened, all supported top-level pointers (including album artistId) and relationship endpoints are rewritten. Old names remain aliases.
- Sources, media and music links are retained. Complete source entities and distinct relationship evidence remain in mergedRecords/mergedRelationships. Chained merges retain earlier lineage. No base entity, source or historical decision is physically deleted.
- Approved field corrections are applied before a merge and retained. While a merged identity is active, further legacy field approval/undo for either involved ID is conservatively blocked; undo the merge first. This avoids silently overriding a correction inherited from the other ID.
- The most recent effective structural approval can be undone only while the exact post-approval graph still matches. Undoing later operations restores earlier undo eligibility. A field correction on a newly created entity must be undone before that entity can be removed. There is no guessed inverse after a base snapshot changes.
- A currently conflicted operation contributes nothing because each transform is applied to an isolated clone. It can explicitly be moved back to pending even if later operations exist; those later effective operations stay intact. This provides recovery after seed removals or collisions without erasing newer data. The conflict list remains visible until handled.

## Recording certainty

A match identifies one track slot on one edition, an existing MusicBrainz recording entity, and the edition's exact MusicBrainz release ID. The source URL must refer to that release or recording, and matchBasis must explain the source linkage. The original album year is never overwritten. Approval adds only that slot's recordingId and a sourced records_recording edge; its status says that the exact release catalogue linkage was reviewed while the physical master remains unverified. A shared title or MB recording ID is not proof that different masters, live takes, mixes, remasters, digital releases, Spotify tracks or physical copies have identical audio.

The 54 research proposals shipped in v1.0 remain pending. They link four exact release tracklists to directly linked recording IDs. Some recording detail pages were unavailable; each candidate preserves the distinction. No production decision is auto-approved or reset on deployment. MusicBrainz credit assertions that conflict with primary sources are not imported.

## Persistence, concurrency and API

Append-only Drizzle migration 0003 creates catalog_operations, operation_events and catalog_state. Existing migrations, candidates, attribute_overrides, review_events and approval_snapshots remain intact. The seed owns only the original base tables. Active structural transforms and field overrides are replayed from separate durable tables after seed refreshes; runtime code does not CREATE/ALTER tables.

- GET /api/operations: candidates, evidence, blocked dependencies, duplicate suggestions, safe undo eligibility, epoch, graph token and recent audit events
- POST /api/operations/preview: no candidate/event write
- POST /api/operations/import: idempotent pending-only insertion
- POST /api/operations/{operation_id}: approve/reject with expectedVersion, expectedEpoch, graphToken and note
- POST /api/operations/{operation_id}/undo: same context and mandatory note

Imports do not alter the effective graph. Structural decisions and legacy field approval/undo share the transactional epoch. Base snapshot replacement also advances it. A batch failure rolls back the candidate, epoch and audit event together. A stale/missing identity, changed origin, cross-site request, oversized body or incorrect JSON type cannot write. Private runtime decisions, identities, history and database contents are excluded from the public source export.
