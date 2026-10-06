# v1.0 acceptance and research record

Checked 2026-10-02. This is a finite functional release, not a claim to catalogue all City Pop.

## Delivered scope

- Persistent entity/relationship collection candidates, offline manifest conversion, three-language forms, explicit preview/import, semantic dedup and candidate duplicate-identity suggestions
- Confirmed review with evidence, mandatory decision reason, dependency validation, rejection history, transaction-safe approval and conservative reversible merge
- Exact edition/track recording identity review, separate album/work/recording/edition/track layers, unchanged original release dates and no inferred cross-master equivalence
- Existing field review, reverse-stack undo, source provenance, private auth/CSRF protection and read-only failure states preserved
- Existing archive search, filters, pagination, navigation/return state, graph controls, licensed portrait fallbacks and official players preserved

## Measured catalogue

457 entities and 806 relationships. Entity count includes layers and positions, not 457 songs. There are 19 editions of 16 album concepts, 203 track slots, 53 composition works and 54 recording catalogue entities. The 54 exact-release match proposals are pending, so no physical track-to-recording mapping has been silently approved. Nine licensed person/group photos, 34 official album players and 107 verified provider links are present. Source metadata verification is not full playback or region verification.

## Evidence added

- SUNSHOWER GW-4029: https://musicbrainz.org/release/8b29545a-cd63-499d-8780-8224cfb2607b — ten direct recording hyperlinks
- MIGNONNE RVL-8035: https://musicbrainz.org/release/6b9f4391-c266-4e21-be13-53e305c90970 — ten direct recording hyperlinks
- VARIETY WPCL-12007: https://musicbrainz.org/release/b09a26e1-33f8-421f-9a72-d3d5feb0d3ce — eighteen track links, original/mix/karaoke distinctions retained
- REQUEST WPCL-12756: https://musicbrainz.org/release/c61dc148-070e-4cff-9902-146fe2ff37f4 — sixteen track links, distinct versions retained
- MIGNONNE primary credits: https://onukitaeko.jp/project/mignonne/ — ten songs' words/music and exact track arrangement credits; nine missing work entities added
- SUNSHOWER primary-source conflict guard: https://onukitaeko.jp/project/sunshower/ — preserve Yu Imai's Fender Rhodes credit and Ryuichi Sakamoto's Furiko no Yagi composition despite conflicting MusicBrainz display
- New photographs retain their individual Commons source page, creator, licence link, crop statement and photo date in each media object. Mariya Takeuchi and Toshiki Kadomatsu images are CC0; Yellow Magic Orchestra is CC BY 2.0. Metadata includes renderingVerified:false because binary retrieval was blocked during research.
- Thirty-six new Spotify provider listings and metadata rechecks for all 71 existing service links are recorded per serviceLink. Version notes are trilingual where newly added. No album-cover files, audio or lyrics are copied.

## Verification

`npm run build && npm test` runs schema/data checks, SQLite persistence/migration and Worker endpoints, original graph/archive/navigation DOM tests, field review/undo/intake tests, eight Python collector tests, structural operations, offline conversion, independent model/lifecycle/security tests, DOM-to-real-Worker end-to-end tests and cancellation/failure/race tests. All tests are network-free; synthetic assertions remain in isolated fixtures.

Important failure cases include both directions of field-vs-structural races, two structural approvals on one graph snapshot, transactional rollback, date/range/prototype/URL checks, a new entity edited then restored before removal, source-preserving chained merge, edition track-slot collisions, old-ID navigation, seed-refresh conflict deactivation, exact-release match+undo and late previews after cancellation or mutation.

Actual browser layout, real third-party image rendering, media playback and regional availability require separate verification. DOM tests and provider metadata are not substituted for those results. Publication status is verified through the hosting deployment status, not an unauthenticated scrape of the private Site.

## Deliberate limits

- No automatic schedule, broad fuzzy search, new OAuth/API key, public editor or audience change
- Normal structural undo is intentionally conservative after later edits or a base refresh; conflicted unapplied operations can be explicitly deactivated, and no history is deleted
- Seven album player gaps remain: CIRCUS TOWN, SPACY, RIDE ON TIME, FOR YOU, SEA BREEZE, AFTER 5 CLASH and SONGS. Ambiguous covers, wrong artists, local-file playlists and unrelated releases were rejected
- The general arranger credits for 夏のペーパーバック and ペパーミント・ブルー remain unknown; source discussion of string arrangements does not justify a general arranger assertion
- Unmatched track identities and unlicensed portraits remain missing rather than guessed. Recording-detail 429/cache failures are disclosed in candidate evidence
