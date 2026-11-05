/* explore.js: navigation engine and chart helpers shared by every page of this explorable.
   Plain JavaScript, no dependencies, no network requests.
   Deck pages: <body data-deck="01-leaders.html">, slides are <section class="slide">,
   a bottom <nav class="bar"> holds .dots, .prev, .next and .mapbtn.
   Hub page: <div id="map"> receives the map, #begin resumes where the reader left off. */
(function () {
  'use strict';

  var SLUG = 'mtd-portfolio-optimization';
  var PAPER = '../../publication/' + SLUG + '/';
  /* The tree. Main decks run in order; a side deck hangs from the slides whose doors open it.
     doors: [deck, slide holding the door, slide the door opens]; the first door is the branch's home in the map. */
  var TREE = [
    { file: '01-leaders.html', title: 'Who leads whom', slides: [
      'Which stock moves first?',
      'How can one stock’s today shape another’s tomorrow?',
      'What does the whole web look like?',
      'Do leaders link to leaders?'] },
    { file: '02-portfolio.html', title: 'From network to portfolio', slides: [
      'Which links should a portfolio seek or avoid?',
      'Which two stocks would you pick?',
      'How many stocks does the classic recipe hold?',
      'What does the network term do to a portfolio?',
      'How was it tested?'] },
    { file: '03-results.html', title: 'Did it pay?', slides: [
      'Did the network beat the classic recipe?',
      'What do the other columns show?',
      'How sure can we be?',
      'What should you take away?'] },
    { file: '04-correlation.html', title: 'What correlation misses', side: true,
      doors: [['01-leaders.html', 1, 1]], slides: [
      'Why isn’t correlation enough?'] },
    { file: '05-excess.html', title: 'Not counting this arrow', side: true,
      doors: [['01-leaders.html', 4, 1], ['02-portfolio.html', 2, 1]], slides: [
      'Why leave the arrow itself out?',
      'How do arrows add up to a stock’s score?'] },
    { file: '06-checks.html', title: 'Two more checks', side: true,
      doors: [['03-results.html', 3, 1], ['03-results.html', 2, 2]], slides: [
      'Does a second measure agree?',
      'How do they look on the data they were fitted to?'] },
    { file: '07-limits.html', title: 'What the test leaves out', side: true,
      doors: [['02-portfolio.html', 5, 1]], slides: [
      'What does the test leave out?'] }
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

  /* ---------- the paper's ten-stock example (Section 2.6): data, strengths, assortativity, drawing ---------- */
  var NAMES = 'ABCDEFGHIJ'.split('');
  /* W[i][j]: influence of stock i on stock j (row = source, column = target), the matrix printed in Section 2.6 */
  var W0 = [
    [0, 0, 0, 0, 0, 0, 0.659, 0, 0, 0],
    [0, 0, 0.710, 0, 0, 0.450, 0, 0, 0, 0],
    [0, 0.657, 0, 0.371, 0.220, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0.159, 0.270, 0.381, 0],
    [0.669, 0.210, 0, 0, 0, 0.429, 0, 0, 0, 0.545],
    [0, 0, 0, 0, 0.321, 0, 0.182, 0.064, 0, 0.241],
    [0, 0, 0.253, 0, 0, 0, 0, 0.297, 0.203, 0],
    [0.241, 0.133, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0.037, 0.581, 0.459, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0.120, 0, 0.369, 0.417, 0]
  ];
  /* positions as in the paper's Figure 1 (0..1 across, 0..1 down) */
  var POS = [[0.67, 1], [0.67, 0.66], [0.67, 0.32], [1, 0.49], [0.33, 1], [0, 0.49], [0.33, 0.66], [0.33, 0.32], [0.67, 0], [0.33, 0]];
  function copyW(W) { return W.map(function (r) { return r.slice(); }); }
  function strengths(W) {
    var n = W.length, out = [], inn = [];
    for (var i = 0; i < n; i++) { out[i] = 0; inn[i] = 0; }
    for (i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j) { out[i] += W[i][j]; inn[j] += W[i][j]; }
    return { out: out, 'in': inn };
  }
  /* every arrow with its source's and target's excess strengths (Section 2.4, Table 1) */
  function edges(W) {
    var s = strengths(W), n = W.length, E = [];
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j && W[i][j] > 0) {
      E.push({ i: i, j: j, w: W[i][j],
        src: { 'in': s['in'][i] - W[j][i], out: s.out[i] - W[i][j] },
        tgt: { 'in': s['in'][j] - W[i][j], out: s.out[j] - W[j][i] } });
    }
    return E;
  }
  /* global (equation 8) and local (equation 9) assortativity for modality (m1, m2) */
  function assort(W, m1, m2) {
    var E = edges(W), O = 0, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, n = W.length;
    E.forEach(function (e) { var x = e.src[m1], y = e.tgt[m2]; O += e.w; Sx += e.w * x; Sy += e.w * y; Sxx += e.w * x * x; Syy += e.w * y * y; Sxy += e.w * x * y; });
    var den = Math.sqrt(Math.max(0, Sxx - Sx * Sx / O)) * Math.sqrt(Math.max(0, Syy - Sy * Sy / O)) || 1;
    var loc = [];
    for (var i = 0; i < n; i++) {
      var a = 0, b = 0;
      E.forEach(function (e) { if (e.i === i) { a += e.w * e.src[m1] * e.tgt[m2]; b += e.w * e.src[m1]; } });
      loc.push((a - b * Sy / O) / den);
    }
    return { glob: (Sxy - Sx * Sy / O) / den, local: loc, edges: E };
  }
  /* Draw the network inside root at box {x, y, w, h}.
     o.size: 'in' | 'out' | null; o.plain: lines without direction or weight;
     o.edgeClass(e) and o.nodeClass(i) return extra classes; o.onNode(i) makes nodes clickable. */
  function drawNet(root, W, box, o) {
    o = o || {};
    var n = W.length, st = strengths(W), pad = o.pad || 24;
    var R = o.R || 12;
    function radius(i) {
      if (!o.size) return R;
      return Math.max(8, R * Math.sqrt(Math.max(0.05, st[o.size][i])));
    }
    var P = POS.map(function (p) { return [box.x + pad + p[0] * (box.w - 2 * pad), box.y + pad + p[1] * (box.h - 2 * pad)]; });
    var rad = P.map(function (p, i) { return radius(i); });
    var gE = svg('g', { 'class': 'net-edges' }, root), gN = svg('g', { 'class': 'net-nodes' }, root);
    var out = { edges: [], nodes: [], P: P, rad: rad };
    function toward(p, q, d) { var ux = q[0] - p[0], uy = q[1] - p[1], l = Math.sqrt(ux * ux + uy * uy) || 1; return [p[0] + ux / l * d, p[1] + uy / l * d]; }
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      if (i === j || !(W[i][j] > 0)) continue;
      if (o.plain && j < i && W[j][i] > 0) continue; /* one line per pair */
      var a = P[i], b = P[j], dx = b[0] - a[0], dy = b[1] - a[1];
      /* a gentle bend to the right of the direction of travel keeps the two arrows of a reciprocal pair apart */
      var bend = o.plain ? 0 : 0.13;
      var cx = (a[0] + b[0]) / 2 - dy * bend, cy = (a[1] + b[1]) / 2 + dx * bend;
      var w = W[i][j], sw = o.plain ? 1.2 : 0.7 + 4.4 * w, head = o.plain ? 0 : 5.5 + 5 * w;
      var s0 = toward(a, [cx, cy], rad[i] + 1.5), s1 = toward(b, [cx, cy], rad[j] + 2 + head * 0.85);
      var cls = 'net-edge' + (o.edgeClass ? ' ' + (o.edgeClass(i, j, w) || '') : '');
      var g = svg('g', { 'class': cls }, gE);
      svg('path', { d: 'M' + s0[0].toFixed(1) + ',' + s0[1].toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' + s1[0].toFixed(1) + ',' + s1[1].toFixed(1), 'stroke-width': sw.toFixed(2) }, g);
      if (head) {
        var tip = toward(b, [cx, cy], rad[j] + 1.5), ux = tip[0] - s1[0], uy = tip[1] - s1[1], ul = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= ul; uy /= ul;
        var hw = 2.6 + 2.6 * w, bx = tip[0] - ux * head, by = tip[1] - uy * head;
        svg('path', { d: 'M' + tip[0].toFixed(1) + ',' + tip[1].toFixed(1) + ' L' + (bx - uy * hw).toFixed(1) + ',' + (by + ux * hw).toFixed(1) + ' L' + (bx + uy * hw).toFixed(1) + ',' + (by - ux * hw).toFixed(1) + ' Z', 'class': 'head' }, g);
      }
      out.edges.push({ i: i, j: j, g: g, mid: [0.25 * s0[0] + 0.5 * cx + 0.25 * s1[0], 0.25 * s0[1] + 0.5 * cy + 0.25 * s1[1]] });
    }
    for (i = 0; i < n; i++) {
      var ng = svg('g', { 'class': 'net-node' + (o.nodeClass ? ' ' + (o.nodeClass(i) || '') : '') }, gN);
      svg('circle', { cx: P[i][0], cy: P[i][1], r: rad[i] }, ng);
      text(ng, P[i][0], P[i][1] + 4, NAMES[i], { 'text-anchor': 'middle' });
      if (o.onNode) {
        ng.setAttribute('tabindex', '0'); ng.setAttribute('role', 'button');
        ng.setAttribute('aria-label', 'Stock ' + NAMES[i]);
        (function (k) {
          ng.addEventListener('click', function () { o.onNode(k); });
          ng.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onNode(k); } });
        })(i);
      }
      out.nodes.push(ng);
    }
    return out;
  }
  var net = { names: NAMES, W0: W0, pos: POS, copy: copyW, strengths: strengths, edges: edges, assort: assort, draw: drawNet };

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
    spread: spread, still: still, seg: seg, fit: fit, load: load, save: save, onShow: onShow, go: null, net: net };
  var deckFile = document.body.getAttribute('data-deck');
  if (deckFile) initDeck(deckFile); else initHub();
})();
