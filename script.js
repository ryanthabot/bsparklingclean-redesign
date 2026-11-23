/* ============================================================
   Brittney’s Sparkling Clean — interactions
   - Header state + mobile menu
   - Hero "gleam": a band of light passes over the photo once
   - Scroll reveal for sections and the room-list ticks
   - Room picker: shows the list for one room at a time
   - Mobile action bar (email + estimate)
   - Estimate form: POST to api/inquiry (Cloudflare Pages Function →
     Resend); falls back to a mailto: link when the API isn't there.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var INBOX = "info@bsparklingclean.com";

  /* ---------- Header state + mobile menu ---------- */
  var header = $(".site-header");
  var navToggle = $("#nav-toggle");
  var nav = $("#site-nav");

  function setMenu(open) {
    header.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
    updateBar();
  }

  if (header && navToggle && nav) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    navToggle.addEventListener("click", function () {
      setMenu(navToggle.getAttribute("aria-expanded") !== "true");
    });

    // Close after choosing a link, or on Escape
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setMenu(false);
        navToggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024 && header.classList.contains("is-open")) setMenu(false);
    });
  }

  /* ---------- Hero: the gleam ---------- */
  var gleam = $("#hero-gleam");
  var heroImg = $("#hero-img");
  var dull = gleam && $(".gleam-dull", gleam);

  if (gleam && heroImg && dull) {
    var reveal = function () {
      gleam.classList.add("is-ready");
    };
    if (reduceMotion) {
      reveal();
    } else {
      var start = function () {
        // Two frames so both copies are painted before the light begins
        requestAnimationFrame(function () {
          requestAnimationFrame(reveal);
        });
      };
      if (heroImg.complete && heroImg.naturalWidth) start();
      else {
        heroImg.addEventListener("load", start, { once: true });
        heroImg.addEventListener("error", reveal, { once: true });
      }
    }
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = $$(".rv");
  if (!("IntersectionObserver" in window) || reduceMotion) {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Room picker: one room's list at a time ---------- */
  var picker = $("#room-picker");
  var panels = $$(".room-panel");
  var roomButtons = picker ? $$(".room-btn", picker) : [];

  function chooseRoom(key) {
    roomButtons.forEach(function (b) {
      var active = b.getAttribute("data-room") === key;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    panels.forEach(function (panel) {
      var active = panel.id === "room-" + key;
      panel.classList.toggle("is-active", active);
      if (active) {
        // Hold the ticks back for a frame, so the newly shown list ticks in again
        panel.classList.add("is-fresh");
        void panel.offsetWidth;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { panel.classList.remove("is-fresh"); });
        });
      }
    });
  }

  if (picker && roomButtons.length && panels.length) {
    picker.addEventListener("click", function (e) {
      var btn = e.target.closest(".room-btn");
      if (btn && !btn.classList.contains("is-active")) chooseRoom(btn.getAttribute("data-room"));
    });
    // Left / Right arrows move between rooms
    picker.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      var current = roomButtons.indexOf(document.activeElement);
      if (current === -1) return;
      e.preventDefault();
      var dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      var next = roomButtons[(current + dir + roomButtons.length) % roomButtons.length];
      chooseRoom(next.getAttribute("data-room"));
      next.focus();
    });
    // "14 tasks on the list" on a room card opens that room's list
    $$(".room-link[data-room]").forEach(function (link) {
      link.addEventListener("click", function () { chooseRoom(link.getAttribute("data-room")); });
    });
  }

  /* ---------- Mobile action bar ---------- */
  // Shown whenever the hero's main button is not fully on screen (and the estimate
  // form isn't already in view), so an email or estimate is always one tap away.
  var bar = $("#mobile-bar");
  var heroCta = $(".hero-actions .btn-primary");
  var contact = $("#estimate");
  var ctaOffScreen = false;
  var onContact = false;

  function updateBar() {
    if (!bar) return;
    var menuOpen = header && header.classList.contains("is-open");
    bar.classList.toggle("is-shown", ctaOffScreen && !onContact && !menuOpen);
  }

  if (bar && heroCta && "IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) { ctaOffScreen = !entries[0].isIntersecting; updateBar(); },
      { threshold: 1 }
    ).observe(heroCta);

    new IntersectionObserver(
      function (entries) { onContact = entries[0].isIntersecting; updateBar(); },
      { threshold: 0.12 }
    ).observe(contact);
  }

  /* ---------- Estimate form ---------- */
  var form = $("#estimate-form");

  if (form) {
    var phoneInput = $("#phone");
    var emailInput = $("#email");
    var errorBox = $("#form-error");

    var showReachError = function (show) {
      if (errorBox) errorBox.hidden = !show;
      [phoneInput, emailInput].forEach(function (input) {
        input.setAttribute("aria-invalid", String(show));
        if (show) input.classList.add("is-invalid"); else input.classList.remove("is-invalid");
      });
    };

    [phoneInput, emailInput].forEach(function (input) {
      input.addEventListener("input", function () { showReachError(false); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Browser-level checks first (name is required, email must be well-formed)
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var value = function (name) {
        var el = form.elements[name];
        return el ? el.value.trim() : "";
      };

      // We need at least one way to answer
      if (!value("phone") && !value("email")) {
        showReachError(true);
        phoneInput.focus();
        return;
      }

      var data = {
        name: value("name"),
        phone: value("phone"),
        email: value("email"),
        town: value("town"),
        often: value("often"),
        message: value("message"),
        website: value("website") // honeypot — people never see or fill this
      };

      // Honeypot tripped: pretend it worked, send nothing
      if (data.website) {
        form.replaceChildren(successPanel());
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Sending…";

      var mailtoFallback = function () {
        var subject = "Cleaning estimate request — " + (data.name || "new enquiry");
        var lines = [
          "Name: " + data.name,
          "Phone: " + data.phone,
          "Email: " + data.email,
          "Town: " + data.town,
          "How often: " + data.often,
          "",
          "Message:",
          data.message
        ].join("\n");
        window.location.href = "mailto:" + INBOX +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(lines);
        btn.disabled = false;
        btn.textContent = "Request my free estimate";
      };

      fetch("api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (json) {
          if (!json || json.ok === false) throw new Error("rejected");
          form.replaceChildren(successPanel());
        })
        .catch(mailtoFallback);
    });
  }

  function successPanel() {
    var wrap = document.createElement("div");
    wrap.className = "form-success";
    wrap.setAttribute("role", "status");
    wrap.innerHTML =
      '<span class="form-success-icon" aria-hidden="true"><svg class="icon"><use href="#i-check"></use></svg></span>' +
      "<h3>Request received</h3>" +
      "<p>Thanks \u2014 we\u2019ll be in touch with your estimate as soon as possible.</p>" +
      "<p>Prefer to email? <a href=\"mailto:" + INBOX + "\">" + INBOX + "</a></p>";
    return wrap;
  }
})();
