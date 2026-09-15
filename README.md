# hl-effects

Small, no-build scroll and text effects. One CSS file, one JS file, driven by a
`data-effect` attribute on the element.

```
effects.css   styles + initial hidden state. Load in <head>.
effects.js    splitter, effect registry, wiring. Load deferred.
test/         local harnesses.
```

## Requirements

`window.gsap` and `window.ScrollTrigger`, provided by the host page.

Don't load GSAP more than once. A second copy overwrites the first, and you end
up running whichever version happens to load last rather than the one you think
you chose.

If GSAP is missing, `effects.js` logs a warning and does nothing. Headings then
render as ordinary visible text — degraded, never broken.

## Install

```html
<!-- in <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rjohnson-hl/hl-website@v1.0.1/effects.css">

<!-- before </body> -->
<script defer src="https://cdn.jsdelivr.net/gh/rjohnson-hl/hl-website@v1.0.1/effects.js"></script>
```

The CSS belongs in `<head>`. It carries the initial hidden state, so if it
arrives after first paint you get a flash of the full text before the script
hides it.

Both URLs are **pinned to a tag**. jsDelivr caches a tagged path immutably, so
nothing changes downstream until the version is bumped deliberately — which also
makes rollback a one-string edit.

## Usage

```html
<h2 data-effect="scrub-words">Some heading text…</h2>
```

`data-effect` is space-separated, so an element can take more than one.

## Effects

### `scrub-words`

Reveals a heading word by word as it scrolls into view. Unrevealed words are
**completely invisible**, not dimmed. Revealed words carry a gradient that runs
continuously across the whole heading rather than restarting on each word.

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-stagger` | `0.15` | Seconds between words |
| `data-start` | `top 90%` | ScrollTrigger `start` |
| `data-end` | `top center` | ScrollTrigger `end` |

Override the gradient per section:

```css
.some-section { --hl-word-gradient: linear-gradient(90deg, #fff, #888); }
```

**Tuning note.** The default `end: "top center"` completes the reveal when the
heading's *top* reaches the viewport middle. Fine for a 3–4 line heading. A
heading tall enough to run to 6+ lines will finish revealing below the fold, so
you scroll down to text that has already completed. Set
`data-end="bottom center"` on those.

## Adding an effect

Add a key to the `effects` object in `effects.js`. It receives the element and
may return a resync function, which runs on resize and after webfonts load.

```js
var effects = {
  "my-effect": function (el) {
    // set up
    return function () { /* recalculate on resize / font load */ };
  }
};
```

A page can also register one without editing this file:

```js
hlEffects.effects["page-only-thing"] = function (el) { /* … */ };
hlEffects.init();
```

`hlEffects.init()` is idempotent; `hlEffects.resync()` is safe to call any time.

## Design notes

Worth reading before "simplifying" any of this. Two of these look like
redundancy and are not.

**The gradient lives on each word, never on the container.**
`background-clip: text` on a parent paints its gradient through *every*
descendant glyph. Put the gradient on the `<h2>` and every word shows it
immediately, including the ones meant to be hidden.

**A child's `opacity` cannot suppress a parent's clipped gradient.** The clip
region is geometric, computed from text layout, and a child's alpha has no say
in it. Verified in-browser: a word at `opacity: 0` under a parent-level gradient
is still fully visible. Only `visibility: hidden` removes a word from the clip,
and that's discrete, so it pops instead of fading. Hence: gradient per word.

**Matching the background colour is not the same as invisible.** Painting a
hidden word in the background colour *nearly* works, and is tempting because it
needs no per-word gradient sync. It leaves a faint outline — the glyph interior
matches the background, but anti-aliased edge pixels blend toward the bright
gradient still painted underneath. Fine for a dim ghost, not for "gone."

**`syncWordGradient` is load-bearing.** Because each word owns its background
box, the gradient would otherwise restart on every word. The sync maps each
word's background onto the container's box, and must re-run on anything that
reflows it — resize and webfont swap are both handled. Delete it and the
gradient fragments per word.

**The CSS never hides the container, only `.word`.** `.word` doesn't exist until
the script runs, so a blocked or broken `effects.js` leaves ordinary visible
text. Don't add `opacity: 0` to the container to avoid a flash — that turns a
degraded state into an invisible one.

**The splitter refuses inline markup.** `splitWords` reads `textContent`, so a
`<br>`, `<em>` or link inside a heading would be silently destroyed. It checks
for element children first and warns instead. Loud in staging beats invisible in
production. If a heading genuinely needs inline markup, teach the splitter to
walk child nodes — don't remove the guard.

## Failure modes

| Symptom | Cause |
| --- | --- |
| Text fully visible, no animation | GSAP missing, or `data-effect` not set. Check the console. |
| Text visible before scrolling | `effects.css` not loading, or loading after first paint. |
| Gradient restarts on every word | `syncWordGradient` never ran, or ran at zero width. |
| Gradient banded or offset after load | Sync ran before webfonts settled; `document.fonts.ready` should cover it. |
| A heading is skipped entirely | It contains inline markup. See the console warning. |

## Local development

Serve the repo and open `test/`. `index.html` runs the local files; `cdn.html`
runs the published build and is the pre-release smoke test.
