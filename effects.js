/*!
 * hl-effects v1.0.1
 * Small, no-build scroll and text effects.
 * https://github.com/rjohnson-hl/hl-website
 *
 * Requires window.gsap and window.ScrollTrigger.
 * The host page must provide both. Do NOT load GSAP again from a CDN -- a
 * second copy overwrites the first, and you silently end up running whichever
 * version happens to load last.
 */
(function () {
  "use strict";

  var NS = "[hl-effects]";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function warn(message, el) {
    console.warn(NS + " " + message, el || "");
  }

  /* ------------------------------------------------------------------
   * splitWords(el)
   *
   * Replaces an element's text with one <span class="word"> per word.
   * Real space text nodes are kept between words, so text selection and
   * screen readers still see a normal sentence.
   *
   * Text-only by design. If the element contains inline markup (<br>, <em>,
   * a link) this refuses and warns rather than silently destroying it.
   * Returns a NodeList of words, or null if it declined.
   * ---------------------------------------------------------------- */
  function splitWords(el) {
    if (el.dataset.hlSplit === "true") {
      return el.querySelectorAll(":scope > .word");
    }

    if (el.children.length) {
      warn(
        'skipped: contains inline markup (<' +
          el.children[0].tagName.toLowerCase() +
          '>). Word-splitting would destroy it.',
        el
      );
      return null;
    }

    var words = el.textContent.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return null;

    var frag = document.createDocumentFragment();
    words.forEach(function (word, i) {
      if (i) frag.appendChild(document.createTextNode(" "));
      var span = document.createElement("span");
      span.className = "word";
      span.textContent = word; // textContent, never innerHTML
      frag.appendChild(span);
    });

    el.textContent = "";
    el.appendChild(frag);
    el.dataset.hlSplit = "true";
    return el.querySelectorAll(":scope > .word");
  }

  /* ------------------------------------------------------------------
   * syncWordGradient(block)
   *
   * Each word carries its own gradient background (see effects.css for why).
   * That means each word's background box is its own, so left alone the
   * gradient would restart on every word. This maps each word's background
   * onto the BLOCK's box, so the gradient reads as one continuous sweep.
   *
   * Must re-run on anything that reflows the block: resize, webfont swap.
   * ---------------------------------------------------------------- */
  function syncWordGradient(block) {
    var b = block.getBoundingClientRect();
    if (!b.width) return; // hidden, display:none, or not laid out yet

    var words = block.querySelectorAll(":scope > .word");
    if (!words.length) return;

    // Read every rect first, then write. Keeps this to one layout pass.
    var rects = Array.prototype.map.call(words, function (w) {
      return w.getBoundingClientRect();
    });

    var size = b.width + "px " + b.height + "px";
    words.forEach(function (w, i) {
      w.style.backgroundSize = size;
      w.style.backgroundPosition =
        -(rects[i].left - b.left) + "px " + -(rects[i].top - b.top) + "px";
    });
  }

  /* ------------------------------------------------------------------
   * Effects
   *
   * Keyed by the value used in data-effect. Each receives the element and
   * may return a resync function, which runs on resize and font load.
   * ---------------------------------------------------------------- */
  var effects = {
    /*
     * scrub-words -- reveals a heading word by word as it scrolls into view.
     * Unrevealed words are completely invisible, not dimmed.
     *
     *   <h2 data-effect="scrub-words">...</h2>
     *
     * Optional per-element tuning (plain HTML attributes):
     *   data-stagger  seconds between words          default 0.15
     *   data-start    ScrollTrigger start            default "top 90%"
     *   data-end      ScrollTrigger end              default "top center"
     */
    "scrub-words": function (el) {
      var words = splitWords(el);
      if (!words || !words.length) return;

      syncWordGradient(el);

      var resync = function () {
        syncWordGradient(el);
      };

      if (reducedMotion) {
        window.gsap.set(words, { opacity: 1 });
        return resync;
      }

      window.gsap.fromTo(
        words,
        { opacity: 0 },
        {
          opacity: 1,
          ease: "none",
          stagger: { each: parseFloat(el.dataset.stagger) || 0.15 },
          scrollTrigger: {
            trigger: el,
            start: el.dataset.start || "top 90%",
            end: el.dataset.end || "top center",
            scrub: true
          }
        }
      );

      return resync;
    }
  };

  /* ------------------------------------------------------------------
   * Wiring
   * ---------------------------------------------------------------- */
  var resyncers = [];

  function init(root) {
    root = root || document;
    Object.keys(effects).forEach(function (name) {
      root.querySelectorAll('[data-effect~="' + name + '"]').forEach(function (el) {
        if (el.dataset.hlInit === "true") return; // idempotent
        el.dataset.hlInit = "true";
        var resync = effects[name](el);
        if (typeof resync === "function") resyncers.push(resync);
      });
    });
  }

  function resync() {
    resyncers.forEach(function (fn) {
      fn();
    });
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  function boot() {
    if (!window.gsap || !window.ScrollTrigger) {
      warn(
        "GSAP + ScrollTrigger not found, so effects are disabled and text " +
          "renders normally. The host page must load GSAP and ScrollTrigger."
      );
      return;
    }
    window.gsap.registerPlugin(window.ScrollTrigger);

    init();
    resync();

    // Webfonts change metrics after first layout, which moves every word.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(resync);
    }

    var timer;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(resync, 150);
    });
  }

  // Exposed for debugging, and so a page can register an effect or re-init
  // after injecting content, without editing this file.
  window.hlEffects = {
    init: init,
    resync: resync,
    effects: effects,
    splitWords: splitWords
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
