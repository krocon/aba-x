# Product page ABA-X1

A static, **dark** page in English, after the model of the Comic Commander page: `index.html` with inline CSS,
**no JavaScript, no web fonts, no trackers, no requests to other servers**. The pictures live in `img/` next to the
page. Colours of the app: page `#252936`, LCD green, violet `#a98fdb`, teal `#68cac3` (logo inline, `favicon.svg` =
`public/logo.svg`). The only movement is the small LCD ticker in the hero (CSS animation, off with
`prefers-reduced-motion`).

## Upload

No build step: copy `index.html`, `favicon.svg` and `img/` into the target folder of the web space.

```
/products/aba-x/index.html
/products/aba-x/favicon.svg
/products/aba-x/img/hero.png, graph.png, device-calc.png, device-cas.png, device-graph.png   (~2 MB together)
```

**Open decision – where the page lives.** The web app itself is at `https://krocon.de/products/aba-x1/` (Angular
`baseHref`), so the page cannot use that folder. The head assumes `https://krocon.de/products/aba-x/` (`og:url`,
`og:image`); a different folder only needs those two meta tags changed. All links to the app are absolute.

## Pictures

Generated from the web build, reproducible:

```bash
pnpm screenshots:site     # builds the web version, writes site/img/*.png
```

The scenes are in `scripts/screenshots/run.mjs` (group `site`): `hero` and `graph` are 1280 × 720 in full-size mode at
device pixel ratio 2 (the menu button is hidden); `device-*` are the device at 520 × 980 (= the worked examples). If
the size changes, adjust `width`/`height` of the `<img>` tags – `scripts/site.test.mjs` compares them with the files.

## Notes

- **Claims:** what the page promises must hold for the current state (features, platforms, languages, "not yet
  released"). Same statements as in the README.
- **Privacy:** no cookies, no JavaScript, no foreign servers – only the access logs of the web server. Imprint and
  privacy: link in the footer to `https://krocon.de`.
- **Check:** `node --test scripts/site.test.mjs` (part of `pnpm check`) – local files only, every picture exists with
  matching size and an alt text, no scripts, no external resources.
- View locally: open `site/index.html` in a browser.
