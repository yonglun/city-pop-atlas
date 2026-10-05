# City Pop Atlas: illustrated reading and consent-first analytics

## Editorial coverage

Every one of the 755 catalog entities has a corresponding introduction in Chinese, English and Japanese: **2,265 language versions**.

- 43 people/groups, 41 albums and 44 songs retain their 128 full original essays.
- Each of those 128 canonical essays has its own distinct original illustration. The 84 existing illustrations are preserved; 44 new song-specific illustrations were generated individually.
- 44 release editions, 476 ordered track positions, 53 written works and 54 recording identifiers each have a specific contextual introduction. These 627 pages identify the exact edition/position/work/reference, explain the available evidence and its limits, explicitly identify their shared illustration, and link the appropriate fuller essay.
- A track position is not counted as a new unique song. A MusicBrainz reference, shared title, remaster label or catalog number is not independent proof of recording/master equivalence. Live reviewed facts remain separate from the distributable source snapshot; changed current facts are displayed prominently at reading time.
- All original essay titles, decks, prose and source lists are unchanged. New art is conceptual AI-generated editorial illustration, not a historical photograph, artist portrait or original record cover. No lyrics are reproduced.

Source joins are recorded in each contextual entry’s `contextEvidence`; source seed attribute snapshots support current-fact notices. `data/illustration-provenance.json` records 128 image hashes, including prompts and encoding information for new assets. Full-resolution new image originals are retained separately from the optimized website assets.

## About

The About page now opens with a substantial, source-grounded three-language introduction. It distinguishes the 1970s/early 1980s from the later asset-price bubble, follows technology and credited collaboration, and describes collecting, reissues and renewed circulation without invented interviews or listening claims.

Three real photographs retain visible creators, capture dates, source and license links:

- Tokyo in March 1978, LBM1948, CC BY-SA 4.0
- Sony TPS-L2 museum photograph from 2006, Anna Gerdén / Tekniska museet, CC BY-SA 3.0
- Tower Records Shibuya in 2019, DXR, CC BY-SA 4.0

The later photographs are explicitly distinguished from period documentation. Web derivatives are proportionally resized and re-encoded, without cropping or retouching. `data/about-photo-provenance.json` records originals and derivative hashes. Scope and coverage appear last.

## Behavior and integrations

The graph rotates on a fresh visit, respects reduced-motion preference, saves explicit pause/resume choices, and suspends its animation loop while hidden. Existing manual graph interaction remains available.

GA4 and Clarity use two allowlisted public runtime IDs, blank by default. Three-language opt-in controls gate all analytics code loading. Review/admin documents are excluded; search text and account/review identifiers are not passed into events. See [configuration, privacy boundaries and verification](ANALYTICS-PRIVACY.md). No accounts, actual IDs, access grants or live tracking have been configured.

## Preservation and test scope

Catalog entities/relationships and database schema are unchanged. No live review candidate is approved, reset or migrated by this update; hosted access and administrator configuration are preserved. Portable Linux code retains separate authenticated administration and runtime database handling. No user Linux host is changed by publishing the private hosted Site.

Application tests cover every contextual entry in all three languages, canonical-text preservation, all image mappings/provenance, navigation back to the exact reading context, consent races, review isolation, environment validation, animation state and the existing catalog/review/undo security suites. Browser-client restrictions prevented local cloud-browser visual/CSP verification; mocked tests are not a substitute for real vendor/dashboard verification before activation.
