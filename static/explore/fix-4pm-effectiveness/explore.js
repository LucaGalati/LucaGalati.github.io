/* explore.js: navigation engine and chart helpers shared by every page of this explorable.
   Plain JavaScript, no dependencies, no network requests.
   Deck pages: <body data-deck="01-fix.html">, slides are <section class="slide">,
   a bottom <nav class="bar"> holds .dots, .prev, .next and .mapbtn.
   Hub page: <div id="map"> receives the map, #begin resumes where the reader left off. */
(function () {
  'use strict';

  var SLUG = 'fix-4pm-effectiveness';
  var PAPER = '../../publication/' + SLUG + '/';
  /* The tree. Main decks run in order; a side deck hangs from the slides whose doors open it.
     doors: [deck, slide holding the door, slide the door opens]; the first door is the branch's home in the map. */
  var TREE = [
    { file: '01-fix.html', title: 'Four o’clock', slides: [
      'Why does the fix last five minutes?',
      'How does a window make a fix?',
      'How do you judge a fix?',
      'What did the authors look at?'] },
    { file: '02-stretch.html', title: 'Stretch the window', slides: [
      'Would a longer window track the market better?',
      'Would a longer fix be easier to match?',
      'What would a longer window buy?',
      'Has five minutes held up since 2015?'] },
    { file: '03-month-end.html', title: 'The last day of the month', slides: [
      'Is month-end different?',
      'What lines up with the fix at month-end?',
      'What should you take away?'] },
    { file: '04-behind.html', title: 'Behind the numbers', side: true,
      doors: [['01-fix.html', 4, 1], ['01-fix.html', 4, 2]], slides: [
      'How do you rebuild a fix nobody published?',
      'What does “pre-registered” mean?'] },
    { file: '05-gaps.html', title: 'Reading the gaps', side: true,
      doors: [['02-stretch.html', 1, 1], ['03-month-end.html', 3, 2]], slides: [
      'Average gap or typical gap?',
      'What can the design tell?'] },
    { file: '06-recipe.html', title: 'A different average', side: true,
      doors: [['03-month-end.html', 3, 1]], slides: [
      'Is length the wrong knob?'] }
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
  /* a chart mark the reader can point at, focus or press: fn() shows its numbers */
  function hit(g, label, fn) {
    g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', label);
    g.addEventListener('mouseenter', fn); g.addEventListener('focus', fn); g.addEventListener('click', fn);
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
    return g;
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

  /* The motif: a clock at four o'clock whose minute ring carries the fixing window as an arc centred on the hour.
     arcs: [{ min: minutes, cls: class of the arc, w: stroke width, dr: radial offset }]; returns the <g>. */
  function arcPath(cx, cy, r, min) {
    var h = Math.min(min, 59.9) / 2 * 6 * Math.PI / 180;
    var x0 = cx + r * Math.sin(-h), y0 = cy - r * Math.cos(-h), x1 = cx + r * Math.sin(h), y1 = cy - r * Math.cos(h);
    return 'M' + x0.toFixed(2) + ',' + y0.toFixed(2) + ' A' + r + ',' + r + ' 0 ' + (min > 30 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2);
  }
  function clock(parent, cx, cy, r, arcs) {
    var g = svg('g', { 'class': 'clock' }, parent);
    svg('circle', { cx: cx, cy: cy, r: r, 'class': 'clock-face' }, g);
    for (var m = 0; m < 60; m++) {
      var a = m * 6 * Math.PI / 180, long = m % 5 === 0, r0 = r - (long ? r * 0.12 : r * 0.05);
      svg('line', { x1: cx + r0 * Math.sin(a), y1: cy - r0 * Math.cos(a), x2: cx + r * Math.sin(a), y2: cy - r * Math.cos(a), 'class': long ? 'clock-tick' : 'clock-tick minor' }, g);
    }
    (arcs || []).forEach(function (ar) {
      svg('path', { d: arcPath(cx, cy, r + (ar.dr || 0), ar.min), 'class': ar.cls, 'stroke-width': ar.w || 6, fill: 'none' }, g);
    });
    var ha = 120 * Math.PI / 180;
    svg('line', { x1: cx, y1: cy, x2: cx + r * 0.5 * Math.sin(ha), y2: cy - r * 0.5 * Math.cos(ha), 'class': 'clock-hand hour' }, g);
    svg('line', { x1: cx, y1: cy, x2: cx, y2: cy - r * 0.8, 'class': 'clock-hand' }, g);
    svg('circle', { cx: cx, cy: cy, r: 3, 'class': 'text-fill' }, g);
    return g;
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
    spread: spread, still: still, seg: seg, hit: hit, fit: fit, clock: clock, arcPath: arcPath, load: load, save: save, onShow: onShow, go: null };
  var deckFile = document.body.getAttribute('data-deck');
  if (deckFile) initDeck(deckFile); else initHub();
})();
