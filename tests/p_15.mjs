// HoneyThumb 1.5: gewählte Schrift bleibt beim Wechsel von Vorlage, Format und Auflage; Rautenmuster; Rahmen um das Titelbild;
// Raster-Ausschnitt für Instagram und TikTok (nur auf der Bühne).
import { launch, sleep, pruefung } from './drv.mjs';
const { chk, ende } = pruefung('HoneyThumb 1.5');
const { browser, page, logs } = await launch();
const ev = (f, a) => page.evaluate(f, a);
const fontOf = slot => ev(s => (HT.doc.layers.find(l => l.type === 'text' && l.slot === s) || {}).font, slot);
const pick = async (slot, f) => { await ev(s => HT.select(HT.doc.layers.find(l => l.type === 'text' && l.slot === s).id), slot); await sleep(80); await page.selectOption('#insp select[data-k="font"]', f); await sleep(150); };
// Farbe eines Punkts im fertigen Bild (Anteil der Breite und Höhe)
const px = (fx, fy, W = 800) => ev(([fx, fy, W]) => { const c = HoneyThumb.render(HT.doc, W), d = c.getContext('2d').getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data; return [d[0], d[1], d[2]]; }, [fx, fy, W]);
const near = (a, b, t = 30) => a.every((v, i) => Math.abs(v - b[i]) <= t);
try {
  // ═════════ Schrift bleibt ═════════
  await ev(async () => { await HoneyThumb.fonts(); await HT.openDoc(HoneyThumb.fromTemplate('pinsel', '16:9', {}, {}), true); });
  const f0 = await fontOf('title'); await pick('title', 'lora');
  chk('Schrift des Titels über die Auswahlliste gewählt', f0 === 'anton' && await fontOf('title') === 'lora', f0);
  await ev(() => HT.setFormat('9:16')); await sleep(200);
  chk('Formatwechsel: die gewählte Schrift bleibt, die übrigen Felder behalten die Schrift der Vorlage', await fontOf('title') === 'lora' && await fontOf('kicker') === 'typewriter', [await fontOf('title'), await fontOf('kicker')]);
  await page.click('#tplGrid [data-t="schlagzeile"]'); await sleep(250);
  chk('Vorlagenwechsel: die gewählte Schrift bleibt', await fontOf('title') === 'lora', await fontOf('title'));
  await page.click('#tplGrid [data-t="zitat"]'); await sleep(250); await page.click('#tplGrid [data-t="pinsel-m"]'); await sleep(250);
  chk('Über mehrere Vorlagen hinweg bleibt sie', await fontOf('title') === 'lora', await fontOf('title'));
  const prev = await ev(() => { const d = HoneyThumb.fromTemplate('rechts', HT.doc.format, HoneyThumb.contentOf(HT.doc), {}); return d.layers.find(l => l.slot === 'title').font; });
  chk('Die Vorschauen der Vorlagen zeigen die gewählte Schrift', prev === 'lora', prev);
  await pick('title', 'anton'); await page.click('#tplGrid [data-t="schlagzeile"]'); await sleep(250);
  const back = await ev(() => ({ f: HT.doc.layers.find(l => l.slot === 'title').font, ref: HoneyThumb.fromTemplate('schlagzeile', HT.doc.format, {}, {}).layers.find(l => l.slot === 'title').font }));
  chk('Zurück auf die Schrift der Vorlage gestellt: danach gilt wieder die Schrift jeder Vorlage', back.f === back.ref, back);
  // Auflage dazu: die Vorlage wird neu angeordnet, die Schrift bleibt
  await pick('title', 'playfair');
  await ev(async () => { const c = document.createElement('canvas'); c.width = 900; c.height = 1600; const x = c.getContext('2d'); x.fillStyle = '#c00'; x.fillRect(0, 1300, 900, 300); const it = await HT.libAddImage('overlay', c.toDataURL('image/png'), {name: 'Banner'}); await HT.useOverlay(it); }); await sleep(300);
  chk('Auflage dazu (Vorlage neu angeordnet): die gewählte Schrift bleibt', await fontOf('title') === 'playfair' && await ev(() => HT.doc.layers.some(l => l.top)), await fontOf('title'));
  // Eigene Schrift aus den Markenunterlagen
  const uk = await ev(async () => { const b = await (await fetch('fonts/Oswald-SemiBold.ttf')).blob(); const it = await HT.libAddFont(new File([b], 'Eigene.ttf')); return 'u:' + it.id; });
  await pick('title', uk); await page.click('#tplGrid [data-t="pinsel"]'); await sleep(250);
  chk('Auch eine eigene Schrift bleibt beim Vorlagenwechsel und reist in der Datei mit', await fontOf('title') === uk && await ev(k => !!(HT.doc.fonts && HT.doc.fonts[k]), uk), await fontOf('title'));
  const bild = await ev(() => { const sig = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 128) n++; return n; }; const a = sig(HoneyThumb.render(HT.doc, 600)), t = HT.doc.layers.find(l => l.slot === 'title'), f = t.font; t.font = 'anton'; const b = sig(HoneyThumb.render(HT.doc, 600)); t.font = f; return [a, b]; });
  chk('Im fertigen Bild steht die gewählte Schrift (anderes Bild als mit der Vorlagenschrift)', bild[0] !== bild[1], bild);

  // ═════════ Rautenmuster ═════════
  await ev(async () => { await HT.openDoc(HoneyThumb.blank('16:9'), true); }); await sleep(150);
  chk('„Rauten“ steht bei den Arten des Hintergrunds', await ev(() => [...document.querySelectorAll('#insp [data-k="fill.kind"]')].some(b => b.textContent === 'Rauten')));
  await page.click('#insp [data-k="fill.kind"][data-j=\'"rauten"\']'); await sleep(200);
  const r0 = await ev(() => HT.doc.layers[0].fill);
  chk('Erste Wahl: Weiß und Blau', r0.kind === 'rauten' && r0.a.toLowerCase() === '#ffffff' && r0.b.toLowerCase() === '#0098d4', r0);
  const cols = await ev(() => { const c = HoneyThumb.render(HT.doc, 800), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let w = 0, b = 0, o = 0; for (let i = 0; i < d.length; i += 4){ if (d[i] > 235 && d[i + 2] > 235) w++; else if (d[i] < 30 && Math.abs(d[i + 1] - 152) < 25 && d[i + 2] > 190) b++; else o++; } const n = d.length / 4; return [w / n, b / n, o / n]; });
  chk('Beide Farben füllen je etwa die Hälfte des Bilds', cols[0] > 0.44 && cols[0] < 0.56 && cols[1] > 0.44 && cols[1] < 0.56, cols);
  chk('Regler für Größe, Höhe und Neigung', await ev(() => ['fill.step', 'fill.tall', 'fill.ang'].every(k => document.querySelector(`#insp input[data-k="${k}"]`))));
  const sigA = await ev(() => HoneyThumb.render(HT.doc, 400).toDataURL().length);
  await ev(() => { const f = HT.doc.layers[0].fill; f.a = '#131312'; f.b = '#E5402A'; f.step = 90; f.ang = 0; }); const cA = await px(0.5, 0.5);
  chk('Farben frei wählbar: die Raute in der Mitte trägt die zweite Farbe', near(cA, [229, 64, 42]), cA);
  chk('Mit Neigung 0 stehen die Rauten gerade: links und rechts der Mitte gleich', near(await px(0.5 - 0.02, 0.5), await px(0.5 + 0.02, 0.5), 6));
  await page.click('#tplGrid [data-t="rechts"]'); await sleep(200);

  // ═════════ Rahmen ═════════
  await ev(async () => { await HT.openDoc(HoneyThumb.fromTemplate('schlagzeile', '16:9', {}, {}), true); HT.select(null); }); await sleep(150);
  const before = await px(0.001, 0.5);
  await ev(() => { const t = document.querySelector('#insp input[data-tog="edge"]'); t.click(); }); await sleep(200);
  const e0 = await ev(() => HT.doc.layers[0].edge);
  chk('Haken „Rahmen“ setzt einen dünnen Rahmen (6 von 1600 Punkten)', !!e0 && e0.w === 6 && /^#/.test(e0.c), e0);
  await ev(() => { HT.doc.layers[0].edge.c = '#00FF00'; });
  const rim = [await px(0.001, 0.5), await px(0.999, 0.5), await px(0.5, 0.002), await px(0.5, 0.998)], inner = await px(0.02, 0.5);
  chk('Der Rahmen steht an allen vier Kanten, daneben das Bild', rim.every(c => near(c, [0, 255, 0], 20)) && !near(inner, [0, 255, 0], 60) && !near(before, [0, 255, 0], 60), { rim, inner });
  const big = await ev(() => { const c = HoneyThumb.render(HT.doc, 1920), x = c.getContext('2d'); let n = 0; while (n < 40){ const d = x.getImageData(n, 540, 1, 1).data; if (!(d[0] < 30 && d[1] > 225 && d[2] < 30)) break; n++; } return n; });
  chk('Im Export mit 1920 Punkten ist er rund 7 Punkte breit', big >= 6 && big <= 8, big);
  await ev(() => HT.setFormat('9:16')); await sleep(200); await page.click('#tplGrid [data-t="pinsel"]'); await sleep(250);
  chk('Der Rahmen bleibt bei Format- und Vorlagenwechsel', await ev(() => { const e = HT.doc.layers.find(l => l.type === 'bg').edge; return !!e && e.c === '#00FF00'; }));
  const top = await ev(async () => { const c = document.createElement('canvas'); c.width = 900; c.height = 1600; const x = c.getContext('2d'); x.fillStyle = '#0000cc'; x.fillRect(0, 1300, 900, 300); const it = await HT.libAddImage('overlay', c.toDataURL('image/png'), {name: 'Banner 2'}); await HT.useOverlay(it); const r = HoneyThumb.render(HT.doc, 450), d = r.getContext('2d').getImageData(225, r.height - 1, 1, 1).data; return [d[0], d[1], d[2]]; });
  chk('Der Rahmen liegt über einer Auflage', near(top, [0, 255, 0], 20), top);
  const file = await ev(() => { const d = HoneyThumb.parse(JSON.stringify(HoneyThumb.prune(HoneyThumb.clone(HT.doc)))); return d.layers.find(l => l.type === 'bg').edge; });
  chk('Er reist in der .honeythumb-Datei mit', !!file && file.c === '#00FF00' && file.w === 6, file);

  // ═════════ Raster-Ausschnitt ═════════
  await ev(async () => { HT.setGuide(''); await HT.openDoc(HoneyThumb.fromTemplate('schlagzeile', '16:9', {}, {}), true); }); await sleep(200);
  chk('Im Querformat gibt es den Knopf nicht', await ev(() => document.querySelector('#edGuide').classList.contains('hidden')));
  await ev(() => HT.setFormat('9:16')); await sleep(250);
  chk('Im Hochformat 9:16 steht der Knopf in der Kopfzeile', await ev(() => !document.querySelector('#edGuide').classList.contains('hidden')));
  const stageSig = () => ev(() => { const c = document.querySelector('#stage'), x = c.getContext('2d'), p = (fx, fy) => { const d = x.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data; return d[0] + d[1] + d[2]; }; return { oben: p(0.5, 0.03), mitte: p(0.03, 0.4), unten: p(0.5, 0.97) }; });
  await ev(() => { const b = HT.doc.layers.find(l => l.type === 'bg'); b.fill = {kind: 'color', a: '#ffffff'}; HT.doc.layers = [b]; HT.select(null); }); await sleep(250);
  const s0 = await stageSig(); await page.click('#edGuide'); await sleep(250); const s1 = await stageSig();
  chk('Eingeschaltet: oben und unten ist die Bühne abgedunkelt, die Mitte bleibt', s1.mitte === 765 && s1.oben < 765 * 0.7 && s1.unten < 765 * 0.7, { s0, s1 });
  const rc = await ev(() => HT.guideRects(1080, 1920));
  chk('Der Ausschnitt ist mittig 1080 × 1440 (3:4): oben und unten fallen je 240 Punkte weg', rc.length === 1 && rc[0].w === 1080 && rc[0].h === 1440 && rc[0].y === 240 && rc[0].x === 0, rc);
  const exp = await ev(() => { const c = HoneyThumb.render(HT.doc, 1080), d = c.getContext('2d').getImageData(540, 40, 1, 1).data; return d[0] + d[1] + d[2]; });
  chk('Im Export steht die Hilfe nicht', exp === 765, exp);
  await page.click('#edGuide'); await sleep(200); const rq = await ev(() => HT.guideRects(1080, 1920));
  chk('Zweiter Tipp: zusätzlich das mittige Quadrat', await ev(() => HT.guide) === 'quad' && rq.length === 2 && rq[1].w === 1080 && rq[1].h === 1080 && rq[1].y === 420, rq);
  await ev(() => HT.setFormat('4:5')); await sleep(250); const r45 = await ev(() => { HT.setGuide('34'); return HT.guideRects(1080, 1350); });
  chk('Im Format 4:5 fällt links und rechts ein schmaler Streifen weg', !await ev(() => document.querySelector('#edGuide').classList.contains('hidden')) && Math.abs(r45[0].w - 1012.5) < 0.01 && r45[0].h === 1350, r45);
  await page.click('#edGuide'); await page.click('#edGuide'); await sleep(200);
  chk('Dritter Tipp schaltet aus; die Wahl bleibt über den Neustart', await ev(() => HT.guide) === '' && await ev(() => localStorage.getItem('ht-guide')) === '');
  chk('Keine Fehlermeldungen der Seite', logs.filter(l => /error/i.test(l)).length === 0, logs.slice(0, 5));
} catch (e) { chk('Lauf ohne Abbruch', false, String(e && e.stack || e)); }
await browser.close(); ende();
