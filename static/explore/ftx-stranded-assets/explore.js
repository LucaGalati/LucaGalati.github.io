/* explore.js: navigation engine and chart helpers shared by every page of this explorable.
   Plain JavaScript, no dependencies, no network requests.
   Deck pages: <body data-deck="01-stranded.html">, slides are <section class="slide">,
   a bottom <nav class="bar"> holds .dots, .prev, .next and .mapbtn.
   Hub page: <div id="map"> receives the map, #begin resumes where the reader left off. */
(function () {
  'use strict';

  var SLUG = 'ftx-stranded-assets';
  var PAPER = '../../publication/' + SLUG + '/';
  /* The tree. Main decks run in order; a side deck hangs from the slides whose doors open it.
     doors: [deck, slide holding the door, slide the door opens]; the first door is the branch's home in the map. */
  var TREE = [
    { file: '01-stranded.html', title: 'Stranded', slides: [
      'What do you do when you can trade but not leave?',
      'What happened that week?',
      'Did trading stop?',
      'What did traders move into?',
      'Was a dollar coin still worth a dollar?',
      'Why can one coin have two prices?',
      'How far did prices on FTX drift?'] },
    { file: '02-toll.html', title: 'The toll', slides: [
      'What does it cost to trade right now?',
      'How much wider did Bitcoin’s spread get?',
      'Was it every coin, and only on FTX?',
      'Why would a market maker charge more?',
      'Who kept the extra?',
      'What should you take away?'] },
    { file: '03-bank.html', title: 'An exchange that is also a bank', side: true,
      doors: [['01-stranded.html', 1, 1], ['01-stranded.html', 2, 2]], slides: [
      'Why does an exchange hold your coins?',
      'What was FTT really worth?'] },
    { file: '04-yardstick.html', title: 'How sure can we be?', side: true,
      doors: [['02-toll.html', 3, 1], ['02-toll.html', 5, 2]], slides: [
      'Is Binance a fair yardstick?',
      'What can this comparison not tell us?'] },
    { file: '05-wallet.html', title: 'Follow the wallet', side: true,
      doors: [['01-stranded.html', 3, 1], ['01-stranded.html', 2, 2]], slides: [
      'Did any money leave?',
      'What happened on the last night?'] }
  ];
  function deckOf(file) { return TREE.filter(function (d) { return d.file === file; })[0] || null; }

  /* ---------- storage: every access wrapped; progress is a convenience, never a requirement ---------- */
  function load(key) {
    try { var v = localStorage.getItem('explore:' + SLUG + ':' + key); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function save(key, val) {
    try { localStorage.setItem('explore:' + SLUG + ':' + key, JSON.stringify(val)); }
    catch (e) { /* private window or blocked storage: the page works, progress is not kept */ }
  }
  function deckState(file) {
    var s = load('deck:' + file);
    if (!s || typeof s.cur !== 'number' || typeof s.max !== 'number') s = { cur: 1, max: 0 };
    if (!Array.isArray(s.seen)) { s.seen = []; for (var i = 1; i <= s.max; i++) s.seen.push(i); }
    return s;
  }

  /* ---------- helpers shared with the playables ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    var t = svg('text', attrs || {}, parent);
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.textContent = str;
    return t;
  }
  function el(tag, cls, str) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (str != null) e.textContent = str;
    return e;
  }
  function fmt(x, d) { d = d == null ? 2 : d; return (x < 0 ? '−' : '') + Math.abs(x).toFixed(d); }
  function plus(x, d) { d = d == null ? 2 : d; return (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d); }
  function thousands(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  /* rough width of a label in Geist at a given size, for keeping labels inside a chart */
  function textW(str, px) { return String(str).length * (px || 12) * 0.56; }
  /* push label positions apart so neighbours are at least `gap` apart, keeping their average */
  function spread(ys, gap) {
    var idx = ys.map(function (y, i) { return i; }).sort(function (a, b) { return ys[a] - ys[b]; });
    var out = ys.slice(), k, shift = 0;
    for (k = 1; k < idx.length; k++) if (out[idx[k]] - out[idx[k - 1]] < gap) out[idx[k]] = out[idx[k - 1]] + gap;
    idx.forEach(function (i) { shift += out[i] - ys[i]; });
    shift /= idx.length || 1;
    return out.map(function (y) { return y - shift; });
  }
  /* the motif: hatching marks whatever could not leave. Adds a pattern to an svg and returns its fill url. */
  var hatchN = 0;
  function hatch(root, cls) {
    var id = 'hatch-' + (++hatchN);
    var defs = svg('defs', {}, root);
    var p = svg('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, defs);
    svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, 'class': cls || 'hatch-line' }, p);
    return 'url(#' + id + ')';
  }
  var still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* segmented control: options = [[key, label], ...]; returns a setter (null clears the selection) */
  function seg(container, options, initial, onChange, label) {
    var btns = {};
    container.setAttribute('role', 'group');
    if (label) container.setAttribute('aria-label', label);
    options.forEach(function (o) {
      var b = el('button', null, o[1]); b.type = 'button';
      b.setAttribute('aria-pressed', o[0] === initial ? 'true' : 'false');
      b.addEventListener('click', function () { set(o[0]); onChange(o[0]); });
      container.appendChild(b); btns[o[0]] = b;
    });
    function set(key) { for (var k in btns) btns[k].setAttribute('aria-pressed', k === key ? 'true' : 'false'); }
    return set;
  }
  /* Draw a chart at the pixel width of its container, so 12 px of SVG text is 12 px on screen.
     render(W, viewportHeight) must redraw everything from the current state. Runs again when the
     slide is shown or the width changes; returns a function that forces a redraw. */
  function fit(box, render, o) {
    o = o || {};
    var last = '', timer = null;
    function measure(force) {
      var w = box.clientWidth;
      if (!w) return;
      w = Math.round(clamp(w, o.min || 300, o.max || 760));
      var sig = w + (o.useHeight ? 'x' + window.innerHeight : '');
      if (!force && sig === last) return;
      last = sig;
      render(w, window.innerHeight);
    }
    var slide = box.closest('.slide');
    if (slide) slide.addEventListener('explore:show', function () { measure(false); });
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(function () { measure(false); }, 120); });
    measure(false);
    return function () { measure(true); };
  }

  /* ---------- the motif drawing: FTX as a box with trades still crossing inside and its exit barred ---------- */
  function motif(box) {
    var COINS = ['BTC', 'ETH', 'BNB', 'FTT', 'LTC', 'DOGE'];
    fit(box, function (W) {
      box.innerHTML = '';
      var H = Math.round(W * 0.6), bx1 = Math.round(W * 0.64), top = 24, bot = H - 8;
      var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Schematic: FTX drawn as a box holding Bitcoin, Ether, BNB, FTT, Litecoin, Dogecoin and Tether, with trades still crossing between them; the exit on its right edge is barred by a hatched gate, so nothing reaches Binance outside.' }, box);
      var fillUrl = hatch(root, 'hatch-line');
      var midY = (top + bot) / 2, gap = 30;
      svg('path', { d: 'M' + (bx1) + ',' + (midY - gap) + ' V' + top + ' H1 V' + bot + ' H' + bx1 + ' V' + (midY + gap), 'class': 'box' }, root);
      text(root, 8, top - 8, 'FTX', { 'class': 'strong' });
      text(root, 38, top - 8, 'trading still open');
      var cx = bx1 / 2 + 2, cy = midY + 2, R = Math.min(bx1 * 0.36, (bot - top) * 0.34);
      var pts = COINS.map(function (c, i) { var a = (-90 + i * 60) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
      pts.forEach(function (p) { svg('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], 'class': 'trade' }, root); });
      svg('circle', { cx: cx, cy: cy, r: 22, 'class': 'coin usdt' }, root);
      text(root, cx, cy + 4, 'USDT', { 'text-anchor': 'middle', 'class': 'label' });
      pts.forEach(function (p, i) {
        svg('circle', { cx: p[0], cy: p[1], r: 18, 'class': 'coin' }, root);
        text(root, p[0], p[1] + 4, COINS[i], { 'text-anchor': 'middle', 'class': 'label' });
      });
      svg('rect', { x: bx1 - 5, y: midY - gap, width: 10, height: gap * 2, fill: fillUrl, 'class': 'gate-hatch' }, root);
      svg('rect', { x: bx1 - 5, y: midY - gap, width: 10, height: gap * 2, fill: 'none', stroke: 'var(--ftx)', 'stroke-width': 1.4 }, root);
      var b0 = Math.round(W * 0.78);
      svg('rect', { x: b0, y: midY - 46, width: W - b0 - 1, height: 92, 'class': 'box-bin' }, root);
      text(root, b0 + (W - b0) / 2, midY - 4, 'Binance', { 'text-anchor': 'middle', 'class': 'bin-text' });
      text(root, b0 + (W - b0) / 2, midY + 12, 'the market', { 'text-anchor': 'middle' });
      svg('path', { d: 'M' + (bx1 + 10) + ',' + midY + ' H' + (b0 - 4), 'class': 'arrow-line', 'stroke-dasharray': '3 3' }, root);
      text(root, (bx1 + b0) / 2 + 2, midY + gap + 18, 'exit', { 'text-anchor': 'middle', 'class': 'label' });
      text(root, (bx1 + b0) / 2 + 2, midY + gap + 33, 'barred', { 'text-anchor': 'middle' });
    }, { min: 300, max: 460 });
  }

  /* ---------- the map: main path as a spine, side paths hanging from the slides that open them ---------- */
  function seenMeta(deck, st) {
    var seen = st.seen.filter(function (k) { return k >= 1 && k <= deck.slides.length; }).length;
    if (seen === 0) return 'not started';
    if (seen === deck.slides.length) return seen === 1 ? 'seen' : 'all ' + seen + ' seen';
    return seen + ' of ' + deck.slides.length + ' seen';
  }
  function slideLink(deck, i, st, hereFile, hereIndex) {
    var here = deck.file === hereFile && i + 1 === hereIndex;
    var a = el('a', 'map-slide' + (st.seen.indexOf(i + 1) >= 0 ? ' seen' : '') + (here ? ' current' : ''));
    a.href = deck.file + '#s' + (i + 1);
    if (here) a.setAttribute('aria-current', 'page');
    a.appendChild(el('span', 'n', String(i + 1)));
    a.appendChild(el('span', 'name', deck.slides[i]));
    if (here) a.appendChild(el('span', 'you', 'you are here'));
    return a;
  }
  function deckHead(deck, st, kind) {
    var head = el('div', 'map-head');
    if (kind) head.appendChild(el('span', 'map-kind', kind));
    var title = el('a', 'map-deck-title', deck.title);
    title.href = deck.file; /* no hash: the deck resumes where the reader left it */
    head.appendChild(title);
    head.appendChild(el('span', 'map-meta', seenMeta(deck, st)));
    return head;
  }
  function renderMap(container, hereFile, hereIndex) {
    container.innerHTML = '';
    var sides = TREE.filter(function (d) { return d.side; });
    var tree = el('div', 'map-tree');
    TREE.filter(function (d) { return !d.side; }).forEach(function (deck) {
      var st = deckState(deck.file);
      var sec = el('section', 'map-deck' + (deck.file === hereFile ? ' here' : ''));
      sec.appendChild(deckHead(deck, st));
      var ol = el('ol', 'map-slides main');
      deck.slides.forEach(function (name, i) {
        var li = el('li');
        li.appendChild(slideLink(deck, i, st, hereFile, hereIndex));
        sides.forEach(function (sd) {
          sd.doors.forEach(function (d, k) {
            if (d[0] !== deck.file || d[1] !== i + 1) return;
            var sst = deckState(sd.file);
            if (k === 0) {
              var br = el('div', 'map-branch' + (sd.file === hereFile ? ' here' : ''));
              br.appendChild(deckHead(sd, sst, 'Side path'));
              var sol = el('ol', 'map-slides side');
              sd.slides.forEach(function (n2, j) { var sli = el('li'); sli.appendChild(slideLink(sd, j, sst, hereFile, hereIndex)); sol.appendChild(sli); });
              br.appendChild(sol);
              li.appendChild(br);
            } else {
              var p = el('p', 'map-cross');
              p.appendChild(document.createTextNode('↳ a door here also opens '));
              var a = el('a', null, sd.title + ', slide ' + d[2] + ': ' + sd.slides[d[2] - 1]);
              a.href = sd.file + '#s' + d[2];
              p.appendChild(a);
              li.appendChild(p);
            }
          });
        });
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      tree.appendChild(sec);
    });
    container.appendChild(tree);
  }

  /* ---------- deck pages ---------- */
  var current = 0;
  var showHandlers = [];
  function onShow(i, fn) { showHandlers.push([i, fn]); if (current === i) fn(); }

  function initDeck(file) {
    var deck = deckOf(file) || { file: file, title: file, slides: [] };
    var slides = [].slice.call(document.querySelectorAll('.slide'));
    var n = slides.length;
    var st = deckState(file);
    var main = document.querySelector('main');
    var bar = document.querySelector('.bar');

    var dotsEl = document.querySelector('.bar .dots');
    var prevBtn = document.querySelector('.bar .prev');
    var nextBtn = document.querySelector('.bar .next');
    var dots = slides.map(function (s, i) {
      var name = deck.slides[i] || s.getAttribute('data-title') || '';
      var b = el('button', 'dot'); b.type = 'button';
      b.setAttribute('aria-label', 'Slide ' + (i + 1) + ' of ' + n + ': ' + name);
      b.title = name;
      b.addEventListener('click', function () { if (i + 1 <= st.max) go(i + 1); });
      if (dotsEl) dotsEl.appendChild(b);
      return b;
    });

    function go(i) {
      i = clamp(i, 1, n);
      if (i === current) return;
      var prev = current ? slides[current - 1] : null;
      var hadFocus = prev && prev.contains(document.activeElement);
      if (prev) prev.classList.remove('active');
      current = i;
      var s = slides[i - 1];
      s.classList.add('active');
      st.cur = i; st.max = Math.max(st.max, i);
      if (st.seen.indexOf(i) < 0) st.seen.push(i);
      save('deck:' + file, st);
      save('last', { href: file + '#s' + i, label: deck.title + ', slide ' + i });
      dots.forEach(function (b, k) {
        var cur = k + 1 === i;
        b.classList.toggle('current', cur);
        b.classList.toggle('seen', st.seen.indexOf(k + 1) >= 0);
        if (cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        b.disabled = k + 1 > st.max;
      });
      if (prevBtn) prevBtn.disabled = i === 1;
      if (nextBtn) nextBtn.disabled = i === n;
      if (location.hash !== '#s' + i) { try { history.replaceState(null, '', '#s' + i); } catch (e) {} }
      window.scrollTo(0, 0);
      if (hadFocus) { /* the button that was pressed is now hidden: hand focus to the new heading */
        var h = s.querySelector('h1, h2');
        if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      }
      showHandlers.forEach(function (h2) { if (h2[0] === i) h2[1](); });
      s.dispatchEvent(new CustomEvent('explore:show', { detail: { index: i } }));
    }

    /* map overlay, built once per page */
    var map = el('div', 'map'); map.hidden = true;
    map.setAttribute('role', 'dialog'); /* not aria-modal: the site bar above it stays reachable */ map.setAttribute('aria-label', 'Map of this explorable');
    map.innerHTML = '<div class="map-inner"><header><h2>Map of this explorable</h2>' +
      '<button type="button" class="btn map-close">Close<kbd>Esc</kbd></button></header>' +
      '<div class="map-body"></div>' +
      '<p class="map-links"><a href="index.html">Start page</a> &middot; <a href="' + PAPER + '">← Back to the paper</a></p></div>';
    document.body.appendChild(map);
    var mapBody = map.querySelector('.map-body');
    var opener = null;
    function openMap() {
      opener = document.activeElement;
      renderMap(mapBody, file, current);
      map.hidden = false; document.body.classList.add('map-open');
      if (main) main.inert = true; if (bar) bar.inert = true;
      map.querySelector('.map-close').focus();
    }
    function closeMap() {
      map.hidden = true; document.body.classList.remove('map-open');
      if (main) main.inert = false; if (bar) bar.inert = false;
      var back = opener && document.contains(opener) && opener !== document.body ? opener : document.querySelector('.bar .mapbtn');
      if (back) back.focus();
    }
    map.querySelector('.map-close').addEventListener('click', closeMap);
    map.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && (a.getAttribute('href') || '').indexOf(file + '#') === 0) closeMap();
    });

    function fromHash() { var m = /^#s(\d+)$/.exec(location.hash); return m ? +m[1] : 0; }
    window.addEventListener('hashchange', function () { var h = fromHash(); if (h && h !== current) go(h); });

    document.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!map.hidden) {
        if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { e.preventDefault(); closeMap(); }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (current < n) { e.preventDefault(); go(current + 1); } }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (current > 1) { e.preventDefault(); go(current - 1); } }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); openMap(); }
    });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-next],[data-prev],[data-go],[data-map]');
      if (t) {
        e.preventDefault();
        if (t.hasAttribute('data-map')) openMap();
        else if (t.hasAttribute('data-next')) go(current + 1);
        else if (t.hasAttribute('data-prev')) go(current - 1);
        else go(+t.getAttribute('data-go'));
        return;
      }
      /* leaving the main path for another deck, by a door or any other link: remember the way back */
      var a = e.target.closest('a[href]');
      if (!a || deck.side) return;
      var target = (a.getAttribute('href') || '').split('#')[0];
      if (!target || target === file || !deckOf(target)) return;
      var r = a.getAttribute('data-return'), back = current;
      if (r === 'next') back = Math.min(n, current + 1); else if (r && /^\d+$/.test(r)) back = +r;
      save('return', { href: file + '#s' + back, label: deck.title + ', slide ' + back });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { go(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(current + 1); });
    var mapBtn = document.querySelector('.bar .mapbtn');
    if (mapBtn) mapBtn.addEventListener('click', openMap);

    /* side paths: "return" links point back to the main-path slide the reader left */
    var ret = load('return');
    var retOk = ret && ret.href && deckOf(ret.href.split('#')[0]) && !deckOf(ret.href.split('#')[0]).side;
    [].forEach.call(document.querySelectorAll('.return-link'), function (a) {
      if (!retOk) return;
      a.href = ret.href;
      a.textContent = '← Return to ' + ret.label;
      var when = a.getAttribute('data-primary-when');
      if (when && ret.href.indexOf(when) === 0) {
        var row = a.parentNode;
        [].forEach.call(row.querySelectorAll('.btn.primary'), function (b) { b.classList.remove('primary'); });
        a.classList.add('primary');
        row.insertBefore(a, row.firstChild);
      }
    });

    window.Explore.go = go;
    go(fromHash() || st.cur || 1);
  }

  /* ---------- hub page ---------- */
  function initHub() {
    var mot = document.getElementById('motif');
    if (mot) motif(mot);
    var mapEl = document.getElementById('map');
    if (mapEl) renderMap(mapEl, null, 0);
    /* entering any deck from the start page: forget an old way back, side paths fall back to their defaults */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (a && deckOf((a.getAttribute('href') || '').split('#')[0])) save('return', null);
    });
    var last = load('last');
    var begin = document.getElementById('begin');
    var restart = document.getElementById('restart');
    if (last && last.href && begin && deckOf(last.href.split('#')[0])) {
      begin.href = last.href;
      begin.textContent = 'Continue: ' + last.label + ' →';
      if (restart) restart.hidden = false;
    }
  }

  window.Explore = { svg: svg, text: text, el: el, fmt: fmt, plus: plus, thousands: thousands, clamp: clamp, textW: textW,
    spread: spread, still: still, seg: seg, fit: fit, hatch: hatch, motif: motif, load: load, save: save, onShow: onShow, go: null };
  var deckFile = document.body.getAttribute('data-deck');
  if (deckFile) initDeck(deckFile); else initHub();
})();
