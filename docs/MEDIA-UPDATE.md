# Media completion pass · 2026-10-02

## Scope and result

This pass covers all 43 artist/person entries (39 individuals and 4 groups), 41 album entries and 44 song entries. It does not count editions, recordings, works or track-position entities as additional songs.

- 11 licensed photographs, including two newly documented photographs of Junko Yagami and Yasuha.
- 9 intact official Spotify artist widgets with visually checked standalone portraits. These images are provider-hosted, may change, and are not extracted or relicensed.
- 3 additional widgets contain photographs in cover/promotional artwork. They are labeled separately and are not counted as standalone portraits.
- 34 of 41 albums and 38 of 44 songs have verified matching resources rendered as embedded Spotify or YouTube players. Previously song resources were external links only.
- All 70 Spotify album/track links had matching provider metadata and a PLAYABLE flag at inspection. All 14 YouTube links had matching oEmbed identity metadata. Actual audio playback and worldwide availability were not established; YouTube watch-page checks returned rate limits.

This is not 100% coverage. The complete 128-entry status, source URLs and precise remaining reasons are in [MEDIA-COVERAGE.json](MEDIA-COVERAGE.json) and in the site's collection guide.

## Remaining music gaps

Albums: CIRCUS TOWN, SPACY, RIDE ON TIME, FOR YOU, SEA BREEZE, AFTER 5 CLASH and SONGS. Official teasers, unboxings, isolated singles, empty user playlists, same-name releases and unverified-rights uploads are not full album players.

Songs: RIDE ON TIME, いつか (Someday), LOVE TALKIN', MUSIC BOOK, MORNING GLORY and YOUR EYES. Covers, drum covers, remixes and other performers' recordings are not substituted for the represented recording.

## Implementation and rights

- Spotify album/track identifiers must match their declared resource type; malformed URLs, credentials, ports and search pages cannot become players.
- YouTube uses privacy-enhanced embeds, explicit no-autoplay and a compatible referrer policy. Both providers retain their controls and original-page links.
- Catalog pages are rendered in batches, iframes are lazy-loaded, and hidden/closed detail views unmount their players. Opening the search drawer also unmounts the hidden detail player.
- Existing version labels and source evidence are preserved. A playable digital version does not establish equivalence with any physical master or recording entity.
- No new credentials, sharing permissions, automatic ingestion, review decisions or recording matches were added.

## Verification boundary

Automated DOM tests cover every album/song detail, all portrait widgets, safe URLs, missing states, lifecycle and the trilingual checklist. Source researchers visually checked provider portraits in the cloud browser. Complete live-site browser/audio playback QA was not available in this task; the site does not claim playback-tested coverage.
