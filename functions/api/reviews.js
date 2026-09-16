/**
 * GET /api/reviews — Google Business Profile reviews, cached at the edge.
 *
 * Pulls rating, review count and the latest reviews for TX2 from the Google Places API (New),
 * strips them down to what the page needs, and caches the result for REVIEWS_TTL seconds
 * (default 6 h) so Google is hit a handful of times a day at most. New reviews appear on the
 * site automatically the next time the cache expires.
 *
 * Required env:
 *   GOOGLE_PLACES_API_KEY — Google Cloud → APIs & Services → Credentials. Restrict it to
 *                           "Places API (New)" only.
 * Optional env:
 *   GOOGLE_PLACE_ID       — the ChIJ… id. If absent, resolved once via Text Search and cached.
 *   REVIEWS_MIN_RATING    — hide reviews below this star count (default 4).
 *   REVIEWS_TTL           — cache seconds (default 21600).
 *
 * Google Places policy notes honoured here: author name + profile link are passed through for
 * attribution, data is cached < 30 days, and the page shows "Reviews from Google" with links back.
 */

const SEARCH_QUERY = "TX2 Services, 2 Kee Drive, Union, MO 63084";
const FIELDS = "id,rating,userRatingCount,googleMapsUri,reviews";

const json = (status, body, cache) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache ? `public, max-age=${Math.min(cache, 3600)}, s-maxage=${cache}` : "no-store",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "same-origin",
    },
  });

async function resolvePlaceId(key) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName" },
    body: JSON.stringify({ textQuery: SEARCH_QUERY, maxResultCount: 1 }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Place lookup failed (${r.status}): ${googleReason(d)}`);
  const id = d.places && d.places[0] && d.places[0].id;
  if (!id) throw new Error("Place lookup returned no match for the business address");
  return id;
}

// Google's error envelope → one safe, human-readable line (never includes the key)
function googleReason(d) {
  const e = d && d.error;
  if (!e) return "unknown error";
  const status = e.status || e.code || "";
  const msg = String(e.message || "").replace(/key=[^&\s]+/g, "key=…");
  let hint = "";
  if (/not (been )?(used|enabled)|SERVICE_DISABLED/i.test(msg)) hint = " → enable \"Places API (New)\" in Google Cloud for this project";
  else if (/billing/i.test(msg)) hint = " → enable billing on the Google Cloud project";
  else if (/referer|referrer/i.test(msg)) hint = " → the key has HTTP-referrer restrictions; server calls have no referrer, use API restrictions only";
  else if (/API key not valid|INVALID_ARGUMENT.*key/i.test(msg)) hint = " → check the key was pasted correctly";
  else if (/PERMISSION_DENIED/i.test(status)) hint = " → the key is restricted to a different API; allow \"Places API (New)\"";
  return `${status} ${msg}${hint}`.trim();
}

function shape(place, minRating) {
  const reviews = (place.reviews || [])
    .filter((rv) => typeof rv.rating === "number" && rv.rating >= minRating && rv.text && rv.text.text)
    .map((rv) => ({
      author: (rv.authorAttribution && rv.authorAttribution.displayName) || "Google user",
      authorUrl: (rv.authorAttribution && rv.authorAttribution.uri) || null,
      rating: rv.rating,
      text: String(rv.text.text).slice(0, 700),
      when: rv.relativePublishTimeDescription || "",
      time: rv.publishTime || null,
    }))
    .sort((a, b) => (b.time || "").localeCompare(a.time || ""));
  return {
    ok: true,
    rating: place.rating || null,
    count: place.userRatingCount || 0,
    mapsUrl: place.googleMapsUri || null,
    writeReviewUrl: place.id ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place.id)}` : null,
    reviews,
    fetchedAt: new Date().toISOString(),
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const ttl = Math.max(600, Number(env.REVIEWS_TTL) || 21600);
  const minRating = Math.min(5, Math.max(1, Number(env.REVIEWS_MIN_RATING) || 4));
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) return json(503, { ok: false, error: "reviews_not_configured" });

  // Edge cache: one entry per deployment host
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/reviews?v=2", request.url).toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    let placeId = env.GOOGLE_PLACE_ID;
    if (!placeId) {
      // Resolve once and remember it (KV if bound, otherwise the edge cache)
      if (env.RATE_LIMIT) placeId = await env.RATE_LIMIT.get("google_place_id");
      if (!placeId) {
        placeId = await resolvePlaceId(key);
        if (env.RATE_LIMIT) await env.RATE_LIMIT.put("google_place_id", placeId, { expirationTtl: 60 * 60 * 24 * 30 });
      }
    }
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    });
    const place = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = `Place details failed (${r.status}): ${googleReason(place)}`;
      console.error("places_details_error", detail);
      return json(502, { ok: false, error: "google_unavailable", detail });
    }
    const res = json(200, shape(place, minRating), ttl);
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    console.error("reviews_exception", String(e));
    return json(502, { ok: false, error: "google_unavailable", detail: String(e && e.message || e).slice(0, 300) });
  }
}

export async function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  return json(405, { ok: false, error: "Method not allowed." });
}
