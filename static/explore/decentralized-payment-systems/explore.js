/* Shared navigation for the explorable: one slide per view, progress dots as buttons,
   arrow keys, a map of the whole tree (m), side trips that return where they came from,
   progress per deck in localStorage (every access in try/catch), bets, and chart hooks. */
(function () {
  'use strict';

  /* The tree. Main slides are numbered within a deck (#1, #2, ...). Side trips have a key
     (#burn) and a parent: the main slide whose words open them and to which they return. */
  var TREE = [
    { file: '01-auction.html', name: 'Deck 1', title: 'The auction you cannot see',
      slides: ['A trillion-dollar network with a strange bill', 'Space in a block is scarce',
               'Bid for a slot', 'The fix: a posted fee', 'The thermostat'],
      play: [3, 5],
      branches: [{ key: 'burn', title: 'Why burn the fee?', parent: 4 }] },
    { file: '02-evidence.html', name: 'Deck 2', title: 'What the data said',
      slides: ['The counterfactual: place your bet', 'Why did it get dearer?', 'The promise kept',
               'The gap in dollars', 'Narrower ratio, wider gap', 'Who got the money',
               'Relative to Bitcoin, the network shrank', 'What it cost in welfare'],
      play: [1, 5],
      branches: [{ key: 'control', title: 'Is Bitcoin a fair control?', parent: 1 },
                 { key: 'liu', title: 'Didn’t another study find the gap fell?', parent: 4 }] },
    { file: '03-placebo.html', name: 'Deck 3', title: 'Rules, or event?',
      slides: ['A second shock', 'Two shocks, one chart', 'What it means', 'What it cannot say',
               'Sandbox: three fee markets'],
      play: [2, 5],
      branches: [{ key: 'private', title: 'What about private fee deals?', parent: 1 }] }
  ];
  var PAPER = '../../publication/decentralized-payment-systems/';
  var KEY = 'explore:dps2:';

  function load(k) { try { var v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }

  var api = {
    TREE: TREE, PAPER: PAPER, reduced: reduced,
    bet: function (name, value) { save('bet:' + name, value); },
    getBet: function (name) { return load('bet:' + name); },
    remember: function (name, value) { save('state:' + name, value); },
    recall: function (name) { return load('state:' + name); },
    progress: function (file) {
      var p = load('deck:' + file) || {};
      return { reached: p.reached || 0, last: p.last || 1, seen: p.seen || [], seenB: p.seenB || [] };
    },
    last: function () { return load('last'); }
  };
  window.explore = api;

  function deckIndex(file) { for (var i = 0; i < TREE.length; i++) if (TREE[i].file === file) return i; return -1; }
  function branchOf(deck, key) { var b = deck && deck.branches || []; for (var i = 0; i < b.length; i++) if (b[i].key === key) return b[i]; return null; }
  api.titleOf = function (file, at) {
    var d = TREE[deckIndex(file)]; if (!d) return '';
    if (typeof at === 'number') return d.slides[at - 1] || '';
    var b = branchOf(d, at); return b ? b.title : '';
  };

  // ---------- the map (overlay on decks, inline on the hub) ----------
  function mapLink(deck, at, label, n, cls, extra, here) {
    var a = document.createElement('a');
    a.href = deck.file + '#' + at;
    a.className = cls;
    a.innerHTML = '<span class="pip"></span>' + (n ? '<span class="n">' + n + '</span>' : '') + '<span>' + label + '</span>' + (extra || '');
    if (here) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); closeMap(true); go(at); });
    }
    return a;
  }
  function buildMapGrid(container, currentFile, currentAt) {
    container.innerHTML = '';
    TREE.forEach(function (deck) {
      var prog = api.progress(deck.file);
      var d = document.createElement('div');
      d.className = 'map-deck';
      var h = document.createElement('h3');
      h.innerHTML = '<small>' + deck.name + '</small>' + deck.title;
      d.appendChild(h);
      var ol = document.createElement('ol');
      var here = deck.file === currentFile;
      deck.slides.forEach(function (title, i) {
        var n = i + 1, li = document.createElement('li');
        var cls = (prog.seen.indexOf(n) !== -1 ? ' is-seen' : '') + (here && currentAt === n ? ' is-current' : '');
        li.appendChild(mapLink(deck, n, title, n, cls.trim(), deck.play.indexOf(n) !== -1 ? '<span class="play">play</span>' : '', here));
        var kids = (deck.branches || []).filter(function (b) { return b.parent === n; });
        if (kids.length) {
          var sub = document.createElement('ol');
          kids.forEach(function (b) {
            var sli = document.createElement('li');
            var c2 = 'is-branch' + (prog.seenB.indexOf(b.key) !== -1 ? ' is-seen' : '') + (here && currentAt === b.key ? ' is-current' : '');
            sli.appendChild(mapLink(deck, b.key, b.title, '', c2, '<span class="side">side trip</span>', here));
            sub.appendChild(sli);
          });
          li.appendChild(sub);
        }
        ol.appendChild(li);
      });
      d.appendChild(ol);
      container.appendChild(d);
    });
  }
  api.buildMapGrid = buildMapGrid;

  var mapEl = null, mapReturn = null;
  function openMap() {
    if (!mapEl) return;
    mapReturn = document.activeElement;
    buildMapGrid(mapEl.querySelector('.map-grid'), deckFile, currentKey || current);
    mapEl.classList.add('is-open');
    mapEl.setAttribute('aria-hidden', 'false');
    setMapBtn(true);
    var c = mapEl.querySelector('.close'); if (c) c.focus();
  }
  function closeMap(skipFocus) {
    if (!mapEl || !mapEl.classList.contains('is-open')) return;
    mapEl.classList.remove('is-open');
    mapEl.setAttribute('aria-hidden', 'true');
    setMapBtn(false);
    if (!skipFocus && mapReturn && mapReturn.focus) { try { mapReturn.focus(); } catch (e) { /* gone */ } }
    mapReturn = null;
  }
  function setMapBtn(open) { var mb = document.querySelector('.mapbtn'); if (mb) mb.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  function toggleMap() { if (!mapEl) return; if (mapEl.classList.contains('is-open')) closeMap(); else openMap(); }
  api.openMap = openMap; api.closeMap = closeMap;

  // ---------- deck pages ----------
  var body = document.body;
  var deckFile = body.getAttribute('data-deck');
  var deck = TREE[deckIndex(deckFile)];
  var mains = [], trips = {}, dots = [], current = 1, currentKey = null, reached = 1, seen = [], seenB = [];
  var prevBtn, nextBtn, tripEl, live;

  function parseAt(v) {
    if (v === null || v === undefined || v === '') return null;
    var s = String(v).replace(/^#/, '');
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return trips[s] ? s : null;
  }

  function go(at, opts) {
    at = parseAt(at);
    if (at === null) return;
    var el, parent;
    if (typeof at === 'number') {
      if (at < 1 || at > mains.length) return;
      el = mains[at - 1]; current = at; currentKey = null; parent = at;
      if (at > reached) reached = at;
      if (seen.indexOf(at) === -1) seen.push(at);
    } else {
      el = trips[at]; currentKey = at;
      var b = branchOf(deck, at); parent = b ? b.parent : current; current = parent;
      if (seenB.indexOf(at) === -1) seenB.push(at);
    }
    mains.concat(Object.keys(trips).map(function (k) { return trips[k]; })).forEach(function (s) { s.classList.toggle('is-active', s === el); });
    save('deck:' + deckFile, { reached: reached, last: at, seen: seen, seenB: seenB });
    save('last', { file: deckFile, at: at });
    dots.forEach(function (btn, i) {
      var k = i + 1;
      var isCur = !currentKey && k === current;
      btn.classList.toggle('is-current', isCur);
      btn.classList.toggle('is-parent', !!currentKey && k === parent);
      btn.classList.toggle('is-seen', !isCur && seen.indexOf(k) !== -1);
      btn.disabled = k > reached && k !== parent;
      btn.setAttribute('aria-current', isCur ? 'step' : 'false');
    });
    if (tripEl) { tripEl.hidden = !currentKey; }
    if (!(opts && opts.keepHash)) { try { history.replaceState(null, '', '#' + at); } catch (e) { /* file:// in some browsers */ } }
    window.scrollTo(0, 0);
    var title = currentKey ? api.titleOf(deckFile, currentKey) : (deck ? deck.slides[at - 1] : '');
    if (deck) document.title = title + ' — ' + deck.title;
    if (live) live.textContent = (currentKey ? 'Side trip: ' : 'Slide ' + at + ' of ' + mains.length + ': ') + title;
    document.dispatchEvent(new CustomEvent('slidechange', { detail: { index: currentKey ? null : at, key: currentKey, slide: el } }));
  }
  api.go = go;
  api.here = function () { return currentKey || current; };

  function next() {
    var from = current; // on a side trip, current holds the parent
    if (from < mains.length) { go(from + 1); return; }
    var i = deckIndex(deckFile);
    if (i !== -1 && i < TREE.length - 1) location.href = TREE[i + 1].file + '#1';
    else location.href = 'index.html';
  }
  function prev() {
    if (currentKey) { go(current); return; }
    if (current > 1) { go(current - 1); return; }
    var i = deckIndex(deckFile);
    if (i > 0) { var p = TREE[i - 1]; location.href = p.file + '#' + p.slides.length; }
    else location.href = 'index.html';
  }

  function initDeck() {
    var all = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    if (!all.length) return;
    all.forEach(function (s) { var k = s.getAttribute('data-branch'); if (k) trips[k] = s; else mains.push(s); });
    var prog = api.progress(deckFile);
    reached = Math.max(1, prog.reached || 1);
    seen = prog.seen.slice(); seenB = prog.seenB.slice();

    live = document.createElement('div');
    live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status');
    body.appendChild(live);

    var dotsEl = document.querySelector('.dots');
    if (dotsEl) {
      mains.forEach(function (s, i) {
        var b = document.createElement('button');
        b.type = 'button';
        var title = (deck && deck.slides[i]) || s.getAttribute('data-title') || ('Slide ' + (i + 1));
        b.setAttribute('aria-label', 'Slide ' + (i + 1) + ': ' + title);
        b.title = title;
        b.addEventListener('click', function () { go(i + 1); });
        dotsEl.appendChild(b);
        dots.push(b);
      });
      tripEl = document.createElement('span');
      tripEl.className = 'trip'; tripEl.textContent = 'side trip'; tripEl.hidden = true;
      dotsEl.parentNode.insertBefore(tripEl, dotsEl.nextSibling);
    }
    prevBtn = document.querySelector('.nav-prev');
    nextBtn = document.querySelector('.nav-next');
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    mapEl = document.querySelector('.map');
    var mb = document.querySelector('.mapbtn'); if (mb) mb.addEventListener('click', toggleMap);
    var mc = mapEl && mapEl.querySelector('.close'); if (mc) mc.addEventListener('click', function () { closeMap(); });

    // links inside the deck: <a data-go="3"> or <a data-go="burn">
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('[data-go]');
      if (!a) return;
      var at = parseAt(a.getAttribute('data-go'));
      if (at === null) return;
      ev.preventDefault();
      if (typeof at === 'number' && at > reached + 1) reached = at - 1; // a fork may open a slide ahead
      go(at);
    });

    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === 'Escape') { closeMap(); return; }
      if (ev.key === 'm' || ev.key === 'M') { ev.preventDefault(); toggleMap(); return; }
      if (mapEl && mapEl.classList.contains('is-open')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { ev.preventDefault(); next(); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); prev(); }
    });

    window.addEventListener('hashchange', function () {
      var h = parseAt(location.hash);
      if (h === null || h === (currentKey || current)) return;
      if (typeof h === 'number' && h > reached + 1) reached = h - 1;
      go(h, { keepHash: true });
    });

    var start = parseAt(location.hash);
    if (start !== null) {
      if (typeof start === 'number' && start > mains.length) start = null;
      else if (typeof start === 'number' && start > reached) reached = start;
    }
    if (start !== null) go(start, { keepHash: true });
    else { var l = parseAt(prog.last); go(l !== null && (typeof l !== 'number' || l <= mains.length) ? l : 1); }
  }

  if (deckFile) initDeck();

  // ---------- helpers for playables ----------
  api.fmt = function (x, d) { d = d || 0; return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); };
  api.css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  api.active = function (slideEl) { return !!slideEl && slideEl.classList.contains('is-active'); };

  /* Charts are drawn in one of two coordinate widths: 520 when the stage is wide, 360 when it is
     narrow, so that 12-unit text never renders below about 11px. */
  api.chartW = function (el) {
    var w = el.getBoundingClientRect().width, W = w && w < 460 ? 360 : 520;
    if (el.classList) el.classList.toggle('is-narrow', W === 360);   // narrow charts use larger text classes
    return W;
  };

  /* Run a slide's draw function whenever the slide is shown, and on resize while it is shown. */
  var drawers = [];
  api.onShow = function (slideEl, fn) {
    drawers.push({ el: slideEl, fn: fn });
    if (api.active(slideEl)) fn();
  };
  document.addEventListener('slidechange', function (ev) {
    drawers.forEach(function (d) { if (d.el === ev.detail.slide) d.fn(); });
  });
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { drawers.forEach(function (d) { if (api.active(d.el)) d.fn(); }); }, 120);
  });

  /* Bet buttons record the answer, then either reveal in place (a function) or move on (a slide). */
  api.wireBets = function (slideEl, name, after) {
    var btns = slideEl.querySelectorAll('[data-bet]');
    Array.prototype.forEach.call(btns, function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-bet');
        api.bet(name, v);
        Array.prototype.forEach.call(btns, function (o) { o.classList.toggle('is-on', o === b); o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        if (typeof after === 'function') after(v);
        else if (after) setTimeout(function () { go(after); }, 220);
      });
    });
    var prev = api.getBet(name);
    if (prev) Array.prototype.forEach.call(btns, function (o) { var on = o.getAttribute('data-bet') === prev; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    return prev;
  };
})();
