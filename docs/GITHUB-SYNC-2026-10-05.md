# Source synchronization 2026 10 05 v27

This release brings illustrated trilingual reading and consent-first analytics into the existing Linux-compatible public source. It preserves the separate administrator listener, exact Host/Origin validation, review authorization, persistent overlays, audit history, and deployment/backup/rollback safeguards.

- The public source snapshot remains 755 layered entities and 1,117 relationships, with 44 editions covering 41 albums and 476 ordered track positions.
- Every entity has a reading page in Chinese, English and Japanese: 2,265 localized versions, comprising 128 full original essays and 627 source-specific contextual introductions.
- All 128 full essays have distinct original concept illustrations. The original 84 remain, and 44 song-specific images are added. Contextual pages disclose their shared artwork.
- About includes a substantial trilingual introduction and three real photographs with creators, capture dates, sources and individual licenses. Later museum/store photographs are not represented as period evidence.
- The graph rotates by default, respects reduced motion and a saved pause, and suspends animation while hidden.
- Optional GA4 and Clarity identifiers are blank by default. Explicit visitor opt-in gates vendor loading; persistent privacy controls support denial and revocation with document replacement. Authenticated administration, review content and privacy signals are excluded. No actual IDs, accounts or live tracking are configured by this release.
- Existing database migrations and schemaVersion 1 are unchanged. In-place upgrades preserve shared configuration and runtime data; compatible code-only rollback preserves decisions made after upgrade. A database restore explicitly sacrifices writes newer than its backup.
- Public source and packages exclude live databases, approved live-state exports, private owner identities, credentials, private deployment metadata and research caches. Public seeds are not an export of private review state.
- The package builder produces city-pop-linux-deploy-20261005.tar.gz, the corresponding ZIP, and SHA-256 sidecars from an explicit verified source commit. It stamps that commit into package release.json. See the archive's sourceCommit and the matching GitHub commit for the immutable release source; this source document does not embed its own future commit.
- Source publication and package preparation do not deploy any Linux host. Existing working PUBLIC_ORIGIN, proxy, certificates, admin/security settings and shared database must be retained. Never replace an existing .env with .env.example during upgrade.

See [deployment](DEPLOYMENT.md), [analytics/privacy](ANALYTICS-PRIVACY.md), [operator scripts](../deploy/scripts/README.md) and [verification](VERIFICATION.md) for commands, current checks and unverified platform boundaries. Docker build/runtime, target-host routing, restart recovery and live vendor dashboards require separate acceptance in the operator's environment.
