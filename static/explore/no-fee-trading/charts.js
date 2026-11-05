/* Free — explorable of Galati (2024). Hand-drawn SVG chart helpers. No libraries.
   Charts are drawn at their host's pixel width (Charts.mount), so 11–13 px labels stay 11–13 px on a phone. */
(function () {
  'use strict';
  var NSVG = 'http://www.w3.org/2000/svg';
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function el(tag, attrs, children) {
    var e = document.createElementNS(NSVG, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function text(x, y, s, attrs) {
    var a = { x: x, y: y, 'font-size': 13 };
    if (attrs) for (var k in attrs) a[k] = attrs[k];
    return el('text', a, s);
  }
  function fmt(v, d) {
    if (d === undefined) d = 2;
    var s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    if (Number(s.replace(/,/g, '')) === 0) return s; // never print "−0.00"
    return (v < 0 ? '−' : '') + s;
  }
  function signed(v, d) { var s = fmt(Math.abs(v), d); return (Number(s.replace(/,/g, '')) === 0 ? '' : v >= 0 ? '+' : '−') + s; }
  function root(w, h, label) {
    return el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'img', 'aria-label': label || '' });
  }

  /* Draw into host at its pixel width and redraw when that width changes.
     draw(w) returns an <svg>. Hosts on hidden slides draw when they first get a width. */
  function mount(host, draw) {
    var lastW = -1;
    function render(force) {
      var w = Math.floor(host.clientWidth);
      if (!w || (w === lastW && force !== true)) return;
      lastW = w;
      var svg = draw(w);
      host.innerHTML = '';
      host.appendChild(svg);
    }
    render();
    if (window.ResizeObserver) new ResizeObserver(function () { render(); }).observe(host);
    else window.addEventListener('resize', function () { render(); });
    return { redraw: function () { render(true); } };
  }

  /* Two bars, before and after, on their own scale, with a zero baseline for negative values. */
  function barPair(w, o) {
    var h = o.height || 206;
    var pre = o.pre, post = o.post;
    var d = o.decimals === undefined ? 2 : o.decimals;
    if (Math.max(Math.abs(pre), Math.abs(post)) < 0.1 && d < 3) d = 3; // tiny values: keep a significant digit
    var neg = Math.min(pre, post) < 0;
    var svg = root(w, h, o.label || '');
    var padT = 60, padB = neg ? 56 : 38;          // room below negative bars for their value labels
    var maxV = Math.max(pre, post, 0), minV = Math.min(pre, post, 0);
    if (maxV === minV) maxV = minV + 1;
    var scale = (h - padT - padB) / (maxV - minV);
    function yOf(v) { return padT + (maxV - v) * scale; }
    var y0 = yOf(0);
    var barW = Math.max(26, Math.min(46, (w - 48) / 3.4)), gap = Math.round(barW * 0.7);
    var x1 = (w - (barW * 2 + gap)) / 2, x2 = x1 + barW + gap;
    svg.appendChild(text(w / 2, 16, o.title || '', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 500 }));
    if (o.sub) svg.appendChild(text(w / 2, 32, o.sub, { 'text-anchor': 'middle', 'font-size': 11, 'class': 'muted' }));
    [[x1, pre, 'before'], [x2, post, 'after']].forEach(function (b, i) {
      var v = b[1], top = Math.min(yOf(v), y0), hh = Math.max(Math.abs(yOf(v) - y0), 1);
      svg.appendChild(el('rect', i === 1
        ? { x: b[0], y: top, width: barW, height: hh, fill: o.color || 'var(--s1)', stroke: o.edge || 'none', 'stroke-width': 1 }
        : { x: b[0] + 0.5, y: top + 0.5, width: barW - 1, height: Math.max(hh - 1, 0.5), fill: 'var(--bar-pre)', stroke: 'var(--muted)', 'stroke-width': 1 }));
      var ly = v >= 0 ? top - 6 : top + hh + 14;
      svg.appendChild(text(b[0] + barW / 2, ly, fmt(v, d), { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': i === 1 ? 500 : 400 }));
      svg.appendChild(text(b[0] + barW / 2, h - 20, b[2], { 'text-anchor': 'middle', 'font-size': 11, 'class': 'muted' }));
    });
    svg.appendChild(el('line', { x1: 10, x2: w - 10, y1: y0, y2: y0, 'class': 'axis' }));
    var delta = post - pre, dl = signed(delta, d);
    if (o.pct && pre !== 0) dl += ' (' + signed(Math.round(delta / Math.abs(pre) * 100), 0) + '%)';
    svg.appendChild(text(w / 2, h - 4, dl, { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 500 }));
    return svg;
  }

  /* The maker's ledger as a waterfall, in basis points:
     the taker pays you (0 → pay), the price then moves against you (pay → pay − impact), you keep (a marker).
     o: { pay, impact, ghost (optional earlier "keep"), ghostLabel, min, max, label } */
  function waterfall(w, o) {
    var stacked = w < 480;                       // phones: labels above their bars
    var labelW = stacked ? 0 : Math.min(210, Math.round(w * 0.38));
    var rowH = stacked ? 58 : 50, top = 10;
    var h = top + rowH * 3 + 26;
    var padL = stacked ? 8 : labelW + 10, padR = 62;
    var lo = o.min === undefined ? -4 : o.min, hi = o.max === undefined ? 4 : o.max;
    var sx = (w - padL - padR) / (hi - lo);
    function X(v) { return padL + (v - lo) * sx; }
    var keep = o.pay - o.impact;
    var svg = root(w, h, o.label || '');
    for (var g = Math.ceil(lo); g <= hi; g++) {
      svg.appendChild(el('line', { x1: X(g), x2: X(g), y1: top, y2: h - 20, 'class': g === 0 ? 'ink' : 'hair', 'stroke-width': 1 }));
      if (g % 2 === 0) svg.appendChild(text(X(g), h - 6, g === 0 ? '0' : fmt(g, 0), { 'text-anchor': 'middle', 'font-size': 11, 'class': 'muted' }));
    }
    var rows = [
      { label: o.payLabel || 'The taker pays you', sub: 'effective spread', a: 0, b: o.pay, fill: 'var(--s1)', val: signed(o.pay, 2) },
      { label: o.impactLabel || 'The price then moves against you', sub: 'price impact, next 20 seconds', a: o.pay, b: keep, fill: 'var(--bar-pre)', stroke: 'var(--muted)', val: '−' + fmt(o.impact, 2) },
      { label: o.keepLabel || 'You keep', sub: 'realized spread', marker: keep, val: signed(keep, 2), bold: true }
    ];
    rows.forEach(function (r, i) {
      var y = top + i * rowH, by = stacked ? y + 26 : y + 8, bh = 18;
      if (stacked) {
        svg.appendChild(text(padL, y + 12, r.label, { 'font-size': 12, 'font-weight': r.bold ? 500 : 400, 'class': 'halo' }));
        if (padL + measure(r.label, 12) + 6 + measure(r.sub, 11) < w) svg.appendChild(text(padL + measure(r.label, 12) + 6, y + 12, r.sub, { 'font-size': 11, 'class': 'muted halo' }));
      } else {
        svg.appendChild(text(labelW - 4, y + 20, r.label, { 'text-anchor': 'end', 'font-size': 13, 'font-weight': r.bold ? 500 : 400 }));
        svg.appendChild(text(labelW - 4, y + 35, r.sub, { 'text-anchor': 'end', 'font-size': 11, 'class': 'muted' }));
      }
      var vx;
      if (r.marker === undefined) {
        var xa = X(Math.min(r.a, r.b)), xb = X(Math.max(r.a, r.b));
        svg.appendChild(el('rect', { x: xa, y: by, width: Math.max(xb - xa, 1), height: bh, fill: r.fill, stroke: r.stroke || 'none', 'stroke-width': 1 }));
        vx = Math.max(X(r.a), X(r.b));
        if (i === 0) svg.appendChild(el('line', { x1: X(r.b), x2: X(r.b), y1: by + bh, y2: by + rowH, 'class': 'ink', 'stroke-dasharray': '2 3' }));
        if (i === 1) svg.appendChild(el('line', { x1: X(r.b), x2: X(r.b), y1: by + bh, y2: by + rowH + 2, 'class': 'ink', 'stroke-dasharray': '2 3' }));
      } else {
        var cy = by + bh / 2, mx = X(r.marker), pos = r.marker >= 0;
        if (o.ghost !== undefined && Math.abs(o.ghost - r.marker) > 0.02) {
          var gx = X(o.ghost);
          svg.appendChild(el('circle', { cx: gx, cy: cy, r: 6, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '2 2' }));
          svg.appendChild(text(gx, cy + 22, o.ghostLabel || '', { 'text-anchor': 'middle', 'font-size': 11, 'class': 'muted' }));
          svg.appendChild(el('line', { x1: gx + (mx > gx ? 8 : -8), x2: mx + (mx > gx ? -10 : 10), y1: cy, y2: cy, stroke: 'var(--muted)', 'stroke-width': 1 }));
        }
        svg.appendChild(el('circle', { cx: mx, cy: cy, r: 8, fill: pos ? 'var(--gold)' : 'var(--bg)', stroke: pos ? 'var(--gold-edge)' : 'var(--text)', 'stroke-width': pos ? 1 : 1.5 }));
        vx = mx + 10;
      }
      svg.appendChild(text(Math.min(vx + 8, w - padR + 8), by + 14, r.val, { 'font-size': 12, 'font-weight': r.bold ? 500 : 400 }));
    });
    return svg;
  }

  /* Rough text width for Geist at a given size (labels only; no layout depends on it closely). */
  function measure(s, size) { return s.length * size * 0.56; }

  /* Animate t from 0 to 1 over ms, calling step(t); immediate when the reader prefers reduced motion. */
  function tween(ms, step) {
    if (REDUCED) { step(1); return; }
    var t0 = null;
    function f(ts) { if (t0 === null) t0 = ts; var t = Math.min(1, (ts - t0) / ms); step(1 - Math.pow(1 - t, 3)); if (t < 1) requestAnimationFrame(f); }
    requestAnimationFrame(f);
  }

  window.Charts = { el: el, text: text, fmt: fmt, signed: signed, root: root, mount: mount,
    barPair: barPair, waterfall: waterfall, measure: measure, tween: tween, reduced: REDUCED };
})();
