# موقع الاتحاد السعودي للجمباز — SGF website

Static site, hosted free on **Cloudflare Pages**. No dependencies.

## Cloudflare settings (Workers + static assets)
- Deploy command: `npx wrangler deploy` (uses wrangler.jsonc)
- Build command: `node build.mjs`
- Build output directory: `dist`

## Content
Content lives in `data/`:
- `events.json` — competitions & events (status: `published` / `hidden`)
- `news.json` — news
- `albums.json` — photo albums
- `site.json` — centres, contact, member portal link
- `khobar.json` — Khobar packages, schedule, conditions
- `people.json`, `coaches.json`, `partners.json` — team, coaches, clubs & partners

**Next phase:** these files are filled automatically from Zoho CRM (Events / News / Albums modules) and album photos come from Google Drive folders, so staff only work in Zoho.

## Local preview
```
node build.mjs && python3 -m http.server -d dist 8000
```
