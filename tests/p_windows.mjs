// HoneyThumb 1.4.1 – Windows: Speicher über den eigenen Server des Programms (/__store/…) statt über die Brücke von pywebview.
// Gestartet wird der Server aus desktop/honeythumb_app.py (ohne Fenster) mit einem leeren Datenordner; die Oberfläche läuft wie im Programm mit ?desktop=1&k=….
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { launch, sleep, pruefung, FOTO } from './drv.mjs';
const { chk, ende } = pruefung('HoneyThumb – Windows-Speicher');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), data = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-win-')), site = process.env.HT_SITE || '/tmp/ht/site';
const py = spawn('python3', ['-c', `
import sys, threading; sys.path.insert(0, ${JSON.stringify(path.join(root, 'desktop'))})
import honeythumb_app as a
from pathlib import Path
from http.server import ThreadingHTTPServer
a.WEB_DIR = Path(${JSON.stringify(site)}); a._OFFEN = Path(${JSON.stringify(path.join(data, 'Mein Titelbild ä.honeythumb'))})
srv = ThreadingHTTPServer(("127.0.0.1", 0), a.Quiet); print(srv.server_address[1], a.TOKEN, flush=True); srv.serve_forever()
`], { env: { ...process.env, APPDATA: data }, stdio: ['ignore', 'pipe', 'inherit'] });
const [port, token] = await new Promise(res => py.stdout.once('data', d => res(String(d).trim().split(/\s+/))));
const base = `http://127.0.0.1:${port}`, url = `${base}/index.html?desktop=1&k=${token}`, store = path.join(data, 'HoneyThumb', 'store');
let browser, logs = [];
try {
  // ═════════ Der Server selbst ═════════
  const call = (p, o = {}) => fetch(base + p, o).then(async r => ({ s: r.status, t: await r.text() }));
  const H1 = { 'X-HoneyThumb': token };
  const a1 = await call('/__store/keys?prefix=lib:'), a2 = await call('/__store/keys?prefix=lib:', { headers: { 'X-HoneyThumb': 'falsch' } }), a3 = await call('/__store/set?key=x:1', { method: 'POST', body: '{"a":1}' });
  chk('Ohne den Schlüssel des Programmlaufs gibt der Server den Speicher nicht heraus und nimmt nichts an', a1.s === 403 && a2.s === 403 && a3.s === 403 && !fs.existsSync(path.join(store, 'x_1.json')), { a1, a2, a3 });
  const big = JSON.stringify({ img: 'data:image/png;base64,' + 'A'.repeat(6e6) });
  const t0 = Date.now(); const b1 = await call('/__store/set?key=libd:ab.cd', { method: 'POST', headers: H1, body: big }), b2 = await call('/__store/get?key=libd:ab.cd', { headers: H1 }), ms = Date.now() - t0;
  const b3 = await call('/__store/keys?prefix=libd:ab', { headers: H1 }), b4 = await call('/__store/get?key=fehlt:1', { headers: H1 });
  const b5 = await call('/__store/del?key=libd:ab.cd', { method: 'POST', headers: H1, body: '' }), b6 = await call('/__store/keys?prefix=libd:', { headers: H1 });
  chk('Schreiben, Lesen, Auflisten und Löschen laufen über den Server – sechs Megabyte in unter zwei Sekunden; Schlüssel mit Punkt bleiben ganz', b1.s === 200 && b2.t === big && ms < 2000 && b3.t === '["libd:ab.cd"]' && b4.s === 200 && b4.t === '' && b5.s === 200 && b6.t === '[]', { ms, b3: b3.t, b4, b6: b6.t });
  const c1 = await call('/__store/get?key=../../x', { headers: H1 }), c2 = await call('/index.html');
  chk('Schlüssel führen nie aus dem Speicherordner heraus; die Oberfläche selbst kommt weiter ohne Schlüssel', c1.s === 200 && c1.t === '' && c2.s === 200 && /HoneyThumb/.test(c2.t), { c1: c1.s });

  // ═════════ Ohne Brücke von pywebview: Öffnen und Speichern über den Server ═════════
  const quell = fs.readFileSync(path.join(root, 'desktop', 'honeythumb_app.py'), 'utf8');
  chk('Das Programm übergibt pywebview kein Objekt für die Brücke mehr (kein js_api=, kein öffentliches Fenster an einem solchen Objekt)', !/js_api\s*=/.test(quell) && !/class Api/.test(quell) && /create_window\(TITLE, url, width/.test(quell));
  const d0 = await fetch(base + '/__store/opened', { headers: H1 });
  fs.writeFileSync(path.join(data, 'Mein Titelbild ä.honeythumb'), '{"app":"honeythumb","x":1}');
  const d1 = await fetch(base + '/__store/opened', { headers: H1 }), d1t = await d1.text(), d2 = await call('/__store/opened'), d3 = await call('/__store/save?name=x.png', { method: 'POST', headers: H1, body: 'abc' });
  chk('Die beim Start übergebene Datei kommt über den Server – mit Namen, nur mit Schlüssel; ohne Fenster scheitert „Speichern unter“ sauber', d0.status === 404 && d1.status === 200 && d1t === '{"app":"honeythumb","x":1}' && decodeURIComponent(d1.headers.get('X-Name')) === 'Mein Titelbild ä.honeythumb' && d2.s === 403 && d3.s === 500, { d0: d0.status, d1: d1.status, n: d1.headers.get('X-Name'), d2: d2.s, d3: d3.s });
  fs.rmSync(path.join(data, 'Mein Titelbild ä.honeythumb'));

  // ═════════ Die Oberfläche auf diesem Speicher ═════════
  let page; ({ browser, page, logs } = await launch({ url }));
  const ev = (f, a) => page.evaluate(f, a);
  const foto = await ev(FOTO);
  await ev(async foto => { const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#1450c8'; x.fillRect(0, h * 0.8, w, h * 0.2); return c.toDataURL('image/png'); };
    await HT.libAddImage('overlay', mk(1080, 1920), { name: 'Banner' }); await HT.libAddImage('person', foto, { name: 'Raphael' }); }, foto);
  await page.click('#homeNew'); await page.waitForSelector('#ndGrid canvas'); await page.click('#ndFmt [data-f="9:16"]'); await page.click('#ndGrid [data-t="pinsel"]'); await page.waitForFunction(() => HT.doc); await sleep(300);
  await ev(async () => { const it = HT.lib.find(i => i.kind === 'person'); await HT.usePerson(it, it.pics[0]); await HT.saveNow(); });
  const files = fs.readdirSync(store).sort(), kinds = n => files.filter(f => f.startsWith(n)).length;
  chk('Titelbild, Marke und Einträge liegen als Dateien im Speicherordner: leichte Einträge und schwere Daten getrennt', kinds('thumb_') === 1 && kinds('meta_') === 1 && kinds('brand_') === 1 && kinds('lib_') === 2 && kinds('libd_') === 2 && files.filter(f => f.startsWith('lib_')).every(f => fs.statSync(path.join(store, f)).size < 200000), files);
  // Schwere Markenunterlagen, wie sie den Start bisher angehalten haben: 40 MB in alten Einträgen (alles in einem)
  for (let i = 0; i < 8; i++) fs.writeFileSync(path.join(store, `lib_alt${i}.json`), JSON.stringify({ id: 'alt' + i, kind: 'graphic', name: 'Alt ' + i, img: 'data:image/png;base64,' + 'A'.repeat(5e6), ar: 1, thumb: '' }));
  const t1 = Date.now(); await page.reload(); await page.waitForFunction(() => window.HT && !document.querySelector('#home').classList.contains('hidden') && document.querySelectorAll('#thumbList .thumb-card').length > 0, null, { timeout: 20000 });
  const home = Date.now() - t1; await ev(() => HT.libReady()); const all = Date.now() - t1;
  const r1 = await ev(() => ({ n: HT.lib.length, alt: HT.lib.filter(i => /^alt/.test(i.id)).every(i => i.v === 2 && !i.img), brand: HT.brand.name }));
  const klein = fs.readdirSync(store).filter(f => /^lib_alt/.test(f)).every(f => fs.statSync(path.join(store, f)).size < 2000), daten = fs.readdirSync(store).filter(f => /^libd_alt/.test(f)).length;
  chk('Neustart mit 40 MB alter Einträge: Die Übersicht steht sofort, die Einträge werden im Hintergrund aufgeteilt', home < 3000 && r1.n === 10 && r1.alt && klein && daten === 8, { home, all, r1, klein, daten });
  const t2 = Date.now(); await page.reload(); await page.waitForFunction(() => window.HT && !document.querySelector('#home').classList.contains('hidden')); await ev(() => HT.libReady()); const zweit = Date.now() - t2;
  chk('Jeder weitere Start liest nur noch Kleines', zweit < 2500 && await ev(() => HT.lib.length === 10), { zweit });
  await page.click('#thumbList .thumb-card'); await page.waitForFunction(() => HT.doc && !document.querySelector('#ed').classList.contains('hidden'), null, { timeout: 15000 }); await sleep(300);
  chk('Das gespeicherte Titelbild öffnet sich wieder – mit Auflage und Person', await ev(() => !!HT.doc.layers.at(-1).top && HT.doc.layers.some(l => l.type === 'img' && l.mask && HT.doc.assets[l.img]) && Object.keys(HT.doc.assets).length >= 3));
  // ═════════ Startanzeige ═════════
  chk('Läuft das Programm, ist die Startanzeige weg', await ev(() => getComputedStyle(document.querySelector('#boot')).display === 'none' && !window.__htBoot.shown));
  await page.route('**/thumb-engine.js', r => r.abort()); logs.length = 0;
  await page.goto(url).catch(() => {}); await sleep(600);
  const s0 = await ev(() => ({ text: document.querySelector('#bootBox').textContent, da: getComputedStyle(document.querySelector('#boot')).display }));
  await page.waitForFunction(() => window.__htBoot && window.__htBoot.shown, null, { timeout: 12000 }); await sleep(400);
  const s1 = await ev(() => document.querySelector('#bootBox').textContent), logf = path.join(store, 'log_start.json'), lg = fs.existsSync(logf) ? JSON.parse(fs.readFileSync(logf, 'utf8')) : null;
  chk('Lädt eine Datei des Programms nicht, steht erst „HoneyThumb startet …“ da und nach wenigen Sekunden der Grund – mit der Datei, dem Fenster und einem Knopf „Neu laden“', /startet/.test(s0.text) && s0.da !== 'none' && /kommt nicht in Gang/.test(s1) && /Datei lädt nicht: thumb-engine\.js/.test(s1) && /Rechenkern nein/.test(s1) && /Chrome|Chromium/.test(s1) && await ev(() => !!document.querySelector('#bootBox button')), { s0, s1 });
  chk('Der Grund steht danach auch im Speicherordner (log_start.json)', !!lg && lg.facts.some(f => /thumb-engine\.js/.test(f)), lg);
  logs.length = 0; await page.unroute('**/thumb-engine.js');
} catch (e) { chk('Der Lauf endet ohne Abbruch', false, String(e && e.stack || e)); }
finally { if (browser) await browser.close().catch(() => {}); py.kill(); fs.rmSync(data, { recursive: true, force: true }); ende(logs); }
