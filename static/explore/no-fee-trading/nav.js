/* Free — explorable of Galati (2024). Deck navigation, progress, map. No external requests. */
(function () {
  'use strict';

  var DECKS = [
    { file: 'index.html', key: '01-free', title: 'The gift',
      slides: ['The gift', 'Two bills', 'Place your bet', 'Three parties'] },
    { file: '02-experiment.html', key: '02-experiment', title: 'The experiment',
      slides: ['Before and after is not enough', 'Two weeks, split at the switch', 'Ten measures, four markets', 'What the regression adds', 'What this design cannot rule out'] },
    { file: '03-maker.html', key: '03-maker', title: 'The maker’s quote',
      slides: ['Two spreads', 'What a market maker earns', 'The saving', 'Set the quote', 'Why no rival undercut them'] },
    { file: '04-murky.html', key: '04-murky', title: 'Murky',
      slides: ['What the exchange got', 'What zero fees bought', 'What theory got wrong', 'No rule to break', 'Open questions'] }
  ];
  var NS = 'explore:no-fee-trading:';

  function load(k) { try { var v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* storage unavailable: progress lasts for this visit only */ } }

  var deckKey = document.body.getAttribute('data-deck');
  var deck = DECKS.filter(function (d) { return d.key === deckKey; })[0] || DECKS[0];
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var total = slides.length;
  var state = load(deck.key);
  if (!state || !Array.isArray(state.seen)) state = { slide: 1, seen: [] };
  var current = 0;
  var listeners = [];

  // ---------- chrome: the Map button sits in every page's <lg-sitebar>; the bottom bar is added here ----------
  var mapBtn = document.querySelector('[data-map-open]');

  var bottom = document.createElement('nav');
  bottom.className = 'bottombar';
  bottom.setAttribute('aria-label', 'Slides in this deck');
  var prev = document.createElement('button');
  prev.type = 'button'; prev.className = 'navbtn'; prev.textContent = '← Previous';
  var next = document.createElement('button');
  next.type = 'button'; next.className = 'navbtn'; next.textContent = 'Next →';
  var dots = document.createElement('div');
  dots.className = 'dots';
  var dotEls = slides.map(function (s, i) {
    var d = document.createElement('button');
    d.type = 'button'; d.className = 'dot';
    d.setAttribute('aria-label', 'Slide ' + (i + 1) + ' of ' + total + ': ' + (deck.slides[i] || ''));
    d.addEventListener('click', function () { go(i); });
    dots.appendChild(d);
    return d;
  });
  bottom.appendChild(prev); bottom.appendChild(dots); bottom.appendChild(next);
  document.body.appendChild(bottom);
  prev.addEventListener('click', function () { go(current - 1); });
  next.addEventListener('click', function () { go(current + 1); });

  // ---------- map ----------
  var map = document.createElement('div');
  map.className = 'map'; map.setAttribute('role', 'dialog'); map.setAttribute('aria-label', 'Map of the explorable');
  document.body.appendChild(map);

  function setInert(on) {
    Array.prototype.forEach.call(document.body.children, function (n) {
      if (n === map || n.tagName === 'SCRIPT' || n.tagName === 'LG-SITEBAR') return; // the site bar stays usable over the map
      if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert');
    });
  }
  function isOpen() { return map.classList.contains('is-open'); }
  function mapOpen() {
    renderMap();
    map.classList.add('is-open');
    setInert(true);
    mapBtn.setAttribute('aria-expanded', 'true');
    map.querySelector('[data-map-close]').focus();
    var here = map.querySelector('.map-slide.is-current');
    if (here && here.scrollIntoView) here.scrollIntoView({ block: 'center' });
  }
  function mapClose() {
    if (!isOpen()) return;
    map.classList.remove('is-open');
    setInert(false);
    mapBtn.setAttribute('aria-expanded', 'false');
    mapBtn.focus();
  }
  mapBtn.setAttribute('aria-expanded', 'false');
  mapBtn.addEventListener('click', function () { if (isOpen()) mapClose(); else mapOpen(); }); // the site bar stays live over the map, so its Map button toggles like m

  function renderMap() {
    var seenAll = {};
    DECKS.forEach(function (d) { var s = d.key === deck.key ? state : load(d.key); seenAll[d.key] = s && Array.isArray(s.seen) ? s.seen : []; });

    // the tree on the price line: the first deck branches to the other three, and the branches rejoin
    var W = 1000, H = 216, base = 108;
    var pos = [[100, base], [400, 62], [610, 160], [880, base]];
    var above = [false, true, false, false];
    var edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    var svg = '<svg class="map-tree" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">';
    svg += '<line class="hair" x1="20" y1="' + base + '" x2="980" y2="' + base + '"/>';
    edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]], mx = (a[0] + b[0]) / 2;
      svg += '<path d="M' + a[0] + ' ' + a[1] + ' C ' + mx + ' ' + a[1] + ', ' + mx + ' ' + b[1] + ', ' + b[0] + ' ' + b[1] + '" fill="none" class="axis"/>';
    });
    DECKS.forEach(function (d, i) {
      var p = pos[i], here = d.key === deck.key, seen = seenAll[d.key], n = d.slides.length;
      var ty = above[i] ? p[1] - 36 : p[1] + 32, dy = above[i] ? p[1] - 22 : p[1] + 46;
      svg += '<a href="' + d.file + '" tabindex="-1">';
      svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="' + (here ? 'var(--gold)' : 'var(--bg)') + '" stroke="' + (here ? 'var(--on-gold)' : 'var(--text)') + '" stroke-width="1"/>';
      svg += '<text x="' + p[0] + '" y="' + ty + '" text-anchor="middle" font-size="15" font-weight="500">' + d.title + '</text>';
      for (var s = 0; s < n; s++) {
        var cx = p[0] + (s - (n - 1) / 2) * 12, cur = here && s === current;
        svg += '<circle cx="' + cx + '" cy="' + dy + '" r="3.5" fill="' + (cur ? 'var(--gold)' : seen[s] ? 'var(--muted)' : 'none') + '" stroke="' + (cur ? 'var(--on-gold)' : 'var(--muted)') + '" stroke-width="1"/>';
      }
      svg += '</a>';
    });
    svg += '</svg>';

    var grid = '<div class="map-grid">';
    DECKS.forEach(function (d, di) {
      grid += '<div class="map-deck' + (d.key === deck.key ? ' is-here' : '') + '"><h3><small>Deck ' + (di + 1) + '</small><a href="' + d.file + '">' + d.title + '</a></h3>';
      d.slides.forEach(function (t, si) {
        var cls = 'map-slide', note = '';
        if (seenAll[d.key][si]) { cls += ' is-seen'; note = ', seen'; }
        if (d.key === deck.key && si === current) { cls += ' is-current'; note = ', you are here'; }
        grid += '<a class="' + cls + '" href="' + d.file + '#' + (si + 1) + '"' + (note === ', you are here' ? ' aria-current="page"' : '') + '><span class="mk" aria-hidden="true"></span><span class="n">' + (si + 1) + '</span><span>' + t + '<span class="sr">' + note + '</span></span></a>';
      });
      grid += '</div>';
    });
    grid += '</div>';

    map.innerHTML =
      '<div class="map-inner">' +
      '<div class="map-head"><h2>Map</h2><button type="button" class="navbtn" data-map-close>Close <span class="muted">(Esc)</span></button></div>' +
      '<p class="map-legend"><span><span class="mk"></span>not yet seen</span><span><span class="mk seen"></span>seen</span><span><span class="mk here"></span>you are here</span><span>Four short decks. Start anywhere; the paths rejoin.</span></p>' +
      svg + grid +
      '<div class="map-foot"><a href="../../publication/no-fee-trading/">← Back to the paper</a><span>Keys: ← → move, m map, Esc close.</span></div>' +
      '</div>';
    map.querySelector('[data-map-close]').addEventListener('click', mapClose);
    // links into this deck move the slide in place instead of reloading the page
    Array.prototype.forEach.call(map.querySelectorAll('a[href^="' + deck.file + '"]'), function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var n = parseInt(a.getAttribute('href').split('#')[1], 10);
        mapClose();
        if (n >= 1) go(n - 1);
      });
    });
  }

  // ---------- slide control ----------
  function go(n, opts) {
    if (n < 0 || n >= total) return;
    current = n;
    slides.forEach(function (s, i) {
      var on = i === n;
      s.classList.toggle('is-current', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    state.seen[n] = true;
    state.slide = n + 1;
    dotEls.forEach(function (d, i) {
      d.classList.toggle('is-current', i === n);
      d.classList.toggle('is-seen', i !== n && !!state.seen[i]);
      if (i === n) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    prev.disabled = n === 0;
    next.disabled = n === total - 1;
    save(deck.key, state);
    if (!(opts && opts.silent)) {
      try { history.replaceState(null, '', '#' + (n + 1)); } catch (e) { /* file:// in some browsers */ }
    }
    window.scrollTo(0, 0);
    listeners.forEach(function (fn) { fn(n); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts (Back, tabs) alone
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); mapClose(); return; }
    var t = e.target, tag = (t && t.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); if (isOpen()) mapClose(); else mapOpen(); return; }
    if (isOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(current - 1); }
  });
  window.addEventListener('hashchange', function () {
    mapClose();
    var h = parseInt((location.hash || '').replace('#', ''), 10);
    if (h >= 1 && h <= total && h - 1 !== current) go(h - 1, { silent: true });
  });
  // in-deck doors: <a href="#3" data-go="3">
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); go(parseInt(a.getAttribute('data-go'), 10) - 1); });
  });

  // ---------- start: an explicit #n wins; otherwise resume where the reader left this deck ----------
  var start = parseInt((location.hash || '').replace('#', ''), 10);
  if (!(start >= 1 && start <= total)) start = state.slide >= 1 && state.slide <= total ? state.slide : 1;
  go(start - 1, { silent: !location.hash });

  window.Explore = {
    go: function (n) { go(n - 1); },
    onShow: function (fn) { listeners.push(fn); fn(current); },
    get: function (name) { return load(deck.key + ':' + name); },
    set: function (name, v) { save(deck.key + ':' + name, v); }
  };
})();
