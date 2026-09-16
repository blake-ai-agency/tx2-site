# TX2 Services — website

Dumpster rental · Junk removal · Property maintenance — Union, MO. Static site built for **Cloudflare Pages** with one Pages Function for the quote form.

```
tx2-site/
├── src/
│   ├── site.json          ← business facts (phone, address, hours, domain, Turnstile site key)
│   ├── partials/          ← layout, nav, footer (shared by every page)
│   └── pages/             ← one file per page; JSON front-matter at the top
├── public/                ← copied to dist/ as-is (css, js, img, fonts, _headers, _redirects)
├── functions/api/contact.js  ← Cloudflare Pages Function: Turnstile + validation + Resend email
├── build.mjs              ← zero-dependency builder (src → dist)
└── dist/                  ← BUILD OUTPUT — this is what Cloudflare serves
```

---

## 1. Deploy to Cloudflare Pages (recommended: Git)

1. Push this folder to a GitHub/GitLab repo.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Node version: 18+ (default is fine)
4. Add the environment variables in step 3 below, then **Save and Deploy**.
5. **Custom domain** → add `tx2services.com` and `www.tx2services.com` (or whatever the real domain is). Cloudflare handles SSL.

The `functions/` folder is picked up automatically — `/api/contact` goes live with the site.

**Alternative (no Git):** `npm run deploy` uses Wrangler to upload `dist/` + `functions/` directly. Note that drag-and-drop upload in the dashboard does **not** support Functions, so the form would not work that way.

## 2. Before going live — things to confirm in `src/site.json`

| Key | Currently | Action |
|---|---|---|
| `url` | `https://www.tx2services.com` | **Set to the real domain** (used in canonical tags, sitemap, schema, OG). |
| `hours` | `Mon–Sat, 7am–6pm · Text anytime` | Placeholder — confirm real hours. |
| `turnstileSiteKey` | `1x00000000000000000000AA` (Cloudflare's **test key**, always passes) | Replace with your real Turnstile site key (see step 3). |
| `phone`, `street`, `city`, `zip`, `facebook` | From public listings | Verify. |

Everything else (service area lists, "5 days + 1 ton included", 14-yard specs) came from TX2's public listings and the photos in the TX2 folder — edit any page in `src/pages/` if something's off, then rebuild.

## 3. Environment variables (Pages → Settings → Environment variables → Production)

| Variable | Where to get it |
|---|---|
| `TURNSTILE_SECRET_KEY` | dash.cloudflare.com → **Turnstile** → Add widget (domain = your site) → copy **Secret key**. Put the matching **Site key** into `src/site.json → turnstileSiteKey`. |
| `RESEND_API_KEY` | resend.com → API Keys. Verify your sending domain there first (free tier is plenty). |
| `CONTACT_TO_EMAIL` | Where leads should land, e.g. `cody@…`. Comma-separate for multiple. |
| `CONTACT_FROM_EMAIL` | A sender on your verified Resend domain, e.g. `TX2 Website <leads@tx2services.com>`. |
| `SITE_ORIGIN` *(optional)* | `https://www.tx2services.com` — pins the form to one origin. |
| `RATE_LIMIT` *(optional KV binding)* | Pages → Settings → Functions → KV namespace bindings. Enables 5 submissions / 10 min / IP. |

Until these are set, the form returns a friendly "call us" message instead of failing silently.

## 4. Editing content

- Phone/address/hours: `src/site.json` (used everywhere).
- Page copy: `src/pages/*.html`. Each file starts with `<!--{ "title": …, "description": … }-->` for SEO.
- Photos: drop new `.webp` files in `public/img/`. Current photos were resized from the originals in the TX2 folder (480 / 960 / 1600 px widths).
- Rebuild locally: `npm run build` (no dependencies to install). Preview: `npm run dev` (uses Wrangler, serves Functions too).

## 5. Security posture (what's already in place)

- `public/_headers`: strict **CSP** (no inline scripts, only `challenges.cloudflare.com` allowed), **HSTS** with preload, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP. No third-party fonts, analytics or trackers — all assets self-hosted.
- `functions/api/contact.js`: method/content-type/size gates → same-origin check → honeypot + time-trap → **Turnstile** server-side verification → strict validation with allow-listed enum → optional KV rate limit → HTML-escaped email (no header injection) → generic errors to the client, details only in Cloudflare logs.
- `/api/*` is `no-store` and `noindex`; `robots.txt` disallows it.
- Recommended in the dashboard: turn on **Bot Fight Mode** and set a **WAF rate-limiting rule** on `/api/contact` (e.g. 10 req / min / IP) as a second layer.

## 6. SEO

- Per-page titles/descriptions, canonicals, Open Graph + Twitter cards, `sitemap.xml`, `robots.txt`.
- JSON-LD: `LocalBusiness` (address, phone, areaServed, service catalog) on every page; `Service` + `FAQPage` on service/FAQ pages.
- Next steps after launch: claim the Google Business Profile, add the site URL to Facebook, submit the sitemap in Google Search Console, and add real reviews as they come in (the review section is built to hold more).
