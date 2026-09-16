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
      message: function (v) { return v.trim().length <= 2000 ? "" : "Please keep it under 2,000 characters."; }
    };
    var validateField = function (input) {
      var rule = rules[input.name]; if (!rule) return true;
      var msg = rule(input.value);
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
      var fd = new FormData(form);
      fetch(form.action, { method: "POST", body: fd, headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (res.ok && res.body && res.body.ok) {
            form.reset();
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
  if (q && sel.querySelector('option[value="' + q.replace(/[^a-z]/g, "") + '"]')) sel.value = q.replace(/[^a-z]/g, "");
  if (new URLSearchParams(location.search).get("error")) { var s = document.querySelector("#contact-form .form__status"); if (s) { s.dataset.state = "error"; s.textContent = "Something went wrong sending that. Please call or text (636) 584-9662."; } }
})();
