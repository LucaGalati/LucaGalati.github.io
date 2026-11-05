#!/usr/bin/env node
// Probe for the explore pages of lucagalati.com. Loads every page of ONE explorable from disk in
// headless Chrome at four viewport sizes, walks its slides with the right-arrow key, opens the map
// with "m", and checks that the site bar (static/explore/sitebar.js) is present and that nothing sits
// under it, overflows sideways or falls off the bottom. It then sweeps every page from 320 to 1440px
// wide and checks that the items of the bar fit and do not touch. No dependencies: Node >= 22 and
// Google Chrome.
//
//   node probe.mjs <path to static/explore/<slug>> [--out <dir>] [--viewports d,w,m,s]
//                  [--record <metrics.json>] [--baseline <metrics.json>] [--no-bar]
//
// --no-bar      skip the site-bar checks (used to record the metrics of a page before the bar goes in)
// --record      write the vertical overflow of every state to a JSON file
// --baseline    compare the vertical overflow with a recorded file and warn where a slide that fitted
//               the desktop viewport now scrolls
// Exit code 1 when there is at least one ERROR. Screenshots and report.json go to --out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(args[0] || '.');
if (!args[0] || !fs.existsSync(path.join(dir, 'index.html'))) {
  console.error('usage: node probe.mjs <explorable folder with index.html> [--out dir] [--viewports d,w,m,s] [--record f] [--baseline f] [--no-bar]');
  process.exit(2);
}
const slug = path.basename(dir);
const OUT = path.resolve(opt('--out', path.join(os.tmpdir(), 'explore-probe-' + slug)));
fs.mkdirSync(OUT, { recursive: true });
const NO_BAR = args.includes('--no-bar');
const baseline = opt('--baseline') && fs.existsSync(opt('--baseline')) ? JSON.parse(fs.readFileSync(opt('--baseline'), 'utf8')) : null;
const VPS = { d: [1280, 800, false], w: [1440, 900, false], m: [390, 844, true], s: [320, 568, true] };
const vps = opt('--viewports', 'd,w,m,s').split(',').filter(v => VPS[v]);
const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'))
  .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

const errors = [], warnings = [], metrics = {};
const err = (where, what) => { const s = `${where}: ${what}`; if (!errors.includes(s)) errors.push(s); };
const warn = (where, what) => { const s = `${where}: ${what}`; if (!warnings.includes(s)) warnings.push(s); };

// ---- static: the two lines every page needs
if (!NO_BAR) for (const f of pages) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!/<script\s+src="\.\.\/sitebar\.js"\s*><\/script>/.test(html.split(/<\/head>/i)[0])) err(f, 'no <script src="../sitebar.js"></script> in <head> (plain tag, no defer or async)');
  if (!/<body[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*<lg-sitebar[\s>]/i.test(html)) err(f, '<lg-sitebar></lg-sitebar> is not the first element of <body>');
}

// ---- headless Chrome over the DevTools protocol
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'explore-probe-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run',
  '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
const quit = code => { try { chrome.kill(); } catch (e) {} try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(code); };
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  const t = setTimeout(() => rej(new Error('Chrome did not start: ' + buf.slice(-300))), 30000);
  chrome.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
  chrome.on('exit', c => { clearTimeout(t); rej(new Error('Chrome exited with ' + c + ': ' + buf.slice(-300))); });
}).catch(e => { console.error(String(e)); quit(2); });

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0, onLoad = null;
const pending = new Map(), consoleErrors = [], requests = [];
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); return; }
  if (d.method === 'Page.loadEventFired' && onLoad) onLoad();
  else if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url);
  else if (d.method === 'Runtime.exceptionThrown') consoleErrors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') consoleErrors.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
  else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') consoleErrors.push(d.params.args.map(a => a.value ?? a.description).join(' '));
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
for (const d of ['Page', 'Runtime', 'Log', 'Network']) await send(d + '.enable', {}, S);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, S);

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function go(url) {
  const loaded = new Promise(r => { onLoad = r; });
  await send('Page.navigate', { url }, S);
  await Promise.race([loaded, sleep(8000)]);
  onLoad = null;
  await sleep(450);
  await ev('document.fonts ? document.fonts.ready.then(() => 1) : 1');
}
async function key(k, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : undefined }, S);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }, S);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, S);
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
}

// ---- runs inside the page
function CHECK(o) {
  const BAR = 40, issues = [], bar = document.querySelector('lg-sitebar');
  const vis = el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility !== 'visible' || +s.opacity < 0.05) return false;
    for (let p = el.parentElement; p; p = p.parentElement) if (+getComputedStyle(p).opacity < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.left < innerWidth && r.right > 0;
  };
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim().length > 0);
  const desc = el => {
    const r = el.getBoundingClientRect(), c = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + c + ' at y=' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
  };
  const scrolls = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return true; } return false; };
  // scrolled above the top of its own scroll box (a map overlay, say) that starts below the bar: clipped by that box, not under the bar
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollTop > 0 && p.getBoundingClientRect().top >= BAR - 0.5) return true; } return false; };
  const active = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/;
  if (!o.noBar) {
    if (!bar) return { issues: ['no <lg-sitebar> element on the page'], overflowY: 0, sig: '', fixed: [] };
    const nav = bar.shadowRoot && bar.shadowRoot.querySelector('nav');
    if (!nav) issues.push('the site bar did not render (is ../sitebar.js loaded in <head>, before the element?)');
    else {
      const r = nav.getBoundingClientRect();
      if (Math.abs(r.top) > 0.5 || Math.abs(r.height - BAR) > 0.5 || r.width < innerWidth - 1) issues.push('the site bar is not a ' + BAR + 'px strip across the top: ' + JSON.stringify([r.left, r.top, r.width, r.height].map(Math.round)));
      if (nav.querySelectorAll('a').length < 3) issues.push('the site bar has fewer than three links');
      const top = document.elementFromPoint(Math.min(60, innerWidth / 2), 12);
      if (top !== bar) issues.push('something covers the site bar: ' + (top ? desc(top) : 'nothing there'));
    }
    // an open overlay may scroll its rows under the bar's edge, but never the control that holds the focus
    const ae = o.map && document.activeElement;
    if (ae && ae !== document.body && !bar.contains(ae)) {
      const r = ae.getBoundingClientRect();   // a focused container taller than the viewport only has to start below the bar
      if (r.top < BAR - 0.5 || (r.height <= innerHeight - BAR && r.bottom > innerHeight + 0.5)) issues.push('the focused control of the open map is not fully in view: ' + desc(ae));
    }
  }
  const fixed = [], pageScrolls = document.scrollingElement.scrollHeight > innerHeight + 1;
  for (const el of document.body.querySelectorAll('*')) {
    if ((bar && bar.contains(el)) || !vis(el)) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (s.position === 'fixed') fixed.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + (typeof el.className === 'string' ? el.className : ''));
    if (o.noBar) continue;
    if ((s.position === 'fixed' || s.position === 'sticky') && r.top < BAR - 0.5 && r.bottom > 0.5) issues.push('pinned element starts under the site bar: ' + desc(el));
    else if (scrollY === 0 && !o.scrolled && r.top < BAR - 0.5 && r.bottom > 3 && (ownText(el) || active.test(el.tagName)) && !clipped(el)) issues.push('text or control under the site bar: ' + desc(el));
    if (s.position === 'fixed' && r.bottom > innerHeight + 1 && r.top < innerHeight) issues.push('pinned element runs off the bottom of the viewport: ' + desc(el));
    if (!pageScrolls && !o.scrolled && active.test(el.tagName) && r.bottom > innerHeight + 1 && r.top < innerHeight + 300 && !scrolls(el)) issues.push('control cut off below the viewport on a page that cannot scroll: ' + desc(el));
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal overflow: page is ' + document.documentElement.scrollWidth + 'px wide in a ' + innerWidth + 'px viewport');
  const heads = [...document.querySelectorAll('h1,h2,h3')].filter(e => vis(e) && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0);
  return { issues: [...new Set(issues)], overflowY: Math.max(0, document.scrollingElement.scrollHeight - innerHeight), fixed,
    sig: location.hash + '|' + heads.map(e => e.textContent.trim().slice(0, 30)).join('|'), path: location.pathname };
}
const check = o => ev('(' + CHECK.toString() + ')(' + JSON.stringify({ noBar: NO_BAR, ...o }) + ')');

// The items of the bar (its own links and the page's children) at the current width: each inside the
// viewport and the 40px strip, none touching the next. Returns [level, message] pairs.
function BARFIT() {
  const bar = document.querySelector('lg-sitebar');
  if (!bar || !bar.shadowRoot) return [];
  const shown = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility === 'visible' && r.width > 1 && r.height > 1; };
  const name = el => (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase()) + ' "' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 16) + '"';
  const items = [...bar.shadowRoot.querySelectorAll('a'), ...[...bar.children].filter(c => c.tagName !== 'NOSCRIPT')].filter(shown)
    .map(el => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left);
  const out = [];
  items.forEach((it, i) => {
    if (it.r.right > innerWidth - 3) out.push(['ERROR', 'bar item cut off at the right edge: ' + name(it.el)]);
    if (it.r.left < 3) out.push(['ERROR', 'bar item cut off at the left edge: ' + name(it.el)]);
    if (it.r.top < -0.5 || it.r.bottom > 40.5) out.push(['ERROR', 'bar item taller than the bar: ' + name(it.el)]);
    if (it.el.scrollWidth > it.el.clientWidth + 2 && it.el.clientWidth < 72) out.push(['WARN', 'bar label cut down to ' + it.el.clientWidth + 'px, too little to read (hide it at this width): ' + name(it.el)]);
    const next = items[i + 1];
    if (next && next.r.left < it.r.right + 2) out.push(['ERROR', 'bar items overlap: ' + name(it.el) + ' and ' + name(next.el)]);
    else if (next && next.r.left < it.r.right + 11) out.push(['WARN', 'bar items closer than 11px, they read as one label: ' + name(it.el) + ' and ' + name(next.el)]);
  });
  return out;
}
const ranges = widths => { const a = [...widths].sort((x, y) => x - y), out = []; for (let i = 0; i < a.length; i++) { let j = i; while (j + 1 < a.length && a[j + 1] - a[j] <= 16) j++; out.push(a[i] === a[j] ? `${a[i]}px` : `${a[i]}-${a[j]}px`); i = j; } return out.join(', '); };

// ---- walk every page at every viewport
let states = 0;
for (const v of vps) {
  const [w, h, mobile] = VPS[v];
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }, S);
  for (const f of pages) {
    const url = pathToFileURL(path.join(dir, f)).href, at = `${v} ${w}x${h} ${f}`;
    await go(url);
    await ev('try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} 1');
    consoleErrors.length = 0;
    await go(url);
    const y0 = await ev('Math.round(scrollY)');
    if (y0 > 0 && !NO_BAR) { err(at, `the page opens scrolled by ${y0}px, its first slide starts under the bar (a fragment jump: give the slides scroll-margin-top)`); await ev('scrollTo(0, 0), 1'); await sleep(150); }
    let st = await check({});
    const home = st.path, slideKey = n => `${v}|${f}|${n}`;
    const note = (n, s) => {
      states++; metrics[slideKey(n)] = s.overflowY;
      s.issues.forEach(i => err(`${at} slide ${n}`, i));
      const b = baseline && baseline[slideKey(n)];
      if (!mobile && b != null && s.overflowY > b + 8) warn(`${at} slide ${n}`, b <= 8 ? `now scrolls by ${s.overflowY}px (it fitted the viewport before the bar)` : `scrolls by ${s.overflowY}px, was ${b}px`);
    };
    note(1, st);
    await shot(`${v}-${f.replace('.html', '')}.png`);
    // pinned things while scrolled
    if (st.overflowY > 60) {
      await ev('scrollTo(0, 400), 1'); await sleep(200);
      (await check({ scrolled: true })).issues.forEach(i => err(`${at} scrolled`, i));
      await ev('scrollTo(0, 0), 1'); await sleep(150);
    }
    // the map
    const before = st.fixed.join('\n');
    await key('m', 'KeyM', 77); await sleep(420);
    let mp = await check({ map: true });
    if (mp.fixed.join('\n') !== before || mp.sig !== st.sig) {
      mp.issues.forEach(i => err(`${at} map open`, i));
      await shot(`${v}-${f.replace('.html', '')}-map.png`);
      await key('Escape', 'Escape', 27); await sleep(300);
      if ((await check({})).fixed.join('\n') !== before) { await key('m', 'KeyM', 77); await sleep(300); }
      if ((await check({})).fixed.join('\n') !== before) { warn(at, 'the map did not close with Escape or m; page reloaded'); await go(url); }
    }
    // the slides
    let prev = (await check({})).sig, same = 0, n = 1;
    for (let i = 0; i < 40 && same < 2; i++) {
      await key('ArrowRight', 'ArrowRight', 39); await sleep(380);
      st = await check({});
      if (st.path !== home) break;                    // the deck handed over to the next page
      if (st.sig === prev) { same++; continue; }
      same = 0; prev = st.sig; n++;
      note(n, st);
      if (st.issues.length) await shot(`${v}-${f.replace('.html', '')}-slide${n}-ISSUE.png`);
    }
    [...new Set(consoleErrors)].forEach(e => err(at, 'console error: ' + String(e).split('\n')[0].slice(0, 200)));
  }
}
[...new Set(requests)].filter(u => !/^(file:|data:|about:|blob:|chrome|devtools)/.test(u)).forEach(u => err('network', 'request leaves the folder: ' + u));

// ---- the bar at every width from 320 to 1440px: the four viewports above miss what breaks in between
if (!NO_BAR) for (const f of pages) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, S);
  await go(pathToFileURL(path.join(dir, f)).href);
  const seen = new Map();
  // every 16px, plus both sides of each breakpoint the page's stylesheets and the bar declare
  const breaks = await ev(`(() => { const out = [340, 400, 480]; try { for (const sh of document.styleSheets) for (const r of sh.cssRules) if (r.media) for (const m of r.conditionText.matchAll(/(?:max|min)-width:\\s*([\\d.]+)px/g)) out.push(Math.round(+m[1])); } catch (e) {} return out; })()`);
  const widths = new Set(); for (let w = 320; w <= 1440; w += 16) widths.add(w);
  for (const b of breaks) for (const w of [b - 1, b, b + 1]) if (w >= 320 && w <= 1440) widths.add(w);
  for (const w of [...widths].sort((a, b) => a - b)) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: false }, S);
    await sleep(45);
    for (const [level, msg] of await ev('(' + BARFIT.toString() + ')()')) {
      const k = level + '\t' + msg;
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push(w);
    }
  }
  for (const [k, widths] of seen) { const [level, msg] = k.split('\t'); (level === 'ERROR' ? err : warn)(`${f} at ${ranges(widths)} wide`, msg); }
}

if (opt('--record')) fs.writeFileSync(opt('--record'), JSON.stringify(metrics, null, 1));
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ slug, pages, viewports: vps, states, errors, warnings }, null, 1));
console.log(`${slug}: ${pages.length} pages, ${states} states at ${vps.join(',')} -> ${errors.length} ERROR, ${warnings.length} WARN  (screenshots and report.json in ${OUT})`);
errors.forEach(e => console.log('  ERROR ' + e));
warnings.forEach(e => console.log('  WARN  ' + e));
await send('Target.closeTarget', { targetId }).catch(() => {});
ws.close();
quit(errors.length ? 1 : 0);
