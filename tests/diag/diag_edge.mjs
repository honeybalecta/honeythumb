// Dieselbe Diagnose in Edge (Playwright), mit Fenster
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = 'diag-out/edge'; fs.mkdirSync(out, {recursive: true});
for (const headless of [false]){
  const br = await chromium.launch({channel: 'msedge', headless});
  const page = await (await br.newContext({viewport: {width: 1366, height: 768}})).newPage();
  await page.goto(process.env.HT_URL); await page.waitForFunction(() => window.HT && !document.querySelector('#home').classList.contains('hidden'));
  await page.evaluate(fs.readFileSync('tests/diag/diag.js', 'utf8'));
  await page.waitForFunction(() => window.__diag, null, {timeout: 120000});
  const d = JSON.parse(await page.evaluate(() => window.__diag));
  for (const [n, u] of Object.entries(d.pics || {})) fs.writeFileSync(`${out}/${n}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
  delete d.pics; fs.writeFileSync(`${out}/ergebnis.json`, JSON.stringify(d, null, 1)); console.log(JSON.stringify(d, null, 1));
  await br.close();
}
