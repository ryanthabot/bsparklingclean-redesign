/* ============================================================
   Brittney’s Sparkling Clean — interactions
   - Header state + mobile menu (focus moves into the card with it, and out with it)
   - Hero "gleam": a band of light passes over the photo once
   - Scroll reveal for sections and the room-list ticks
   - Room picker: shows the list for one room at a time
   - Mobile action bar (email + estimate)
   - Estimate form: POST to api/inquiry (Cloudflare Pages Function →
     Resend). If the server says something is wrong with the details, the page
     says so. On any other failure it opens the visitor's email program with
     the message filled in, and leaves a way to send it on the page.
   ============================================================ */

(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var INBOX = "info@bsparklingclean.com";

  /* ---------- Tell the one-line script in <head> that this file has started ---------- */
  // If it never starts (blocked, or the connection failed), that script takes the "js"
  // flag away again after five seconds, and with it every "hidden until revealed" state.
  window.__siteJsReady = true;
  clearTimeout(window.__siteFallback);
  // Arriving after that fallback has already shown everything (a very slow connection):
  // the page keeps its plain, fully visible layout. Only the form is switched back on.
  if (!document.documentElement.classList.contains("js")) document.documentElement.classList.add("js-late");

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

    // Opening the card moves focus into it, on to its first link
    navToggle.addEventListener("click", function () {
      var open = navToggle.getAttribute("aria-expanded") !== "true";
      setMenu(open);
      if (open) {
        var firstLink = nav.querySelector("a");
        if (firstLink) firstLink.focus();
      }
    });

    // Choosing a link closes the card. It is hidden from now on, so focus goes back to
    // the button instead of staying on a link that can no longer be seen.
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        setMenu(false);
        navToggle.focus();
      }
    });

    // Escape closes it and returns focus to the button
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setMenu(false);
        navToggle.focus();
      }
    });

    // Tabbing past the button and the card closes it. A tap outside does the same,
    // because focus then leaves the header.
    header.addEventListener("focusout", function (e) {
      if (!header.classList.contains("is-open")) return;
      if (e.relatedTarget && header.contains(e.relatedTarget)) return;
      setMenu(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024 && header.classList.contains("is-open")) setMenu(false);
    });
  }

  /* ---------- Hero: the gleam ---------- */
  var gleam = $("#hero-gleam");
  var heroImg = $("#hero-img");

  if (gleam && heroImg) {
    var reveal = function () {
      gleam.classList.add("is-ready");
    };
    if (reduceMotion) {
      reveal();
    } else {
      var start = function () {
        // Two frames so both copies of the photo are painted before the light begins
        requestAnimationFrame(function () {
          requestAnimationFrame(reveal);
        });
      };
      if (heroImg.complete && heroImg.naturalWidth) start();
      else {
        heroImg.addEventListener("load", start, { once: true });
        // A photo that failed is simply shown as it is; nothing waits for it
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
    var nameInput = $("#name");
    var phoneInput = $("#phone");
    var emailInput = $("#email");
    var errorBox = $("#form-error");
    var noteBox = $("#form-note");
    var contactFields = [nameInput, phoneInput, emailInput];
    var defaultError = errorBox ? errorBox.textContent : "";
    var serverMessage = false;

    var showReachError = function (show) {
      if (errorBox) {
        errorBox.textContent = defaultError;
        errorBox.hidden = !show;
      }
      [phoneInput, emailInput].forEach(function (input) {
        input.setAttribute("aria-invalid", String(show));
        if (show) input.classList.add("is-invalid"); else input.classList.remove("is-invalid");
      });
    };

    var showNote = function (html) {
      if (!noteBox) return;
      noteBox.innerHTML = html;
      noteBox.hidden = false;
    };
    var hideNote = function () {
      if (!noteBox) return;
      noteBox.hidden = true;
      noteBox.textContent = "";
    };

    // What was wrong is cleared as soon as the visitor changes a field
    form.addEventListener("input", function (e) {
      hideNote();
      if (e.target === phoneInput || e.target === emailInput) showReachError(false);
      if (serverMessage && contactFields.indexOf(e.target) !== -1) {
        serverMessage = false;
        if (errorBox) errorBox.hidden = true;
        contactFields.forEach(function (input) {
          input.removeAttribute("aria-invalid");
          input.classList.remove("is-invalid");
        });
      }
    });

    // The form gives way to a confirmation; focus moves to it, because the button that
    // had focus is gone
    var succeed = function () {
      var panel = successPanel();
      form.replaceChildren(panel);
      var heading = panel.querySelector("h3");
      if (heading) heading.focus();
    };

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
        succeed();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Sending…";
      hideNote();

      // The same message, ready for the visitor's own email program
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
      ].join("\r\n");   // Windows line ends, which every mail program shows as line breaks
      var mailtoUrl = "mailto:" + INBOX +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(lines);

      var resetButton = function () {
        btn.disabled = false;
        btn.textContent = "Request my free estimate";
      };

      // Anything other than a slip in the details falls back to the visitor's email
      // program, with the message filled in. The page says so too, in case no program opens.
      var fallBack = function () {
        window.location.href = mailtoUrl;
        resetButton();
        showNote("Your message did not go through, so we opened your email program with it filled in. " +
          "If nothing opened, you can <a href=\"" + mailtoUrl + "\">send it from here</a>.");
      };

      fetch("api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json()
            .catch(function () { return null; })
            .then(function (json) { return { ok: res.ok, status: res.status, json: json }; });
        })
        .then(function (result) {
          if (result.ok && result.json && result.json.ok !== false) {
            succeed();
            return;
          }
          // The server found something wrong with the details: say so on the page, where
          // it can be put right, instead of sending the visitor to an email program
          if (result.status === 400 && result.json && typeof result.json.error === "string") {
            resetButton();
            serverMessage = true;
            var field = /name/i.test(result.json.error) ? nameInput
              : /email/i.test(result.json.error) ? emailInput : phoneInput;
            contactFields.forEach(function (input) {
              input.removeAttribute("aria-invalid");
              input.classList.remove("is-invalid");
            });
            field.setAttribute("aria-invalid", "true");
            field.classList.add("is-invalid");
            if (errorBox) {
              errorBox.textContent = result.json.error;
              errorBox.hidden = false;
            }
            field.focus();
            return;
          }
          fallBack();
        })
        .catch(fallBack);
    });
  }

  function successPanel() {
    var wrap = document.createElement("div");
    wrap.className = "form-success";
    wrap.setAttribute("role", "status");
    wrap.innerHTML =
      '<span class="form-success-icon" aria-hidden="true"><svg class="icon"><use href="#i-check"></use></svg></span>' +
      "<h3 tabindex=\"-1\">Request received</h3>" +
      "<p>Thanks \u2014 we\u2019ll be in touch with your estimate as soon as possible.</p>" +
      "<p>Prefer to email? <a href=\"mailto:" + INBOX + "\">" + INBOX + "</a></p>";
    return wrap;
  }
})();
