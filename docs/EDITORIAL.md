# Illustrated editorial edition

The editorial library is `public/articles.json`. It contains one original essay for each canonical artist, group, creator and album in the catalog. Songs, works, recordings, editions and track positions retain their factual archive entries; they are not silently counted as essays. Every essay has Chinese, English and Japanese versions, individual sources, and one original conceptual illustration.

The essays use a literary magazine register. They are original editorial writing, not published New Yorker pieces, and do not impersonate its authors or invent quotations. Interpretive listening observations are distinct from documented biographical or release facts. Original conceptual illustrations are labeled separately from historical photographs and original cover artwork; the existing factual media and licensed player embeds remain available in archive details.

## Experience

- The graph uses stable category colors in nodes, legend, index, detail tags and catalog entries.
- Only categories with real entries appear in the legend. Selecting a category from the all-types state isolates it. Further category selections toggle a multi-type selection; Show all restores the collection.
- Search and decade filters intersect the selected graph categories. Colors do not carry meaning alone: category text, counts and `aria-pressed` states remain available.
- Each eligible catalog card and detail panel has an essay button. The reading view follows the language selector, shows actual illustration captions and source links, and restores the previous browsing scroll and initiating control when returning.
- Leaving the catalog or detail panel for an essay removes inactive media embeds; it does not keep audio players running invisibly.

## Validation

`node tests/editorial.mjs` verifies exact coverage, three substantive versions per entity, paragraph/length minimums, source URLs, actual raster assets and unique image hashes. `node tests/ui-editorial.cjs` covers category filtering and the article return/language/media lifecycle. Existing UI, navigation, archive, storage and operations tests continue to apply.

Illustrations are optimized WebP assets in `public/illustrations`. The Worker build recursively packages binary assets without exposing filesystem paths. The provenance manifest is retained in this document's companion data file when integration completes.

## Verified provenance correction

For `album_a_long_vacation`, the source supporting the existing original release date (1981-03-21) and day precision was corrected from Sony Music announcement `info/521604` to [Sony Music's 2020-10-12 anniversary announcement](https://www.sonymusic.co.jp/artist/EiichiOhtaki/info/522862). The replacement explicitly states the original issue date in its opening body sentence. The date itself and precision were not changed. The former source was about a related Seiko Matsuda release rather than the original album-date claim. The seed revision was advanced so this provenance correction reaches the persistent archive while preserving its review overlay.

MAGICAL retains its existing compilation classification and canonical 1984 year, supported by Universal's UPCY-90068 page (which specifies July 1984). A translated source-difference note records that Light in the Attic's reissue listing says 1983. No alternate year is silently approved, and the essay suppresses its year kicker while explaining the unresolved discrepancy.

Piper's Summer Breeze also retains its existing 1983 year. Apple Music dates it to 1983 while the official reissue Bandcamp description says 1984. A translated unresolved source-difference note records both sources; the essay omits a definitive year rather than resolving the discrepancy by inference.
