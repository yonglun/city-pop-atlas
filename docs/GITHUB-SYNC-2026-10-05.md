> Historical v33 publication record only. The current 20261006-seo-v34 package includes private-upstream SEO changes that have NOT been pushed to public GitHub. Use release.json provenance and the complete source shipped with this archive.

# Source synchronization 2026 10 05 v33

This cumulative release adds CD-edition coverage and five artist-expansion batches to the existing Linux-compatible public source. It retains illustrated trilingual reading and consent-first analytics. It preserves the separate administrator listener, exact Host/Origin validation, review authorization, persistent overlays, audit history, and deployment/backup/rollback safeguards.

- The public source snapshot contains 1,226 layered entities and 1,711 base relationships, with 76 editions covering 67 albums and 835 ordered track positions.
- Every entity has a reading page in Chinese, English and Japanese: 3,678 localized versions, comprising 208 full original essays and 1,018 source-specific contextual introductions.
- All 208 full essays have distinct original concept illustrations. The previous 128 remain, with 80 additional illustrations in this cumulative release. Contextual pages disclose their shared artwork.
- About includes a substantial trilingual introduction and three real photographs with creators, capture dates, sources and individual licenses. Later museum/store photographs are not represented as period evidence.
- The graph rotates by default, respects reduced motion and a saved pause, and suspends animation while hidden.
- Optional GA4 and Clarity identifiers are blank by default. Explicit visitor opt-in gates vendor loading; persistent privacy controls support denial and revocation with document replacement. Authenticated administration, review content and privacy signals are excluded. No actual IDs, accounts or live tracking are configured by this release.
- Existing database migrations and schemaVersion 1 are unchanged. In-place upgrades preserve shared configuration and runtime data; compatible code-only rollback preserves decisions made after upgrade. A database restore explicitly sacrifices writes newer than its backup.
- Public source and packages exclude live databases, approved live-state exports, private owner identities, credentials, private deployment metadata and research caches. Public seeds are not an export of private review state.
- The package builder produces city-pop-linux-deploy-20261005.tar.gz, the corresponding ZIP, SHA-256 sidecars, and deterministic attachment-sized parts with a standalone reassembly/checker when needed. Every archive retains all source content and the prebuilt runtime. Build from an explicit verified source commit. It stamps that commit into package release.json. See the archive's sourceCommit and the matching GitHub commit for the immutable release source; this source document does not embed its own future commit.
- Source publication and package preparation do not deploy any Linux host. Existing working PUBLIC_ORIGIN, proxy, certificates, admin/security settings and shared database must be retained. Never replace an existing .env with .env.example during upgrade.

See [deployment](DEPLOYMENT.md), [analytics/privacy](ANALYTICS-PRIVACY.md), [operator scripts](../deploy/scripts/README.md) and [verification](VERIFICATION.md) for commands, current checks and unverified platform boundaries. Docker build/runtime, target-host routing, restart recovery and live vendor dashboards require separate acceptance in the operator's environment.

## Large snapshot safety

Catalog JSON parameters are split at UTF-8 boundaries below 1,800,000 bytes. Deletion of the old base snapshot and insertion of every chunk share a single transaction. Duplicate rows in a later chunk, oversized individual rows and the import query-budget guard fail closed; no successful prior chunk is committed independently. The Linux production SQLite adapter is covered separately from the development adapter.

## Same-day upgrade identification

The release label is `20261005-v33`, distinct from the earlier `20261005-v27`; the operator uses the archive SHA-256 prefix as the installation directory ID. An existing `.env`, including configured analytics values and origin, is preserved byte-for-byte. The package does not reset values to the blank example.
