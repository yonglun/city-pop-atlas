# City Pop Atlas: source and matching implementation brief
Verified against primary documentation, 2026-10-02. Recommendations below are implementation judgments, not source assertions.

## Existing corpus and migration
106 nodes: 22 artist, 39 album, 18 person, 27 song; 178 edges. Preserve existing stable IDs. Normalize `album.artistId`: values such as `tatsuro_yamashita` do not currently equal node ID `person_tatsuro_yamashita`. Songs duplicate `sourceURLs`, `tracksourceURLs`, `sources` and `description`/`descriptions`; migrate through one explicit adapter and retain provenance. Do not classify all connected people as performing artists.

## Durable model
Use durable database tables or a versioned canonical JSON artifact, with generated graph views; browser localStorage alone is not shared durable storage. Retain `schemaVersion`, migration version, `updatedAt`, and source snapshots/checksums.
- Entity: id, type, labels keyed by locale, aliases [{text,language,kind}], descriptions, externalIds, facts, sourceIds, createdAt, updatedAt.
- Album abstract entity maps to MusicBrainz release-group. Edition: parentAlbumId, release MBID, date plus precision, country, label, catalogNumber, barcode, format. Do not overwrite original 1980 album dates with 2023 reissue dates.
- Work/song composition and recording are distinct. Recording: workId, performerIds, recording MBID, ISRCs, durationMs, version (studio/live/remix/remaster), language. Track: editionId, recordingId, discNumber, trackNumber.
- Relationship: id, sourceId, targetId, role (composer, lyricist, arranger, producer, performer, member, released), attributes, datePrecision, evidenceIds, status. Preserve uncertainty; never infer arranger from producer or whole-album credit onto every track.
- Source: id, URL, publisher, title, retrievedAt, license, sourceEntityId, rawHash.
- Media: id, entityId, kind, URL, sourcePage, creator, license, licenseURL, attributionText, changed/cropped, width,height, sourceEditionId, checkedAt, status.
- ServiceLink: entityId, service, resourceType, externalId, URL, version, market, sourceURL, matchMethod, confidence, checkedAt, status. Status includes verified, candidate, unavailable, unknown. Search URLs must have `resourceType=search`, not masquerade as exact playable matches.

## MusicBrainz
Primary docs: https://musicbrainz.org/doc/MusicBrainz_API ; https://musicbrainz.org/doc/MusicBrainz_API/Search ; https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
Read-only public lookups need no login. API root is https://musicbrainz.org/ws/2/ and `fmt=json` selects JSON. One request per second maximum per application/IP; meaningful application/version/contact User-Agent; back off on 503. Run ingestion centrally, not one importer per visitor. Search/browse limit up to 100; paginate, cache successful results, and avoid routine change polling.
Suggested documented-form requests (URL-encode parameter values):
- /artist?query=artist:"山下達郎"&fmt=json
- /artist/ad62391d-ab7e-4ac9-9ce8-3704bc6746bb?inc=aliases+url-rels&fmt=json
- /release-group?artist=ARTIST_MBID&type=album&limit=100&offset=0&fmt=json
- /release-group/RG_MBID?inc=artist-credits+releases+url-rels&fmt=json
- /release/RELEASE_MBID?inc=recordings+artist-credits+labels+url-rels&fmt=json
- /recording/RECORDING_MBID?inc=artist-rels+work-rels+url-rels+isrcs&fmt=json
Resolve artist first, then scoped release-group and recording matches; Japanese titles and existing aliases are useful. Search score is candidate ranking, not proof of identity. Verify artist, album title, year, edition, track list, duration and ISRC where available.
License: core facts, identifiers, relationships and URLs are CC0; annotations, tags including genre associations, ratings and other supplementary data are CC BY-NC-SA 3.0. Avoid copying supplementary data into an unrestricted corpus. Sources: https://musicbrainz.org/doc/About/Data_License ; https://musicbrainz.org/doc/MusicBrainz_Database

## Cover Art Archive
Docs: https://musicbrainz.org/doc/Cover_Art_Archive/API
Use https://coverartarchive.org/release-group/RG_MBID/ for image metadata, then select `front=true` and suitable thumbnail. Response includes actual source release; persist it. Exact-edition alternative: https://coverartarchive.org/release/RELEASE_MBID/ . Direct thumbnails: /release-group/RG_MBID/front-250 or front-500 (also 1200). Follow redirects and handle missing 404s; `approved` means community edit approval, not licensing clearance. Documentation currently says no rate-limit rules, but bounded concurrency/cache/backoff remain sensible.
CAA is an accessible archive, not a blanket freely licensed asset library: https://musicbrainz.org/doc/Cover_Art_Archive explicitly warns reuse is at user's risk. Never label covers CC0. Prefer source-backed album thumbnails with rights status explicit; do not assume moving a remote image to owned storage confers rights.

## Wikidata and Commons portraits
https://www.wikidata.org/wiki/Wikidata:Data_access documents CC0 structured data, public entity JSON and API options. Prefer known IDs and small reads, e.g. https://www.wikidata.org/wiki/Special:EntityData/Q1154190.json . Use P18 image, P434 MusicBrainz artist ID, and native labels/aliases where present. Follow redirects and inspect statement rank/references instead of treating every claim as authoritative. Source selection should favor artist/label documentation for disputed music credits.
Commons API documented at https://www.mediawiki.org/wiki/API:Imageinfo :
https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&titles=File:ENCODED_FILENAME&iiprop=url|size|extmetadata&iiurlwidth=500
Use returned thumbnail URL, not a guessed hashed Wikimedia URL. Fetch expensive extmetadata in small batches. Save creator/license/credit/source page; sanitize HTML-valued metadata before display. The photograph's license is separate from Wikidata's CC0 metadata. Missing licensed portrait should remain missing rather than using an invented likeness.
Verified example: Tatsuro Yamashita MBID ad62391d-ab7e-4ac9-9ce8-3704bc6746bb, Wikidata Q1154190. Portrait `Tatsuro Yamashita, 2005 (forward crop).jpg`, author Kamasami Kong, CC BY-SA 2.0; source page https://commons.wikimedia.org/wiki/File:Tatsuro_Yamashita,_2005_(forward_crop).jpg . Credit creator, link license, and disclose crop/adaptations. Seed identity sources: https://musicbrainz.org/artist/ad62391d-ab7e-4ac9-9ce8-3704bc6746bb and https://www.wikidata.org/wiki/Q1154190 .

## Exact Spotify/YouTube links without credentials
MusicBrainz `url-rels`, artist/label official pages, and manually verified public service pages can yield exact IDs. Outbound links need no app API integration. Preserve unavailable as a real state; never fabricate service IDs, claim global availability, or use a cover version/live recording as the studio recording silently.
Spotify public exact link shape: https://open.spotify.com/track/ID or /album/ID. Their oEmbed endpoint accepts an already-known URL and returns title/embed/thumbnail: https://open.spotify.com/oembed?url=ENCODED_SPOTIFY_URL . It is not a search API, identity adjudicator or assurance of regional availability. Docs: https://developer.spotify.com/documentation/embeds/tutorials/using-the-oembed-api and https://developer.spotify.com/documentation/embeds/reference/oembed . Spotify catalog search requires valid access token; do not promise credential-free automated catalog discovery: https://developer.spotify.com/documentation/web-api/reference/search .
Important durable-storage constraint: Spotify terms limit storage/aggregation, require operational necessity and only temporary caching; metadata and artwork need attribution and link-back. Therefore source atlas facts independently and store outbound associations rather than making Spotify content the permanent database. https://developer.spotify.com/terms ; https://developer.spotify.com/policy ; https://developer.spotify.com/documentation/design .
YouTube exact link: https://www.youtube.com/watch?v=VIDEO_ID . Prefer verified artist/label channels and clearly label official MV, official audio, live, or fan upload separately. A channel ID or search result is not a track match. YouTube Data API discovery requires a project/key, even for public-data requests: https://developers.google.com/youtube/v3/getting-started and https://developers.google.com/youtube/v3/docs/search/list . Current overview describes separate daily search-call allocation; do not hard-code the historically common 100-unit search assumption without checking current console/docs. No-credential alternative is source-linked/manual exact-URL verification, not unofficial scraping APIs.

## Expansion order
1. Normalize current 106 entities/references; attach MBIDs and evidence.
2. Resolve all 39 album release-groups and chosen editions; import track lists, ISRC-bearing recordings and grounded personnel edges.
3. Add licensed portraits and cover metadata with attribution and fallback handling.
4. Verify exact outbound links for the 27 existing songs first, then expanded tracks; record match confidence/version/source.
5. Render coverage counts separately for sourced facts, imagery, exact links, and unresolved matches. Never market partial match coverage as complete.

## 2026-10-02 media expansion

Added 20 exact service associations: 10 Spotify albums, 4 artist pages, 3 tracks and 3 official YouTube video/audio pages. Public embed metadata established identity; only outbound associations and version caveats are stored, not Spotify artwork or a mirrored catalog. Album-concept links do not assert equality with a physical edition. New caveats include Chinese/Japanese labels in `versionLabels`, with English `version` retained.

Added Alan O’Day’s 2007 portrait by Joe Ortiz, CC BY-SA 2.5: https://commons.wikimedia.org/wiki/File:Alan_O_Day.jpg . The Commons page records Wikimedia VRT permission review. The 177×174 original is displayed without artificial enlargement. Other portrait candidates lacking adequate ownership evidence were not imported.
