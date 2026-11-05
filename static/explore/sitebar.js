/* Site bar of the explore pages: the way back to the site (home, Research, the paper) from every
   page of every explorable.

   In each page: <script src="../sitebar.js"></script> in <head> (no defer, no async) and
   <lg-sitebar></lg-sitebar> as the first element of <body>. The element is a spacer in the flow and
   the bar inside it is fixed to the top of the viewport, so a page that scrolls needs nothing else.

   What a page may rely on:
   - --lg-sitebar-h on <html> holds the height (40px): whatever the page pins to the top (sticky or
     fixed headers, overlays, full-height stages) offsets itself with var(--lg-sitebar-h, 0px).
     Fragment jumps are covered: <html> gets scroll-padding-top of the same height.
   - Children of <lg-sitebar> (the page's own Map button, a deck label) are shown at the right end of
     the bar and stay in the page's DOM and CSS; they inherit the bar's text colour. With children the
     brand shortens to "LG" from 480px down, and it always keeps 40px (20px on phones) from the links,
     so a label that shrinks never pushes the links against it.
     A <noscript> child with a plain link back to the paper serves readers without JavaScript; the
     element is then undefined, so the page styles that state itself (lg-sitebar:not(:defined)).
   - --lg-sitebar-max and --lg-sitebar-pad, set on <lg-sitebar> or above it, are the width cap and the
     side padding of the bar's content (defaults: 1100px, like the site's own navbar, and
     clamp(1rem, 4vw, 2rem)); a page sets them to line the bar up with its own column.
   - The bar stays above and usable over a page's overlays: leave <lg-sitebar> out of anything made
     inert, and do not mark an overlay aria-modal while the bar is reachable. */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('lg-sitebar')) return;

  var H = 40;
  document.documentElement.style.setProperty('--lg-sitebar-h', H + 'px');
  var page = document.createElement('style');
  page.textContent = 'html{scroll-padding-top:var(--lg-sitebar-h)}';
  document.head.appendChild(page);

  var CSS =
    ':host{display:block;height:' + H + 'px}' +
    'nav{position:fixed;top:0;left:0;right:0;z-index:2147483000;height:' + H + 'px;box-sizing:border-box;' +
      'background:#FCFBF8;border-bottom:1px solid #D9D6CE;color:#1C1C1A;' +
      'font:500 12.5px/1 "Geist",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
      'letter-spacing:.11em;text-transform:uppercase}' +
    '.in{display:flex;align-items:center;justify-content:space-between;gap:2.5rem;height:100%;' +
      'max-width:var(--lg-sitebar-max,1100px);margin:0 auto;' +
      'padding:0 var(--lg-sitebar-pad,clamp(1rem,4vw,2rem));box-sizing:border-box}' +
    '.links{display:flex;align-items:center;gap:1.5rem;min-width:0}' +
    'a{color:#1C1C1A;text-decoration:none;white-space:nowrap;padding:.4rem 0;border-bottom:1.5px solid transparent}' +
    '.brand{flex:none;color:#003262;font-size:13px}' +
    '.brand .s{display:none}' +
    'a:hover,a:focus-visible{color:#003262;border-bottom-color:#FDB515}' +
    'a:focus-visible{outline:2px solid #003262;outline-offset:3px}' +
    '@media (max-width:480px){:host([data-tools]) .brand .l{display:none}:host([data-tools]) .brand .s{display:inline}}' +
    '@media (max-width:400px){nav{letter-spacing:.06em}.in{gap:1.25rem}.links{gap:1rem}}' +
    '@media (max-width:340px){nav{font-size:11.5px}.brand{font-size:12px}}' +
    '@media (prefers-color-scheme:dark){nav{background:#0B1A2E;border-bottom-color:#23395A;color:#E8EDF3}a{color:#E8EDF3}' +
      '.brand,a:hover,a:focus-visible{color:#8EC1E6}a:focus-visible{outline-color:#8EC1E6}}' +
    '@media print{:host{display:none}}';

  customElements.define('lg-sitebar', class extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      // explore/<slug>/page.html: the site root is two levels up, wherever the site is mounted.
      var slug = this.getAttribute('slug') || (location.pathname.match(/\/explore\/([^\/]+)\//) || [])[1] || '';
      var paper = slug ? '<a href="../../publication/' + encodeURIComponent(slug) + '/">This paper</a>' : '';
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' + CSS + '</style>' +
        '<nav aria-label="Luca Galati, site"><div class="in">' +
        '<a class="brand" href="../../" aria-label="Luca Galati, home"><span class="l">Luca Galati</span><span class="s">LG</span></a>' +
        '<span class="links"><a href="../../publication/">Research</a>' + paper + '<slot></slot></span>' +
        '</div></nav>';
      // The children arrive after this callback (the parser is still inside the element).
      var host = this, slot = root.querySelector('slot');
      slot.addEventListener('slotchange', function () {
        host.toggleAttribute('data-tools', slot.assignedElements().some(function (e) { return e.tagName !== 'NOSCRIPT'; }));
      });
    }
  });
})();
