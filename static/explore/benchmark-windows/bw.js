/* Shared model + chrome for the "Limits to Longer Benchmark Windows" explorable.
   Model: Galati & Gaudiosi (2026), eqs. 14-25, 34, 44, 46, 70, 75, 76, 82, 86. No external requests. */
(function () {
  'use strict';

  /* ---------------- the tree ----------------
     Two main decks and one deck of side rooms. doors: slide number -> rooms it opens ('deck#sN'). */
  var TREE = [
    { id: 'fix', file: 'index.html', title: 'The fix', kind: 'main',
      slides: ['Four o’clock', 'An average over a window', 'The dealer hedges', 'Impact fades', 'So: longer is better?'],
      doors: { 2: ['behind#s3'], 3: ['behind#s1'] } },
    { id: 'limits', file: '02-limits.html', title: 'The limits', kind: 'main',
      slides: ['The price moves on its own', 'Place your bet', 'What moves the bottom', 'The dealer’s window', 'The fee', 'Four objectives, four answers', 'One window for everyone', 'Where five minutes sits'],
      doors: { 4: ['behind#s1'], 5: ['behind#s2'], 6: ['behind#s3', 'behind#s4'], 7: ['behind#s5'], 8: ['behind#s5', 'behind#s6'] } },
    { id: 'behind', file: '03-behind.html', title: 'Behind the window', kind: 'side',
      slides: ['Trading before the window', 'When the dealer adapts', 'Centre the window', 'Attainability', 'What the numbers rest on', 'Where the model stops'],
      doors: {} }
  ];
  function deckById(id) { for (var i = 0; i < TREE.length; i++) if (TREE[i].id === id) return TREE[i]; return null; }
  function deckByFile(f) { for (var i = 0; i < TREE.length; i++) if (TREE[i].file === f) return TREE[i]; return null; }

  /* ---------------- storage (always guarded) ---------------- */
  function load(key, fallback) { try { var v = window.localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
  function save(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode, blocked storage */ } }

  /* ---------------- model ----------------
     Rounded medians reported in Section 4.1: kappa ~ 0.01, lambda 0.06-0.07 (midpoint used for both currencies),
     beta 0.82 / 0.72, sigma 1.60 / 2.35. Risk settings: Table B.1 (moderate = the baseline). */
  var PRESETS = {
    GBP: { name: 'GBP/USD', kappa: 0.01, lam: 0.065, beta: 0.82, sigma: 1.60 },
    AUD: { name: 'AUD/USD', kappa: 0.01, lam: 0.065, beta: 0.72, sigma: 2.35 }
  };
  var RISK = {
    low: { gC: 0.000146, gD: 0.0123, gB: 0.00194, gA: 0.0123 },
    mid: { gC: 0.0005, gD: 0.02, gB: 0.004, gA: 0.02 },
    high: { gC: 0.000732, gD: 0.0246, gB: 0.00775, gA: 0.0246 }
  };
  var BASE = { Tp: 10, m: 25, n: 25, X: 50, gC: 0.0005, gD: 0.02, gB: 0.004, gA: 0.02, theta: 0.1 };
  var ETA_C = 2 * 50 * 2 * Math.sqrt(10 + 5 / 3); /* eq. 94-95: gamma_C x this = bp of expected cost per bp of risk */
  function params(preset, over) { var p = {}, k; for (k in BASE) p[k] = BASE[k]; for (k in preset) p[k] = preset[k]; if (over) for (k in over) p[k] = over[k]; return p; }

  function coeffs(p) {
    var m = p.m, n = p.n, Tp = p.Tp;
    return { an: (n - 1) / (2 * n), Am: Tp * (2 * m * m - 3 * m + 1) / (6 * m * m), Bn: (n + 1) * (2 * n + 1) / (6 * n * n), Cn: (n + 1) * (4 * n - 1) / (12 * n * n) };
  }
  function Hn(theta, c) { return 1 / 3 + (1 - theta) * (1 - theta) * c.Bn - 2 * (1 - theta) * c.Cn; }
  function Ap(p) { return (1 - Math.exp(-p.beta * p.Tp)) / (p.m * (1 - Math.exp(-p.beta * p.Tp / p.m))); }
  function PhiP(Tf, p) { if (Tf <= 0) return Ap(p); return Ap(p) * (1 - Math.exp(-p.beta * Tf)) / (p.beta * Tf); }
  function PhiF(Tf, p) { if (Tf <= 0) return 0; var x = p.beta * Tf / p.n; return (1 / (p.n * p.beta * Tf)) * (p.n - (1 - Math.exp(-p.beta * Tf)) / (1 - Math.exp(-x))); }
  function Psi(k, T, beta) { var s = k / 2, l; for (l = 1; l < k; l++) s += (k - l) * Math.exp(-beta * l * T / k); return s / (k * k); }
  function PsiPF(Tf, p) { if (Tf <= 0) return Ap(p); var x = p.beta * Tf / p.n; return Ap(p) * Math.exp(-x) * (1 - Math.exp(-p.beta * Tf)) / (p.n * (1 - Math.exp(-x))); }

  /* all quantities divided by X^2, as in the paper's normalised expressions; multiply by X for bp per unit traded */
  function model(Tf, theta, p) {
    var c = coeffs(p), s2 = p.sigma * p.sigma;
    var Pp = PhiP(Tf, p), Pf = PhiF(Tf, p), Phi = theta * Pp + (1 - theta) * Pf;
    var Psp = Psi(p.m, p.Tp, p.beta), Psf = Psi(p.n, Tf, p.beta), Pspf = PsiPF(Tf, p);
    var Xi = theta * theta * Psp + (1 - theta) * (1 - theta) * Psf + theta * (1 - theta) * Pspf;
    var perm = p.kappa * (theta + c.an * (1 - theta));
    var ETC = perm + p.lam * Phi;
    var VTC = s2 * (p.Tp + Tf / 3);
    var CEC = ETC + p.gC * VTC;
    var EPi = perm - p.kappa / 2 + p.lam * (Phi - Xi);
    var H = Hn(theta, c);
    var VPi = s2 * (theta * theta * c.Am + Tf * H);
    var UD = EPi - p.gD * VPi;
    var FD = Math.max(0, -UD);
    var LB = perm + p.lam * Phi + p.gB * s2 * Tf / 12;
    return { ETC: ETC, VTC: VTC, risk: p.gC * VTC, CEC: CEC, EPi: EPi, VPi: VPi, UD: UD, FD: FD, CEfee: CEC + FD, LB: LB, Phi: Phi, Xi: Xi, perm: perm, H: H };
  }
  /* the dealer's book at one window, bp per unit of the order (eq. 23 split into its parts, eq. 25 risk charge) */
  function ledger(Tf, theta, p) {
    var r = model(Tf, theta, p), c = coeffs(p), X = p.X;
    var rev = X * p.lam * r.Phi, exec = X * p.lam * r.Xi, perm = X * p.kappa * (theta + c.an * (1 - theta) - 0.5), risk = X * p.gD * r.VPi;
    return { rev: rev, exec: exec, perm: perm, risk: risk, U: rev - exec + perm - risk };
  }
  function thetaD(Tf, p) {
    var c = coeffs(p), s2 = p.sigma * p.sigma;
    var Pp = PhiP(Tf, p), Pf = PhiF(Tf, p);
    var Psp = Psi(p.m, p.Tp, p.beta), Psf = Psi(p.n, Tf, p.beta), Pspf = PsiPF(Tf, p);
    var num = p.kappa * (1 - c.an) + p.lam * (Pp - Pf + 2 * Psf - Pspf) + 2 * p.gD * s2 * Tf * (c.Bn - c.Cn);
    var den = 2 * (p.lam * (Psp + Psf - Pspf) + p.gD * s2 * (c.Am + Tf * c.Bn));
    return Math.min(1, Math.max(0, num / den));
  }
  function thetaA(Tf, p) { var c = coeffs(p); return Tf * (c.Bn - c.Cn) / (c.Am + Tf * c.Bn); }
  function trackVar(Tf, theta, p) { var c = coeffs(p); return theta * theta * c.Am + Tf * Hn(theta, c); }
  function LA(Tf, p) { var th = thetaA(Tf, p); return p.gA * p.sigma * p.sigma * trackVar(Tf, th, p); }
  function J(Tf, p, w) {
    var th = thetaD(Tf, p), r = model(Tf, th, p);
    return w[0] * r.CEfee - w[1] * Math.max(r.UD, 0) + w[2] * r.LB + w[3] * LA(Tf, p);
  }
  /* grid search on exact grid points lo + i*step (no accumulated drift) */
  function argmin(f, lo, hi, step) {
    var n = Math.round((hi - lo) / step), best = lo, bv = f(lo), i, t, v;
    for (i = 1; i <= n; i++) { t = Math.round((lo + i * step) * 1e6) / 1e6; v = f(t); if (v < bv) { bv = v; best = t; } }
    return { t: best, v: bv };
  }

  /* ---------------- randomness (seeded, so every visit draws the same market) ---------------- */
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  /* Brownian path in bp: steps of dt minutes, volatility sigma bp per sqrt-minute; path[0] = 0 */
  function bm(seed, steps, dt, sigma) { var r = rng(seed), out = new Float64Array(steps + 1), v = 0, i; for (i = 1; i <= steps; i++) { v += sigma * Math.sqrt(dt) * gauss(r); out[i] = v; } return out; }

  /* ---------------- formatting ---------------- */
  function fmt(x, d) { var p = Math.pow(10, d); return (Math.round(x * p) / p).toFixed(d); }
  function sgn(x, d) { return (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), d); }
  /* 1 bp of a £X million order is £100·X; shown to the nearest £10 below £1,000, else to the nearest £100 */
  function money(bp, X) { var v = Math.abs(bp) * (X || 50) * 100; v = v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 100) * 100; return '£' + v.toLocaleString('en-GB'); }
  function optLabel(t, lo, hi) { if (t <= lo + 1e-9) return 'the shortest'; if (t >= hi - 1e-9) return hi + ' min or longer'; return fmt(t, 1) + ' min'; }
  /* minutes relative to 4pm, as a 12-hour London clock time (3:57:30) */
  function clockLabel(min) { var s = Math.round((16 * 60 + min) * 60), h = Math.floor(s / 3600), m = Math.floor((s - h * 3600) / 60), sec = s - h * 3600 - m * 60; return (h > 12 ? h - 12 : h) + ':' + (m < 10 ? '0' : '') + m + (sec ? ':' + (sec < 10 ? '0' : '') + sec : ''); }

  /* ---------------- svg helpers ---------------- */
  var NS = 'http://www.w3.org/2000/svg', uid = 0;
  function mk(tag, attrs, parent) { var e = document.createElementNS(NS, tag), k; if (attrs) for (k in attrs) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } if (parent) parent.appendChild(e); return e; }
  function el(tag, attrs, parent) { var e = document.createElement(tag), k; if (attrs) for (k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); } if (parent) parent.appendChild(e); return e; }
  function lin(d0, d1, r0, r1) { var f = function (x) { return r0 + (x - d0) * (r1 - r0) / (d1 - d0); }; f.inv = function (y) { return d0 + (y - r0) * (d1 - d0) / (r1 - r0); }; return f; }
  function pathOf(pts) { var s = '', i; for (i = 0; i < pts.length; i++) s += (i ? 'L' : 'M') + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1); return s; }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* Text in an svg keeps its true size: --k = viewBox width / rendered width, used by the CSS font sizes. */
  var NARROW = 640;
  function narrow() { return (window.innerWidth || document.documentElement.clientWidth || 1024) < NARROW; }
  function fitText(svg) { var vb = svg.viewBox && svg.viewBox.baseVal, w = svg.clientWidth || (svg.getBoundingClientRect ? svg.getBoundingClientRect().width : 0); if (!vb || !vb.width || !w) return; svg.style.setProperty('--k', clamp(vb.width / w, 0.4, 3).toFixed(3)); }
  var ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(function (es) { es.forEach(function (e) { fitText(e.target); }); }) : null;
  if (!ro) window.addEventListener('resize', function () { Array.prototype.forEach.call(document.querySelectorAll('svg[viewBox]'), fitText); });

  /* A chart frame: axes + ticks inside an svg. o.mobile overrides o on narrow screens; o.clip clips the content
     group to the plot. Returns scales and layer groups (under, g = content, over). */
  function chart(svg, o) {
    if (o.mobile && narrow()) o = merge(o, o.mobile);
    var W = o.W || 620, H = o.H || 300, pad = o.pad || { l: 52, r: 16, t: 16, b: 34 };
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var X = lin(o.x[0], o.x[1], pad.l, W - pad.r), Y = lin(o.y[0], o.y[1], H - pad.b, pad.t);
    var g = mk('g', {}, svg), under = mk('g', {}, g), ax = mk('g', {}, g);
    if (!o.noAxes) {
      mk('line', { x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b, 'class': 'axis' }, ax);
      if (!o.noYAxis) mk('line', { x1: pad.l, x2: pad.l, y1: pad.t, y2: H - pad.b, 'class': 'axis' }, ax);
    }
    (o.xticks || []).forEach(function (t) {
      var v = typeof t === 'number' ? t : t[0], lab = typeof t === 'number' ? (o.xfmt ? o.xfmt(t) : String(t)) : t[1], x = X(v);
      var anchor = x > W - pad.r - 24 ? 'end' : (x < pad.l + 6 && o.yticks && o.yticks.length ? 'start' : 'middle');
      mk('line', { x1: x, x2: x, y1: H - pad.b, y2: H - pad.b + 4, 'class': 'axis' }, ax);
      mk('text', { x: anchor === 'end' ? Math.min(x + 4, W - 2) : x, y: H - pad.b + 17, 'text-anchor': anchor, 'class': 'lbl', text: lab }, ax);
    });
    (o.yticks || []).forEach(function (t) {
      var v = typeof t === 'number' ? t : t[0], lab = typeof t === 'number' ? (o.yfmt ? o.yfmt(t) : String(t)) : t[1];
      mk('line', { x1: pad.l - 4, x2: pad.l, y1: Y(v), y2: Y(v), 'class': 'axis' }, ax);
      mk('text', { x: pad.l - 7, y: Y(v) + 4, 'text-anchor': 'end', 'class': 'lbl', text: lab }, ax);
    });
    if (o.ylabel) mk('text', { x: pad.l + 6, y: pad.t + 4, 'text-anchor': 'start', 'class': 'lbl', text: o.ylabel }, ax);
    var content = mk('g', {}, g);
    if (o.clip) {
      var id = 'clip-' + (svg.id || 'c') + '-' + (++uid), cp = mk('clipPath', { id: id }, mk('defs', {}, svg));
      mk('rect', { x: pad.l, y: pad.t - 1, width: W - pad.l - pad.r, height: H - pad.t - pad.b + 1 }, cp);
      content.setAttribute('clip-path', 'url(#' + id + ')');
    }
    var over = mk('g', {}, g);
    if (ro) ro.observe(svg);
    fitText(svg);
    return { X: X, Y: Y, W: W, H: H, pad: pad, under: under, g: content, over: over, svg: svg, narrow: narrow(), top: pad.t, bottom: H - pad.b, left: pad.l, right: W - pad.r };
  }
  /* the dashed five-minute reference with a label at the foot of the plot */
  function five(C, label, atTop) {
    mk('line', { x1: C.X(5), x2: C.X(5), y1: C.top, y2: C.bottom, 'class': 'hair' }, C.under);
    mk('text', { x: C.X(5) + 5, y: atTop ? C.top - 7 : C.bottom - 7, 'class': 'lbl', text: label || 'five minutes' }, C.under);
  }
  /* the fix: an ink line over a gold underlay */
  function fixMark(parent) {
    var u = mk('line', { 'class': 'fix-under' }, parent), l = mk('line', { 'class': 'fix-line' }, parent);
    return { set: function (x1, x2, y) { [u, l].forEach(function (n) { n.setAttribute('x1', x1); n.setAttribute('x2', x2); n.setAttribute('y1', y); n.setAttribute('y2', y); }); },
      show: function (on) { u.style.opacity = l.style.opacity = on ? 1 : 0; } };
  }
  /* text-anchor that keeps a label inside the plot */
  function anchorFor(x, C, room) { room = room || 60; return x < C.left + room ? 'start' : (x > C.right - room ? 'end' : 'middle'); }
  /* a rebuild hook: run now, and again when the layout crosses the narrow breakpoint */
  var builders = [];
  function layout(fn) { builders.push(fn); fn(); }
  (function () {
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(max-width: ' + (NARROW - 1) + 'px)'), h = function () { builders.forEach(function (f) { f(); }); };
    if (mq.addEventListener) mq.addEventListener('change', h); else if (mq.addListener) mq.addListener(h);
  })();
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* slider binding: input[type=range] + output; calls fn(value) on input. refresh() runs it once now. */
  function bind(input, output, fn, fmtFn) {
    var h = function () { var v = parseFloat(input.value); if (output) output.textContent = fmtFn ? fmtFn(v) : v; fn(v); };
    input.addEventListener('input', h); return { refresh: h, set: function (v) { input.value = v; h(); }, input: input };
  }
  /* segmented buttons sharing one data attribute; keeps aria-pressed in step with .is-on */
  function seg(container, attr, fn) {
    var bs = Array.prototype.slice.call(container.querySelectorAll('.btn[' + attr + ']'));
    function mark(b) { bs.forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
    bs.forEach(function (b) { b.addEventListener('click', function () { mark(b); fn(b.getAttribute(attr)); }); });
    var on = bs.filter(function (b) { return b.classList.contains('is-on'); })[0]; if (on) mark(on); else bs.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    return { set: function (v) { var b = bs.filter(function (x) { return x.getAttribute(attr) === v; })[0]; if (b) mark(b); }, clear: function () { mark(null); } };
  }

  /* ---------------- deck chrome ---------------- */
  function parseFrom() {
    var m = /[?&]from=([a-z]+)\.(\d+)/.exec(location.search || ''); if (!m) return null;
    var d = deckById(m[1]), k = parseInt(m[2], 10);
    if (!d || d.kind === 'side' || !(k >= 1 && k <= d.slides.length)) return null;
    return { href: d.file + '#s' + k, label: d.title + ' · ' + d.slides[k - 1], title: d.title };
  }
  function arrowText(a, long, short) { a.innerHTML = ''; el('span', { 'class': 'l', text: long }, a); el('span', { 'class': 's', text: short || long }, a); }

  function initDeck(deckId) {
    var deck = deckById(deckId), di = TREE.indexOf(deck);
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var dotsBox = document.querySelector('.dots'), prev = document.querySelector('.nav .prev'), next = document.querySelector('.nav .next-arrow');
    var seen = load('bw.seen', {}); if (!seen || typeof seen !== 'object') seen = {};
    if (!Array.isArray(seen[deckId])) seen[deckId] = [];
    var cur = -1, dots = [], origin = deck.kind === 'side' ? parseFrom() : null;
    var prevDeck = di > 0 ? TREE[di - 1] : null, nextDeck = TREE[di + 1] || null;

    slides.forEach(function (s, k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dot';
      b.setAttribute('aria-label', 'Slide ' + (k + 1) + ' of ' + slides.length + ': ' + deck.slides[k]); b.title = deck.slides[k];
      b.addEventListener('click', function () { go(k); }); dotsBox.appendChild(b); dots.push(b);
    });

    /* side rooms: a way back to where the reader came from, and the other rooms */
    if (deck.kind === 'side') {
      slides.forEach(function (s, k) {
        var back = s.querySelector('.room-back');
        if (back) { if (origin) { back.hidden = false; back.innerHTML = ''; el('a', { 'class': 'door door--back', href: origin.href, text: 'Back to ' + origin.label }, back); } else back.hidden = true; }
        var rooms = s.querySelector('.rooms');
        if (rooms) { rooms.innerHTML = ''; el('span', { 'class': 'rooms-h', text: 'Other rooms' }, rooms);
          deck.slides.forEach(function (t, j) { if (j !== k) el('a', { href: '#s' + (j + 1), text: t }, rooms); }); }
      });
    }

    function paint() {
      dots.forEach(function (d, k) { d.classList.toggle('is-current', k === cur); d.classList.toggle('is-seen', !!seen[deckId][k] && k !== cur); if (k === cur) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
      prev.removeAttribute('aria-disabled');
      if (cur === 0) {
        if (origin) { prev.setAttribute('href', origin.href); arrowText(prev, '‹ Back to ' + origin.title, '‹ Back'); }
        else if (prevDeck) { prev.setAttribute('href', prevDeck.file + '#s' + prevDeck.slides.length); arrowText(prev, '‹ ' + prevDeck.title, '‹ Back'); }
        else { prev.setAttribute('aria-disabled', 'true'); prev.removeAttribute('href'); arrowText(prev, '‹ Previous', '‹'); }
      } else { prev.setAttribute('href', '#s' + cur); arrowText(prev, '‹ Previous', '‹'); }
      if (cur === slides.length - 1) {
        if (nextDeck) { next.setAttribute('href', nextDeck.file + '#s1'); arrowText(next, (nextDeck.kind === 'side' ? 'Side rooms' : nextDeck.title) + ' ›', 'Next ›'); }
        else { next.setAttribute('href', '../../publication/benchmark-windows/'); arrowText(next, 'Back to the paper ›', 'Paper ›'); }
      } else { next.setAttribute('href', '#s' + (cur + 2)); arrowText(next, 'Next ›', 'Next ›'); }
    }
    function go(k, keepScroll) {
      if (k < 0 || k >= slides.length) return;
      if (cur >= 0 && cur !== k) slides[cur].classList.remove('is-active');
      cur = k; slides[k].classList.add('is-active');
      seen[deckId][k] = true; save('bw.seen', seen); save('bw.pos.' + deckId, k);
      try { history.replaceState(null, '', '#s' + (k + 1)); } catch (e) { /* file:// in some browsers */ }
      if (!keepScroll) window.scrollTo(0, 0);
      paint();
      slides[k].dispatchEvent(new CustomEvent('bw:enter', { bubbles: false }));
    }
    function fromHash() { var m = /^#s(\d+)$/.exec(location.hash); return m ? parseInt(m[1], 10) - 1 : -1; }

    /* every in-page and cross-deck link; cross-deck links into the side rooms carry where the reader came from */
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button > 0) return;
      var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
      var href = a.getAttribute('href'), m = /^#s(\d+)$/.exec(href);
      if (m) { var k = parseInt(m[1], 10) - 1; if (k >= 0 && k < slides.length) { e.preventDefault(); closeMap(true); go(k); } return; }
      m = /^([\w-]+\.html)(?:\?[^#]*)?(#s\d+)?$/.exec(href); if (!m) return;
      var tgt = deckByFile(m[1]); if (!tgt) return;
      if (tgt.id === deckId) { e.preventDefault(); closeMap(true); go(m[2] ? parseInt(m[2].slice(2), 10) - 1 : cur); return; }
      if (tgt.kind === 'side' && deck.kind !== 'side') a.setAttribute('href', m[1] + '?from=' + deckId + '.' + (cur + 1) + (m[2] || ''));
    }, true);
    window.addEventListener('hashchange', function () { var k = fromHash(); if (k >= 0 && k !== cur) go(k); });

    /* ---- map overlay: a dialog over the page; the site bar stays above it and usable (its Map button toggles it), so not aria-modal ---- */
    var map = document.createElement('div'), closeBtn = null, mapBtn = document.querySelector('.map-btn');
    map.className = 'map'; map.hidden = true; map.setAttribute('role', 'dialog'); map.setAttribute('aria-labelledby', 'map-title');
    document.body.appendChild(map);
    var bg = [document.querySelector('main'), document.querySelector('footer.nav')];
    if (mapBtn) mapBtn.setAttribute('aria-expanded', 'false');
    function opensFrom(target) {
      var out = [];
      TREE.forEach(function (d) { Object.keys(d.doors).forEach(function (sk) { d.doors[sk].forEach(function (t) { if (t === target) out.push({ d: d, k: parseInt(sk, 10) }); }); }); });
      return out;
    }
    function buildMap() {
      map.innerHTML = '';
      var inner = el('div', { 'class': 'map-inner' }, map), head = el('div', { 'class': 'map-head' }, inner);
      el('h2', { id: 'map-title', text: 'Map' }, head);
      closeBtn = el('button', { 'class': 'btn', type: 'button', text: 'Close' }, head); closeBtn.addEventListener('click', function () { closeMap(); });
      el('p', { 'class': 'map-sub', text: 'The main path runs through two short decks. Side rooms open from the doors along it, and each room links back to where you came from.' }, inner);
      var grid = el('div', { 'class': 'map-grid' }, inner);
      TREE.forEach(function (d, j) {
        var box = el('section', { 'class': 'map-deck' + (d.kind === 'side' ? ' map-side' : '') + (d.id === deckId ? ' is-here' : '') }, grid);
        var h = el('h3', {}, box);
        el('a', { href: d.file, title: 'Open where you left it', text: d.kind === 'side' ? 'Side rooms · ' + d.title : 'Part ' + (j + 1) + ' · ' + d.title }, h);
        var ol = el('ol', {}, box);
        d.slides.forEach(function (t, k) {
          var isCur = d.id === deckId && k === cur, isSeen = !!(seen[d.id] && seen[d.id][k]);
          var li = el('li', { 'class': (isCur ? 'is-current' : '') + (isSeen ? ' is-seen' : '') }, ol);
          el('span', { 'class': 'm', 'aria-hidden': 'true' }, li);
          var a = el('a', { href: d.file + '#s' + (k + 1), text: (k + 1) + '. ' + t }, li);
          if (isCur) { a.setAttribute('aria-current', 'page'); el('span', { 'class': 'here', text: 'you are here' }, li); }
          (d.doors[k + 1] || []).forEach(function (t2) { var p = t2.split('#'), td = deckById(p[0]), tk = parseInt(p[1].slice(1), 10); el('a', { 'class': 'map-door', href: td.file + '#s' + tk, text: td.slides[tk - 1] }, li); });
          if (d.kind === 'side') { var fr = opensFrom(d.id + '#s' + (k + 1)); if (fr.length) el('span', { 'class': 'd', text: 'opens from ' + fr.map(function (f) { return f.d.title + ' ' + f.k; }).join(', ') }, li); }
        });
      });
      el('div', { 'class': 'map-legend', html: '<span class="m c"></span>you are here <span class="m s"></span>seen <span class="m"></span>not yet <span class="dl"></span>door to a side room · <b>m</b> opens and closes this map, <b>Esc</b> closes it, arrow keys move between slides.' }, inner);
    }
    function openMap() {
      buildMap(); map.hidden = false; if (mapBtn) mapBtn.setAttribute('aria-expanded', 'true');
      bg.forEach(function (n) { if (n) { n.inert = true; n.setAttribute('aria-hidden', 'true'); } });
      if (closeBtn) closeBtn.focus();
    }
    function closeMap(silent) {
      if (map.hidden) return; map.hidden = true; if (mapBtn) mapBtn.setAttribute('aria-expanded', 'false');
      bg.forEach(function (n) { if (n) { n.inert = false; n.removeAttribute('aria-hidden'); } });
      if (!silent && mapBtn) mapBtn.focus();
    }
    if (mapBtn) mapBtn.addEventListener('click', function () { if (map.hidden) openMap(); else closeMap(); });

    function back() { if (cur > 0) go(cur - 1); else if (origin) location.href = origin.href; else if (prev.getAttribute('href') && prev.getAttribute('aria-disabled') !== 'true') location.href = prev.getAttribute('href'); }
    function fwd() { if (cur < slides.length - 1) go(cur + 1); else location.href = next.getAttribute('href'); }
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target || {}, tag = t.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && t.type !== 'range') || t.isContentEditable) return;
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); if (map.hidden) openMap(); else closeMap(); return; }
      if (!map.hidden) { if (e.key === 'Escape') { e.preventDefault(); closeMap(); } return; }
      if (tag === 'INPUT' && /^Arrow/.test(e.key)) return;            /* sliders own their arrows */
      if (t.closest && t.closest('[data-own-keys]')) return;           /* so do widgets that say so */
      if (e.key === 'ArrowRight') { e.preventDefault(); fwd(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    });

    var start = fromHash(); if (start < 0) start = load('bw.pos.' + deckId, 0);
    if (typeof start !== 'number' || !(start >= 0 && start < slides.length)) start = 0;
    go(start);
    /* the browser's own fragment scroll runs after this script; keep the slide top under the site bar */
    window.addEventListener('load', function () { requestAnimationFrame(function () { window.scrollTo(0, 0); }); });
    return { go: go, current: function () { return cur; } };
  }

  window.BW = { TREE: TREE, PRESETS: PRESETS, RISK: RISK, BASE: BASE, ETA_C: ETA_C, params: params, coeffs: coeffs, Hn: Hn, PhiP: PhiP, PhiF: PhiF, model: model, ledger: ledger,
    thetaD: thetaD, thetaA: thetaA, trackVar: trackVar, LA: LA, J: J, argmin: argmin, rng: rng, gauss: gauss, bm: bm,
    mk: mk, el: el, lin: lin, pathOf: pathOf, fmt: fmt, sgn: sgn, money: money, optLabel: optLabel, clockLabel: clockLabel, clamp: clamp,
    chart: chart, five: five, fixMark: fixMark, anchorFor: anchorFor, layout: layout, narrow: narrow, reduced: reduced, fitText: fitText,
    bind: bind, seg: seg, initDeck: initDeck, load: load, save: save };
})();
