# Optional Google Analytics 4 and Microsoft Clarity

Both integrations are **off by default**. No real account or project identifiers are included. The archive works without them. Configuring an ID does not override visitor consent.

## Configuration

Add only the intended public identifiers to `.env`:

```
GA_MEASUREMENT_ID=
CLARITY_PROJECT_ID=
```

Use the GA4 web stream's `G-…` Measurement ID and the Clarity project's lowercase alphanumeric ID, not API keys or credentials. Blank or malformed values disable that provider independently. These IDs are intentionally public; never put passwords, service tokens or review administrator IDs in them.

For local Node preview, `.env` is loaded at startup using Node 22's native environment loader; existing process environment takes precedence. For the portable Linux package, Compose passes these two variables to the application. Restart/recreate the application after changing them. For the hosted Site, set the same two runtime variables in that Site's environment settings; local `.env` is not uploaded. Preserve existing review/access settings.

`GET /api/public-config` returns only `gaMeasurementId`, `clarityProjectId` and a boolean `blocked`; it never serializes the environment or queries the database. It is not cached. Authenticated administrators, DNT and GPC are blocked server-side; the browser separately checks the same privacy signals.

## Consent and isolation

- The three-language Privacy choices control offers equally prominent allow/reject actions. No Google/Clarity script, preload, preconnect or tracking request is made before a valid explicit grant.
- With neither ID configured, only an explanatory privacy control appears. No consent banner is needed.
- Search text, raw query strings, fragments, review tokens, account identifiers and user IDs are never added to analytics events. Only fixed public view paths and public article IDs are used for manually emitted GA pageviews.
- Clarity text is masked at the document root, with an additional review mask. Configure strict masking in the Clarity project before activation as defense in depth. No custom `identify` or user/session identifier is supplied.
- Review entry after vendor code has loaded is a full document navigation, before any review request or private DOM is rendered. A document that has entered review is permanently ineligible for analytics, including when it later shows public views. Authenticated administrators also receive blank provider IDs.
- Unknown or repeated URL parameters, non-public paths and fragments prevent analytics startup. A clean `?privacy=off` is a safe revocation landing route.
- Revocation persists denial, disables GA, restricts the dying document's external connections with an additional CSP, invokes vendor shutdown as best effort, removes readable first-party `_ga*`, `_gid`, `_gat*`, `_clck` and `_clsk` cookies and replaces the document. Google/Microsoft domain cookies and previously collected data cannot be deleted by this site. Already-sent or in-flight requests cannot be recalled.
- Cross-tab removal/revocation, BFCache restoration and changed DNT/GPC signals fail closed. A denied/revoked visitor can explicitly allow analytics again through Privacy choices.

Google and Microsoft receive normal device/connection information, including the transport IP address, when their services are enabled. The application does not add an IP address parameter. This integration is not a representation that every jurisdiction's privacy obligations have been satisfied; the operator remains responsible for its notice, retention and provider settings.

## GA4 pageview configuration

This SPA emits its own public pageviews. `send_page_view: false` suppresses the tag's automatic initial event; repeated renders and language changes do not create pageviews. Moving to a different public view or article does. Advertising storage, advertising user data and personalization are denied, and Google Signals/ad personalization are disabled.

Before entering a real ID, disable GA4 Enhanced Measurement's automatic history-based pageview collection (and other automatic collection that could capture fields outside this manual model). `send_page_view: false` alone does **not** disable Enhanced Measurement history events. No live GA account settings were changed or verified here.

## Why loading is gated, rather than just setting denied consent

Microsoft's ConsentV2 denial can continue limited cookieless collection, and its implementation can schedule a restart. Therefore this app does not load Clarity at all before grant, and consent withdrawal replaces the document instead of relying on a consent API or removing a script tag alone. Clarity's consent fields intentionally use `ad_Storage` and `analytics_Storage`, unlike Google's field names.

## Verification

`npm run build && npm run test:privacy` uses fake IDs and isolated jsdom/Worker tests. No vendor scripts execute or receive traffic during these tests. Coverage includes absent/invalid IDs, grant/decline, DNT/GPC, per-provider loading, duplicated URL values, exact-once SPA pageviews, language rerenders, review isolation, storage/config races, revocation, cookies and BFCache.

These are application-level checks. Cloud-browser access to the local preview was blocked by the browser client, so real-browser CSP enforcement, vendor masking behavior and live dashboards were not verified. Validate them in a permitted staging browser with consenting traffic before activation.

## Primary references

- [Google: pageview measurement](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google: consent mode implementation](https://developers.google.com/tag-platform/security/guides/consent)
- [Google: disabling Analytics measurement](https://developers.google.com/analytics/devguides/collection/ga4/disable-analytics)
- [Microsoft: Clarity Consent API V2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Microsoft: masking content](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking)
- [Microsoft Clarity implementation](https://github.com/microsoft/clarity/blob/master/packages/clarity-js/src/data/metadata.ts)
