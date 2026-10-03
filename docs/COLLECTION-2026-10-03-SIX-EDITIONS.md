# Official-source collection · 2026-10-03

## Added coverage

Six existing album concepts now have their first structured official editions: SEA BREEZE, AFTER 5 CLASH, FULL MOON, FLAPPER, TWILIGHT ZONE and DOWN TOWN.

- Added 6 exact editions and 56 ordered track positions. These are edition slots, not 56 new songs.
- Added 64 sourced relationships: 6 edition-to-album, 56 slot-to-edition, one slot-to-existing-song and one EPO-to-album release relationship.
- Total: 552 layered entities and 908 relationships, including 28 editions across 25 existing albums and 289 ordered positions.
- All previous 490 entities and 844 relationships are unchanged. No new album/person profile or essay is needed; all 84 essays, 252 language versions and 84 illustrations remain intact.

## Exact edition sources

1. [SEA BREEZE · Sony Music Shop](https://www.sonymusicshop.jp/m/item/itemShw.php?site=S&ima=5729&cd=BVCR000001517): BVCR-1517, CD, 1994-12-16, 8 positions. Corroborated by [Sony artist discography](https://www.sonymusic.co.jp/artist/ToshikiKadomatsu/discography/BVCR-1517). No remaster year is inferred. The present shop's label display is not imported as a historical 1994 imprint.
2. [AFTER 5 CLASH · Sony Music Shop](https://www.sonymusicshop.jp/m/item/itemShw.php?site=S&ima=5729&cd=BVCR000001520): BVCR-1520, CD, 1994-12-16, 9 positions. Corroborated by [Sony artist discography](https://www.sonymusic.co.jp/artist/ToshikiKadomatsu/discography/BVCR-1520). The sixth title retains the official spelling “Step into the Light～After 5 Crash”; album and track spellings are not silently unified.
3. [FULL MOON · Victor discography](https://www.jvcmusic.co.jp/-/Discography/A017546/VICL-62684.html): VICL-62684, 2007-12-19, 10 positions. The [Victor store](https://victor-store.jp/item/14462) explicitly confirms CD/paper-jacket packaging. It names 2007-12-19 as the initial date in its title but displays 2008-10-22 in its release-date field. This same-SKU date discrepancy remains unresolved and is visible in Chinese, English and Japanese. The structured date follows the label discography; no invented relisting event or second edition is added. Generic bonus-track wording does not identify a specific bonus slot, so none is assigned.
4. [FLAPPER · Sony](https://www.sonymusic.co.jp/artist/MINAKOYOSHIDA/discography/MHCL-10125): MHCL-10125, CD/SACD hybrid, 2020-07-22, 10 positions. Sony credits Bernie Grundman's 2020 remastering. The actual product date takes precedence over an earlier planned date in promotional announcements.
5. [TWILIGHT ZONE · Sony](https://www.sonymusic.co.jp/artist/MINAKOYOSHIDA/discography/MHCL-10126): MHCL-10126, CD/SACD hybrid, 2020-07-22, 9 positions. Sony credits Bernie Grundman's 2020 remastering and explicitly identifies track 5, 恋は流星, as the album version. “Twilight Zone (Overture)” and “Twilight Zone” remain distinct slots.
6. [DOWN TOWN · Sony](https://www.sonymusic.co.jp/artist/EPO/discography/MHCL-31017): MHCL-31017, regular Blu-spec CD2 / BSCD2, 2024-09-25, 10 positions. The label places it in ALDELIGHT CITY POP COLLECTION. Mastering year is unspecified. Slot 1 links only to the existing EPO DOWN TOWN song entry; slot 6 retains the composite title ポップ･ミュージック ～ DOWN TOWN and is not merged or split.

## Identity and rights boundaries

Edition dates do not replace original album dates. Every new attribute carries the exact official source, source type and checking date. All 56 new recording IDs remain null, and no platform playback link is copied onto an exact physical edition. The one composition-entry navigation link does not assert recording or master equivalence.

No new photos or music players were added. Coverage remains 20/43 people/groups with portrait coverage, 34/41 album players and 38/44 song players. Source pages prove catalogue metadata, not worldwide playback availability. MAGICAL and Piper Summer Breeze date questions remain unchanged.

## Preservation and verification

- Full schema, provenance, semantic-duplicate, model, editorial, review, undo, intake, structural-operation, lifecycle, security and DOM tests cover the revised source.
- New regression checks cover all six edition identities, all 56 contiguous positions, exact source spelling, special versions and Chinese/English/Japanese detail views.
- Isolated regression fixtures verify that catalogue refresh preserves separately stored review decisions, histories and pending structural proposals. No private runtime state is included in the public source.
- Fresh cloud-browser QA was attempted, but the client blocked the local preview URL (`ERR_BLOCKED_BY_CLIENT`). Automated DOM checks cover all 186 new entity/language views; no screenshot or music-playback verification is claimed.
- This collection describes the source-data update. Source publication and runtime deployments are separate; Linux deployment instructions and security boundaries are documented independently.

Machine-readable counts and edition sources: [collection report](COLLECTION-2026-10-03-SIX-EDITIONS.json).
