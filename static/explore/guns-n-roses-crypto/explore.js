/* explore.js: navigation engine, the paper's shared numbers and chart helpers for every page of this explorable
   (Galati and Russo, Guns ’N Roses, Finance Research Letters 2026). Plain JavaScript, no dependencies, no network requests.
   Deck pages: <body data-deck="01-shot.html">, slides are <section class="slide">,
   a bottom <nav class="bar"> holds .dots, .prev, .next and .mapbtn.
   A page may set Explore.hold = function (slide) { return true while the reader must stay }: the only use is the bet.
   Hub page: <div id="map"> receives the map, #begin resumes where the reader left off. */
(function () {
  'use strict';

  var SLUG = 'guns-n-roses-crypto';
  var PAPER = '../../publication/' + SLUG + '/';
  /* The tree. Main decks run in order; a side deck hangs from the slides whose doors open it.
     doors: [deck, slide holding the door, slide the door opens]; the first door is the branch's home in the map. */
  var TREE = [
    { file: '01-shot.html', title: 'The shot', slides: [
      'Fear or hope?',
      'What did the authors watch?',
      'Which way did crypto move?',
      'Did every token move the same way?',
      'Why would ten tokens move as one?'] },
    { file: '02-spillover.html', title: 'The spillover', slides: [
      'What does it mean to move together?',
      'Did Bitcoin’s moves spread further?',
      'What should you take away?'] },
    { file: '03-measure.html', title: 'Reading the numbers', side: true,
      doors: [['01-shot.html', 2, 1], ['01-shot.html', 4, 2]], slides: [
      'What counts as abnormal?',
      'What does “before and after” compare?'] },
    { file: '04-limits.html', title: 'The scope of one event', side: true,
      doors: [['01-shot.html', 5, 1]], slides: [
      'What can one shot show?'] }
  ];

  /* ---------- the paper's numbers, shared by every page ---------- */
  var ORDER = ['AVAX', 'BTC', 'DOGE', 'DOT', 'ETH', 'LINK', 'LTC', 'SHIB', 'SOL', 'XRP'];
  var NAMES = { AVAX: 'Avalanche', BTC: 'Bitcoin', DOGE: 'Dogecoin', DOT: 'Polkadot', ETH: 'Ethereum',
    LINK: 'Chainlink', LTC: 'Litecoin', SHIB: 'Shiba Inu', SOL: 'Solana', XRP: 'XRP', ALL: 'All ten' };
  /* Table 2: mean CAR in the week before, in the week after, and post − pre, in percent */
  var T2 = {
    AVAX: [-6.252, -1.513, 4.739], BTC: [1.915, 17.870, 15.955], DOGE: [-0.627, 18.642, 19.269],
    DOT: [-1.804, 2.214, 4.018], ETH: [3.377, 19.654, 16.277], LINK: [1.488, 17.479, 15.992],
    LTC: [5.618, 20.748, 15.130], SHIB: [-0.331, 18.060, 18.391], SOL: [-3.323, 7.996, 11.319],
    XRP: [3.699, 34.276, 30.577], ALL: [0.376, 15.543, 15.167]
  };
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
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
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

  /* ---------- the motif: Table 2's gains as a rose diagram, after Florence Nightingale ----------
     Ten petals, one per token, petal AREA proportional to the gain (radius ∝ √gain).
     rose(box, { bloom: bool, max: px }) returns { bloom(animate) }: a bud (spokes only) until bloomed. */
  var VMAX = 31;
  function rose(box, o) {
    o = o || {};
    var bloomed = !!o.bloom, t = bloomed ? 1 : 0, geo = null, raf = null;
    function ease(p) { return 1 - Math.pow(1 - p, 3); }
    function drawPetals() {
      if (!geo) return;
      var g = geo.petals, c = geo.c, R = geo.R;
      g.innerHTML = '';
      ORDER.forEach(function (k, i) {
        var p = ease(clamp((t - i * 0.05) / 0.55, 0, 1));
        if (p <= 0) return;
        var th = (-90 + i * 36) * Math.PI / 180, h = 15 * Math.PI / 180, r = R * Math.sqrt(T2[k][2] / VMAX) * p;
        var x0 = c + r * Math.cos(th - h), y0 = c + r * Math.sin(th - h), x1 = c + r * Math.cos(th + h), y1 = c + r * Math.sin(th + h);
        svg('path', { d: 'M' + c + ',' + c + ' L' + x0.toFixed(1) + ',' + y0.toFixed(1) + ' A' + r.toFixed(1) + ',' + r.toFixed(1) + ' 0 0 1 ' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' Z', 'class': 'petal' }, g);
      });
    }
    function render(W0) {
      var W = Math.round(clamp(W0, 280, o.max || 440));
      box.innerHTML = '';
      var c = W / 2, R = W / 2 - 46;
      var aria = bloomed
        ? 'Rose diagram of the gains in Table 2, average cumulative abnormal return in the week after the shot minus the week before, petal area proportional to the gain: ' +
          ORDER.map(function (k) { return NAMES[k] + ' +' + T2[k][2].toFixed(1); }).join(', ') + ' percentage points. All ten are positive.'
        : 'A bud: ten spokes, one for each token (' + ORDER.map(function (k) { return NAMES[k]; }).join(', ') + '). The petals appear once the bet is placed.';
      var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + W, role: 'img', 'aria-label': aria }, box);
      root.style.maxWidth = W + 'px'; root.style.margin = '0 auto';
      [10, 20, 30].forEach(function (v) { svg('circle', { cx: c, cy: c, r: (R * Math.sqrt(v / VMAX)).toFixed(1), 'class': 'grid' }, root); });
      ORDER.forEach(function (k, i) {
        var th = (-90 + i * 36) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
        svg('line', { x1: c, y1: c, x2: (c + R * cs).toFixed(1), y2: (c + R * sn).toFixed(1), 'class': 'spoke' }, root);
        var lx = c + (R + 10) * cs, ly = c + (R + 10) * sn;
        var anchor = cs > 0.3 ? 'start' : cs < -0.3 ? 'end' : 'middle';
        var y1 = sn < -0.5 ? ly - (bloomed ? 16 : 2) : sn > 0.5 ? ly + 10 : ly + (bloomed ? -3 : 4);
        text(root, lx, y1, k, { 'text-anchor': anchor, 'class': 'label' });
        if (bloomed) text(root, lx, y1 + 14, '+' + T2[k][2].toFixed(1), { 'text-anchor': anchor, 'class': 'strong' });
      });
      /* ring values sit on the top spoke, above Avalanche's short petal, so no petal ever covers them */
      geo = { c: c, R: R, petals: svg('g', {}, root) };
      [10, 20, 30].forEach(function (v) {
        var r = R * Math.sqrt(v / VMAX);
        text(root, c + 4, c - r + 13, String(v), { 'class': 'halo ring-label' });
      });
      svg('circle', { cx: c, cy: c, r: 2.5, 'class': 'text-fill' }, root);
      if (!bloomed) text(root, c, c + R * 0.42, o.budText || '', { 'text-anchor': 'middle', 'class': 'placeholder halo' });
      drawPetals();
    }
    var redraw = fit(box, render, { min: 280, max: o.max || 440 });
    return {
      bloom: function (animate) {
        if (raf) cancelAnimationFrame(raf);
        bloomed = true;
        if (!animate || still) { t = 1; redraw(); return; }
        t = 0; redraw();
        var t0 = null;
        function step(ts) {
          if (!t0) t0 = ts;
          t = Math.min(1, (ts - t0) / 1300);
          drawPetals();
          raf = t < 1 ? requestAnimationFrame(step) : null;
        }
        raf = requestAnimationFrame(step);
      }
    };
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
  /* a page can hold the reader on a slide (the bet); deep links and dots to slides already seen stay open */
  function held(i) { var h = window.Explore && window.Explore.hold; return typeof h === 'function' && !!h(i); }

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
      if (nextBtn) nextBtn.disabled = i === n || held(i);
      if (location.hash !== '#s' + i) { try { history.replaceState(null, '', '#s' + i); } catch (e) {} }
      window.scrollTo(0, 0);
      if (hadFocus) { /* the button that was pressed is now hidden: hand focus to the new heading */
        var h = s.querySelector('h1, h2');
        if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      }
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
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (current < n && !held(current)) { e.preventDefault(); go(current + 1); } }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (current > 1) { e.preventDefault(); go(current - 1); } }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); openMap(); }
    });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-next],[data-prev],[data-go],[data-map]');
      if (t) {
        e.preventDefault();
        if (t.hasAttribute('data-map')) openMap();
        else if (t.hasAttribute('data-next')) { if (!held(current)) go(current + 1); }
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
    if (nextBtn) nextBtn.addEventListener('click', function () { if (!held(current)) go(current + 1); });
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
    /* a page calls this once its hold condition has changed */
    window.Explore.refresh = function () { if (nextBtn && current) nextBtn.disabled = current === n || held(current); };
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

  window.Explore = { svg: svg, text: text, el: el, clamp: clamp,
    still: still, seg: seg, fit: fit, load: load, save: save, go: null, refresh: function () {}, hold: null,
    rose: rose, T2: T2, ORDER: ORDER, NAMES: NAMES };
  var deckFile = document.body.getAttribute('data-deck');
  if (deckFile) initDeck(deckFile); else initHub();
})();
