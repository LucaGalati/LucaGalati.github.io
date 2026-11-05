/* Toy block-space market used by "The thermostat" (deck 1) and the sandbox (deck 3).
   Rules follow the paper's descriptions. Posted fee (EIP-1559; manuscript p. 3 and Appendix C):
   one base fee for everyone in the block, raised when the previous block was above the target and
   lowered when below, burned; an optional tip to the miner; blocks that can stretch to twice the
   target. First price (the pre-reform design): a sealed pay-as-bid auction with a fixed block.
   Uniform price (the design the paper names as the next test, p. 44): a fixed block in which every
   included transaction pays the lowest included bid.
   How the simulated users bid and tip is ours, not the paper's. One simulated transaction stands
   for one million gas: target 15, maximum 30. Fee units are arbitrary. */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function randn(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function poisson(r, lam) {
    if (lam <= 0) return 0;
    if (lam > 60) return Math.max(0, Math.round(lam + Math.sqrt(lam) * randn(r)));
    var L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  }

  // Users: a value v for getting in, an urgency u, and a guessing error e (the estimation burden).
  function Stream(seed) { this.r = mulberry32(seed || 7); this.pendingBurst = 0; }
  Stream.prototype.burst = function (n) { this.pendingBurst += n; };
  Stream.prototype.next = function (p) {
    var n = poisson(this.r, p.demand) + this.pendingBurst;
    this.pendingBurst = 0;
    var users = [];
    for (var i = 0; i < n; i++) users.push({ v: p.valueMedian * Math.exp(p.valueSigma * randn(this.r)), u: this.r(), e: randn(this.r) });
    return users;
  };

  // What a user bids in the sealed auction: a noisy guess of the clearing price, marked up for urgency
  // and for every block already waited.
  function auctionBid(x, level, p) { return level * Math.exp(p.guess * x.e) * (1 + p.markup * x.u) * (1 + 0.3 * x.waited); }

  function Market(regime) { this.regime = regime; this.reset(); }   // 'firstprice' | 'posted' | 'uniform'
  Market.prototype.reset = function () { this.base = 1; this.est = 1; this.queue = []; this.history = []; this.axis = {}; };

  /* One block. `ref` is the sealed auction's current clearing estimate, used by posted-fee users
     who keep bidding as before (p.habit): they tip what they would have bid in the old auction. */
  Market.prototype.step = function (newUsers, p, ref) {
    var q = this.queue;
    for (var i = 0; i < newUsers.length; i++) q.push({ v: newUsers[i].v, u: newUsers[i].u, e: newUsers[i].e, waited: 0 });
    var T = p.target, cap, inc, fees, rec;

    if (this.regime === 'posted') {
      cap = Math.round(T * p.elasticity);
      var b = this.base, habit = p.habit && ref > 0;
      var eligible = q.filter(function (x) { return x.v >= b; });
      eligible.forEach(function (x) {
        var want = habit ? auctionBid(x, ref, p) : p.tipBase * b * (0.2 + x.u) * (1 + 0.35 * x.waited);
        x.tip = Math.min(Math.max(0, x.v - b), want);
      });
      eligible.sort(function (a, c) { return c.tip - a.tip; });
      inc = eligible.slice(0, cap);
      fees = inc.map(function (x) { return b + x.tip; });
      rec = { price: b, burned: b * inc.length, toMiner: inc.reduce(function (s, x) { return s + x.tip; }, 0) };
      this.base = Math.max(0.05, b * (1 + p.step * (inc.length - T) / T));
    } else if (this.regime === 'firstprice') {
      cap = T;
      var est = this.est;
      q.forEach(function (x) { x.bid = Math.min(x.v, Math.max(0.02, auctionBid(x, est, p))); });
      inc = q.slice().sort(function (a, c) { return c.bid - a.bid; }).slice(0, cap);
      fees = inc.map(function (x) { return x.bid; });
      var full = inc.length >= cap, clear = full ? inc[inc.length - 1].bid : 0;
      rec = { price: full ? clear : est, burned: 0, toMiner: fees.reduce(function (s, x) { return s + x; }, 0) };
      this.est = full ? Math.max(0.02, clear) : Math.max(0.02, est * 0.8);
    } else {
      cap = T;
      inc = q.slice().sort(function (a, c) { return c.v - a.v; }).slice(0, cap);   // in this toy, users bid their value
      var price = inc.length ? inc[inc.length - 1].v : 0;
      fees = inc.map(function () { return price; });
      rec = { price: price, burned: 0, toMiner: price * inc.length };
    }

    var incSet = new Set(inc);
    this.queue = q.filter(function (x) { return !incSet.has(x); });
    this.queue.forEach(function (x) { x.waited++; });
    this.queue = this.queue.filter(function (x) { return x.waited <= p.patience; });

    rec.used = inc.length; rec.cap = cap; rec.target = T; rec.subsidy = p.subsidy;
    if (fees.length) {
      rec.low = Math.min.apply(null, fees); rec.high = Math.max.apply(null, fees);
      rec.avg = fees.reduce(function (s, x) { return s + x; }, 0) / fees.length;
      rec.disp = rec.high - rec.low;
      rec.minerPerTx = (rec.toMiner + p.subsidy) / fees.length;
      rec.subsidyPerTx = p.subsidy / fees.length;
    } else {
      rec.low = rec.high = rec.avg = rec.disp = rec.minerPerTx = rec.subsidyPerTx = 0;
    }
    rec.queue = this.queue.length;
    this.history.push(rec);
    if (this.history.length > 400) this.history.shift();
    return rec;
  };

  // Averages over the last n blocks. Swing: mean absolute change in the log of the posted or
  // clearing price from one block to the next (the block-level cousin of the paper's day-to-day measure).
  Market.prototype.stats = function (n) {
    var h = this.history.slice(-n), k = h.length || 1, s = { avg: 0, disp: 0, used: 0, queue: 0, miner: 0, subsidy: 0, swing: 0, n: h.length };
    h.forEach(function (r, i) {
      s.avg += r.avg; s.disp += r.disp; s.used += r.used; s.queue += r.queue; s.miner += r.minerPerTx; s.subsidy += r.subsidyPerTx;
      if (i) s.swing += Math.abs(Math.log(Math.max(r.price, 1e-3) / Math.max(h[i - 1].price, 1e-3)));
    });
    s.avg /= k; s.disp /= k; s.used /= k; s.queue /= k; s.miner /= k; s.subsidy /= k; s.swing /= Math.max(1, h.length - 1);
    return s;
  };

  // ---------- a steady axis: grows at once, shrinks only after a sustained fall ----------
  function nice(x) {
    if (!(x > 0)) return 1;
    var k = Math.pow(10, Math.floor(Math.log(x) / Math.LN10)), m = x / k, steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) if (m <= steps[i] + 1e-9) return steps[i] * k;
    return 10 * k;
  }
  function axisMax(state, cur) {
    var t = nice(Math.max(cur * 1.1, 0.2));
    if (!state.max || t > state.max) { state.max = t; state.low = 0; }
    else if (cur * 1.1 < 0.4 * state.max) { state.low = (state.low || 0) + 1; if (state.low > 30) { state.max = t; state.low = 0; } }
    else state.low = 0;
    return state.max;
  }
  // The axis follows the prices and the average fee paid; a single dear transaction does not set it
  // (block ranges taller than the axis are clipped at its top).
  function peak(market, n) {
    var m = 0;
    market.history.slice(-n).forEach(function (r) { m = Math.max(m, r.price, r.avg || 0); });
    return m;
  }

  // ---------- drawing, in real CSS pixels so text stays 11px at any width ----------
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function setup(canvas, W, H) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas._w !== W || canvas._h !== H || canvas._dpr !== dpr) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.height = H + 'px';
      canvas._w = W; canvas._h = H; canvas._dpr = dpr;
    }
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /* Two stacked panels: the price (base fee, clearing or uniform price; the average fee paid; the
     lowest-to-highest range in each block) and the block's use against its target and maximum.
     The newest block is always drawn at the right edge, next to "latest". */
  function draw(canvas, market, opts) {
    opts = opts || {};
    var W = Math.round(canvas.getBoundingClientRect().width);
    if (!W) return;
    var H = opts.height || 300, compact = !!opts.compact;
    var ctx = setup(canvas, W, H);
    var col = { line: css('--eth'), gold: css('--gold'), muted: css('--muted'), border: css('--border-strong'), text: css('--text') };
    ctx.clearRect(0, 0, W, H);
    var N = compact ? 60 : 80, h = market.history.slice(-N), off = N - h.length;
    var padL = compact ? 30 : 38, padR = 8, padT = 18, gap = 26, padB = 18;
    var priceH = Math.round((H - padT - gap - padB) * 0.56), useTop = padT + priceH + gap, useH = H - useTop - padB;
    var xw = (W - padL - padR) / N;
    function xc(i) { return padL + (off + i + 0.5) * xw; }
    ctx.font = '11px Geist, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    // price panel
    var pmax = opts.pmax || market.axis.max || axisMax(market.axis, peak(market, N));
    var py = function (v) { return padT + priceH - (Math.min(v, pmax) / pmax) * priceH; };
    ctx.strokeStyle = col.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT + priceH + 0.5); ctx.lineTo(W - padR, padT + priceH + 0.5); ctx.stroke();
    ctx.fillStyle = col.muted; ctx.textAlign = 'right';
    [0, 0.5, 1].forEach(function (f) { ctx.fillText(String(+(pmax * f).toFixed(2)), padL - 5, py(pmax * f)); });
    ctx.textAlign = 'left';
    ctx.fillText(opts.priceLabel || (market.regime === 'posted' ? 'base fee' : 'clearing price'), padL, padT - 10);

    ctx.strokeStyle = col.border; ctx.lineWidth = 1;   // lowest-to-highest fee in each block
    h.forEach(function (r, i) {
      if (!r.used || r.high - r.low < 1e-9) return;
      var x = Math.round(xc(i)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, py(r.low)); ctx.lineTo(x, py(r.high)); ctx.stroke();
    });
    ctx.strokeStyle = col.line; ctx.lineWidth = 1.8; ctx.beginPath();   // the price
    h.forEach(function (r, i) { var x = xc(i), y = py(r.price); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    ctx.fillStyle = col.gold; ctx.strokeStyle = col.line; ctx.lineWidth = 0.75;   // average fee paid
    h.forEach(function (r, i) {
      if (!r.used) return;
      ctx.beginPath(); ctx.arc(xc(i), py(r.avg), 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });

    // block-use panel
    var cap = h.length ? h[h.length - 1].cap : 30, target = h.length ? h[h.length - 1].target : 15;
    var umax = Math.max(cap, target * 2) * 1.08;
    var uy = function (v) { return useTop + useH - (v / umax) * useH; };
    ctx.fillStyle = col.muted; ctx.textAlign = 'left';
    ctx.fillText('transactions in block', padL, useTop - 10);
    ctx.fillStyle = col.line;
    h.forEach(function (r, i) {
      var x = padL + (off + i) * xw + 0.5, bw = Math.max(1, xw - 1);
      ctx.fillRect(x, uy(r.used), bw, useTop + useH - uy(r.used));
    });
    ctx.strokeStyle = col.gold; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, uy(target)); ctx.lineTo(W - padR, uy(target)); ctx.stroke();
    if (cap !== target) {
      ctx.setLineDash([3, 3]); ctx.strokeStyle = col.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, uy(cap) + 0.5); ctx.lineTo(W - padR, uy(cap) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = col.muted; ctx.textAlign = 'right';
    ctx.fillText('0', padL - 5, uy(0));
    ctx.fillText(String(target), padL - 5, uy(target));
    if (cap !== target) ctx.fillText(String(cap), padL - 5, uy(cap));
    ctx.strokeStyle = col.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, useTop + useH + 0.5); ctx.lineTo(W - padR, useTop + useH + 0.5); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillText('older blocks', padL, H - 7);
    ctx.textAlign = 'right'; ctx.fillText('latest', W - padR, H - 7);
  }

  window.FeeMarket = {
    Stream: Stream, Market: Market, draw: draw, axisMax: axisMax, peak: peak,
    defaults: function () {
      return { demand: 18, target: 15, elasticity: 2, step: 0.125, tipBase: 0.08, markup: 0.5, guess: 0.35,
               habit: false, subsidy: 20, patience: 6, valueMedian: 2, valueSigma: 0.6 };
    }
  };
})();
