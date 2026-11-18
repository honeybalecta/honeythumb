// HoneyThumb 1.0: Vorlage wählen, Person freistellen (mit künstlichem Foto und eigener Erkennung), Texte, Ebenen, Bühne, Rückgängig,
// Vorlage und Format wechseln, Export, Datei sichern und öffnen, Speichern über einen Neustart, Handy-Ansicht.
import { launch, sleep, pruefung, FOTO, URL0 } from './drv.mjs';
const { chk, ende } = pruefung('HoneyThumb');
const { browser, ctx, page, logs } = await launch();
const ev = (f, a) => page.evaluate(f, a);
const L = slot => ev(s => { const l = HT.doc.layers.find(x => x.slot === s); return l && JSON.parse(JSON.stringify(l)); }, slot);
// Mittlere Farbe eines Stücks der fertigen Zeichnung (Entwurfspixel)
const px = (x, y) => ev(([x, y]) => { const c = HoneyThumb.render(HT.doc, 800), s = 800 / HoneyThumb.format(HT.doc.format).w, d = c.getContext('2d').getImageData(Math.round(x * s) - 2, Math.round(y * s) - 2, 5, 5).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4){ r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return [r / n, g / n, b / n].map(Math.round); }, [x, y]);
const near = (a, b, t = 28) => a.every((v, i) => Math.abs(v - b[i]) <= t);

try {
  // ═════════ Übersicht und neues Titelbild ═════════
  chk('Leere Übersicht mit Hinweis', await ev(() => !document.querySelector('#homeEmpty').classList.contains('hidden')));
  await page.click('#emptyNew'); await page.waitForSelector('#ndGrid canvas');
  const nd = await ev(() => ({ n: document.querySelectorAll('#ndGrid button').length, fm: document.querySelectorAll('#ndFmt button').length, tall: (() => { document.querySelector('#ndFmt [data-f="9:16"]').click(); const c = document.querySelector('#ndGrid canvas'); return c.height > c.width; })() }));
  chk('Vierzehn Vorlagen, vier Formate; die Vorschauen folgen dem Format', nd.n === 14 && nd.fm === 4 && nd.tall, nd);
  await page.click('#ndFmt [data-f="16:9"]'); await page.click('#ndGrid [data-t="rechts"]'); await page.waitForFunction(() => HT.doc && !document.querySelector('#ed').classList.contains('hidden'));
  const d0 = await ev(() => ({ n: HT.doc.layers.length, bg: HT.doc.layers[0].type, slots: HT.doc.layers.map(l => l.slot || '').join(), box: [document.querySelector('#stageBox').clientWidth, document.querySelector('#stageBox').clientHeight] }));
  chk('Vorlage „Person rechts“ ist offen: Hintergrund, Person, Rubrik, Titel, Strich', d0.n === 5 && d0.bg === 'bg' && d0.slots === 'photo,person,kicker,title,'.replace('photo', '') && Math.abs(d0.box[0] / d0.box[1] - 16 / 9) < 0.02, d0);

  // ═════════ Person freistellen ═════════
  const url = await ev(FOTO);
  await ev(async url => { const d = HT.doc, id = HoneyThumb.addAsset(d, url); await HoneyThumb.load(d); const l = d.layers.find(x => x.slot === 'person'); l.img = id; HT.select(l.id); await HT.cutLayer(l, true); }, url);
  const p1 = await L('person');
  chk('Nach dem Freistellen trägt die Ebene Bild, Maske und das unbeschnittene Original', !!p1.img && !!p1.mask && !!p1.src && p1.src !== p1.img, { img: !!p1.img, mask: !!p1.mask, src: !!p1.src });
  // Güte der Maske gegen die wahre Form (grobe Erkennung mit 64 Punkten Breite → geführter Filter)
  const iou = await ev(async () => { const im = new Image(); im.src = HT.doc.assets[HT.doc.layers.find(x => x.slot === 'person').src]; await im.decode(); const r = await HoneyThumbCut.person(im), w = r.mask.width, h = r.mask.height, a = r.mask.getContext('2d').getImageData(0, 0, w, h).data;
    const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(window.__truth, 0, 0, w, h); const b = t.getContext('2d').getImageData(0, 0, w, h).data; let i = 0, u = 0;
    for (let k = 3; k < a.length; k += 4){ const p = a[k] > 127, q = b[k] > 127; if (p && q) i++; if (p || q) u++; } return { iou: i / u, share: r.share, box: r.box }; });
  chk('Die Maske deckt sich mit der wahren Form (über 97 %)', iou.iou > 0.97, iou);
  const e1 = await px(1250, 500), e2 = await px(1230, 880), e3 = await px(900, 300);
  chk('Im Bild: Kopf und Oberkörper der Person stehen vor dem dunklen Hintergrund, das Zimmer ist weg', near(e2, [47, 75, 110], 40) && near(e3, [27, 27, 26], 22), { e1, e2, e3 });
  const out = await ev(() => { const l = HT.doc.layers.find(x => x.slot === 'person'), c = HoneyThumb.render(HT.doc, 1600), d = c.getContext('2d').getImageData(0, 0, 1600, 900).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 220 && d[i + 2] > 205 && d[i] - d[i + 2] > 8) n++; return { n, w: l.outline.w }; });
  chk('Der Umriss in Creme liegt um die Person', out.n > 4000, out);

  // ═════════ Texte ═════════
  await page.mouse.click(...(await ev(() => { const r = document.querySelector('#stageBox').getBoundingClientRect(), l = HT.doc.layers.find(x => x.slot === 'title'); return [r.left + (l.x + l.w / 2) * HT.scale, r.top + (l.y + 20) * HT.scale]; })));
  await sleep(150);
  chk('Ein Klick auf den Titel wählt ihn aus; rechts stehen seine Eigenschaften', await ev(() => HT.doc.layers.find(x => x.id === HT.sel)?.slot === 'title' && !!document.querySelector('#insp textarea') && !document.querySelector('#sel').classList.contains('hidden')));
  await page.fill('#insp textarea', 'Wer hat das *gesagt*?'); await page.dispatchEvent('#insp textarea', 'change'); await sleep(200);
  const t1 = await ev(() => { const l = HT.doc.layers.find(x => x.slot === 'title'), c = HoneyThumb.mkCanvas(10, 10).getContext('2d'), T = HoneyThumb.textLayout(c, l, 1); return { text: l.text, lines: T.lines.length, parts: T.lines.at(-1).t.at(-1).p.map(q => [q.s, q.a]), fits: T.total <= l.h + 1 && T.widest <= l.w + 1, title: document.querySelector('#inspTitle').textContent }; });
  chk('Der Titel bricht um und passt in sein Feld; „GESAGT“ ist hervorgehoben, das Fragezeichen hängt ohne Lücke daran', t1.fits && t1.lines >= 2 && JSON.stringify(t1.parts) === '[["GESAGT",true],["?",false]]', t1);
  const red = await ev(() => { const c = HoneyThumb.render(HT.doc, 1600), l = HT.doc.layers.find(x => x.slot === 'title'), d = c.getContext('2d').getImageData(l.x, l.y, l.w, l.h).data; let r = 0, w = 0; for (let i = 0; i < d.length; i += 4){ if (d[i] > 200 && d[i + 1] < 100 && d[i + 2] < 80) r++; if (d[i] > 220 && d[i + 1] > 215 && d[i + 2] > 200) w++; } return { r, w }; });
  chk('Im Titel stehen cremefarbene und rote Buchstaben', red.r > 3000 && red.w > 6000, red);
  await ev(() => { const l = HT.doc.layers.find(x => x.slot === 'title'); l.text = 'Ein sehr langer Titel mit vielen Wörtern, der niemals in dieses kleine Feld passen kann, egal wie man ihn dreht und wendet und kürzt'; HT.commit(); }); await sleep(250);
  const t2 = await ev(() => { const l = HT.doc.layers.find(x => x.slot === 'title'), T = HoneyThumb.textLayout(HoneyThumb.mkCanvas(10, 10).getContext('2d'), l, 1); return { fits: T.total <= l.h + 1 && T.widest <= l.w + 1, size: T.size, warn: !document.querySelector('#warn').classList.contains('hidden') }; });
  chk('Ein zu langer Text wird verkleinert, bis er passt; dazu erscheint ein Hinweis', t2.fits && t2.size < 100 && t2.warn, t2);
  await ev(() => document.activeElement.blur()); await page.keyboard.press('Control+z'); await sleep(250);
  chk('Strg+Z holt den vorigen Titel zurück', (await L('title')).text === 'Wer hat das *gesagt*?');

  // ═════════ Bühne: verschieben, vergrößern, drehen ═════════
  await page.click('#addBar [data-add="text"]'); await sleep(200);
  const n0 = await ev(() => { const l = HT.doc.layers.at(-1); return { id: l.id, x: l.x, y: l.y, w: l.w, h: l.h, size: l.size, sel: HT.sel === l.id, user: l.user }; });
  chk('„＋ Text“ legt eine neue Ebene obenauf und wählt sie aus', n0.sel && n0.user === true, n0);
  const P = (x, y) => ev(([x, y]) => { const r = document.querySelector('#stageBox').getBoundingClientRect(); return [r.left + x * HT.scale, r.top + y * HT.scale]; }, [x, y]);
  const dragTo = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 }); await page.mouse.move(...b, { steps: 4 }); await page.mouse.up(); await sleep(150); };
  await dragTo(await P(n0.x + n0.w / 2, n0.y + n0.h / 2), await P(n0.x + n0.w / 2 - 200, n0.y + n0.h / 2 + 150));
  const n1 = await ev(() => { const l = HT.doc.layers.at(-1); return { x: l.x, y: l.y }; });
  chk('Ziehen verschiebt die Ebene', Math.abs(n1.x - (n0.x - 200)) < 12 && Math.abs(n1.y - (n0.y + 150)) < 12, n1);
  await dragTo(await P(n1.x + n0.w / 2, n1.y + n0.h / 2), await P(800 + 3, n1.y + n0.h / 2));
  const n2 = await ev(() => { const l = HT.doc.layers.at(-1); return l.x + l.w / 2; });
  chk('Nahe der Bildmitte rastet die Ebene ein', Math.abs(n2 - 800) < 0.01, n2);
  const b0 = await ev(() => { const l = HT.doc.layers.at(-1); return { x: l.x, y: l.y, w: l.w, h: l.h, size: l.size }; });
  await dragTo(await P(b0.x + b0.w, b0.y + b0.h), await P(b0.x + b0.w * 0.5, b0.y + b0.h * 0.5));
  const b1 = await ev(() => { const l = HT.doc.layers.at(-1); return { x: l.x, y: l.y, w: l.w, h: l.h, size: l.size }; });
  chk('Der Eck-Anfasser verkleinert Feld und Schrift im selben Verhältnis; die Ecke gegenüber bleibt stehen', Math.abs(b1.w / b0.w - 0.5) < 0.04 && Math.abs(b1.size / b0.size - b1.w / b0.w) < 0.01 && Math.abs(b1.x - b0.x) < 1 && Math.abs(b1.y - b0.y) < 1, { b0, b1 });
  await dragTo(await P(b1.x + b1.w, b1.y + b1.h / 2), await P(b1.x + b1.w + 120, b1.y + b1.h / 2));
  const b2 = await ev(() => { const l = HT.doc.layers.at(-1); return { w: l.w, h: l.h, size: l.size }; });
  chk('Der Seiten-Anfasser ändert nur die Breite', Math.abs(b2.w - b1.w - 120) < 12 && b2.h === b1.h && b2.size === b1.size, b2);
  const rh = await ev(() => { const r = document.querySelector('#sel [data-h="rot"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }), cc = await P(b1.x + b2.w / 2, b1.y + b1.h / 2);
  await dragTo(rh, [cc[0] + (cc[1] - rh[1]), cc[1]]);
  chk('Der Dreh-Anfasser dreht um die Mitte (rastet bei 90° ein)', (await ev(() => HT.doc.layers.at(-1).rot)) === 90);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown'); await sleep(600);
  const k1 = await ev(() => { const l = HT.doc.layers.at(-1); return [l.x, l.y]; });
  chk('Pfeiltasten schieben um 1 und mit Umschalt um 10', Math.abs(k1[0] - (b1.x + 1)) < 0.01 && Math.abs(k1[1] - (b1.y + 10)) < 0.01, { k1, b1 });
  await page.keyboard.press('Control+d'); await sleep(200);
  const dup = await ev(() => ({ n: HT.doc.layers.length, sel: HT.sel === HT.doc.layers.at(-1).id }));
  await page.keyboard.press('Delete'); await sleep(200);
  chk('Strg+D dupliziert, Entf löscht', dup.n === 7 && dup.sel && (await ev(() => HT.doc.layers.length)) === 6, dup);

  // ═════════ Eigenschaften: Form, Symbol, Hintergrund ═════════
  await page.click('#addBar [data-add="shape"]'); await page.click('#modalCard [data-s="burst"]'); await sleep(200);
  await page.click('#insp .sw [data-k="fill"][data-j=\'"#EDE7DA"\']'); await sleep(150);
  const s1 = await ev(() => { const l = HT.doc.layers.at(-1); return { shape: l.shape, fill: l.fill }; });
  chk('Form „Zacken“ eingefügt und cremefarben gefärbt', s1.shape === 'burst' && s1.fill === '#EDE7DA', s1);
  await page.click('#addBar [data-add="icon"]'); await page.fill('#icQ', 'megafon'); await page.click('#icG [data-i="megafon"]'); await sleep(200);
  chk('Symbol über die Suche eingefügt', await ev(() => HT.doc.layers.at(-1).type === 'icon' && HT.doc.layers.at(-1).icon === 'megafon'));
  await ev(() => HT.select(null)); await sleep(100);
  await page.click('#insp [data-k="fill.kind"][data-j=\'"rays"\']'); await sleep(200);
  const g1 = await ev(() => ({ kind: HT.doc.layers[0].fill.kind, b: HT.doc.layers[0].fill.b, title: document.querySelector('#inspTitle').textContent, range: !!document.querySelector('#insp [data-k="fill.n"]') }));
  chk('Ohne Auswahl gehören die Eigenschaften dem Hintergrund; „Strahlen“ bringt eine zweite Farbe und eigene Regler', g1.kind === 'rays' && !!g1.b && g1.title === 'Hintergrund' && g1.range, g1);
  await ev(() => { const r = document.querySelector('#insp [data-k="fill.vig"]'); r.value = 0.5; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(150);
  chk('Ein Regler schreibt seinen Wert in die Ebene', await ev(() => HT.doc.layers[0].fill.vig === 0.5));

  // ═════════ Ebenen ═════════
  await page.click('#leftTabs [data-t="layers"]'); await sleep(150);
  const ll = await ev(() => [...document.querySelectorAll('#layerList .lay .n')].map(e => e.textContent));
  chk('Die Ebenenliste zeigt alles von vorn nach hinten', ll[0] === 'Megafon' && ll[1] === 'Zacken' && ll.at(-1) === 'Hintergrund' && ll.includes('Person'), ll);
  await page.click('#layerList .lay:nth-child(2) [data-a="hide"]'); await sleep(150);
  chk('Das Auge blendet eine Ebene aus', await ev(() => HT.doc.layers.at(-2).hide === true));
  await page.click('#layerList .lay:nth-child(1) .n'); await sleep(100); await page.click('#insp [data-act="down"]'); await sleep(150);
  chk('„Nach hinten“ tauscht die Reihenfolge', await ev(() => HT.doc.layers.at(-1).type === 'shape' && HT.doc.layers.at(-2).type === 'icon'));

  // ═════════ Maske nachbessern ═════════
  await ev(() => HT.select(HT.doc.layers.find(x => x.slot === 'person').id)); await sleep(150);
  await page.click('#insp [data-act="mask"]'); await page.waitForSelector('#mkView');
  const m0 = (await L('person')).mask, vb = await (await page.$('#mkView')).boundingBox();
  await page.evaluate(() => { document.querySelector('#mkSize').value = 120; });
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height * 0.2); await page.mouse.down(); await page.mouse.move(vb.x + vb.width / 2 + 30, vb.y + vb.height * 0.25, { steps: 5 }); await page.mouse.up();
  await page.click('#mkOk'); await sleep(400);
  const m1 = await ev(async () => { const l = HT.doc.layers.find(x => x.slot === 'person'), im = HoneyThumb.imgOf(HT.doc, l.mask), c = HoneyThumb.mkCanvas(im.naturalWidth, im.naturalHeight), x = c.getContext('2d'); x.drawImage(im, 0, 0); return { id: l.mask, a: x.getImageData(Math.round(im.naturalWidth / 2), Math.round(im.naturalHeight * 0.2), 1, 1).data[3], b: x.getImageData(Math.round(im.naturalWidth / 2), Math.round(im.naturalHeight * 0.8), 1, 1).data[3] }; });
  chk('Der Pinsel „Entfernen“ nimmt die bemalte Stelle aus der Maske, der Rest bleibt', m1.id !== m0 && m1.a < 20 && m1.b > 235, m1);

  // ═════════ Vorlage, Farbe, Format ═════════
  await page.click('#leftTabs [data-t="tpl"]'); await sleep(700);
  chk('Die Vorlagen zeigen den eigenen Inhalt; die aktuelle ist markiert', await ev(() => document.querySelectorAll('#tplGrid canvas').length === 14 && document.querySelector('#tplGrid .on')?.dataset.t === 'rechts'));
  await page.click('#tplGrid [data-t="balken"]'); await sleep(400);
  const v1 = await ev(() => { const d = HT.doc, b = d.layers[0]; return { tpl: d.tpl, bgImg: b.fill.img, auto: b.auto, src: d.keep.person.src, title: d.layers.find(x => x.slot === 'title').text, extra: d.layers.filter(x => x.user).map(x => x.type).join() }; });
  chk('„Bild mit Balken“ nimmt das unbeschnittene Foto als Hintergrund; Titel und eigene Ebenen bleiben', v1.tpl === 'balken' && v1.bgImg === v1.src && v1.auto === true && v1.title === 'Wer hat das *gesagt*?' && v1.extra === 'text,icon,shape', v1);
  await page.click('#tplGrid [data-t="kreis"]'); await sleep(400);
  const v2 = await L('person');
  chk('Zurück zu einer Vorlage mit Person: Freistellung und Maske sind noch da', !!v2.mask && v2.mask === m1.id && !!v2.src, { mask: !!v2.mask });
  await page.click('#edAcc'); await page.click('#modalCard [data-a="blau"]'); await sleep(300);
  const c1 = await ev(() => ({ key: HT.doc.accentKey, fill: HT.doc.layers.find(x => x.type === 'shape' && !x.user).fill, css: getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() }));
  chk('Akzentfarbe Blau färbt den Kreis und die Oberfläche um', c1.key === 'blau' && c1.fill === '#6F9BEA' && c1.css === '#6F9BEA', c1);
  await page.selectOption('#edFmt', '9:16'); await sleep(500);
  const f1 = await ev(() => { const d = HT.doc, f = HoneyThumb.format(d.format), b = document.querySelector('#stageBox'); return { fmt: d.format, ratio: b.clientWidth / b.clientHeight, inside: d.layers.filter(x => x.slot && x.type === 'text').every(x => x.x >= 0 && x.x + x.w <= f.w && x.y >= 0 && x.y + x.h <= f.h), mask: !!d.layers.find(x => x.slot === 'person').mask, key: d.accentKey, user: d.layers.filter(x => x.user).length }; });
  chk('Hochformat 9:16: Vorlage neu angeordnet, Texte im Bild, Person, Farbe und eigene Ebenen erhalten', f1.fmt === '9:16' && Math.abs(f1.ratio - 9 / 16) < 0.02 && f1.inside && f1.mask && f1.key === 'blau' && f1.user === 3, f1);
  for (let i = 0; i < 3; i++) await page.click('#undoBtn'); await sleep(300);
  chk('Dreimal „Rückgängig“ führt zurück zu „Bild mit Balken“ im Querformat in Rot', await ev(() => HT.doc.tpl === 'balken' && HT.doc.format === '16:9' && HT.doc.accentKey === 'rot' && document.querySelector('#edFmt').value === '16:9'));
  await page.click('#redoBtn'); await sleep(300);
  chk('„Wiederholen“ geht wieder vor', await ev(() => HT.doc.tpl === 'kreis'));

  // ═════════ Export ═════════
  const dl = async fn => { const [d] = await Promise.all([page.waitForEvent('download'), fn()]); const fs = await import('node:fs'); const p = await d.path(); return { name: d.suggestedFilename(), buf: fs.readFileSync(p) }; };
  await page.click('#edExport');
  const ex = await ev(() => [...document.querySelectorAll('#modalCard [data-w]')].map(b => b.textContent));
  const jpg = await dl(() => page.click('#modalCard [data-w="1280"]'));
  chk('Export bietet 1280 × 720 und 1920 × 1080; das JPG trägt Name und Größe und bleibt unter 2 MB', ex.join('|') === '1280 × 720|1920 × 1080' && jpg.name === 'Titelbild-1280x720.jpg' && jpg.buf[0] === 0xFF && jpg.buf[1] === 0xD8 && jpg.buf.length < 2e6 && jpg.buf.length > 20000, { ex, name: jpg.name, len: jpg.buf.length });
  await page.click('#edExport'); await page.click('#exType [data-y="image/png"]');
  const png = await dl(() => page.click('#modalCard [data-w="1920"]'));
  chk('PNG in 1920 × 1080', png.name === 'Titelbild-1920x1080.png' && png.buf.readUInt32BE(16) === 1920 && png.buf.readUInt32BE(20) === 1080, { name: png.name });
  await page.click('#edExport');
  const file = await dl(() => page.click('#exFile'));
  const fd = JSON.parse(file.buf.toString('utf8'));
  chk('Die .honeythumb-Datei enthält Ebenen und nur die benutzten Bilder', file.name === 'Titelbild.honeythumb' && fd.app === 'honeythumb' && fd.layers.length === (await ev(() => HT.doc.layers.length)) && Object.keys(fd.assets).length === 3, { name: file.name, assets: Object.keys(fd.assets).length });

  // ═════════ Speichern, Übersicht, Neustart, Datei öffnen ═════════
  await page.fill('#edName', 'Gen Z regelt'); await page.dispatchEvent('#edName', 'change'); await page.click('#edBack'); await page.waitForSelector('.thumb-card');
  const h1 = await ev(() => ({ n: document.querySelectorAll('.thumb-card').length, name: document.querySelector('.thumb-card b').textContent, pv: document.querySelector('.thumb-card img').src.startsWith('data:image/jpeg') }));
  chk('Die Übersicht zeigt das Titelbild mit Namen und Vorschau', h1.n === 1 && h1.name === 'Gen Z regelt' && h1.pv, h1);
  await page.reload(); await page.waitForSelector('.thumb-card'); await page.click('.thumb-card'); await page.waitForFunction(() => HT.doc && !document.querySelector('#ed').classList.contains('hidden'));
  const r1 = await ev(() => ({ tpl: HT.doc.tpl, mask: !!HoneyThumb.imgOf(HT.doc, HT.doc.layers.find(x => x.slot === 'person').mask), n: HT.doc.layers.length, name: document.querySelector('#edName').value }));
  chk('Nach einem Neustart ist alles wieder da, auch die Maske', r1.tpl === 'kreis' && r1.mask && r1.n === fd.layers.length && r1.name === 'Gen Z regelt', r1);
  await page.click('#edBack'); await page.waitForSelector('.thumb-card');
  await page.setInputFiles('#fileIn', { name: 'Titelbild.honeythumb', mimeType: 'application/json', buffer: file.buf }); await page.waitForFunction(() => HT.doc && !document.querySelector('#ed').classList.contains('hidden'));
  const o1 = await ev(() => ({ n: HT.doc.layers.length, mask: !!HoneyThumb.imgOf(HT.doc, HT.doc.layers.find(x => x.slot === 'person').mask) }));
  await page.click('#edBack'); await page.waitForSelector('.thumb-card');
  chk('Eine .honeythumb-Datei lässt sich öffnen und liegt danach als zweites Titelbild in der Übersicht', o1.n === fd.layers.length && o1.mask && (await ev(() => document.querySelectorAll('.thumb-card').length)) === 2, o1);
  const bad = await ev(() => { try { HoneyThumb.parse('{"app":"x"}'); return 'ok'; } catch (e) { return e.message; } });
  const clean = await ev(() => { const d = HoneyThumb.parse({ app: 'honeythumb', layers: [{ type: 'text', text: 'A', x: 'x', w: 1e9, size: -5 }, { type: 'böse' }], assets: { a: 'javascript:alert(1)', b: 'data:image/png;base64,AAAA' } }); return { n: d.layers.length, t: d.layers[1], assets: Object.keys(d.assets) }; });
  chk('Fremde Dateien werden abgewiesen; Werte in .honeythumb-Dateien werden begrenzt, unbekannte Ebenen und Adressen fallen weg', bad === 'Das ist keine HoneyThumb-Datei.' && clean.n === 2 && clean.t.x === 0 && clean.t.w === 20000 && clean.t.size === 6 && clean.assets.length === 0, { bad, clean });
  page.once('dialog', d => d.accept()); await page.click('.thumb-card [data-a="del"]'); await sleep(300);
  chk('Löschen nimmt ein Titelbild aus der Übersicht', (await ev(() => document.querySelectorAll('.thumb-card').length)) === 1);

  // ═════════ Bild öffnen → neues Titelbild mit Freistellung ═════════
  const jpgBuf = Buffer.from((await ev(FOTO)).split(',')[1], 'base64');
  await page.setInputFiles('#fileIn', { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: jpgBuf }); await page.waitForSelector('#ndGrid canvas');
  await page.click('#ndGrid [data-t="strahlen"]'); await page.waitForFunction(() => HT.doc && HT.doc.layers.find(x => x.slot === 'person')?.mask, null, { timeout: 15000 });
  chk('Ein geöffnetes Foto landet in der gewählten Vorlage und wird gleich freigestellt', await ev(() => HT.doc.tpl === 'strahlen' && !!HT.doc.layers.find(x => x.slot === 'person').src));
  await page.click('#edBack'); await page.waitForSelector('.thumb-card');
} catch (e) { chk('Ablauf ohne Abbruch', false, String(e && e.stack || e).slice(0, 600)); }

// ═════════ Handy-Ansicht ═════════
try {
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 800 }); m.on('pageerror', e => logs.push('Handy: ' + e.message));
  await m.goto(URL0); await m.waitForSelector('.thumb-card'); await m.click('.thumb-card'); await m.waitForFunction(() => HT.doc && !document.querySelector('#ed').classList.contains('hidden')); await sleep(400);
  const a = await m.evaluate(() => { const vis = s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, r = s => document.querySelector(s).getBoundingClientRect();
    return { tabs: vis('#mobTabs'), insp: vis('#paneInsp'), left: vis('#paneL'), stageTop: r('#paneStage').top < r('#paneInsp').top, wide: document.documentElement.scrollWidth <= innerWidth, exp: r('#edExport').right <= innerWidth, fmt: vis('#edFmt'), more: vis('#edMore') }; });
  chk('Schmales Fenster: Bild oben, darunter „Bearbeiten“, unten drei Reiter; nichts ragt über den Rand', a.tabs && a.insp && !a.left && a.stageTop && a.wide && a.exp && !a.fmt && a.more, a);
  await m.click('#mobTabs [data-t="tpl"]'); await sleep(700);
  const b = await m.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { n: document.querySelectorAll('#tplGrid canvas').length, below: r('#paneL').top >= r('#paneStage').bottom - 1, insp: document.querySelector('#paneInsp').offsetParent !== null }; });
  chk('Reiter „Vorlagen“ zeigt die Vorlagen unter dem Bild', b.n === 14 && b.below && !b.insp, b);
  await m.click('#mobTabs [data-t="layers"]'); await sleep(200); await m.click('#layerList .lay .n'); await sleep(200);
  chk('Antippen einer Ebene wählt sie und wechselt zu „Bearbeiten“', await m.evaluate(() => !!HT.sel && document.querySelector('#paneInsp').offsetParent !== null && document.querySelector('#mobTabs .on').dataset.t === 'insp'));
  await m.click('#edMore'); await m.click('#modalCard [data-f="1:1"]'); await sleep(400);
  chk('„⋯“ wechselt das Format', await m.evaluate(() => HT.doc.format === '1:1'));
  await m.close();
} catch (e) { chk('Handy-Ansicht ohne Abbruch', false, String(e && e.stack || e).slice(0, 600)); }

await browser.close();
ende(logs);
