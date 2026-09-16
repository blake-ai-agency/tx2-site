/* TX2 Services — site behaviour. No dependencies, CSP-safe (no inline handlers / eval). */
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav: scrolled state via sentinel, not scroll events ---------- */
  var nav = document.querySelector(".nav");
  var sentinel = document.querySelector(".nav-sentinel");
  if (nav && sentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle("nav--scrolled", !entries[0].isIntersecting);
    }, { rootMargin: "-40px 0px 0px 0px" }).observe(sentinel);
  }

  /* ---------- Mobile menu ---------- */
  var burger = document.querySelector(".nav__burger");
  var menu = document.getElementById("mobile-menu");
  if (burger && menu) {
    menu.querySelectorAll(".mobile-menu__link").forEach(function (a, i) { a.style.setProperty("--i", i); });
    var setOpen = function (open) {
      burger.setAttribute("aria-expanded", String(open));
      menu.dataset.open = String(open);
      document.body.dataset.menuOpen = String(open);
      if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
    };
    burger.addEventListener("click", function () { setOpen(burger.getAttribute("aria-expanded") !== "true"); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.dataset.open === "true") { setOpen(false); burger.focus(); } });
  }

  /* ---------- Hero word stagger ---------- */
  document.querySelectorAll(".hero__title .w").forEach(function (w, i) { w.style.setProperty("--i", i); });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); ro.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal-group").forEach(function (g) {
      g.querySelectorAll(".reveal").forEach(function (el, i) { el.style.setProperty("--d", i); });
    });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Gallery scroll buttons ---------- */
  document.querySelectorAll(".gallery").forEach(function (g) {
    var track = g.querySelector(".gallery__track");
    if (!track) return;
    g.querySelectorAll("[data-dir]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = track.querySelector(".gallery__item");
        var step = item ? item.getBoundingClientRect().width + 20 : 320;
        track.scrollBy({ left: step * (btn.dataset.dir === "next" ? 1 : -1), behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  });

  /* ---------- "Will it fit?" gauge ---------- */
  var fit = document.querySelector("[data-fit]");
  if (fit) {
    var fill = fit.querySelector(".gauge__fill");
    var pct = fit.querySelector("[data-fit-pct]");
    var note = fit.querySelector("[data-fit-note]");
    var chips = fit.querySelectorAll(".chip");
    var apply = function (chip) {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
      var p = Math.min(100, parseInt(chip.dataset.pct, 10) || 0);
      fill.style.setProperty("--fill", p + "%");
      pct.textContent = p + "%";
      note.textContent = chip.dataset.note || "";
    };
    chips.forEach(function (c) { c.addEventListener("click", function () { apply(c); }); });
    if (chips[0]) apply(chips[0]);
  }

  /* ---------- Sticky mobile CTA: show after hero, hide near footer ---------- */
  var sticky = document.querySelector(".sticky-cta");
  var hero = document.querySelector(".hero, .page-hero");
  var footer = document.querySelector(".footer");
  if (sticky && hero && "IntersectionObserver" in window) {
    var pastHero = false, nearFooter = false;
    var update = function () { sticky.classList.toggle("is-visible", pastHero && !nearFooter); };
    new IntersectionObserver(function (e) { pastHero = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; update(); }, { threshold: 0 }).observe(hero);
    if (footer) new IntersectionObserver(function (e) { nearFooter = e[0].isIntersecting; update(); }, { threshold: 0.05 }).observe(footer);
  }

  /* ---------- Contact form ---------- */
  var form = document.getElementById("contact-form");
  if (form) {
    var status = form.querySelector(".form__status");
    var submitBtn = form.querySelector('button[type="submit"]');
    var started = form.querySelector('input[name="ts"]');
    if (started) started.value = String(Date.now());

    var rules = {
      name: function (v) { return v.trim().length >= 2 && v.trim().length <= 80 ? "" : "Please enter your name."; },
      phone: function (v) { return /^[\d\s().+-]{7,20}$/.test(v.trim()) && v.replace(/\D/g, "").length >= 10 ? "" : "Enter a 10-digit phone number."; },
      email: function (v) { return v.trim() === "" || /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(v.trim()) ? "" : "That email doesn't look right."; },
      service: function (v) { return v ? "" : "Pick a service."; },
      city: function (v) { return v.trim().length >= 2 && v.trim().length <= 80 ? "" : "Which town is the job in?"; },
      message: function (v) { return v.trim().length <= 2000 ? "" : "Please keep it under 2,000 characters."; },
      photos: function () {
        if (photosRequired() && photos.length < PHOTO_MIN) return "Please add at least " + PHOTO_MIN + " photos so we can quote your junk removal (" + photos.length + " of " + PHOTO_MIN + " added).";
        if (photos.length > PHOTO_MAX) return "Max " + PHOTO_MAX + " photos.";
        return "";
      }
    };

    /* ---- Photos: required (min 3) for junk removal, optional otherwise ---- */
    var PHOTO_MIN = 3, PHOTO_MAX = 8, PHOTO_EDGE = 1600, PHOTO_MAX_RAW = 25 * 1024 * 1024;
    var photos = []; // [{ blob, name, url }]
    var photoField = form.querySelector("[data-photos]");
    var photoInput = document.getElementById("f-photos");
    var photoGrid = form.querySelector("[data-photo-grid]");
    var photoLabel = form.querySelector("[data-photos-label]");
    var serviceSel = document.getElementById("f-service");
    var uploadZone = form.querySelector("[data-upload-zone]");
    var photosRequired = function () { return serviceSel && serviceSel.value === "junk"; };
    var syncPhotoLabel = function () {
      if (!photoLabel) return;
      var req = photosRequired();
      photoField.classList.toggle("is-required", req);
      photoLabel.innerHTML = req
        ? '<span class="req" aria-hidden="true">*</span> <span class="upload__count">' + photos.length + " of " + PHOTO_MIN + " required</span> — we quote junk removal from photos"
        : "(optional — but they get you a faster quote)";
      if (photoInput) photoInput.setAttribute("aria-required", String(req));
      if (!req && photoField.classList.contains("is-error")) validateField(photoInput);
    };
    var renderThumbs = function () {
      photoGrid.textContent = "";
      photos.forEach(function (p, i) {
        var d = document.createElement("div"); d.className = "thumb" + (p.busy ? " thumb--busy" : "");
        var im = document.createElement("img"); im.alt = "Photo " + (i + 1); im.src = p.url; d.appendChild(im);
        var rm = document.createElement("button"); rm.type = "button"; rm.className = "thumb__rm"; rm.setAttribute("aria-label", "Remove photo " + (i + 1)); rm.textContent = "×";
        rm.addEventListener("click", function () { URL.revokeObjectURL(p.url); photos.splice(i, 1); renderThumbs(); syncPhotoLabel(); if (photoField.classList.contains("is-error")) validateField(photoInput); });
        d.appendChild(rm); photoGrid.appendChild(d);
      });
      syncPhotoLabel();
    };
    // Shrink on-device: long edge 1600px, JPEG q0.82. Falls back to the original if the browser can't decode it (e.g. HEIC in Chrome).
    var shrink = function (file) {
      if (!("createImageBitmap" in window) || !document.createElement("canvas").getContext) return Promise.resolve(file);
      return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
        var scale = Math.min(1, PHOTO_EDGE / Math.max(bmp.width, bmp.height));
        var c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
        return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.82); });
      }).catch(function () { return file; });
    };
    var addFiles = function (list) {
      var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name); });
      var room = PHOTO_MAX - photos.length;
      if (files.length > room) { files = files.slice(0, room); }
      files.forEach(function (f) {
        if (f.size > PHOTO_MAX_RAW) return;
        var entry = { blob: f, name: f.name || "photo.jpg", url: URL.createObjectURL(f), busy: true };
        photos.push(entry); renderThumbs();
        shrink(f).then(function (b) { entry.blob = b; entry.name = (f.name || "photo").replace(/\.[^.]+$/, "") + ".jpg"; entry.busy = false; renderThumbs(); if (photoField.classList.contains("is-error")) validateField(photoInput); });
      });
      photoInput.value = "";
    };
    if (photoInput) {
      photoInput.addEventListener("change", function () { addFiles(photoInput.files); });
      ["dragenter", "dragover"].forEach(function (ev) { uploadZone.addEventListener(ev, function (e) { e.preventDefault(); uploadZone.classList.add("is-drag"); }); });
      ["dragleave", "drop"].forEach(function (ev) { uploadZone.addEventListener(ev, function (e) { e.preventDefault(); uploadZone.classList.remove("is-drag"); }); });
      uploadZone.addEventListener("drop", function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
      if (serviceSel) serviceSel.addEventListener("change", syncPhotoLabel);
      syncPhotoLabel();
    }
    var validateField = function (input) {
      var rule = rules[input.name]; if (!rule) return true;
      var msg = rule(input.name === "photos" ? null : input.value);
      var field = input.closest(".field");
      var err = field && field.querySelector(".field__error");
      if (field) field.classList.toggle("is-error", !!msg);
      if (err) err.textContent = msg;
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      return !msg;
    };
    form.querySelectorAll("input, select, textarea").forEach(function (el) {
      el.addEventListener("blur", function () { validateField(el); });
      el.addEventListener("input", function () { if (el.closest(".field.is-error")) validateField(el); });
    });
    var showStatus = function (state, text) { status.dataset.state = state; status.textContent = text; status.focus(); };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll("input, select, textarea").forEach(function (el) { if (!validateField(el)) ok = false; });
      if (!ok) { var firstErr = form.querySelector(".field.is-error input, .field.is-error select, .field.is-error textarea"); if (firstErr) firstErr.focus(); return; }
      submitBtn.setAttribute("aria-busy", "true");
      var label = submitBtn.textContent; submitBtn.textContent = "Sending…";
      if (photos.some(function (p) { return p.busy; })) { showStatus("error", "Still preparing your photos — give it a second and hit send again."); submitBtn.removeAttribute("aria-busy"); submitBtn.textContent = label; return; }
      var fd = new FormData();
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.type === "file" || el.disabled) return;
        if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
        fd.append(el.name, el.value);
      });
      photos.forEach(function (p, i) { fd.append("photos", p.blob, "photo-" + (i + 1) + ".jpg"); });
      fetch(form.action, { method: "POST", body: fd, headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (res.ok && res.body && res.body.ok) {
            form.reset();
            photos.forEach(function (p) { URL.revokeObjectURL(p.url); }); photos = []; renderThumbs();
            if (started) started.value = String(Date.now());
            showStatus("success", "Got it — we'll call or text you shortly to confirm details. Need it faster? Call (636) 584-9662.");
            if (window.turnstile) { try { window.turnstile.reset(); } catch (_) {} }
          } else {
            showStatus("error", (res.body && res.body.error) || "Something went wrong sending that. Please call or text (636) 584-9662.");
            if (window.turnstile) { try { window.turnstile.reset(); } catch (_) {} }
          }
        })
        .catch(function () { showStatus("error", "Couldn't reach the server. Please call or text (636) 584-9662."); })
        .finally(function () { submitBtn.removeAttribute("aria-busy"); submitBtn.textContent = label; });
    });
  }

  /* ---------- Footer year ---------- */
  var y = document.querySelector("[data-year]"); if (y) y.textContent = String(new Date().getFullYear());
})();

/* Preselect service from ?service= (e.g. /contact?service=dumpster) */
(function () {
  var sel = document.getElementById("f-service"); if (!sel) return;
  var q = new URLSearchParams(location.search).get("service");
  if (q && sel.querySelector('option[value="' + q.replace(/[^a-z]/g, "") + '"]')) { sel.value = q.replace(/[^a-z]/g, ""); sel.dispatchEvent(new Event("change")); }
  if (new URLSearchParams(location.search).get("error")) { var s = document.querySelector("#contact-form .form__status"); if (s) { s.dataset.state = "error"; s.textContent = "Something went wrong sending that. Please call or text (636) 584-9662."; } }
})();

/* ---------- Google reviews: live strip fed by /api/reviews (edge-cached) ---------- */
(function () {
  var wrap = document.querySelector("[data-reviews]"); if (!wrap) return;
  var track = wrap.querySelector("[data-reviews-track]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.5 5.8 21l1.6-7L2 9.3l7.1-.7z"/></svg>';
  var stars = function (n) { var s = ""; for (var i = 0; i < 5; i++) s += i < n ? STAR : STAR.replace('fill="currentColor"', 'fill="currentColor" opacity=".25"'); return s; };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  var card = function (r) {
    var a = el("article", "rcard");
    var head = el("div", "rcard__head");
    head.appendChild(el("span", "rcard__avatar", (r.author || "G").trim().charAt(0).toUpperCase()));
    var who = el("div");
    var name = el("b");
    if (r.authorUrl && /^https:\/\/(www\.)?google\.com\//.test(r.authorUrl)) { var link = el("a", null, r.author); link.href = r.authorUrl; link.rel = "noopener nofollow"; link.target = "_blank"; name.appendChild(link); } else { name.textContent = r.author; }
    who.appendChild(name);
    var meta = el("span", "rcard__meta");
    var st = el("span", "stars"); st.setAttribute("aria-label", r.rating + " stars"); st.innerHTML = stars(r.rating); meta.appendChild(st);
    meta.appendChild(el("span", "muted", r.when || "Google review"));
    who.appendChild(meta);
    head.appendChild(who);
    a.appendChild(head);
    var p = el("p", "rcard__text", r.text); a.appendChild(p);
    var more = el("button", "rcard__more", "Read more"); more.type = "button"; more.hidden = true;
    more.addEventListener("click", function () { var open = p.classList.toggle("is-open"); more.textContent = open ? "Show less" : "Read more"; });
    a.appendChild(more);
    return a;
  };
  // Show "Read more" only when the text is actually clamped at this card width
  var checkClamps = function () {
    track.querySelectorAll(".rcard").forEach(function (c) { var p = c.querySelector(".rcard__text"), m = c.querySelector(".rcard__more"); if (p && m && !p.classList.contains("is-open")) m.hidden = p.scrollHeight <= p.clientHeight + 2; });
  };
  window.addEventListener("resize", checkClamps);

  var mode = function (count) {
    // Enough cards to loop seamlessly? scroll. Otherwise a static, swipeable row.
    var scroll = count >= 4 && !reduce;
    wrap.classList.toggle("reviews--scroll", scroll);
    wrap.classList.toggle("reviews--static", !scroll);
    if (scroll) {
      Array.prototype.slice.call(track.children).forEach(function (c) { var d = c.cloneNode(true); d.setAttribute("aria-hidden", "true"); track.appendChild(d); });
      wrap.style.setProperty("--reviews-dur", Math.max(30, count * 9) + "s");
    }
  };

  fetch("/api/reviews", { headers: { accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.ok || !d.reviews || !d.reviews.length) { mode(track.children.length); return; }
      track.textContent = "";
      d.reviews.forEach(function (r) { track.appendChild(card(r)); });
      var rating = document.querySelector("[data-gbadge-rating]"), count = document.querySelector("[data-gbadge-count]"), gs = document.querySelector("[data-gbadge-stars]");
      if (rating && d.rating) rating.textContent = Number(d.rating).toFixed(1);
      if (count && d.count) count.textContent = d.count + " Google review" + (d.count === 1 ? "" : "s");
      if (gs && d.rating) gs.innerHTML = stars(Math.round(d.rating));
      document.querySelectorAll("[data-write-review]").forEach(function (a) { if (d.writeReviewUrl) a.href = d.writeReviewUrl; });
      document.querySelectorAll("[data-maps-link], [data-gbadge]").forEach(function (a) { if (d.mapsUrl) a.href = d.mapsUrl; });
      mode(d.reviews.length);
      requestAnimationFrame(checkClamps);
    })
    .catch(function () { mode(track.children.length); });
})();
