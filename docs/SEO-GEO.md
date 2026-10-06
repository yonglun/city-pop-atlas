# Search and AI discovery

City Pop Atlas exposes a sourced, multilingual reading layer alongside its interactive knowledge graph. SEO improves crawlability, indexing signals and the usefulness of the content. GEO here means accessibility to generative search systems; it does not promise a ranking or a citation.

## Public and private environments

- The intended public deployment is `https://city-pop.softmatrix.io`. Keep the existing `PUBLIC_ORIGIN` in the operator's `.env` unchanged. An exact HTTPS origin, without a path, query or fragment, is required for indexable production pages.
- The Linux public listener passes that trusted configuration to the renderer. It still rejects mismatched Host headers and strips forwarded identity/host headers. The authenticated administrative listener remains separate, loopback-only by default, and non-indexable.
- The owner-private Sites preview stays private. Without the explicit production indexing flag and a matching public origin, HTML carries `noindex`; robots excludes crawling and no public sitemap is advertised. Robots is only a crawler instruction, never an access-control mechanism.
- No search-engine ownership, submission, analytics account, DNS, or crawler-specific training permission is changed by this implementation.

## URL and content policy

The reading entry points are `/en/`, `/zh/` and `/ja/`. Every entity has a stable type-based path such as `/en/artists/person-tatsuro-yamashita`. Slugs derive reversibly from immutable entity IDs, so editorial name corrections do not silently change URLs. Language paths take precedence over saved browser language. Original Japanese names remain visible where documented.

Full essays, multilingual about pages, and paginated browse pages are the primary indexable material. Contextual introductions, release positions and other short supporting entries remain individually accessible, with self-canonical URLs and `noindex,follow`. They link to the appropriate related essay without falsely claiming that a track position, composition, recording and album are the same page or entity. Improve their unique sourced editorial value before opting them into the index.

The original graph and its query-based views remain available. The graph shell has ordinary links into the reading layer, while filter/search/administrative queries are excluded from indexing. Canonical article links are ordinary anchors, including for new-tab and keyboard use. Invalid entity URLs return a real 404; known normalized forms and merged aliases redirect to their canonical paths.

## Machine-readable signals

The server provides the same complete article text, sources, current documented properties, related links and navigation to people and crawlers. It does not depend on JavaScript rendering or user-agent detection. Reading pages do not load the full graph dataset and application bundle.

Each page has a specific title and description, canonical URL, language alternates (including English `x-default`), Open Graph/Twitter text metadata and applicable Schema.org entities. Structured data only describes visible documented content. AI editorial illustrations are labeled as illustrations, never archival portraits or original sleeves. There are no invented ratings, endorsements or publication dates.

`/sitemap.xml` is generated from current, indexable canonical pages and uses the configured public origin. The sitemap excludes query variants, error pages, private routes and `noindex` contextual introductions. The generation uses XML escaping and multilingual alternate links. Dates are included only when their meaning is supported by the source data; a deployment or request timestamp is not an editorial modification date.

The effective public catalog is read using the existing storage layer, so approved factual corrections and entity merges are reflected in page properties, related links and routing. Server-side snapshot caching is scoped to the database, source revision and transactional catalog epoch; every reading request checks the epoch, so approvals, undo, merges and source upgrades invalidate the cache immediately without a timed stale window. Private candidate queues, reasons, approval history and administrative identifiers are not rendered. Existing source-update and correction persistence rules remain in effect.

## Deployment and verification

This change does not upgrade the user's running Linux server by itself. Follow the existing safe release procedure, preserve `.env`, back up SQLite, and deploy the newly built source/runtime. Never copy a preview database or private administrative settings into a public package.

After deploying:

1. Fetch the public homepage, `/en/`, a full essay, a contextual entry, `/robots.txt` and `/sitemap.xml` without JavaScript. Check their response status and canonical origin.
2. Verify that indexable pages return HTTP 200 without `noindex`, and that unknown paths return HTTP 404.
3. Check all language alternates and representative structured data with the search engines' own tools. Music-specific Schema.org semantics do not imply eligibility for a Google rich-result feature.
4. Submit the public sitemap through the owner's already-verified Google Search Console and Bing Webmaster Tools properties when authorized. Check robots, URL inspection, indexing and search traffic rather than assuming immediate inclusion.
5. Review the engines' current generative-search reporting and inclusion settings with the owner. Keep crawler search access and model-training policy decisions separate.

The automated checks cover the no-JavaScript sitemap crawl, canonical/language/schema consistency, private-mode isolation, HTTP status/HEAD handling, URL escaping, aliases, consent analytics and approved catalog updates. A passing local test does not establish real-world indexing, performance metrics, third-party music playback, or server deployment.

## Primary guidance

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: generative AI content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [OpenAI crawler documentation](https://platform.openai.com/docs/bots)

## GA4 history-event check

The application sends consent-gated, sanitized manual `page_view` events and suppresses duplicates within that stream. GA4 Enhanced Measurement can independently send another event when the browser History API changes the URL. Google's documentation explicitly states that `send_page_view: false` does not disable those history-based events.

Before claiming end-to-end single-count page measurement, the property owner should check the Web stream's Enhanced Measurement page-view advanced settings and disable **Page changes based on browser history events** when using this site's manual tracking. Also review automatic Site search and Form interactions against the site's privacy policy. Do not enable, disable or change these account settings without owner authorization. The code does not change the existing measurement ID or consent choice, and this release does not claim live GA4/Clarity event verification.

Source: [Google Analytics: disable page changes based on browser history events](https://developers.google.com/analytics/devguides/collection/ga4/views#disable_page_changes_based_on_browser_history_events).
