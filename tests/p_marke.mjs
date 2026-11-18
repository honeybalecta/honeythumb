// HoneyThumb 1.2: Markenunterlagen – Personen, Auflagen (immer ganz oben, je Format, „immer dabei“), Grafiken, Hintergründe; freie Fläche der Vorlagen unter einer Auflage;
// Formatwechsel, Rückgängig, Hinterlegen aus dem Titelbild, Neustart, mehrere Marken, eine Marke im Ganzen als Datei, Handy-Ansicht.
import { launch, sleep, pruefung, FOTO } from './drv.mjs';
const { chk, ende } = pruefung('HoneyThumb – Markenunterlagen');
let { browser, ctx, page, logs } = await launch();
const ev = (f, a) => page.evaluate(f, a);
// Künstliches Banner 1080 × 1920: oben durchsichtig, die unteren 20 % decken (Blau), dazu ein freigestelltes PNG und ein Logo
const BANNER = `(() => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); x.fillStyle = '#1450c8'; x.fillRect(0, 1536, 1080, 384); x.fillStyle = '#fff'; x.fillRect(200, 1650, 680, 120); return c.toDataURL('image/png'); })()`;
const FREI = `(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#c83cc8'; x.beginPath(); x.arc(200, 160, 120, 0, 7); x.fill(); x.fillRect(80, 300, 240, 500); return c.toDataURL('image/png'); })()`;
const LOGO = `(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 150; const x = c.getContext('2d'); x.fillStyle = '#28c850'; x.fillRect(0, 0, 300, 150); return c.toDataURL('image/png'); })()`;
// Farbe der fertigen Zeichnung an einer Stelle (Anteile 0…1)
const px = (fx, fy) => ev(([fx, fy]) => { const c = HoneyThumb.render(HT.doc, 450), d = c.getContext('2d').getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data; return [d[0], d[1], d[2]]; }, [fx, fy]);
const near = (a, b, t = 30) => a.every((v, i) => Math.abs(v - b[i]) <= t);
const BLAU = [20, 80, 200];
const top = () => ev(() => { const F = HoneyThumb.format(HT.doc.format), ls = HT.doc.layers, l = ls.at(-1), ins = HoneyThumb.topInset(ls, F); return { last: !!l.top, lock: !!l.lock, name: l.name, n: ls.filter(x => x.top).length, full: l.x === 0 && l.y === 0 && l.w === F.w && l.h === F.h, ins, slots: Object.fromEntries(ls.filter(x => x.slot && x.type !== 'bg').map(x => [x.slot, [x.y / F.h, (x.y + x.h) / F.h]])) }; });

try {
  // ═════════ Ablage in der Übersicht ═════════
  await page.click('#homeLib'); await page.waitForSelector('.modal-card.lib [data-lk]');
  const l0 = await ev(() => ({ marke: document.querySelector('#lbBrand').selectedOptions[0].textContent, tabs: [...document.querySelectorAll('.modal-card.lib [data-lk]')].map(b => b.textContent), leer: !!document.querySelector('.lib-grid .hint'), add: document.querySelector('[data-lb="add"]').textContent, save: document.querySelector('[data-lb="save"]').disabled }));
  chk('Die Markenunterlagen haben vier Reiter – Personen, Auflagen, Grafiken, Hintergründe – und sind anfangs leer; es gibt die Marke „Meine Marke“', l0.tabs.join() === 'Personen,Auflagen,Grafiken,Hintergründe' && l0.marke === 'Meine Marke' && l0.leer && /Person/.test(l0.add) && l0.save, l0);
  await page.click('[data-lb="x"]');

  // ═════════ Auflage hinterlegen ═════════
  const ov = await ev(async src => { const it = await HT.libAddImage('overlay', eval(src), { name: 'Banner' }); return { kind: it.kind, formats: it.formats, auto: it.auto, band: it.band, thumb: /^data:image\/png/.test(it.thumb) }; }, BANNER);
  chk('Ein Banner im Hochformat wird als Auflage für 9:16 hinterlegt, „immer dabei“; erkannt ist der deckende Streifen unten (20 %)', ov.kind === 'overlay' && ov.formats.join() === '9:16' && ov.auto === true && ov.band.t === 0 && Math.abs(ov.band.b - 0.2) < 0.02 && ov.thumb, ov);
  await page.click('#homeLib'); await page.click('[data-lk="overlay"]');
  const l1 = await ev(() => { const c = document.querySelector('.lib-card'); return { name: c.querySelector('.nm').value, on: [...c.querySelectorAll('[data-lf].on')].map(b => b.dataset.lf), auto: c.querySelector('[data-lauto]').checked, use: !!c.querySelector('.go') }; });
  chk('Die Karte der Auflage zeigt Name, Format 9:16 und den Haken „Immer dabei“; ohne offenes Titelbild gibt es kein „Einsetzen“', l1.name === 'Banner' && l1.on.join() === '9:16' && l1.auto && !l1.use, l1);
  await page.click('[data-lb="x"]');

  // ═════════ Neues Titelbild: die Auflage ist von selbst dabei ═════════
  await page.click('#homeNew'); await page.waitForSelector('#ndGrid canvas');
  const pv = async f => { await page.click(`#ndFmt [data-f="${f}"]`); return ev(() => { const c = document.querySelector('#ndGrid [data-t="rechts"] canvas'), d = c.getContext('2d').getImageData(Math.round(c.width * 0.05), Math.round(c.height * 0.97), 1, 1).data; return [d[0], d[1], d[2]]; }); };
  const pq = await pv('16:9'), ph = await pv('9:16');
  chk('Die Vorschau im Hochformat zeigt die Auflage unten, die im Querformat nicht', near(ph, BLAU) && !near(pq, BLAU), { ph, pq });
  await page.click('#ndGrid [data-t="rechts"]'); await page.waitForFunction(() => HT.doc && !document.querySelector('#ed').classList.contains('hidden')); await sleep(200);
  const t1 = await top();
  chk('Im neuen Titelbild liegt die Auflage als oberste Ebene: gesperrt, über das ganze Bild, mit ihrem Namen', t1.last && t1.lock && t1.full && t1.n === 1 && t1.name === 'Banner', t1);
  chk('Die Vorlage ordnet sich in der freien Fläche an: Titel und Rubrik enden über dem Banner, die Person steht an seiner Kante', Math.abs(t1.ins.b - 0.2) < 0.02 && t1.slots.title[1] < 0.8 && t1.slots.kicker[1] < 0.8 && t1.slots.person[1] > 0.8 && t1.slots.person[1] < 0.86, t1);
  chk('Im Bild: unten das Banner, darüber der Hintergrund der Vorlage', near(await px(0.05, 0.97), BLAU) && !near(await px(0.05, 0.5), BLAU));
  chk('In der Ebenenliste steht die Auflage ganz oben', await ev(() => { document.querySelector('#leftTabs [data-t="layers"]').click(); const r = document.querySelector('#layerList .lay'); return r.querySelector('.n').textContent === 'Banner' && r.querySelector('.k').textContent === '⬓'; }));

  // ═════════ Immer ganz oben ═════════
  await page.click('#addBar [data-add="text"]'); await sleep(150);
  await ev(() => { const F = HoneyThumb.format(HT.doc.format), l = HT.doc.layers.find(x => x.id === HT.sel); l.text = 'XXXXXXXX'; l.color = '#00ff00'; l.box = { c: '#00ff00', pad: 0.3, mode: 'block' }; l.y = F.h * 0.8; l.h = F.h * 0.2; l.x = 0; l.w = F.w; HT.commit(); HT.act('up'); }); await sleep(150);
  const t2 = await top();
  chk('Ein neuer Text – auch „nach vorn“ geholt – bleibt unter der Auflage; im Bild deckt das Banner ihn ab', t2.last && near(await px(0.05, 0.97), BLAU), t2);
  await page.mouse.click(...(await ev(() => { const r = document.querySelector('#stageBox').getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.3]; }))); await sleep(100);
  chk('Ein Klick ins Bild greift nie die gesperrte Auflage', await ev(() => { const l = HT.doc.layers.find(x => x.id === HT.sel); return !l || !l.top; }));

  // ═════════ Vorlage wechseln ═════════
  await ev(() => document.querySelector('#leftTabs [data-t="tpl"]').click()); await sleep(700);
  chk('Die Vorschauen der Vorlagen zeigen die Auflage mit', near(await ev(() => { const c = document.querySelector('#tplGrid [data-t="balken"] canvas'), d = c.getContext('2d').getImageData(Math.round(c.width * 0.05), Math.round(c.height * 0.97), 1, 1).data; return [d[0], d[1], d[2]]; }), BLAU));
  await page.click('#tplGrid [data-t="balken"]'); await sleep(250);
  const t3 = await top();
  chk('„Bild mit Balken“ setzt seinen Titel über das Banner statt darunter; die Auflage und der eigene Text bleiben', t3.last && t3.n === 1 && t3.slots.title[1] < 0.8 && t3.slots.title[0] > 0.4 && await ev(() => HT.doc.layers.some(l => l.text === 'XXXXXXXX')), t3);
  await page.click('#tplGrid [data-t="links"]'); await sleep(250);
  const t4 = await ev(() => { const F = HoneyThumb.format(HT.doc.format), r = HT.doc.layers.find(l => l.type === 'shape' && l.shape === 'rect'); return (r.y + r.h) / F.h; });
  chk('Flächen am unteren Rand der Vorlage reichen weiter bis zum Bildrand', Math.abs(t4 - 1) < 0.001, t4);

  // ═════════ Format wechseln, Rückgängig ═════════
  await page.selectOption('#edFmt', '16:9'); await sleep(250);
  const f1 = await ev(() => ({ n: HT.doc.layers.filter(l => l.top).length, a: Object.keys(HT.doc.assets).length }));
  chk('Im Querformat ist die Auflage weg (sie gilt nur für 9:16)', f1.n === 0 && !near(await px(0.05, 0.97), BLAU), f1);
  await ev(() => document.activeElement.blur()); await page.keyboard.press('Control+z'); await sleep(250);
  const f2 = await top();
  chk('Rückgängig holt das Hochformat samt Auflage und ihrem Bild zurück', f2.last && f2.n === 1 && near(await px(0.05, 0.97), BLAU), f2);
  await page.keyboard.press('Control+Shift+z'); await sleep(200); await page.selectOption('#edFmt', '9:16'); await sleep(250);
  const f3 = await top();
  chk('Zurück im Hochformat ist die Auflage von selbst wieder da – einmal, ganz oben, und die Vorlage macht ihr Platz', f3.last && f3.n === 1 && f3.full && f3.slots.title[1] < 0.8 && near(await px(0.05, 0.97), BLAU), f3);

  // ═════════ Auflage herausnehmen und von Hand einsetzen ═════════
  await ev(() => { HT.select(HT.doc.layers.at(-1).id); }); await sleep(100);
  const i1 = await ev(() => ({ title: document.querySelector('#inspTitle').textContent, acts: [...document.querySelectorAll('#insp [data-act]')].map(b => b.dataset.act) }));
  chk('Die Eigenschaften der Auflage: Deckkraft, Entsperren, herausnehmen, Ablage', i1.title === 'Banner' && i1.acts.join() === 'lock,del,lib-overlay', i1);
  await page.click('#insp [data-act="del"]'); await sleep(250);
  const d1 = await ev(() => { const F = HoneyThumb.format(HT.doc.format), p = HT.doc.layers.find(l => l.slot === 'person'); return { n: HT.doc.layers.filter(l => l.top).length, pb: (p.y + p.h) / F.h }; });
  chk('Ohne Auflage nutzt die Vorlage wieder das ganze Bild', d1.n === 0 && d1.pb > 1, d1);
  await page.click('#addBar [data-add="lib"]'); await page.click('[data-lk="overlay"]'); await page.click('.lib-card .go'); await sleep(300);
  const d2 = await top();
  chk('„Ablage → Auflagen → Einsetzen“ legt sie wieder obenauf und ordnet die Vorlage neu an', d2.last && d2.n === 1 && d2.slots.person[1] < 0.86 && near(await px(0.05, 0.97), BLAU), d2);
  await ev(async () => { await HT.useOverlay(HT.lib.find(i => i.kind === 'overlay')); }); await sleep(100);
  chk('Ein zweites Mal wird dieselbe Auflage nicht eingesetzt', (await top()).n === 1);

  // ═════════ Personen ═════════
  const foto = await ev(FOTO);
  const p1 = await ev(async ([foto, frei]) => { const a = await HT.libAddImage('person', foto, { name: 'Raphael' }), b = await HT.libAddImage('person', eval(frei), { id: a.id }); return { n: HT.lib.filter(i => i.kind === 'person').length, pics: b.pics.map(q => ({ mask: !!q.mask, src: !!q.src, thumb: /^data:image\/png/.test(q.thumb) })), name: b.name }; }, [foto, FREI]);
  chk('Eine Person mit zwei Bildern: das Foto wird freigestellt (Maske und Original), das schon freigestellte PNG bleibt, wie es ist', p1.n === 1 && p1.name === 'Raphael' && p1.pics.length === 2 && p1.pics[0].mask && p1.pics[0].src && !p1.pics[1].mask && p1.pics.every(q => q.thumb), p1);
  await page.click('#tplGrid [data-t="rechts"]'); await sleep(250);
  await page.click('#addBar [data-add="lib"]'); await page.waitForSelector('.lib-card[data-li]');
  const c1 = await ev(() => { const c = document.querySelector('.lib-card'); return { name: c.querySelector('b').textContent, n: c.querySelector('.muted').textContent }; });
  chk('Die Ablage zeigt die Person mit Name und Zahl der Bilder', c1.name === 'Raphael' && c1.n === '2 Bilder', c1);
  await page.click('.lib-card[data-li]'); await page.waitForSelector('.lib-card[data-lp]');
  chk('Bei mehreren Bildern öffnet ein Tipp die Auswahl', await ev(() => document.querySelectorAll('.lib-card[data-lp]').length === 2 && document.querySelector('#lbName').value === 'Raphael'));
  await page.click('.lib-card[data-lp] .pic'); await sleep(300);
  const u1 = await ev(() => { const l = HT.doc.layers.find(x => x.slot === 'person'); return { img: !!l.img, mask: !!l.mask, src: !!l.src, sel: HT.sel === l.id, modal: document.querySelector('#modal').classList.contains('hidden') }; });
  chk('Ein Tipp auf das Bild setzt die Person in das freie Feld der Vorlage – freigestellt, mit Original', u1.img && u1.mask && u1.src && u1.sel && u1.modal, u1);
  chk('Im Bild steht die Person (Blau des Oberkörpers) über dem Banner', near(await px(0.5, 0.74), [47, 75, 110], 45) && near(await px(0.05, 0.97), BLAU), await px(0.5, 0.74));
  const u2 = await ev(async () => { const n = HT.doc.layers.length, F = HoneyThumb.format(HT.doc.format), l = await HT.usePerson(HT.lib.find(i => i.kind === 'person').pics[1]); return { more: HT.doc.layers.length - n, user: l.user, noMask: !l.mask, bottom: (l.y + l.h) / F.h, last: !!HT.doc.layers.at(-1).top, ratio: l.w / l.h }; });
  chk('Ist das Feld belegt, kommt die nächste Person als eigene Ebene dazu: unten an der Kante des Banners, unter der Auflage', u2.more === 1 && u2.user && u2.noMask && u2.bottom < 0.86 && u2.bottom > 0.78 && u2.last && Math.abs(u2.ratio - 0.5) < 0.01, u2);
  chk('Das zweite Bild (Magenta) ist im Titelbild zu sehen', near(await px(0.5, 0.6), [200, 60, 200], 40), await px(0.5, 0.6));

  // ═════════ Aus dem Titelbild hinterlegen ═════════
  await ev(() => HT.select(HT.doc.layers.find(x => x.slot === 'person').id)); await sleep(100);
  await page.click('#insp [data-act="tolib"]'); await page.waitForSelector('#tlName');
  chk('„In der Ablage hinterlegen“ bietet eine neue Person oder eine vorhandene an', await ev(() => document.querySelectorAll('[data-tp]').length === 1 && document.querySelector('[data-tp]').textContent === 'Raphael'));
  await page.fill('#tlName', 'Katrin'); await page.click('#tlOk'); await sleep(300);
  const h1 = await ev(() => HT.lib.filter(i => i.kind === 'person').map(i => [i.name, i.pics.length, !!i.pics[0].mask]));
  chk('Die Person aus dem Titelbild liegt als neuer Eintrag in der Ablage', JSON.stringify(h1) === '[["Katrin",1,true],["Raphael",2,true]]', h1);

  // ═════════ Grafiken ═════════
  await ev(async logo => { await HT.libAddImage('graphic', eval(logo), { name: 'Logo' }); }, LOGO);
  await page.click('#addBar [data-add="lib"]'); await page.click('[data-lk="graphic"]'); await page.click('.lib-card[data-li] .pic'); await sleep(300);
  const g1 = await ev(() => { const l = HT.doc.layers.find(x => x.id === HT.sel); return { name: l.name, ratio: l.w / l.h, top: !!l.top, last: !!HT.doc.layers.at(-1).top, title: document.querySelector('#inspTitle').textContent }; });
  chk('Eine Grafik aus der Ablage kommt als gewöhnliche Ebene mit ihrem Namen ins Titelbild', g1.name === 'Logo' && Math.abs(g1.ratio - 2) < 0.01 && !g1.top && g1.last && g1.title === 'Logo', g1);

  // ═════════ Datei .honeythumb ═════════
  const r1 = await ev(() => { const d = HoneyThumb.parse(JSON.stringify(HoneyThumb.prune(HoneyThumb.clone(HT.doc)))), l = d.layers.at(-1); return { top: !!l.top, lock: !!l.lock, asset: !!d.assets[l.img], band: l.band && l.band.b }; });
  chk('Die Auflage steckt in der Datei .honeythumb und bleibt beim Öffnen oben', r1.top && r1.lock && r1.asset && r1.band > 0.15, r1);

  // ═════════ Einstellungen der Auflage ═════════
  await ev(() => document.querySelector('#edBack').click()); await page.waitForFunction(() => !document.querySelector('#home').classList.contains('hidden'));
  await page.click('#homeLib'); await page.click('[data-lk="overlay"]'); await page.click('.lib-card [data-lf="4:5"]'); await sleep(150);
  await page.fill('.lib-card .nm', 'Mission'); await page.dispatchEvent('.lib-card .nm', 'change'); await sleep(150);
  const s1 = await ev(() => { const it = HT.lib.find(i => i.kind === 'overlay'); return { f: it.formats, name: it.name }; });
  chk('Formate und Name der Auflage lassen sich auf der Karte ändern', s1.f.join() === '9:16,4:5' && s1.name === 'Mission', s1);
  await page.click('[data-lb="x"]'); await page.click('#homeNew'); await page.waitForSelector('#ndGrid canvas'); await page.click('#ndFmt [data-f="4:5"]'); await page.click('#ndBlank'); await page.waitForFunction(() => HT.doc); await sleep(200);
  const s2 = await top();
  chk('Ein leeres Titelbild in 4:5 trägt die Auflage: unten bündig, über die ganze Breite', s2.last && s2.full && s2.n === 1 && near(await px(0.05, 0.99), BLAU) && s2.ins.b > 0.2 && s2.ins.b < 0.3, s2);
  await ev(() => document.querySelector('#edBack').click()); await page.waitForFunction(() => !document.querySelector('#home').classList.contains('hidden'));
  await page.click('#homeLib'); await page.click('[data-lk="overlay"]'); await page.click('.lib-card [data-lauto]'); await sleep(150); await page.click('[data-lb="x"]');
  await page.click('#homeNew'); await page.waitForSelector('#ndGrid canvas'); await page.click('#ndFmt [data-f="9:16"]'); await page.click('#ndGrid [data-t="schlagzeile"]'); await page.waitForFunction(() => HT.doc); await sleep(200);
  chk('Ohne den Haken „Immer dabei“ bleibt ein neues Titelbild frei', await ev(() => HT.doc.layers.every(l => !l.top)));
  await ev(() => document.querySelector('#edBack').click()); await page.waitForFunction(() => !document.querySelector('#home').classList.contains('hidden'));

  // ═════════ Ablage als Datei, Neustart ═════════
  const file = await ev(() => JSON.stringify({ app: 'honeythumb-ablage', v: 1, items: HT.lib }));
  await page.reload(); await page.waitForFunction(() => window.HT && !document.querySelector('#home').classList.contains('hidden'));
  const n1 = await ev(() => HT.lib.map(i => i.kind + ':' + i.name).sort());
  chk('Nach einem Neustart ist die Ablage noch da', n1.join() === 'graphic:Logo,overlay:Mission,person:Katrin,person:Raphael', n1);
  await page.click('#homeLib'); await page.click('[data-lb="edit"]'); page.once('dialog', d => d.accept()); await page.click('[data-lb="delitem"]'); await sleep(200);
  await page.click('[data-lb="edit"]'); await sleep(100); page.once('dialog', d => d.accept()); await page.click('.lib-card [data-lb="delpic"]'); await sleep(200);
  const n2 = await ev(() => HT.lib.filter(i => i.kind === 'person').map(i => [i.name, i.pics.length]));
  chk('Eine Person und ein einzelnes Bild lassen sich löschen', JSON.stringify(n2) === '[["Raphael",1]]', n2);
  await page.click('[data-lb="x"]');
  await page.setInputFiles('#fileIn', { name: 'HoneyThumb-Ablage.json', mimeType: 'application/json', buffer: Buffer.from(file) }); await page.waitForSelector('.modal-card.lib'); await sleep(300);
  const n3 = await ev(() => ({ all: HT.lib.map(i => i.kind + ':' + i.name + (i.pics ? ':' + i.pics.length : '')).sort(), ov: (i => [i.formats.join(), i.auto, i.band.b > 0.15])(HT.lib.find(i => i.kind === 'overlay')) }));
  chk('Eine gesicherte Ablage-Datei bringt alle Einträge zurück – über „Öffnen“', n3.all.join() === 'graphic:Logo,overlay:Mission,person:Katrin:1,person:Raphael:2' && n3.ov.join() === '9:16,4:5,false,true', n3);
  const bad = await ev(async () => { const n = HT.lib.length; await HT.libImport({ app: 'honeythumb-ablage', items: [{ id: 'x1', kind: 'overlay', name: 'Böse', img: 'javascript:alert(1)' }, { id: '../x', kind: 'graphic', img: 'data:image/png;base64,AAAA' }, { id: 'x3', kind: 'person', name: 'Leer', pics: [{ img: 'http://example.org/a.png' }] }] }); return { more: HT.lib.length - n, leer: HT.lib.find(i => i.id === 'x3')?.pics.length }; });
  chk('Eine Ablage-Datei mit fremden Adressen statt Bildern wird nicht übernommen', bad.more === 1 && bad.leer === 0, bad);
  await ev(() => document.querySelector('[data-lb="x"]')?.click());

  // ═════════ Hintergründe ═════════
  await page.click('#homeNew'); await page.waitForSelector('#ndGrid canvas'); await page.click('#ndFmt [data-f="16:9"]'); await page.click('#ndGrid [data-t="schlagzeile"]'); await page.waitForFunction(() => HT.doc); await sleep(200);
  await ev(async logo => { await HT.libAddImage('bg', eval(logo), { name: 'Studio' }); }, LOGO);
  await page.click('#addBar [data-add="lib"]'); await page.click('[data-lk="bg"]'); await page.click('.lib-card[data-li] .pic'); await sleep(300);
  const b1 = await ev(() => { const b = HT.doc.layers[0]; return { kind: b.fill.kind, img: !!HT.doc.assets[b.fill.img], n: HT.doc.layers.filter(l => l.type === 'bg').length, acts: [...document.querySelectorAll('#insp [data-act]')].map(x => x.dataset.act) }; });
  chk('Ein Hintergrund aus den Markenunterlagen liegt hinter allem; im Bild ist er zu sehen', b1.kind === 'img' && b1.img && b1.n === 1 && near(await px(0.97, 0.03), [40, 200, 80], 60) && b1.acts.includes('libbg') && b1.acts.includes('tolib'), { b1, p: await px(0.97, 0.03) });
  await page.click('#insp [data-act="tolib"]'); await page.fill('#tlName', 'Wiese'); await page.click('#tlOk'); await sleep(300);
  chk('Der Hintergrund eines Titelbilds lässt sich hinterlegen', await ev(() => HT.mine('bg').map(i => i.name).join() === 'Studio,Wiese'));
  await ev(() => document.querySelector('#edBack').click()); await page.waitForFunction(() => !document.querySelector('#home').classList.contains('hidden'));

  // ═════════ Mehrere Marken ═════════
  await page.click('#homeLib'); await page.click('[data-lb="bnew"]'); await page.waitForSelector('#lbBName');
  await page.fill('#lbBName', 'Katrin Fey'); await page.dispatchEvent('#lbBName', 'change'); await page.click('[data-lacc="blau"]'); await sleep(150); await page.click('[data-lb="back"]'); await sleep(100);
  const m0 = await ev(() => ({ sel: document.querySelector('#lbBrand').selectedOptions[0].textContent, n: HT.brands.length, leer: !!document.querySelector('.lib-grid .hint'), mine: HT.mine().length, all: HT.lib.length, acc: getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() }));
  chk('Eine neue Marke „Katrin Fey“ ist gewählt und leer; die Einträge der anderen Marke bleiben, wo sie sind', m0.sel === 'Katrin Fey' && m0.n === 2 && m0.leer && m0.mine === 0 && m0.all >= 6 && m0.acc.toLowerCase() === '#6f9bea', m0);
  await page.click('[data-lb="x"]'); await page.click('#homeNew'); await page.waitForSelector('#ndGrid canvas'); await page.click('#ndFmt [data-f="9:16"]'); await page.click('#ndGrid [data-t="rechts"]'); await page.waitForFunction(() => HT.doc); await sleep(200);
  const m1 = await ev(() => ({ tops: HT.doc.layers.filter(l => l.top).length, acc: HT.doc.accentKey, kicker: HT.doc.layers.find(l => l.slot === 'kicker').color }));
  chk('Ein neues Titelbild dieser Marke trägt ihre Akzentfarbe und keine Auflage der anderen Marke', m1.tops === 0 && m1.acc === 'blau' && m1.kicker.toLowerCase() === '#6f9bea', m1);
  await ev(logo => HT.libAddImage('graphic', eval(logo), { name: 'Fey-Logo' }), LOGO);
  await ev(() => document.querySelector('#edBack').click()); await page.waitForFunction(() => !document.querySelector('#home').classList.contains('hidden'));
  await page.click('#homeLib'); await page.selectOption('#lbBrand', { label: 'Meine Marke' }); await sleep(150); await page.click('[data-lk="graphic"]');
  await page.click('.lib-card [data-lb="move"]'); await page.click('[data-lmv]'); await sleep(200);
  const m2 = await ev(() => ({ here: HT.mine('graphic').length, there: HT.lib.filter(i => i.kind === 'graphic' && i.brand !== HT.brand.id).map(i => i.name).sort().join() }));
  chk('Ein Eintrag lässt sich in eine andere Marke legen', m2.here === 0 && m2.there === 'Fey-Logo,Logo', m2);

  // ═════════ Eine Marke im Ganzen sichern und auf einem „anderen Gerät“ einlesen ═════════
  await page.selectOption('#lbBrand', { label: 'Katrin Fey' }); await sleep(150);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-lb="save"]')]);
  const roh = (await import('node:fs')).readFileSync(await dl.path()), marke = JSON.parse(roh.toString('utf8')), datei = { name: dl.suggestedFilename(), mimeType: 'application/json', buffer: roh };
  chk('„Sichern“ schreibt die Marke im Ganzen in eine Datei: Name, Farbe und ihre Einträge – nur ihre', dl.suggestedFilename() === 'Markenunterlagen-Katrin Fey.json' && marke.app === 'honeythumb-marke' && marke.brand.name === 'Katrin Fey' && marke.brand.accentKey === 'blau' && marke.items.map(i => i.name).sort().join() === 'Fey-Logo,Logo', { n: dl.suggestedFilename(), items: marke.items.map(i => i.name) });
  await page.click('[data-lb="bedit"]'); page.once('dialog', d => d.accept()); await page.click('[data-lb="bdel"]'); await sleep(250);
  const m3 = await ev(() => ({ n: HT.brands.length, name: HT.brand.name, logos: HT.lib.filter(i => i.kind === 'graphic').length, del: (document.querySelector('[data-lb="bedit"]').click(), document.querySelector('[data-lb="bdel"]').disabled) }));
  chk('Eine Marke lässt sich mit ihren Einträgen löschen; die letzte Marke bleibt', m3.n === 1 && m3.name === 'Meine Marke' && m3.logos === 0 && m3.del, m3);
  await page.click('[data-lb="x"]');
  await page.setInputFiles('#fileIn', datei); await page.waitForSelector('.modal-card.lib #lbBrand'); await sleep(300);
  const m4 = await ev(() => ({ n: HT.brands.length, name: HT.brand.name, acc: HT.brand.accentKey, mine: HT.mine().map(i => i.kind + ':' + i.name).sort().join(), sel: document.querySelector('#lbBrand').selectedOptions[0].textContent }));
  chk('Über „Öffnen“ kommt die Marke im Ganzen zurück und ist gleich gewählt', m4.n === 2 && m4.name === 'Katrin Fey' && m4.acc === 'blau' && m4.mine === 'graphic:Fey-Logo,graphic:Logo' && m4.sel === 'Katrin Fey', m4);
  await page.setInputFiles('#fileIn', datei); await sleep(400);
  chk('Dieselbe Datei ein zweites Mal einzulesen verdoppelt nichts', await ev(() => HT.brands.length === 2 && HT.mine().length === 2));
  // Einträge aus 1.1.0 tragen noch keine Marke; die gewählte Marke übersteht den Neustart
  await ev(async () => { const it = HT.lib.find(i => i.kind === 'overlay'); delete it.brand; await HT.Store.set('lib:' + it.id, it); });
  await page.reload(); await page.waitForFunction(() => window.HT && HT.brand && !document.querySelector('#home').classList.contains('hidden'));
  const m5 = await ev(() => ({ name: HT.brand.name, ov: HT.lib.find(i => i.kind === 'overlay').brand === HT.brand.id, n: HT.brands.length }));
  chk('Nach einem Neustart ist dieselbe Marke gewählt; ein Eintrag ohne Marke (aus 1.1.0) kommt in die gewählte', m5.name === 'Katrin Fey' && m5.ov && m5.n === 2, m5);
  await browser.close();

  // ═════════ Handy-Ansicht ═════════
  ({ browser, ctx, page, logs } = await launch({ viewport: { width: 390, height: 780 }, touch: true, dpr: 2 }));
  await ev(async src => { await HT.libAddImage('overlay', eval(src), { name: 'Banner' }); }, BANNER);
  await page.click('#homeNew'); await page.waitForSelector('#ndGrid canvas'); await page.click('#ndFmt [data-f="9:16"]'); await page.click('#ndGrid [data-t="rechts"]'); await page.waitForFunction(() => HT.doc); await sleep(250);
  await page.click('#addBar [data-add="lib"]'); await page.click('[data-lk="overlay"]'); await sleep(150);
  const hy = await ev(() => { const c = document.querySelector('.modal-card.lib').getBoundingClientRect(), k = document.querySelector('.lib-card').getBoundingClientRect(), g = document.querySelector('.lib-card .go').getBoundingClientRect(); return { tabs: [...document.querySelectorAll('.modal-card.lib [data-lk]')].every(b => b.scrollWidth <= b.clientWidth + 1), w: c.width, bottom: c.bottom, inW: k.right <= 390 && k.left >= 0, go: g.height >= 24, over: document.documentElement.scrollWidth <= 390 }; });
  chk('Am Handy passen die Markenunterlagen ins Fenster; Karte und Reiter sind ganz zu sehen', hy.tabs && hy.w <= 390 && hy.bottom <= 781 && hy.inW && hy.go && hy.over, hy);
  chk('Auch am Handy ist die Auflage beim neuen Hochformat dabei', (await top()).last);
} catch (e) { chk('Der Lauf endet ohne Abbruch', false, String(e && e.stack || e)); }
finally { await browser.close().catch(() => {}); ende(logs); }
