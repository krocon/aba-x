# Product page ABA-T1

A static, dark page in English, after the page of ABA-X1: `index.html` with inline CSS, **no JavaScript, no web fonts,
no trackers, no requests to other servers**. Pictures in `img/` (own screenshots of the web build), favicon =
`apps/aba-t1/public/logo.svg`. The only motion is a CSS fade-in of the hero picture, off with `prefers-reduced-motion`.

## Upload

No build step: copy `index.html`, `favicon.svg` and `img/` into the target folder.

```
/products/aba-t/index.html
/products/aba-t/favicon.svg
/products/aba-t/img/*.png   (~2 MB together)
```

**Target (proposal, decision of Marc open):** page `https://krocon.de/products/aba-t/`, web app
`https://krocon.de/products/aba-t1/` (Angular `baseHref` of `pnpm build:web --app aba-t1`). `og:url` and `og:image`
point to the page folder; links to the app are absolute.

## Pictures

```bash
pnpm t1:screenshots   # builds the web version, writes docs/screenshots/aba-t1/ and apps/aba-t1/site/img/
```

Scenes: `scripts/screenshots/aba-t1.mjs`. Test: `node --test scripts/site.test.mjs` (both product pages).

## Look at it locally

Launch configuration `site-t1` in `.claude/launch.json` (port 4311), or open `index.html` directly.
