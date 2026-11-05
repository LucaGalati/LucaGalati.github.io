/* Explorable engine for "Does Centralising a Decentralised Market Do Any Good?"
   Plain JS, no dependencies, no network. Shared by the hub, the three decks and the three side paths.
   Every number a component draws is a toy value; the only number from the paper (4.3 points) lives in the pages. */
(function () {
  'use strict';

  var SLUG = 'centralising-decentralised-market';
  var PAPER = '../../publication/' + SLUG + '/';

  var TREE = [
    { id: '01', label: 'I', file: '01-screens.html', title: 'A bond on many screens',
      slides: ['Where is the price of a bond?', 'Dispersed flow, stale screens', 'Late 2023: the quoting arrangement', 'Why this counts as an experiment'],
      short: ['The question', 'The toy', 'The arrangement', 'The design'],
      playable: [2] },
    { id: '02', label: 'II', file: '02-measure.html', title: 'Measuring public information',
      slides: ['Nothing to discover, everything to synchronise', 'Screens that disagree', 'Moves that undo themselves', 'Place your bet', 'What moved the score', 'Concentrated quotes, not fewer screens'],
      short: ['The problem', 'First symptom', 'Second symptom', 'Place your bet', 'What moved it', 'Where the flow went'],
      playable: [2, 3, 4] },
    { id: '03', label: 'III', file: '03-frictions.html', title: 'Costs and open questions',
      slides: ['The price of a trade', 'What the data cannot see', 'Play with the arrangement', 'So, does it do any good?'],
      short: ['The price of a trade', 'The limits', 'Sandbox', 'The answer'],
      playable: [1, 3] },
    { id: 'a1', label: 'Side path', aside: true, row: 0, file: 'aside-venues.html', title: 'Why have many venues at all?',
      slides: ['Why have many venues at all?'], short: ['Why many venues?'], playable: [] },
    { id: 'a2', label: 'Side path', aside: true, row: 2, file: 'aside-random-walk.html', title: 'Why a random walk scores 1',
      slides: ['Why a random walk scores 1'], short: ['Why a random walk is 1'], playable: [1] },
    // Named without the result, so the map never answers the bet before it is placed.
    { id: 'a3', label: 'Side path', aside: true, row: 3, file: 'aside-points.html', title: 'Points or percent?',
      slides: ['Points or percent?'], short: ['Points or percent?'], playable: [1] }
  ];
  // Doors: forks placed inside slides, where the question arises. from/to are "deck/slide".
  var DOORS = [
    { from: '01/2', to: 'a1/1', label: 'Then why have many venues at all?' },
    { from: '01/3', to: '02/6', label: 'Did trading actually move there?' },
    { from: '02/3', to: 'a2/1', label: 'Why does a random walk score 1?' },
    { from: '02/4', to: 'a3/1', label: 'How big is the result?' },
    { from: '03/1', to: 'a1/1', label: 'Is spreading trading bad, then?' }
  ];

  /* ---- storage: a per-deck convenience, never required ------------------ */
  var store = {
    key: function (id) { return 'xp:' + SLUG + ':' + id; },
    get: function (id) {
      try { var v = JSON.parse(localStorage.getItem(this.key(id))); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; }
    },
    set: function (id, patch) {
      try {
        var cur = this.get(id), k;
        for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
        localStorage.setItem(this.key(id), JSON.stringify(cur));
      } catch (e) { /* storage unavailable: progress is simply not kept */ }
    }
  };

  function deckById(id) { for (var i = 0; i < TREE.length; i++) if (TREE[i].id === id) return TREE[i]; return null; }
  function seenSet(id) { var s = store.get(id).seen; return Array.isArray(s) ? s : []; }
  function isDone(d) { var s = seenSet(d.id); return d.slides.every(function (_, i) { return s.indexOf(i + 1) >= 0; }); }
  function where(d, n) { return d.aside ? 'Side path' : d.label + ' · ' + n; }
  function el(tag, attrs, children) {
    var e = document.createElement(tag), k;
    if (attrs) for (k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children) children.forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) {
    var e = document.createElementNS(SVG_NS, tag), k;
    if (attrs) for (k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  // Seeded randomness, so a knob never reshuffles the luck of a toy (mulberry32).
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function signed(x, dp) { return (x < 0 ? '−' : '') + Math.abs(x).toFixed(dp); }
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---- the tree as a list (map on phones, hub fallback) ----------------- */
  function buildTree(current) {
    var wrap = el('div', { 'class': 'tree' }), sideList = null;
    TREE.forEach(function (d) {
      var seen = seenSet(d.id), list;
      if (d.aside) {
        if (!sideList) {
          sideList = el('ol');
          wrap.appendChild(el('section', { 'class': 'tree__deck' }, [el('h3', {}, [el('span', { text: 'Forks' }), document.createTextNode('Side paths')]), sideList]));
        }
        list = sideList;
      } else {
        list = el('ol');
        wrap.appendChild(el('section', { 'class': 'tree__deck' }, [
          el('h3', {}, [el('span', { text: 'Deck ' + d.label + (isDone(d) ? ' · complete' : '') }), el('a', { href: d.file, text: d.title })]),
          list
        ]));
      }
      d.slides.forEach(function (title, i) {
        var n = i + 1, here = !!current && current.deck === d.id && current.slide === n;
        var li = el('li', { 'class': (seen.indexOf(n) >= 0 ? 'is-seen' : '') + (here ? ' is-current' : '') });
        var a = el('a', { href: d.file + '#' + n }, [el('span', { 'class': 'ico', 'aria-hidden': 'true' }),
          document.createTextNode((d.aside ? '' : n + '. ') + title + (d.playable.indexOf(n) >= 0 ? ' · playable' : '') + (here ? ' · you are here' : ''))]);
        if (here) a.setAttribute('aria-current', 'page');
        li.appendChild(a); list.appendChild(li);
        DOORS.forEach(function (door) {
          if (door.from !== d.id + '/' + n) return;
          var p = door.to.split('/'), t = deckById(p[0]);
          list.appendChild(el('li', { 'class': 'is-door' }, [el('a', { href: t.file + '#' + p[1], text: door.label + ' (' + where(t, +p[1]) + ')' })]));
        });
      });
    });
    return wrap;
  }

  /* ---- the tree as a constellation (hub and map on wide screens) -------- */
  function buildConstellation(container, current) {
    var colW = 240, top = 104, step = 52, half = step / 2, H = top + 5 * step + 24;
    var svg = svgEl('svg', { viewBox: '0 0 960 ' + H, role: 'group', 'aria-label': 'Map of the explorable: three decks and three side paths, with the doors between them' });
    var mk = svgEl('marker', { id: 'xp-arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' });
    mk.appendChild(svgEl('path', { d: 'M0,0 L8,4 L0,8 z', 'class': 'door-head' }));
    svg.appendChild(svgEl('defs', {})).appendChild(mk);
    var pos = {}, col = 0;
    TREE.forEach(function (d) {
      var c = d.aside ? 3 : col++, x = 24 + c * colW;
      d.slides.forEach(function (t, i) { pos[d.id + '/' + (i + 1)] = { x: x, y: top + (d.aside ? d.row : i) * step, c: c }; });
      if (d.aside) return;
      var head = svgEl('a', { href: d.file, 'aria-label': 'Deck ' + d.label + ', ' + d.title + (isDone(d) ? ', complete' : '') + ': resume where you left off' });
      head.appendChild(svgEl('text', { x: x, y: 40, 'class': 'deck-kicker' }, 'DECK ' + d.label + (isDone(d) ? ' · COMPLETE' : '')));
      head.appendChild(svgEl('text', { x: x, y: 63, 'class': 'deck-title' }, d.title));
      svg.appendChild(head);
      for (var i = 0; i < d.slides.length - 1; i++)
        svg.appendChild(svgEl('line', { x1: x + 14, y1: top + i * step + 10, x2: x + 14, y2: top + (i + 1) * step - 10, 'class': 'edge' }));
    });
    svg.appendChild(svgEl('text', { x: 24 + 3 * colW, y: 40, 'class': 'deck-kicker' }, 'FORKS'));
    svg.appendChild(svgEl('text', { x: 24 + 3 * colW, y: 63, 'class': 'deck-title' }, 'Side paths'));
    // Each door leaves its slide downwards, runs through the empty gap below that row, and climbs to its
    // target in its own lane, so no two doors share a segment.
    var lanes = {};
    DOORS.forEach(function (door) {
      var a = pos[door.from], b = pos[door.to], n = lanes[b.c] = (lanes[b.c] || 0) + 1;
      var cx = b.x - 12 - 7 * n, gy = a.y + half;
      svg.appendChild(svgEl('path', { d: 'M ' + (a.x + 22) + ' ' + (a.y + 10) + ' V ' + gy + ' H ' + cx + ' V ' + b.y + ' H ' + (b.x - 3), 'class': 'door-edge', 'marker-end': 'url(#xp-arrow)' }));
    });
    TREE.forEach(function (d) {
      var seen = seenSet(d.id);
      d.slides.forEach(function (t, i) {
        var n = i + 1, p = pos[d.id + '/' + n], here = !!current && current.deck === d.id && current.slide === n;
        var play = d.playable.indexOf(n) >= 0, isSeen = seen.indexOf(n) >= 0;
        var a = svgEl('a', { href: d.file + '#' + n, 'aria-label': (d.aside ? 'Side path' : 'Deck ' + d.label + ', slide ' + n) + ': ' + t + (play ? ', playable' : '') + (isSeen ? ', seen' : '') + (here ? ', you are here' : '') });
        var g = svgEl('g', { 'class': 'node' + (isSeen ? ' is-seen' : '') + (here ? ' is-current' : '') });
        g.appendChild(svgEl('rect', { x: p.x, y: p.y - 10, width: 28, height: 20, rx: 2 }));
        g.appendChild(svgEl('text', { x: p.x + 14, y: p.y + 4, 'text-anchor': 'middle', 'class': 'idx' }, d.aside ? '?' : String(n)));
        if (play) g.appendChild(svgEl('circle', { cx: p.x + 40, cy: p.y, r: 4, 'class': 'play' }));
        g.appendChild(svgEl('text', { x: p.x + 52, y: p.y + 4, 'class': 'lbl' }, d.short[i]));
        a.appendChild(g);
        svg.appendChild(a);
      });
    });
    container.appendChild(svg);
  }

  function legend() {
    function sw(cls) { return el('span', { 'class': 'sw ' + cls, 'aria-hidden': 'true' }); }
    return el('p', { 'class': 'legend' }, [
      el('span', {}, [sw('sw--node'), document.createTextNode('not yet seen')]),
      el('span', {}, [sw('sw--node is-seen'), document.createTextNode('seen')]),
      el('span', {}, [sw('sw--node is-current'), document.createTextNode('you are here')]),
      el('span', {}, [sw('sw--play'), document.createTextNode('something to play with')]),
      el('span', {}, [sw('sw--door'), document.createTextNode('a door: a fork inside a slide')])
    ]);
  }

  /* ---- map overlay ------------------------------------------------------- */
  function buildMap(current) {
    var map = el('div', { 'class': 'map', hidden: '', role: 'dialog', 'aria-label': 'Map of the explorable' });
    var inner = el('div', { 'class': 'map__inner' });
    inner.appendChild(el('div', { 'class': 'map__head' }, [
      el('div', {}, [el('p', { 'class': 'kicker', text: 'Map · press m or Esc to close' }), el('h2', { text: 'Does Centralising a Decentralised Market Do Any Good?' })]),
      el('div', { 'class': 'map__actions' }, [
        el('a', { 'class': 'btn btn--quiet', href: 'index.html', text: 'Hub' }),
        el('a', { 'class': 'btn btn--quiet', href: PAPER, text: '← Back to the paper' }),
        el('button', { 'class': 'btn', type: 'button', 'data-map-close': '', text: 'Close' })
      ])
    ]));
    var con = el('div', { 'class': 'constellation' });
    buildConstellation(con, current);
    inner.appendChild(con);
    inner.appendChild(el('div', { 'class': 'tree--fallback' }, [buildTree(current)]));
    inner.appendChild(legend());
    map.appendChild(inner);
    return map;
  }

  /* ---- deck -------------------------------------------------------------- */
  function initDeck() {
    var root = document.querySelector('[data-deck]');
    if (!root) return;
    var deckId = root.getAttribute('data-deck'), deck = deckById(deckId);
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide')), N = slides.length;
    var dotsBox = document.querySelector('[data-dots]'), countBox = document.querySelector('[data-count]');
    var prevBtn = document.querySelector('[data-prev]'), nextBtn = document.querySelector('[data-next]');
    var mapBtns = Array.prototype.slice.call(document.querySelectorAll('[data-map]'));
    var behind = Array.prototype.slice.call(document.querySelectorAll('body > header, body > main, body > footer'));
    var current = -1, map = null;

    var dots = slides.map(function (s, i) {
      var b = el('button', { 'class': 'dot', type: 'button', 'aria-label': 'Slide ' + (i + 1) + ': ' + (deck.slides[i] || ''), title: (i + 1) + '. ' + (deck.slides[i] || '') });
      b.addEventListener('click', function () { show(i); });
      dotsBox.appendChild(b);
      return b;
    });

    function show(i, opts) {
      opts = opts || {};
      i = Math.max(0, Math.min(N - 1, i));
      if (i === current) return;
      if (current >= 0) {
        slides[current].classList.remove('is-active');
        slides[current].setAttribute('aria-hidden', 'true');
        slides[current].dispatchEvent(new CustomEvent('xp:hide'));
      }
      current = i;
      var s = slides[i];
      s.classList.add('is-active');
      s.removeAttribute('aria-hidden');
      var seen = seenSet(deckId);
      if (seen.indexOf(i + 1) < 0) seen.push(i + 1);
      store.set(deckId, { last: i + 1, seen: seen });
      store.set('recent', { deck: deckId });
      dots.forEach(function (d, j) {
        d.classList.toggle('is-current', j === i);
        d.classList.toggle('is-seen', j !== i && seen.indexOf(j + 1) >= 0);
        d.setAttribute('aria-current', j === i ? 'step' : 'false');
      });
      if (countBox) countBox.textContent = (i + 1) + ' / ' + N;
      prevBtn.disabled = (i === 0);
      nextBtn.disabled = (i === N - 1);
      if (!opts.fromHash) history.replaceState(null, '', '#' + (i + 1));
      window.scrollTo(0, 0);
      s.dispatchEvent(new CustomEvent('xp:show'));
      if (!opts.silent) {
        var h = s.querySelector('h1, h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      }
    }
    function fromHash() {
      var n = parseInt((location.hash || '').replace('#', ''), 10);
      return isNaN(n) ? -1 : n - 1;
    }
    function isOpen() { return !!map && !map.hasAttribute('hidden'); }
    function openMap() {
      var fresh = buildMap({ deck: deckId, slide: current + 1 });
      if (map) map.replaceWith(fresh); else document.body.appendChild(fresh);
      map = fresh;
      map.querySelector('[data-map-close]').addEventListener('click', function () { closeMap(); });
      // Any link in the map closes it, including one to the slide already on screen.
      map.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) closeMap(true); });
      map.removeAttribute('hidden');
      behind.forEach(function (n) { n.inert = true; });
      mapBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      map.querySelector('[data-map-close]').focus();
    }
    function closeMap(silent) {
      if (!isOpen()) return;
      map.setAttribute('hidden', '');
      behind.forEach(function (n) { n.inert = false; });
      mapBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (!silent && mapBtns[0]) mapBtns[0].focus();
    }

    prevBtn.addEventListener('click', function () { show(current - 1); });
    nextBtn.addEventListener('click', function () { show(current + 1); });
    mapBtns.forEach(function (b) { b.addEventListener('click', function () { isOpen() ? closeMap() : openMap(); }); });
    root.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-go]');
      if (a) { e.preventDefault(); show(parseInt(a.getAttribute('data-go'), 10) - 1); }
    });
    document.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') { closeMap(); return; }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); isOpen() ? closeMap() : openMap(); return; }
      if (isOpen()) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); show(current + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(current - 1); }
    });
    window.addEventListener('hashchange', function () {
      closeMap(true);
      var i = fromHash();
      if (i >= 0 && i < N && i !== current) show(i, { fromHash: true });
    });

    slides.forEach(function (s) { s.setAttribute('aria-hidden', 'true'); });
    var start = fromHash();
    if (start < 0 || start >= N) {
      var last = parseInt(store.get(deckId).last, 10);
      start = (!isNaN(last) && last >= 1 && last <= N) ? last - 1 : 0;
    }
    show(start, { silent: true });
  }

  /* ---- hub ---------------------------------------------------------------- */
  function initHub() {
    var c = document.querySelector('[data-constellation]');
    if (!c) return;
    buildConstellation(c, null);
    var fb = document.querySelector('[data-tree]');
    if (fb) fb.appendChild(buildTree(null));
    var lg = document.querySelector('[data-legend]');
    if (lg) lg.appendChild(legend());
    var d = deckById(store.get('recent').deck), cont = document.querySelector('[data-continue]');
    if (d && cont) {
      var last = parseInt(store.get(d.id).last, 10);
      if (isNaN(last) || last < 1 || last > d.slides.length) last = 1;
      cont.href = d.file;  // the bare deck URL resumes on its last slide
      cont.textContent = 'Continue where you left off: ' + where(d, last) + ', ' + d.slides[last - 1];
      cont.hidden = false;
    }
  }

  /* ---- Toy: screens sharing one order flow -------------------------------- */
  /* A toy, not the paper's model. N screens share r orders a trading day (08:00–17:30, six real seconds).
     Public news moves the true value every day at 10:00, or when the reader asks; a screen shows the new
     value only once an order reaches it. A designated screen, when added, is one more screen that dealers
     keep quoted: it is right the moment news arrives, and it takes its share of the orders like the rest. */
  function screensToy(root, opts) {
    opts = opts || {};
    var ctls = opts.controls || ['venues', 'news'];
    var N = opts.venues || 7, R = opts.ordersPerDay || 30, designated = !!opts.designated;
    var DAY = 9.5, SPEED = DAY / 6, NEWS_AT = 2;
    var truth = 97.42, hours = 0, nextNews = NEWS_AT, newsAt = -1, lastWait = null, stale = 0;
    var since = 0, agree = 0, counting = false, flashUntil = -1;  // agreement is counted from the first news after a change
    var screens = [], running = false, raf = null, lastT = null;

    root.classList.add('toy');
    var row = el('div', { 'class': 'ctl-row' });
    function slider(label, min, max, val, onInput) {
      var out = el('output', { text: String(val) });
      var inp = el('input', { type: 'range', min: min, max: max, value: val, step: 1, 'aria-label': label });
      inp.addEventListener('input', function () { out.textContent = inp.value; onInput(+inp.value); });
      return el('div', { 'class': 'ctl' }, [el('div', { 'class': 'ctl__label' }, [el('span', { text: label }), out]), inp]);
    }
    if (ctls.indexOf('venues') >= 0) row.appendChild(slider('Screens sharing the flow', 1, 14, N, function (v) { N = v; layout(); }));
    if (ctls.indexOf('orders') >= 0) row.appendChild(slider('Orders a day', 5, 200, R, function (v) { R = v; reset(); }));
    if (ctls.indexOf('designated') >= 0) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = designated;
      cb.addEventListener('change', function () { designated = cb.checked; layout(); });
      row.appendChild(el('div', { 'class': 'ctl' }, [el('label', { 'class': 'switch' }, [cb, el('span', { text: 'Add a designated screen, kept quoted' })])]));
    }
    var newsBtn = el('button', { 'class': 'btn btn--gold', type: 'button', text: 'Public news now' });
    newsBtn.addEventListener('click', function () { news(); });
    row.appendChild(el('div', { 'class': 'ctl ctl--btn' }, [newsBtn]));

    var truthEl = el('span'), clockEl = el('span', { 'class': 'toy__clock' });
    var flash = el('div', { 'class': 'toy__flash', 'aria-hidden': 'true' });
    var grid = el('div', { 'class': 'toy__grid', role: 'img', 'aria-label': 'Screens of the toy market; each shows the price it last traded at' });
    var stage = el('div', { 'class': 'stage toy__stage' }, [el('div', { 'class': 'toy__head' }, [truthEl, clockEl]), flash, grid]);
    var live = el('p', { 'class': 'vh', 'aria-live': 'polite' });
    var readouts = el('div', { 'class': 'readouts' + (opts.showExpected ? ' readouts--2' : '') });
    function readout(label, sub) {
      var b = el('b', { text: '–' });
      readouts.appendChild(el('div', {}, [el('span', { text: label }), b, sub ? el('small', { text: sub }) : null]));
      return b;
    }
    var rStale = readout('Screens on the old price');
    var rWait = readout('Last news reached every screen after');
    var rShare = readout('Share of trading time all screens agreed', 'from the first news after your last change');
    var rExp = opts.showExpected ? readout('Expected wait for the last screen', 'formula in the note') : null;
    [row, stage, readouts, live].forEach(function (n) { root.appendChild(n); });

    function fmtH(h) {
      if (h == null) return '–';
      if (h < 1) return Math.max(1, Math.round(h * 60)) + ' min';
      if (h < DAY) return h.toFixed(1) + ' h';
      return (h / DAY).toFixed(1) + ' days';
    }
    function clock() {
      var day = Math.floor(hours / DAY) + 1, hod = 8 + (hours % DAY), hh = Math.floor(hod), mm = Math.floor((hod - hh) * 60);
      return 'Day ' + day + ' · ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    }
    function expected() {  // the last of N waiting screens, with orders spread over all M screens: (M / r) · H_N days
      var M = N + (designated ? 1 : 0), h = 0;
      for (var i = 1; i <= N; i++) h += 1 / i;
      return (M / R) * h * DAY;
    }
    function layout() {
      grid.textContent = '';
      screens = [];
      var M = N + (designated ? 1 : 0);
      for (var i = 0; i < M; i++) {
        var isD = designated && i === 0, px = el('b'), st = el('small');
        var cell = el('div', { 'class': 'scr' + (isD ? ' is-designated' : '') }, [px, st]);
        grid.appendChild(cell);
        screens.push({ cell: cell, px: px, st: st, price: truth, d: isD, hit: -1 });
      }
      stale = 0; newsAt = -1;
      reset();
    }
    function reset() { since = 0; agree = 0; counting = false; lastWait = null; update(); }
    function update() {
      rStale.textContent = stale + ' / ' + screens.length;
      rWait.textContent = lastWait == null && newsAt >= 0 ? 'not yet' : fmtH(lastWait);
      rShare.textContent = since > 0.5 ? Math.round(100 * agree / since) + '%' : '–';
      if (rExp) rExp.textContent = fmtH(expected());
      truthEl.innerHTML = 'True value <b>' + truth.toFixed(2) + '</b>' + (newsAt >= 0 && stale > 0 ? ' · news out ' + fmtH(hours - newsAt) + ' ago' : '');
      clockEl.textContent = clock();
      screens.forEach(function (s) {
        var fresh = Math.abs(s.price - truth) < 1e-9;
        s.px.textContent = s.price.toFixed(2);
        s.st.textContent = s.d ? 'kept quoted' : (fresh ? 'current' : 'old price');
        s.cell.classList.toggle('is-stale', !fresh);
        s.cell.classList.toggle('is-hit', s.hit >= 0 && hours - s.hit < 0.5);
      });
      flash.classList.toggle('on', hours < flashUntil);
    }
    function news() {
      var d = (0.08 + Math.random() * 0.22) * (Math.random() < 0.5 ? -1 : 1);
      truth = Math.round((truth + d) * 100) / 100;
      newsAt = hours; stale = 0; counting = true;
      screens.forEach(function (s) { if (s.d) s.price = truth; if (Math.abs(s.price - truth) > 1e-9) stale++; });
      if (stale === 0) lastWait = 0;
      if (!reduced) flashUntil = hours + 0.5;
      live.textContent = 'News: ' + stale + ' of ' + screens.length + ' screens on the old price.';
      update();
    }
    function poisson(lambda) {
      var L = Math.exp(-lambda), k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L);
      return k - 1;
    }
    function step(dt) {
      var dh = dt * SPEED, before = hours;
      hours += dh;
      if (counting) { since += dh; if (stale === 0) agree += dh; }
      var k = poisson(R * dh / DAY);
      for (var j = 0; j < k; j++) {
        var s = screens[Math.floor(Math.random() * screens.length)];
        s.hit = hours;
        if (Math.abs(s.price - truth) > 1e-9) {
          s.price = truth; stale--;
          if (stale === 0 && newsAt >= 0) { lastWait = hours - newsAt; live.textContent = 'All screens caught up after ' + fmtH(lastWait) + '.'; }
        }
      }
      if (before < nextNews && hours >= nextNews) { nextNews += DAY; news(); }
    }
    function loop(t) {
      if (!running) return;
      if (lastT == null) lastT = t;
      var dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
      step(dt); update();
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running) return; running = true; lastT = null; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    layout();
    return { start: start, stop: stop };
  }

  /* ---- Lab: what the paper's gauges see ----------------------------------- */
  /* A toy, not the paper's estimator. Three screens (four with a designated one) price one bond for 80 trading
     days of 114 five-minute steps. The true value is a random walk of public news. In each step a screen
     catches up with probability p (a designated screen always does); when it does it lands at
     V + k·(V − old price): k > 0 overshoots, k < 0 moves only part of the way. Gauges, pooled over days:
     sync = mean pairwise correlation of the screens' five-minute changes (1 = lockstep);
     VR = variance of one-hour changes ÷ (12 × variance of five-minute changes) (random walk = 1);
     AC = first-order autocorrelation of five-minute changes (0 = no pattern). */
  function pricesLab(root, opts) {
    opts = opts || {};
    var ctls = opts.controls || ['catchup', 'designated'], outs = opts.readouts || ['sync'];
    var STEPS = 114, DAYS = 80, s = 65, k = 0, designated = false, seed = 11;
    function pOf(v) { return Math.exp(Math.log(0.04) * (1 - v / 100)); }
    function every(v) { var m = 5 / pOf(v); return m < 7.5 ? 'every five minutes' : m < 60 ? 'about every ' + Math.round(m / 5) * 5 + ' min' : 'about every ' + (m / 60).toFixed(1) + ' h'; }
    function react(v) { return v === 0 ? 'exactly right' : v < 0 ? 'only ' + (100 + v) + '% of the way' : 'overshoots by ' + v + '%'; }

    root.classList.add('lab');
    var row = el('div', { 'class': 'ctl-row' });
    function slider(label, min, max, val, fmt, onInput) {
      var out = el('output', { text: fmt(val) });
      var inp = el('input', { type: 'range', min: min, max: max, value: val, step: 1, 'aria-label': label });
      inp.addEventListener('input', function () { out.textContent = fmt(+inp.value); onInput(+inp.value); });
      return el('div', { 'class': 'ctl' }, [el('div', { 'class': 'ctl__label' }, [el('span', { text: label }), out]), inp]);
    }
    if (ctls.indexOf('catchup') >= 0) row.appendChild(slider('A screen catches up', 0, 100, s, every, function (v) { s = v; draw(); }));
    if (ctls.indexOf('reaction') >= 0) row.appendChild(slider('When it does, it moves', -60, 60, 0, react, function (v) { k = v / 100; draw(); }));
    var foot = el('div', { 'class': 'ctl-row ctl-row--tight' });
    if (ctls.indexOf('designated') >= 0) {
      var cb = el('input', { type: 'checkbox' });
      cb.addEventListener('change', function () { designated = cb.checked; draw(); });
      foot.appendChild(el('label', { 'class': 'switch' }, [cb, el('span', { text: 'Add a designated screen, kept quoted' })]));
    }
    var again = el('button', { 'class': 'btn btn--quiet', type: 'button', text: 'New sample of days' });
    again.addEventListener('click', function () { seed += 1; draw(); });
    foot.appendChild(again);

    var svg = svgEl('svg', { viewBox: '0 0 400 170', 'class': 'lab__chart', role: 'img', 'aria-label': 'One simulated trading day: the true value and the price on each screen' });
    var band = svgEl('path', { 'class': 'lab__truth' }); svg.appendChild(band);
    var lines = [0, 1, 2, 3].map(function (i) { return svg.appendChild(svgEl('path', { 'class': 'lab__s lab__s' + (i + 1) })); });
    var key = el('p', { 'class': 'lab__key' }, [
      el('span', {}, [el('span', { 'class': 'sw sw--band', 'aria-hidden': 'true' }), document.createTextNode('true value')]),
      el('span', {}, [el('span', { 'class': 'sw sw--s1', 'aria-hidden': 'true' }), el('span', { 'class': 'sw sw--s2', 'aria-hidden': 'true' }), el('span', { 'class': 'sw sw--s3', 'aria-hidden': 'true' }), document.createTextNode('three screens')]),
      ctls.indexOf('designated') >= 0 ? el('span', {}, [el('span', { 'class': 'sw sw--d', 'aria-hidden': 'true' }), document.createTextNode('designated')]) : null
    ]);
    var readouts = el('div', { 'class': 'readouts' }), live = {};
    var DEF = { sync: ['Screens move together', '1 = lockstep'], vr: ['Variance ratio, one hour', 'random walk = 1'], ac: ['Autocorrelation, five minutes', '0 = no pattern'] };
    outs.forEach(function (o) {
      live[o] = el('b', { text: '–' });
      readouts.appendChild(el('div', {}, [el('span', { text: DEF[o][0] }), live[o], el('small', { text: DEF[o][1] })]));
    });
    [row, el('div', { 'class': 'stage lab__stage' }, [svg]), key, foot, readouts].forEach(function (n) { root.appendChild(n); });

    function simulate() {
      var r = rng(seed), p = pOf(s), M = 3 + (designated ? 1 : 0), T = STEPS, n = DAYS * (T - 1);
      var rets = [], i, d, t;
      for (i = 0; i < M; i++) rets.push(new Float64Array(n));
      var show = { v: [], p: [[], [], [], []] }, idx = 0;
      for (d = 0; d < DAYS; d++) {
        var V = 0, P = [0, 0, 0, 0];
        if (d === 0) { show.v.push(0); for (i = 0; i < 4; i++) show.p[i].push(0); }
        for (t = 1; t < T; t++) {
          V += 0.02 * gauss(r) + (r() < 0.06 ? 0.09 * gauss(r) : 0);
          for (i = 0; i < 4; i++) {
            var u = r(), old = P[i];               // drawn for every screen, every step
            if (i === 3 && !designated) continue;
            if (i === 3 || u < p) P[i] = V + k * (V - old);
            rets[i][idx] = P[i] - old;
          }
          idx++;
          if (d === 0) { show.v.push(V); for (i = 0; i < 4; i++) show.p[i].push(P[i]); }
        }
      }
      function mean(a) { var m = 0; for (var j = 0; j < a.length; j++) m += a[j]; return m / a.length; }
      var mu = rets.map(mean), va = rets.map(function (a, j) { var v = 0; for (var q = 0; q < a.length; q++) v += (a[q] - mu[j]) * (a[q] - mu[j]); return v / a.length; });
      var sync = 0, pairs = 0;
      for (i = 0; i < M; i++) for (var j = i + 1; j < M; j++) {
        var c = 0; for (var q = 0; q < n; q++) c += (rets[i][q] - mu[i]) * (rets[j][q] - mu[j]);
        sync += (va[i] > 0 && va[j] > 0) ? (c / n) / Math.sqrt(va[i] * va[j]) : 0; pairs++;
      }
      var ac = 0, vr = 0, per = T - 1, blocks = Math.floor(per / 12);
      for (i = 0; i < M; i++) {
        var num = 0, den = 0, hv = 0, hn = 0;
        for (d = 0; d < DAYS; d++) {
          var o = d * per;
          for (t = 0; t < per; t++) { var x = rets[i][o + t] - mu[i]; den += x * x; if (t > 0) num += x * (rets[i][o + t - 1] - mu[i]); }
          for (var b = 0; b < blocks; b++) { var h = 0; for (t = 0; t < 12; t++) h += rets[i][o + b * 12 + t] - mu[i]; hv += h * h; hn++; }
        }
        ac += den > 0 ? num / den : 0;
        vr += va[i] > 0 ? (hv / hn) / (12 * va[i]) : 1;
      }
      return { sync: sync / pairs, ac: ac / M, vr: vr / M, show: show, M: M };
    }
    function draw() {
      var out = simulate(), sh = out.show, T = STEPS, lo = Infinity, hi = -Infinity;
      sh.v.concat.apply(sh.v, sh.p.slice(0, 3).concat(designated ? [sh.p[3]] : [])).forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
      var pad = (hi - lo) * 0.08 || 0.1;
      function X(t) { return 8 + t * 384 / (T - 1); }
      function Y(v) { return 162 - (v - lo + pad) / (hi - lo + 2 * pad) * 154; }
      var dv = 'M ' + X(0) + ' ' + Y(sh.v[0]);
      for (var t = 1; t < T; t++) dv += ' L ' + X(t).toFixed(1) + ' ' + Y(sh.v[t]).toFixed(1);
      band.setAttribute('d', dv);
      lines.forEach(function (ln, i) {
        if (i === 3 && !designated) { ln.setAttribute('d', ''); return; }
        var d = 'M ' + X(0) + ' ' + Y(sh.p[i][0]).toFixed(1);
        for (var t2 = 1; t2 < T; t2++) d += ' H ' + X(t2).toFixed(1) + ' V ' + Y(sh.p[i][t2]).toFixed(1);
        ln.setAttribute('d', d);
      });
      if (live.sync) live.sync.textContent = signed(out.sync, 2);
      if (live.vr) live.vr.textContent = out.vr.toFixed(2);
      if (live.ac) live.ac.textContent = signed(out.ac, 2);
    }
    draw();
  }

  window.XP = { TREE: TREE, DOORS: DOORS, store: store, screensToy: screensToy, pricesLab: pricesLab, el: el, svgEl: svgEl, rng: rng, gauss: gauss, signed: signed, reduced: reduced };

  document.addEventListener('DOMContentLoaded', function () { initDeck(); initHub(); });
})();
