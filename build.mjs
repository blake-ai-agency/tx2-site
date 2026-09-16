// TX2 Services — zero-dependency static site builder.
// src/pages/*.html  +  src/partials/*.html  ->  dist/
// Each page starts with a JSON front-matter block inside <!--{ ... }-->.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";

const ROOT = new URL(".", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const site = JSON.parse(readFileSync(join(SRC, "site.json"), "utf8"));
// Content hash of CSS+JS → ?v= on asset URLs, so browsers never serve a stale stylesheet after a deploy
site.assetVer = createHash("sha256")
  .update(readFileSync(join(ROOT, "public/css/site.css")))
  .update(readFileSync(join(ROOT, "public/js/site.js")))
  .digest("hex").slice(0, 10);

const partials = Object.fromEntries(
  readdirSync(join(SRC, "partials")).map((f) => [basename(f, ".html"), readFileSync(join(SRC, "partials", f), "utf8")])
);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// {{key}} substitution against a data object (site + page), plus {{> partial}}
function render(tpl, data) {
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!partials[name]) throw new Error(`Missing partial: ${name}`);
    return render(partials[name], data);
  });
  return tpl.replace(/\{\{\{?\s*([\w.]+)\s*\}?\}\}/g, (m, key) => {
    const raw = m.startsWith("{{{");
    const val = key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), data);
    if (val === undefined) return "";
    return raw ? String(val) : esc(val);
  });
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, "public"), DIST, { recursive: true });

const pages = readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".html"));
const urls = [];
for (const file of pages) {
  const raw = readFileSync(join(SRC, "pages", file), "utf8");
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) throw new Error(`No front matter in ${file}`);
  const page = JSON.parse(m[1]);
  for (const k of Object.keys(page)) if (typeof page[k] === "string") page[k] = page[k].replace(/\{\{\{?\s*([\w.]+)\s*\}?\}\}/g, (mm, key) => (site[key] !== undefined ? String(site[key]) : mm));
  const body = raw.slice(m[0].length).trim();
  const slug = basename(file, ".html");
  page.path = slug === "index" ? "/" : `/${slug}`;
  page.canonical = site.url + page.path;
  page.ogImage = site.url + (page.ogImage || "/img/og-image.jpg");
  page.robots = page.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large";
  page.bodyClass = page.bodyClass || "";
  const data = { ...site, ...page, site, page, year: new Date().getFullYear() };
  // nav aria-current markers
  data.cur = Object.fromEntries((site.navItems || []).map((n) => [n.key, page.nav === n.key ? ' aria-current="page"' : ""]));
  const html = render(partials.layout, { ...data, content: render(body, data) });
  writeFileSync(join(DIST, `${slug}.html`), html);
  if (!page.noindex) urls.push({ loc: page.canonical, priority: page.priority ?? 0.7 });
  console.log("built", `${slug}.html`, `(${(html.length / 1024).toFixed(1)} KB)`);
}

// sitemap + robots
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join("\n") +
    `\n</urlset>\n`
);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site.url}/sitemap.xml\n`);
console.log(`\n${pages.length} pages -> dist/`);
