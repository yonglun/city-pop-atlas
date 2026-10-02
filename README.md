# City Pop Atlas · シティポップ

A Chinese / English / Japanese knowledge graph for exploring Japanese City Pop artists, records, songs and songwriting credits.

## Features

- Rotatable 3D node cloud with drag, zoom, optional automatic rotation and keyboard controls
- Search across original names, translated labels and aliases
- Entity-type and decade filters; catalogue and introductory guide
- Related-entry navigation and documented source links
- Responsive interface and a keyboard-accessible text index

## Run locally

The editable application source is in `dist/`. This is a static site: no build, package installation, backend or API key is required.

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000 in your browser. Any static web server can serve `dist/` as its document root. Publishing this repository does not automatically configure hosting.

## Files

- `dist/index.html` — page structure
- `dist/style.css` — styling and responsive layout
- `dist/app.js` — interaction, canvas rendering and interface translations
- `dist/data.js` — curated entities, relationships and source URLs
- `dist/favicon.svg` — site icon

Google Fonts are requested by the stylesheet; system-font fallbacks are included. The selected language is stored locally in the browser.

## Data and scope

The initial representative collection contains 106 entities and 178 relationships. It is not a complete catalogue of City Pop. Entity labels and descriptions are available in Chinese, English and Japanese; official original titles are retained. Sources are attached to entities and relationships. Preserve these citations when editing the dataset.

This repository does not host music, lyrics or album-cover images. Referenced third-party material remains subject to its own rights and terms. No open-source license has been selected for this repository.

## Checks

```sh
node --check dist/app.js
node --check dist/data.js
```

Manual checks: switch all three languages; search an alias; filter and clear; drag/zoom/reset the graph; start automatic rotation, move the pointer onto the graph, pause and resume; navigate the catalogue; open relationships and source links; verify mobile search and detail panels and Escape dismissal.

The current version includes fixes for accidental rotation cancellation from hover and bubbled navigation clicks. DOM event-propagation regression checks reproduced the old click failure and passed after the correction. Full browser visual QA remains outstanding.
