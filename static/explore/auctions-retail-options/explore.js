/* Auctions for Retail-Sized Options — explorable explanation — navigation and shared helpers.
   Slides, dots, arrows, the map (m), per-deck progress, bets, and charts drawn at their real
   pixel width. Load it before a page's own script. No dependencies, no external requests. */
(function () {
  'use strict';
  var SLUG = 'auctions-retail-options';
  var PAPER = '../../publication/' + SLUG + '/';
  var NS = 'http://www.w3.org/2000/svg';

  /* The tree. Slide labels are the slide headings. doors lists, per slide (0-based), the doors inside
     that slide that lead off the main path, as [deck, slide] pairs; the map draws them as branches. */
  var TREE = [
    { file: 'index.html', title: 'The order nobody bought',
      slides: ['Auctions for Retail-Sized Options', 'What an auction does to a price', 'Many trades, little money', 'Auction trades are not book trades'],
      doors: { 1: [[3, 4]], 2: [[3, 4]] } },
    { file: '02-match.html', title: 'Like with like',
      slides: ['Twins, two weeks apart', 'Same order, two mechanisms', 'The auction, or the week?', 'Do complex orders gain more?'],
      doors: { 1: [[2, 0]], 3: [[2, 0], [3, 0]] } },
    { file: '03-who-pays.html', title: 'Who pays',
      slides: ['A liquidity provider’s ledger', 'The provider pays for the improvement'],
      doors: { 1: [[1, 2], [1, 3]] } },
    { file: '04-spy.html', title: 'With and without a buyer',
      slides: ['Two auctions on one index', 'Which auction is cheaper?', 'More hands in the fill', 'Exercise style and tick size', 'What the tick does', 'An auction without a buyer'],
      doors: { 4: [[0, 1]], 5: [[0, 1], [2, 1]] } }
  ];

  /* ---- storage: every access guarded, the page works without it ---- */
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: progress lasts this visit */ } }
  function K(s) { return 'explore:' + SLUG + ':' + s; }
  function progOf(f) {
    var p = load(K(f)) || {};
    if (!Array.isArray(p.seen)) { p.seen = []; for (var j = 0; j <= (typeof p.max === 'number' ? p.max : -1); j++) p.seen.push(j); }
    return p;
  }
  var memo = {};
  function ui(id, v) { if (arguments.length > 1) { memo[id] = v; save(K('ui:' + id), v); return v; } return id in memo ? memo[id] : load(K('ui:' + id)); }

  var file = location.pathname.split('/').pop();
  if (!file || file.indexOf('.html') < 0) file = 'index.html';
  var di = 0;
  for (var k = 0; k < TREE.length; k++) if (TREE[k].file === file) di = k;
  var deck = TREE[di];
  var slides = Array.prototype.slice.call(document.querySelectorAll('main > section.slide'));
  var n = slides.length;
  var prog = progOf(file);
  var current = -1;

  /* ---- chrome: the deck label and the Map button sit in the page's <lg-sitebar>; the slide bar is built here ---- */
  var mapBtn = document.querySelector('.map-btn');
  var bottom = document.createElement('nav');
  bottom.className = 'bar bottom';
  bottom.setAttribute('aria-label', 'Slides');
  bottom.innerHTML = '<button type="button" class="arrow prev" aria-label="Previous slide">←</button><ol class="dots"></ol><button type="button" class="arrow next" aria-label="Next slide">→<span class="lbl" hidden></span></button>';
  document.body.appendChild(bottom);
  var dots = bottom.querySelector('.dots');
  var dotBtns = slides.map(function (s, i) {
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Slide ' + (i + 1) + ': ' + (deck.slides[i] || ''));
    b.title = deck.slides[i] || ('Slide ' + (i + 1));
    b.addEventListener('click', function () { go(i); });
    li.appendChild(b); dots.appendChild(li);
    return b;
  });
  var prevBtn = bottom.querySelector('.prev'), nextBtn = bottom.querySelector('.next'), nextLbl = nextBtn.querySelector('.lbl');
  prevBtn.addEventListener('click', function () {
    if (current > 0) go(current - 1);
    else if (di > 0) location.href = TREE[di - 1].file + '#s' + TREE[di - 1].slides.length;
  });
  nextBtn.addEventListener('click', function () {
    if (current < n - 1) go(current + 1);
    else if (TREE[di + 1]) location.href = TREE[di + 1].file;
    else openMap();
  });

  function fromHash() { var m = /^#s(\d+)$/.exec(location.hash); return m ? Math.min(n - 1, Math.max(0, +m[1] - 1)) : -1; }

  function go(i, quiet) {
    if (i < 0 || i >= n || i === current) return;
    slides.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
    current = i;
    prog.at = i;
    if (prog.seen.indexOf(i) < 0) prog.seen.push(i);
    prog.max = Math.max(prog.max || 0, i);
    if (i === n - 1) prog.done = true;
    save(K(file), prog);
    dotBtns.forEach(function (b, j) {
      b.setAttribute('aria-current', j === i ? 'step' : 'false');
      b.classList.toggle('seen', prog.seen.indexOf(j) >= 0 && j !== i);
    });
    prevBtn.disabled = i === 0 && di === 0;
    var prevTitle = i === 0 && di > 0 ? 'Previous deck: ' + TREE[di - 1].title : 'Previous slide';
    prevBtn.setAttribute('aria-label', prevTitle); prevBtn.title = prevTitle;
    var last = i === n - 1;
    var nextTitle = last ? (TREE[di + 1] ? 'Next deck: ' + TREE[di + 1].title : 'Open the map') : 'Next slide';
    nextBtn.setAttribute('aria-label', nextTitle); nextBtn.title = nextTitle;
    nextLbl.hidden = !last;
    nextLbl.textContent = last ? (TREE[di + 1] ? 'next deck' : 'map') : '';
    if (location.hash !== '#s' + (i + 1)) history.replaceState(null, '', '#s' + (i + 1));
    window.scrollTo(0, 0);
    fillUnseen(slides[i]);
    runFits();
    if (!quiet) {
      var h = slides[i].querySelector('h1, h2');
      if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
    }
    document.dispatchEvent(new CustomEvent('explore:slide', { detail: { index: i } }));
  }

  /* A slide may hold <p class="doors" data-unseen hidden>: it lists, deck by deck, the first slide
     the reader has not seen yet, so a fork never strands anyone past a result. */
  function fillUnseen(slide) {
    var box = slide.querySelector('[data-unseen]');
    if (!box) return;
    var have = {};
    slide.querySelectorAll('a[href]').forEach(function (a) { if (!box.contains(a)) have[a.getAttribute('href')] = 1; });
    var out = [];
    TREE.forEach(function (d, kk) {
      var p = kk === di ? prog : progOf(d.file);
      for (var j = 0; j < d.slides.length; j++) {
        if (p.seen.indexOf(j) >= 0) continue;
        var href = d.file + '#s' + (j + 1);
        if (!have[href] && !(j === 0 && have[d.file])) out.push('<a class="door small" href="' + href + '">' + (j === 0 ? d.title : d.slides[j]) + '</a>');
        break;
      }
    });
    box.innerHTML = out.length ? '<span class="lead">Not yet seen:</span>' + out.join('') : '';
    box.hidden = !out.length;
  }

  /* ---- map ---- */
  var map = document.createElement('div');
  map.className = 'map';
  map.hidden = true;
  map.setAttribute('role', 'dialog');
  // not aria-modal: the site bar above the map stays reachable while it is open (../sitebar.js)
  map.setAttribute('aria-label', 'Map of the explorable');
  document.body.appendChild(map);
  mapBtn.addEventListener('click', toggleMap);
  map.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('.close')) { closeMap(); return; }
    var a = t.closest('a');
    if (!a) return;
    var m = /^([^#?]+)(?:\?[^#]*)?#s(\d+)$/.exec(a.getAttribute('href') || '');
    if (m && m[1] === file) { e.preventDefault(); closeMap(); go(+m[2] - 1); }
  });

  function renderMap() {
    var h = '<div class="inner"><div class="map-head"><p class="eyebrow">Map</p><h2>Auctions for Retail-Sized Options</h2>' +
      '<p class="sans muted">Four short decks. Gold is where you are, blue is what you have seen. The branches under a slide are the doors inside it that lead to another deck. Pick anything; press <span class="kbd">m</span> or Esc to close.</p></div><div class="decks">';
    TREE.forEach(function (d, kk) {
      var p = kk === di ? prog : progOf(d.file);
      h += '<section class="deck' + (kk === di ? ' current' : '') + '"><p class="eyebrow">Deck ' + (kk + 1) + (p.done ? ' · finished' : '') + '</p>' +
        '<h3><a href="' + d.file + '#s1">' + d.title + '</a></h3><ol>';
      d.slides.forEach(function (t, j) {
        var here = kk === di && j === current;
        var cls = here ? 'here' : (p.seen.indexOf(j) >= 0 ? 'seen' : '');
        h += '<li><a class="' + cls + '" href="' + d.file + '#s' + (j + 1) + '"' + (here ? ' aria-current="page"' : '') + '><i></i><span>' + t + '</span></a>';
        var ds = d.doors && d.doors[j];
        if (ds) {
          h += '<ul class="branches">';
          ds.forEach(function (td) {
            var tk = TREE[td[0]], tp = td[0] === di ? prog : progOf(tk.file);
            h += '<li><a class="branch' + (tp.seen.indexOf(td[1]) >= 0 ? ' seen' : '') + '" href="' + tk.file + '#s' + (td[1] + 1) + '"><span class="to">Deck ' + (td[0] + 1) + '</span>' + tk.slides[td[1]] + '</a></li>';
          });
          h += '</ul>';
        }
        h += '</li>';
      });
      h += '</ol></section>';
    });
    h += '</div><p class="map-foot"><a href="' + PAPER + '">← Back to the paper</a></p></div><button type="button" class="close" aria-label="Close map">Close</button>';
    map.innerHTML = h;
  }
  var behind = [document.querySelector('main'), bottom];
  function openMap() {
    renderMap();
    map.hidden = false;
    mapBtn.setAttribute('aria-expanded', 'true');
    behind.forEach(function (el) { if (el) el.inert = true; });
    document.body.style.overflow = 'hidden';
    var c = map.querySelector('.close'); if (c) c.focus();
  }
  function closeMap() {
    map.hidden = true;
    mapBtn.setAttribute('aria-expanded', 'false');
    behind.forEach(function (el) { if (el) el.inert = false; });
    document.body.style.overflow = '';
    mapBtn.focus();
  }
  function toggleMap() { if (map.hidden) openMap(); else closeMap(); }

  /* ---- keys ---- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    var typing = (tag === 'INPUT' && !/^(range|checkbox|radio|button|submit)$/.test(t.type)) || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
    if (typing) return;
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMap(); return; }
    if (e.key === 'Escape') { if (!map.hidden) { e.preventDefault(); closeMap(); } return; }
    if (!map.hidden || (tag === 'INPUT' && t.type === 'range')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextBtn.click(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (!prevBtn.disabled) prevBtn.click(); }
  });
  window.addEventListener('hashchange', function () { var h = fromHash(); if (h >= 0) go(h); });

  /* ---- bets: a prediction before the reveal; the choice is remembered ---- */
  var bets = {};
  document.querySelectorAll('.bet[data-bet]').forEach(function (bet) {
    var id = bet.getAttribute('data-bet'), key = K('bet:' + id);
    var buttons = bet.querySelectorAll('.choices button');
    function reveal(choice, fresh) {
      bets[id] = choice;
      bet.classList.add('revealed');
      buttons.forEach(function (b) { var c = b.getAttribute('data-choice') === choice; b.classList.toggle('chosen', c); b.setAttribute('aria-pressed', c ? 'true' : 'false'); b.disabled = true; });
      var shown = null;
      bet.querySelectorAll('[data-verdict]').forEach(function (v) { var on = v.getAttribute('data-verdict') === choice; v.classList.toggle('show', on); if (on) shown = v; });
      if (fresh && shown) {
        shown.setAttribute('tabindex', '-1');
        var a = bet.querySelector('.answer');
        if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
        try { shown.focus({ preventScroll: true }); } catch (e) { shown.focus(); }
      }
      document.dispatchEvent(new CustomEvent('explore:bet', { detail: { id: id, choice: choice } }));
    }
    var saved = load(key);
    if (saved) reveal(saved, false);
    buttons.forEach(function (b) { b.addEventListener('click', function () { var c = b.getAttribute('data-choice'); save(key, c); reveal(c, true); }); });
  });
  function betOf(id) { return bets[id] || load(K('bet:' + id)); }

  /* ---- charts and reserved boxes, laid out at their real width ----
     fit(el, fn) calls fn(width) whenever el is on screen with a new width: on load, when its slide
     opens, on resize and once the fonts arrive. Charts draw with 1 SVG unit = 1 CSS pixel. */
  var fits = [];
  function runFit(f) {
    var w = Math.round(f.el.getBoundingClientRect().width);
    if (w && w !== f.w) { f.w = w; f.fn(w); }
  }
  function runFits() { fits.forEach(runFit); }
  function fit(el, fn) { var f = { el: el, fn: fn, w: 0 }; fits.push(f); runFit(f); return function () { f.w = 0; runFit(f); }; }
  var raf = 0;
  window.addEventListener('resize', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(runFits); });
  function refit() { fits.forEach(function (f) { f.w = 0; }); runFits(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refit);

  /* reserve(el, messages): keep a text box as tall as its longest possible message, so the stage
     around it never changes size. */
  function reserve(el, msgs) {
    return fit(el, function (w) {
      var probe = el.cloneNode(false);
      probe.removeAttribute('id'); probe.removeAttribute('aria-live'); probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;min-height:0;width:' + w + 'px';
      el.parentNode.appendChild(probe);
      var max = 0;
      (typeof msgs === 'function' ? msgs() : msgs).forEach(function (m) { probe.textContent = m; max = Math.max(max, probe.getBoundingClientRect().height); });
      el.parentNode.removeChild(probe);
      el.style.minHeight = Math.ceil(max) + 'px';
    });
  }

  function svg(parent, tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var a in attrs) if (attrs[a] != null) e.setAttribute(a, attrs[a]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function view(el, w, h) { el.setAttribute('viewBox', '0 0 ' + w + ' ' + Math.ceil(h)); }
  /* centre a label of about `half` px half-width on x, kept inside [lo, hi] */
  function clamp(x, half, lo, hi) { return Math.max(lo + half, Math.min(hi - half, x)); }
  function minus(v, d) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d); }
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* older browsers */ }

  /* ---- start: a finished deck reopens on its last slide ---- */
  var start = fromHash();
  if (start < 0) start = prog.done ? n - 1 : Math.min(n - 1, prog.at || 0);
  go(start, true);

  window.EXPLORE = {
    go: go, openMap: openMap, tree: TREE, deck: di, current: function () { return current; },
    bet: betOf, ui: ui, fit: fit, reserve: reserve, svg: svg, clear: clear, view: view, clamp: clamp, minus: minus, reduced: reduced
  };
})();
