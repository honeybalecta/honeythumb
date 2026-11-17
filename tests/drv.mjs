// Gemeinsame Hilfen für die Prüfläufe von HoneyThumb: Chrome starten, Seite öffnen, Ergebnisse zählen.
// Playwright kommt aus HT_PW (Ordner mit node_modules) – in der Entwicklung der Prüfordner von HoneyCut.
import { createRequire } from 'node:module';
const require = createRequire((process.env.HT_PW || '/home/claude/textschnitt/tests') + '/x.js');
const { chromium } = require('playwright');
export const URL0 = process.env.HT_URL || 'http://127.0.0.1:8801/index.html';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function launch(o = {}){
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  const br = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
  const ctx = await br.newContext({ viewport: o.viewport || { width: 1366, height: 768 }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.touch });
  const page = await ctx.newPage(), logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push('Fehler: ' + e.message));
  await page.goto(o.url || URL0); await page.waitForFunction(() => window.HT && !document.querySelector('#home').classList.contains('hidden'));
  return { browser: br, ctx, page, logs };
}
export function pruefung(name){
  let n = 0, bad = 0;
  const chk = (text, ok, info) => { n++; if (!ok){ bad++; console.log('   FEHLER: ' + text + (info === undefined ? '' : ' → ' + JSON.stringify(info))); } else console.log('   ok: ' + text); };
  const ende = logs => { if (logs && logs.length){ bad++; console.log('   FEHLER: Meldungen der Seite → ' + JSON.stringify(logs.slice(0, 5))); } console.log(`${bad ? '❌' : '✅'} ${name}: ${n} geprüft, ${bad} Fehler`); process.exitCode = bad ? 1 : 0; };
  return { chk, ende };
}
// Künstliches Foto: Person (Kopf, Oberkörper) vor einem Zimmer; dazu die wahre Maske als grobe Erkennung (64 Punkte breit)
export const FOTO = `(() => {
  const W = 1280, Hh = 720, c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, Hh); g.addColorStop(0, '#6d7f8c'); g.addColorStop(1, '#39424a'); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
  x.fillStyle = '#8a6f52'; x.fillRect(80, 120, 300, 420); x.fillStyle = '#c9c1b0'; x.fillRect(900, 80, 260, 200);
  const body = y => { y.beginPath(); y.arc(640, 250, 110, 0, 7); y.fill(); y.beginPath(); y.ellipse(640, 720, 300, 330, 0, Math.PI, 0); y.fill(); };
  x.fillStyle = '#d9a37e'; x.beginPath(); x.arc(640, 250, 110, 0, 7); x.fill(); x.fillStyle = '#2f4b6e'; x.beginPath(); x.ellipse(640, 720, 300, 330, 0, Math.PI, 0); x.fill();
  const m = document.createElement('canvas'); m.width = W; m.height = Hh; const y = m.getContext('2d'); y.fillStyle = '#fff'; body(y);
  window.__truth = m;
  HoneyThumbCut.setSegmenter(cv => { const w = 64, h = Math.round(64 * cv.height / cv.width), s = document.createElement('canvas'); s.width = w; s.height = h; const z = s.getContext('2d'); z.drawImage(m, 0, 0, w, h);
    const d = z.getImageData(0, 0, w, h).data, a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255; return {data: a, w, h}; });
  return c.toDataURL('image/jpeg', 0.9);
})()`;
