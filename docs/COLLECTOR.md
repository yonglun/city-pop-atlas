# Explicit MusicBrainz candidate collector

`collect_musicbrainz.py` requires Python 3.9+ and only the standard library. It does not search, fuzzy-match, write back to MusicBrainz, edit a catalog, or use credentials. No network data was collected as part of this implementation.

## Input

Use JSON, not the site's JavaScript `const DATA=...`. Accepted shapes:
- a list of objects with unique string `id` fields
- `{ "nodes": [...] }`
- `{ "entities": [...] }`
- `{ "entities": { "entity_id": { ... } } }`

Pass explicit, already reviewed entity-to-MBID mappings. Artists and release-groups each receive separate candidates. An album entity may also receive one or more explicitly selected release-edition mappings; edition dates do not overwrite original album dates.

## Request plan, zero network

```sh
python3 scripts/collect_musicbrainz.py \
  --catalog data/catalog.json --output planned-requests.json --dry-run \
  --artist person_tatsuro_yamashita=ad62391d-ab7e-4ac9-9ce8-3704bc6746bb
```

The verified Tatsuro mapping is documented in `DATA-SOURCES.md`. For other mappings supply actual verified UUIDs, never the synthetic UUIDs used in tests.

## Collect

```sh
python3 scripts/collect_musicbrainz.py \
  --catalog data/catalog.json --output candidates-2026-10-02.json \
  --cache-dir music-research/mb-cache \
  --user-agent 'CityPopAtlas/1.0 (https://github.com/yonglun/city-pop-atlas)' \
  --artist person_tatsuro_yamashita=ad62391d-ab7e-4ac9-9ce8-3704bc6746bb
```

The example identifies this project’s public repository as the contact URL. Other repeatable flags are `--release-group ENTITY_ID=MBID` and `--release ENTITY_ID=MBID`. Supply all mappings to one invocation. Do not run independent concurrent collectors from the same IP: this CLI throttles its own request stream, not other processes.

Requests are serial and spaced at least 1.1 seconds apart. Retries use the same spacing plus exponential backoff on 429/500/502/503/504 and transport failures. Numeric Retry-After is honored. Other errors are recorded without fuzzy fallback. HTTP redirects are rejected so merged MBIDs need explicit review and do not cause unthrottled implicit requests. Each request has bounded retries and a 40-second socket timeout.

Successful source responses are cached by request URL SHA-256 with their timestamp and payload hash; cache hits verify integrity. The collector does not automatically refresh or repeatedly poll sources. To intentionally re-fetch, choose a new cache directory. Cache stores evidence, not API secrets. Use a dedicated cache directory and retain it with the candidate export.

Output must be a new path and cannot be the catalog. Existing output files are never overwritten. Each candidate contains selected core facts, review status, exact service-link candidates, source page/request URL, retrieval timestamp, and payload SHA-256. Errors are retained alongside successes; exit 1 means some requests failed, 2 means invalid input/I/O/usage. Exit 0 means planned or collected successfully, not reviewed.

## Fixture mode and tests

A fixture file is a JSON object whose keys exactly match `requests[].requestUrl` from the dry-run plan and whose values are MusicBrainz-style response objects. Use:

```sh
python3 scripts/collect_musicbrainz.py \
  --catalog data/catalog.json --output fixture-candidates.json \
  --fixtures fixtures.json \
  --artist person_tatsuro_yamashita=ad62391d-ab7e-4ac9-9ce8-3704bc6746bb
python3 -m unittest discover -s tests -p 'test_collect_musicbrainz.py' -v
```

Fixture mode never opens the network or writes the API cache; provenance mode is `fixture`, and fetchedAt is null so synthetic data cannot masquerade as a live observation. The tests generate isolated temporary catalogs, fixtures and cache files.

## Deliberate limitations / review contract

- Service links are only extracted from source `url-rels`; no guessing, search scraping or auth.
- Spotify only accepts exact artist/album/track URLs with expected ID syntax. YouTube accepts exact video URLs, including youtu.be, watch, shorts or embed forms; search/channel/playlist links are excluded.
- URL syntax validation does not prove availability, official uploader, region support, identity, recording version, or suitability for the mapped entity. Every link remains candidate/pending_reviewer, with those verification flags false. A release URL relationship may point to something of the wrong type: reviewer must decide.
- Artists capture aliases/lifespan/area/disambiguation. Release-groups capture earliest release date and artist-credit. Explicit editions capture labels/date/country/media/track position, duration and recording identifiers. It does not request every recording individually, so absent recording-level ISRCs and personnel are not filled in.
- MusicBrainz is community-maintained. Preserve official artist/label and liner-note evidence already in the atlas. Do not promote candidates automatically.
- Selected core metadata/relationships are CC0. This is not a license for linked album covers, portraits, Spotify metadata, or YouTube media.

Primary docs: https://musicbrainz.org/doc/MusicBrainz_API ; https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting ; https://musicbrainz.org/doc/MusicBrainz_Database

## Promote reviewed facts

Review candidates against their original sources, merge accepted fields into `data/catalog.json`, and preserve per-field evidence. Then run `node scripts/revise-catalog.mjs`, `npm run build`, and `npm test`. Candidate files never import themselves.
