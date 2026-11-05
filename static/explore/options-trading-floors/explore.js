/* Explorable deck engine for lucagalati.com — plain JS, no dependencies, no network.
   A deck page has <section class="slide" data-id="..."> elements inside <main class="stage">.
   Explore.deck(id) wires: hash routing, dots-as-buttons, arrow keys, map overlay (m),
   localStorage resume per deck (try/catch), and per-slide "seen" marks for the map.
   Explore.fit(svg, draw) redraws a chart at its rendered width, so one SVG unit is one CSS pixel. */
(function () {
  'use strict';

  var TREE = {
    key: 'otf2',
    paper: '../../publication/options-trading-floors/',
    title: 'Not Dead Yet: Options Trading Floors',
    decks: [
      { id: 'floor', file: '01-floor.html', n: 1, title: 'The floor that would not die',
        slides: [
          { id: 'hook', title: 'Who still shouts?' },
          { id: 'package', title: 'One order, one price' },
          { id: 'big', title: 'Where the big packages go' },
          { id: 'experiment', title: 'A clean switch' },
          { id: 'bet', title: 'Place your bet' }
        ] },
      { id: 'price', file: '02-price.html', n: 2, title: 'The price of a handshake',
        slides: [
          { id: 'match', title: 'Who gets a twin' },
          { id: 'dial', title: 'The size dial' },
          { id: 'build', title: 'What 1,950 contracts cost on screens' },
          { id: 'fake', title: 'A counterfeit twin' }
        ] },
      { id: 'crowd', file: '03-crowd.html', n: 3, title: 'Inside the crowd',
        slides: [
          { id: 'three', title: 'Three differences' },
          { id: 'commit', title: 'Pre-commitment' },
          { id: 'flex', title: 'Flexibility' },
          { id: 'screen', title: 'Screening' },
          { id: 'notdead', title: 'Not dead yet' },
          { id: 'route', title: 'Route the orders' }
        ] }
    ]
  };

  var store = {
    get: function (k, fb) {
      try { var v = localStorage.getItem(TREE.key + ':' + k); return v == null ? fb : JSON.parse(v); }
      catch (e) { return fb; }
    },
    set: function (k, v) {
      try { localStorage.setItem(TREE.key + ':' + k, JSON.stringify(v)); } catch (e) { /* private mode etc. */ }
    }
  };

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function deckById(id) { for (var i = 0; i < TREE.decks.length; i++) if (TREE.decks[i].id === id) return TREE.decks[i]; return null; }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children) children.forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  /* ---------- charts drawn at their rendered width ---------- */
  var fits = [];
  function refit(f) {
    var w = Math.round(f.svg.parentNode.getBoundingClientRect().width);
    if (!w) return;                       // on a hidden slide: drawn when shown
    w = Math.max(280, Math.min(w, f.max));
    if (w === f.w) return;
    f.w = w; f.draw(w);
  }
  function refitAll() { fits.forEach(refit); }
  function fit(svg, draw, max) {
    var f = { svg: svg, draw: draw, max: max || 760, w: 0 };
    fits.push(f); refit(f);
    return { redraw: function () { f.w = 0; refit(f); }, width: function () { return f.w; } };
  }
  var rzT = null;
  window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(refitAll, 120); });

  /* ---------- map overlay (used by decks and the hub) ---------- */
  function buildMap(current) {
    var seen = store.get('seen', {});
    var box = el('div', { 'class': 'map', hidden: '', role: 'dialog', 'aria-label': 'Map of this explorable' });
    var inner = el('div', { 'class': 'inner' });
    var head = el('header', null, [
      el('div', null, [
        el('span', { 'class': 'kicker', text: 'Map' }),
        el('h2', { text: TREE.title })
      ]),
      el('button', { 'class': 'close', type: 'button', text: 'Close  esc' })
    ]);
    inner.appendChild(head);
    var decks = el('div', { 'class': 'decks' });
    TREE.decks.forEach(function (d) {
      var isHere = current && current.deck === d.id;
      var card = el('div', { 'class': 'deck' + (isHere ? ' here' : '') });
      card.appendChild(el('span', { 'class': 'kicker', text: 'Path ' + d.n + ' · ' + d.slides.length + ' slides' }));
      card.appendChild(el('h3', { text: d.title }));
      var ol = el('ol');
      d.slides.forEach(function (s, i) {
        var sid = d.id + '/' + s.id;
        var here = isHere && current.index === i;
        var cls = (seen[sid] ? 'seen ' : '') + (here ? 'here' : '');
        var a = el('a', { href: d.file + '#' + (i + 1), 'class': cls.trim() }, [
          el('i', { 'class': 'd' }), el('span', { text: (i + 1) + '. ' + s.title })
        ]);
        if (here) a.setAttribute('aria-current', 'page');
        if (isHere) a.addEventListener('click', function (ev) { ev.preventDefault(); closeMap(); if (current.go) current.go(i, false, true); });
        ol.appendChild(el('li', null, [a]));
      });
      card.appendChild(ol);
      decks.appendChild(card);
    });
    inner.appendChild(decks);
    inner.appendChild(el('div', { 'class': 'legend' }, [
      el('span', null, [el('i', { 'class': 'here' }), el('span', { text: 'you are here' })]),
      el('span', null, [el('i', { 'class': 'seen' }), el('span', { text: 'seen' })]),
      el('span', null, [el('i'), el('span', { text: 'not yet' })]),
      el('span', { text: 'Press m anywhere to open this map.' })
    ]));
    var hubLink = el('p', { 'class': 'sans small', style: 'margin-top:22px' });
    hubLink.appendChild(el('a', { href: 'index.html', text: 'Overview' }));
    hubLink.appendChild(document.createTextNode('  ·  '));
    hubLink.appendChild(el('a', { href: TREE.paper, text: '← Back to the paper' }));
    inner.appendChild(hubLink);
    box.appendChild(inner);
    head.querySelector('.close').addEventListener('click', closeMap);
    return box;
  }

  var mapEl = null, mapOpener = null;
  function setInert(on) {
    document.querySelectorAll('.stage, .bar, .hub').forEach(function (e) {
      if (on) e.setAttribute('inert', ''); else e.removeAttribute('inert');
    });
    // the Map button sits in the site bar, above the overlay, so it stays live and closes the map
    document.querySelectorAll('.mapbtn').forEach(function (e) {
      e.setAttribute('aria-expanded', on ? 'true' : 'false');
      e.setAttribute('aria-label', on ? 'Close the map' : 'Open the map');
    });
  }
  function openMap(current) {
    if (mapEl) mapEl.remove();
    mapOpener = document.activeElement;
    mapEl = buildMap(current);
    document.body.appendChild(mapEl);
    mapEl.hidden = false;
    setInert(true);
    var here = mapEl.querySelector('a.here') || mapEl.querySelector('.close');
    if (here) here.focus();
  }
  function closeMap() {
    if (!mapEl || mapEl.hidden) return;
    mapEl.hidden = true;
    setInert(false);
    if (mapOpener && mapOpener.focus && document.contains(mapOpener)) mapOpener.focus();
  }
  function toggleMap(current) { if (mapEl && !mapEl.hidden) closeMap(); else openMap(current); }

  /* ---------- deck ---------- */
  function deck(id, opts) {
    opts = opts || {};
    var d = deckById(id);
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var n = slides.length;
    var saved = store.get('deck:' + id, { at: 0, max: 0, state: {} });
    var state = saved.state || {};
    var at = 0, max = Math.min(saved.max || 0, n - 1);
    var hooks = {}, nudged = {};

    var dots = document.querySelector('.dots');
    var prevBtn = document.querySelector('.navbtn.prev');
    var nextBtn = document.querySelector('.navbtn.next');
    var where = document.querySelector('.where');
    var dotBtns = [];
    if (dots) {
      slides.forEach(function (s, i) {
        var b = el('button', { type: 'button', 'aria-label': 'Slide ' + (i + 1) + ': ' + d.slides[i].title });
        b.addEventListener('click', function () { if (!b.disabled) go(i); });
        dots.appendChild(b); dotBtns.push(b);
      });
    }

    function sid(i) { return d.id + '/' + d.slides[i].id; }
    function seenMap() { return store.get('seen', {}); }
    function markSeen(i) { var s = seenMap(); s[sid(i)] = true; store.set('seen', s); }
    function allSeen() { var s = seenMap(); return d.slides.every(function (x, i) { return !!s[sid(i)]; }); }
    function persist() { store.set('deck:' + id, { at: at, max: max, done: allSeen(), state: state }); }
    function gate() { return slides[at].querySelector('.bet[data-gate]:not([data-done="1"])'); }
    function updateNav() {
      var last = at === n - 1;
      if (prevBtn) prevBtn.disabled = at === 0;
      if (nextBtn) {
        nextBtn.disabled = last && !opts.next;
        nextBtn.textContent = gate() ? 'Skip the bet →' : (last && opts.next ? (opts.nextLabel || 'Next path →') : 'Next →');
      }
    }
    function render() {
      var seen = seenMap();
      slides.forEach(function (s, i) { s.classList.toggle('on', i === at); });
      dotBtns.forEach(function (b, i) {
        b.setAttribute('aria-current', i === at ? 'true' : 'false');
        b.classList.toggle('seen', !!seen[sid(i)] && i !== at);
        b.disabled = i > max;
      });
      updateNav();
      if (where) where.textContent = 'Path ' + d.n + ' · ' + d.title + ' · ' + (at + 1) + '/' + n;
      window.scrollTo(0, 0);
      refitAll();
      (hooks[slides[at].getAttribute('data-id')] || []).forEach(function (h) { h(); });
      if (opts.onShow) opts.onShow(at, slides[at]);
    }
    function focusHead() {
      var h = slides[at].querySelector('h1:not(.off), h2:not(.off)');
      if (!h) return;
      h.setAttribute('tabindex', '-1');
      try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    }
    function go(i, fromHash, focus) {
      if (i < 0 || i >= n) return;
      var hadFocus = i !== at && slides[at].contains(document.activeElement);
      at = i; if (at > max) max = at;
      markSeen(at); persist();
      if (!fromHash) { try { history.replaceState(null, '', '#' + (at + 1)); } catch (e) {} }
      render();
      if (hadFocus || focus) focusHead();
    }
    function fromHash() {
      var m = /^#(\d+)$/.exec(location.hash);
      if (m) { var i = parseInt(m[1], 10) - 1; if (i >= 0 && i < n) { go(i, true); return true; } }
      return false;
    }

    // A slide with an open bet asks once before letting the keyboard skip it.
    function forward(fromKey) {
      var g = gate();
      if (g && fromKey && !nudged[at]) {
        nudged[at] = true;
        var b = g.querySelector('button'); if (b) b.focus();
        g.classList.add('nudge'); setTimeout(function () { g.classList.remove('nudge'); }, 1400);
        var hint = slides[at].querySelector('[data-hint]');
        if (hint && !hint.textContent) hint.textContent = 'Place your bet first, or press → again to skip it.';
        return;
      }
      if (at === n - 1) { if (opts.next) location.href = opts.next; return; }
      go(at + 1);
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { go(at - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { forward(false); });
    document.addEventListener('keydown', function (ev) {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target, tag = t && t.tagName;
      var typing = (tag === 'INPUT' && t.type !== 'range') || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
      if (typing) return;
      if (ev.key === 'm' || ev.key === 'M') { ev.preventDefault(); toggleMap(current()); return; }
      if (ev.key === 'Escape') { closeMap(); return; }
      if (mapEl && !mapEl.hidden) return;
      if (tag === 'INPUT' && t.type === 'range' && /^(Arrow|Page|Home|End)/.test(ev.key)) return;
      // Space activates the focused control; it only turns the page when nothing interactive has focus.
      if (ev.key === ' ' && t && t.closest && t.closest('button, a, input, select, textarea, summary, [role="button"]')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') { ev.preventDefault(); forward(true); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); go(at - 1); }
    });
    window.addEventListener('hashchange', fromHash);
    var mapBtn = document.querySelector('.mapbtn');
    if (mapBtn) mapBtn.addEventListener('click', function () { toggleMap(current()); });
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('[data-go]');
      if (!a) return;
      var v = a.getAttribute('data-go');
      if (/^\d+$/.test(v)) { ev.preventDefault(); go(parseInt(v, 10) - 1); }
    });

    function current() { return { deck: id, index: at, go: go }; }

    // Start: an explicit hash wins; otherwise resume (a finished deck opens at its last slide).
    if (!fromHash()) {
      var start = saved.done ? n - 1 : Math.min(saved.at || 0, n - 1);
      go(start);
    }

    return {
      go: go, at: function () { return at; },
      state: state, reduced: reduced,
      save: function () { persist(); updateNav(); },
      onShow: function (slideId, fn) { (hooks[slideId] = hooks[slideId] || []).push(fn); if (slides[at] && slides[at].getAttribute('data-id') === slideId) fn(); },
      done: function (deckId) { var s = store.get('deck:' + deckId, null); return !!(s && s.done); },
      seenSlide: function (key) { return !!seenMap()[key]; },
      openMap: function () { openMap(current()); }
    };
  }

  /* A prediction: buttons inside .bet; the choice persists in D.state[id]. */
  function bet(D, id, onChoose) {
    var box = document.getElementById(id);
    var btns = Array.prototype.slice.call(box.querySelectorAll('button'));
    function show(v, instant) {
      box.setAttribute('data-done', '1');
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === v ? 'true' : 'false'); });
      onChoose(v, instant);
    }
    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { var v = b.getAttribute('data-v'); show(v, false); D.state[id] = v; D.save(); });
    });
    if (D.state[id]) { show(D.state[id], true); D.save(); }   // restored bet: refresh the footer label
  }

  /* ---------- hub ---------- */
  function hub() {
    var mount = document.querySelector('[data-hub-decks]');
    var seen = store.get('seen', {});
    if (mount) {
      TREE.decks.forEach(function (d) {
        var prog = store.get('deck:' + d.id, null);
        var cnt = 0; d.slides.forEach(function (s) { if (seen[d.id + '/' + s.id]) cnt++; });
        var card = el('div', { 'class': 'deck' });
        card.appendChild(el('span', { 'class': 'kicker', text: 'Path ' + d.n + ' · ' + (cnt ? cnt + ' of ' : '') + d.slides.length + ' slides' + (cnt ? ' seen' : '') }));
        card.appendChild(el('h3', { text: d.title }));
        var ol = el('ol');
        d.slides.forEach(function (s, i) {
          var sid = d.id + '/' + s.id;
          ol.appendChild(el('li', null, [el('a', { href: d.file + '#' + (i + 1), 'class': seen[sid] ? 'seen' : '' }, [
            el('i', { 'class': 'd' }), el('span', { text: (i + 1) + '. ' + s.title })
          ])]));
        });
        card.appendChild(ol);
        var started = prog && cnt > 0;
        var resume = started && !prog.done ? d.file + '#' + ((prog.at || 0) + 1) : d.file + '#1';
        var label = prog && prog.done ? 'Revisit' : (started ? 'Resume' : (d.n === 1 ? 'Begin here' : 'Open'));
        card.appendChild(el('a', { 'class': 'cta' + (d.n === 1 && !started ? '' : ' quiet'), href: resume, text: label + ' →', style: 'margin-top:14px' }));
        mount.appendChild(card);
      });
    }
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === 'm' || ev.key === 'M') { ev.preventDefault(); toggleMap(null); }
      if (ev.key === 'Escape') closeMap();
    });
    var mapBtn = document.querySelector('.mapbtn');
    if (mapBtn) mapBtn.addEventListener('click', function () { toggleMap(null); });
  }

  /* ---------- small helpers for playables ---------- */
  var SVG = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent) {
    var e = document.createElementNS(SVG, tag);
    if (attrs) for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function fmt(x, d) { return Number(x).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function money(x) { return '$' + fmt(Math.round(x)); }
  function textW(str, size) { return String(str).length * (size || 11) * 0.56; }   // rough width of Geist text
  /* Keep a range input's thumb centre over the plot area of a chart drawn by fit(). */
  function alignRange(rng, svg, W, L, plotW, note) {
    var k = svg.getBoundingClientRect().width / W;
    if (!k) return;
    rng.style.marginLeft = Math.round(L * k - 10) + 'px';
    rng.style.width = Math.round(plotW * k + 20) + 'px';
    if (note) { note.style.marginLeft = Math.round(L * k) + 'px'; note.style.width = Math.round(plotW * k) + 'px'; }
  }

  /* Fine-grained ranges (step 0.1, so that exact sizes such as 342 contracts are reachable) still move
     in useful steps from the keyboard: arrows 1% of the range, Page keys 10%, Home and End to the ends. */
  function rangeKeys(rng) {
    rng.addEventListener('keydown', function (ev) {
      var lo = +rng.min, hi = +rng.max, span = hi - lo, v = +rng.value, d = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') d = v + span / 100;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') d = v - span / 100;
      else if (ev.key === 'PageUp') d = v + span / 10;
      else if (ev.key === 'PageDown') d = v - span / 10;
      else if (ev.key === 'Home') d = lo;
      else if (ev.key === 'End') d = hi;
      if (d == null) return;
      ev.preventDefault();
      rng.value = Math.max(lo, Math.min(hi, d)).toFixed(1);
      rng.dispatchEvent(new Event('input')); rng.dispatchEvent(new Event('change'));
    });
  }

  /* The 2020 timeline (slides 1.4 and 3.5). Days are day-of-year in 2020 (leap year):
     Jan 2 = 2 (sample start), Mar 16 = 76 (closure), May 26 = 147 (reopening announced),
     Jun 3 = 155 (postponed), Jun 8 = 160 (planned date), Jun 15 = 167 (reopening), Oct 21 = 295 (sample end). */
  var EVENTS = [
    { id: 'close', d: 76, date: 'Mar 16', what: 'floor closes' },
    { id: 'ann', d: 147, date: 'May 26', what: 'reopening announced for June 8' },
    { id: 'delay', d: 155, date: 'Jun 3', what: 'postponed to June 15' },
    { id: 'planned', d: 160, date: 'Jun 8', what: 'planned date passes' },
    { id: 'open', d: 167, date: 'Jun 15', what: 'floor reopens' }
  ];
  var MONTHS = [[2, 'Jan'], [32, 'Feb'], [61, 'Mar'], [92, 'Apr'], [122, 'May'], [153, 'Jun'], [183, 'Jul'], [214, 'Aug'], [245, 'Sep'], [275, 'Oct']];
  function timeline(svg, o) {
    var W = o.W, H = o.H, L = o.L == null ? 24 : o.L, R = o.R == null ? 24 : o.R, d0 = 2, d1 = 295;
    var compact = W < 560;
    function x(dd) { return L + (dd - d0) / (d1 - d0) * (W - L - R); }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    clear(svg);
    var hBar = 16, yBar = o.yBar;
    s('rect', { x: x(2), y: yBar, width: x(76) - x(2), height: hBar, fill: 'var(--ink)' }, svg);
    s('rect', { x: x(76) + 0.5, y: yBar + 0.5, width: x(167) - x(76) - 1, height: hBar - 1, fill: 'none', stroke: 'var(--ink)', 'stroke-dasharray': '3 3' }, svg);
    s('rect', { x: x(167), y: yBar, width: x(295) - x(167), height: hBar, fill: 'var(--ink)' }, svg);
    var lab = compact ? ['OPEN', 'CLOSED', 'OPEN'] : ['FLOOR OPEN', 'FLOOR CLOSED · SCREENS ONLY', 'FLOOR OPEN'];
    [[2, 76, 'var(--bg)'], [76, 167, 'var(--muted)'], [167, 295, 'var(--bg)']].forEach(function (g, i) {
      s('text', { x: (x(g[0]) + x(g[1])) / 2, y: yBar + 12, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 500, 'letter-spacing': '.04em', fill: g[2], text: lab[i] }, svg);
    });
    // month ticks hang below the bar only, so they never cross its labels
    MONTHS.forEach(function (m) {
      if (o.skipMonths && o.skipMonths.indexOf(m[1]) >= 0) return;
      s('line', { x1: x(m[0]), y1: yBar + hBar, x2: x(m[0]), y2: yBar + hBar + 5, stroke: 'var(--border-strong)' }, svg);
      s('text', { x: x(m[0]) + 3, y: yBar + hBar + 17, 'font-size': 11, fill: 'var(--muted)', text: m[1] }, svg);
    });
    return { x: x, yBar: yBar, hBar: hBar, compact: compact, W: W, H: H };
  }

  window.Explore = {
    tree: TREE, deck: deck, bet: bet, hub: hub, store: store, svg: s, clear: clear, fmt: fmt, money: money, textW: textW,
    fit: fit, alignRange: alignRange, rangeKeys: rangeKeys, reduced: reduced, openMap: openMap, closeMap: closeMap, timeline: timeline, events: EVENTS
  };
})();
