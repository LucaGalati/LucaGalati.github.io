/* explore.js: navigation engine and chart helpers shared by every page of this explorable.
   Plain JavaScript, no dependencies, no network requests.
   Deck pages: <body data-deck="01-digits.html">, slides are <section class="slide">,
   a bottom <nav class="bar"> holds .dots, .prev, .next and .mapbtn.
   Hub page: <div id="map"> receives the map, #begin resumes where the reader left off. */
(function () {
  'use strict';

  var SLUG = 'local-elections-benford-moe';
  var PAPER = '../../publication/' + SLUG + '/';
  /* The tree. Main decks run in order; a side deck hangs from the slides whose doors open it.
     doors: [deck, slide holding the door, slide the door opens]; the first door is the branch's home in the map. */
  var TREE = [
    { file: '01-digits.html', title: 'Honest numbers', slides: [
      'Can you spot touched-up accounts without opening them?',
      'How often does a profit start with 1?',
      'Why would 1 win?',
      'How far from the law is too far?'] },
    { file: '02-elections.html', title: 'Before the vote', slides: [
      'What did the authors compare?',
      'Which pile fails the test?',
      'Is the small pile just noisier?',
      'Does full ownership matter?',
      'What does a misfit prove?',
      'What should you take away?'] },
    { file: '03-setting.html', title: 'The mayor’s companies', side: true,
      doors: [['01-digits.html', 1, 1], ['02-elections.html', 1, 2]], slides: [
      'Who owns the buses, and who votes when?',
      'How did 9,091 entities become 5,021 numbers?'] },
    { file: '04-tests.html', title: 'The size trap', side: true,
      doors: [['02-elections.html', 3, 1]], slides: [
      'Why does the size of the pile matter?'] }
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
      if (!w) { if (force) last = ''; return; } /* hidden: redraw when the slide is shown */
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

  /* ---------- Benford's law and the paper's two conformity tests ---------- */
  var B = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) { return Math.log10(1 + 1 / d); }); /* eq. (1) */
  /* First-digit counts reconstructed from the vector bars of Figures 2 and 3; with them the tests below
     return the paper's p values (exactly for the pre-election piles, within 0.005 for the ordinary ones). */
  var PILES = {
    pre50: [303, 213, 109, 107, 74, 79, 61, 70, 41],          /* Figure 2A, n = 1,057 */
    ord50: [1144, 734, 509, 366, 340, 264, 247, 195, 165],    /* Figure 2B, n = 3,964 */
    pre100: [170, 136, 68, 70, 39, 47, 33, 46, 21],           /* Figure 3A, n = 630 */
    ord100: [689, 428, 303, 228, 183, 152, 161, 105, 104]     /* Figure 3B, n = 2,353 */
  };
  /* survival function of a chi-square with 8 degrees of freedom (nine digits) */
  function chi2sf(x) { var h = x / 2, s = 0, t = 1; for (var j = 0; j < 4; j++) { if (j) t *= h / j; s += t; } return Math.exp(-h) * s; }
  function chi2pdf(x) { return x <= 0 ? 0 : x * x * x * Math.exp(-x / 2) / 96; }
  function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  /* Adjusted MAD (eq. 4) standardized to N(0, 1) under the law (eq. 5): mean sqrt(2/pi), standard deviation
     from the covariances of |Z_i| and |Z_j|, whose correlations are those of eq. (7) */
  var MAD_MU = Math.sqrt(2 / Math.PI), MAD_SD = (function () {
    var s = 0;
    for (var i = 0; i < 9; i++) for (var j = 0; j < 9; j++) {
      var r = i === j ? 1 : -Math.sqrt(B[i] * B[j] / ((1 - B[i]) * (1 - B[j])));
      s += 2 / Math.PI * (r * Math.asin(r) + Math.sqrt(1 - r * r) - 1);
    }
    return Math.sqrt(s / 81);
  })();
  /* shares p (summing to 1) and pile size n: chi-square (eq. 2), plain MAD (eq. 3), standardized adjusted MAD, p values */
  function tests(p, n) {
    var chi = 0, mad = 0, ms = 0;
    for (var i = 0; i < 9; i++) { var g = p[i] - B[i]; chi += g * g / B[i]; mad += Math.abs(g); ms += Math.abs(g) / Math.sqrt(B[i] * (1 - B[i])); }
    chi *= n; mad /= 9; ms *= Math.sqrt(n) / 9;
    var z = (ms - MAD_MU) / MAD_SD;
    return { chi: chi, pChi: chi2sf(chi), mad: mad, z: z, pMad: 1 - Phi(z) };
  }
  function shares(c) { var n = c.reduce(function (a, b) { return a + b; }, 0); return c.map(function (x) { return x / n; }); }
  function total(c) { return c.reduce(function (a, b) { return a + b; }, 0); }
  /* a p value for reading, in the paper's format: two significant figures below 0.01 (0.0054), three decimals below 0.1, two otherwise */
  function pv(p) { return p < 0.01 ? p.toPrecision(2) : p.toFixed(p < 0.1 ? 3 : 2); }
  function peq(p) { return p < 0.0001 ? 'p < 0.0001' : 'p = ' + pv(p); } /* no break inside "p = 0.016" */
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + '%'; }

  /* A first-digit chart: bars for one pile, the law as an ink ruler line (a tick per digit, joined by a hairline).
     o: { W, H, shares (or null for an empty frame), cls: 'near'|'far', title, yMax, aria, noLaw } */
  function digitChart(parent, o) {
    var W = o.W, H = o.H, L = 34, R = 6, TOP = o.title ? 24 : 10, BOT = 26, yMax = o.yMax || 0.35;
    function X(i) { return L + (W - L - R) * (i + 0.5) / 9; }
    function Y(v) { return TOP + (H - TOP - BOT) * (1 - v / yMax); }
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.aria || '' }, parent);
    if (o.title) text(root, L - 30, 14, o.title, { 'class': 'label' });
    var step = yMax > 0.5 ? 0.2 : 0.1;
    for (var v = 0; v <= yMax + 1e-9; v += step) {
      svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), 'class': v === 0 ? 'axis' : 'grid' }, root);
      text(root, L - 6, Y(v) + 4, Math.round(v * 100) + '%', { 'text-anchor': 'end' });
    }
    var bw = Math.min(26, (W - L - R) / 9 * 0.62);
    for (var i = 0; i < 9; i++) text(root, X(i), H - BOT + 17, String(i + 1), { 'text-anchor': 'middle', 'class': 'label' });
    var g = svg('g', {}, root);
    if (o.shares) o.shares.forEach(function (s, i) {
      var y = Y(Math.min(s, yMax));
      svg('rect', { x: X(i) - bw / 2, y: y, width: bw, height: Math.max(0, Y(0) - y), 'class': o.cls === 'near' ? 'near-fill' : 'far-fill' }, g);
    });
    if (!o.noLaw) lawLine(root, X, Y, bw);
    return { root: root, X: X, Y: Y, bw: bw, L: L, R: R, TOP: TOP, BOT: BOT, bars: g };
  }
  function lawLine(root, X, Y, bw) {
    var pts = B.map(function (b, i) { return X(i).toFixed(1) + ',' + Y(b).toFixed(1); }).join(' ');
    svg('polyline', { points: pts, 'class': 'law' }, root);
    B.forEach(function (b, i) { svg('line', { x1: X(i) - bw / 2 - 3, x2: X(i) + bw / 2 + 3, y1: Y(b), y2: Y(b), 'class': 'law-tick' }, root); });
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

  /* ---------- the decade ruler: one power of ten, each first digit owning the stretch up to the next ---------- */
  /* The shares are the answer to the first bet, so they are printed only once that bet is placed. */
  function drawRuler(box) {
    var shares = !!load('bet-ones');
    fit(box, function (W) {
      box.innerHTML = '';
      var two = shares && W < 640, three = two && W < 400, H = shares ? 70 + (two ? 15 : 0) + (three ? 15 : 0) : 50, y0 = 22, h = 22;
      function X(v) { return W * Math.log10(v); }
      var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'A logarithmic ruler for one power of ten, from 1 to 10, cut into the stretches where numbers start with 1, 2 and so on up to 9; the stretch for 1 is the longest.' +
          (shares ? ' It takes 30.1% of the length, 2 takes 17.6%, 3 12.5%, 4 9.7%, 5 7.9%, 6 6.7%, 7 5.8%, 8 5.1% and 9 4.6%.' : '') }, box);
      for (var d = 1; d <= 9; d++) {
        svg('rect', { x: X(d), y: y0, width: X(d + 1) - X(d), height: h, 'class': 'cell' + (d === 1 ? ' one' : '') }, root);
        if (!shares) continue;
        /* on a narrow ruler the even digits' shares drop to a second row, so neighbours never touch; 9 sits against the right end */
        var share = (B[d - 1] * 100).toFixed(1) + '%', y = y0 + h + 17 + (two && d % 2 === 0 ? 15 : 0) + (three && d === 9 ? 30 : 0);
        if (d === 9) text(root, W, y, share, { 'text-anchor': 'end' });
        else text(root, (X(d) + X(d + 1)) / 2, y, share, { 'text-anchor': 'middle', 'class': d === 1 ? 'label' : null });
      }
      for (var v = 1; v <= 10; v++) {
        if (v === 9 && W < 460) continue; /* on a phone 9 and 10 would touch */
        text(root, X(v), y0 - 7, String(v), { 'text-anchor': v === 1 ? 'start' : v === 10 ? 'end' : 'middle', 'class': 'label' });
      }
      svg('rect', { x: X(1), y: y0 + h - 3, width: X(2) - X(1), height: 3, 'class': 'mark' }, root);
    }, { min: 280, max: 680 });
  }

  /* ---------- hub page ---------- */
  function initHub() {
    var mapEl = document.getElementById('map');
    if (mapEl) renderMap(mapEl, null, 0);
    var rulerEl = document.getElementById('ruler');
    if (rulerEl) drawRuler(rulerEl);
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
    spread: spread, still: still, seg: seg, fit: fit, load: load, save: save, onShow: onShow, go: null,
    B: B, PILES: PILES, tests: tests, shares: shares, total: total, chi2pdf: chi2pdf, Phi: Phi, pv: pv, peq: peq, pct: pct,
    digitChart: digitChart, lawLine: lawLine };
  var deckFile = document.body.getAttribute('data-deck');
  if (deckFile) initDeck(deckFile); else initHub();
})();
