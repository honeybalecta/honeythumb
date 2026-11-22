'use strict';
/* HoneyThumb – Oberfläche: Übersicht, Editor (Bühne mit Anfassern, Eigenschaften, Vorlagen, Ebenen), Freistellen, Export.
   Läuft im Browser, als Windows-Programm (pywebview) und in der Android-App (WebView). */
(function(){
  const H = HoneyThumb, CUT = HoneyThumbCut, IC = HoneyThumbIcons, PAL = H.PAL;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
  const DESKTOP = /[?&]desktop=1/.test(location.search);
  const compact = () => matchMedia('(max-width:860px)').matches;
  function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3400); }
  function busy(msg){ $('#busy').classList.toggle('hidden', !msg); if (msg) $('#busyMsg').textContent = msg; }

  // ───────── Ablage: Windows über das Programm, sonst IndexedDB ─────────
  // Windows: Das Programm reicht den Speicher über seinen eigenen Server (/__store/…, mit dem Schlüssel k aus der Adresse).
  // Die Brücke von pywebview ist für Megabytes zu langsam – mit ihr stand das Programm beim Öffnen, sobald Bilder hinterlegt waren.
  const Store = (() => {
    let api = null;
    const KEY = (location.search.match(/[?&]k=([\w-]+)/) || [])[1] || '';
    const http = DESKTOP && KEY ? async (op, q, body) => { const r = await fetch(`/__store/${op}?${q}`, {method: body == null ? 'GET' : 'POST', headers: {'X-HoneyThumb': KEY}, body, cache: 'no-store'}); if (!r.ok) throw new Error('Der Speicher antwortet nicht (' + r.status + ').'); return r; } : null;
    const enc = encodeURIComponent;
    const ready = new Promise(res => {
      if (!DESKTOP) return res();
      if (window.pywebview && window.pywebview.api){ api = window.pywebview.api; return res(); }
      window.addEventListener('pywebviewready', () => { api = window.pywebview.api; res(); });
      setTimeout(res, 4000);
    });
    let dbP = null;
    const db = () => dbP ||= new Promise((res, rej) => { const r = indexedDB.open('honeythumb', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('kv', mode), s = t.objectStore('kv'); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
    return {
      async get(k){ if (http){ const t = await (await http('get', 'key=' + enc(k))).text(); return t ? JSON.parse(t) : null; } await ready; if (api){ const s = await api.store_get(k); return s ? JSON.parse(s) : null; } return tx('readonly', s => s.get(k)); },
      async set(k, v){ if (http) return void await http('set', 'key=' + enc(k), JSON.stringify(v)); await ready; if (api) return api.store_set(k, JSON.stringify(v)); return tx('readwrite', s => s.put(v, k)); },
      async del(k){ if (http) return void await http('del', 'key=' + enc(k), ''); await ready; if (api) return api.store_del(k); return tx('readwrite', s => s.delete(k)); },
      async keys(prefix){ if (http) return (await (await http('keys', 'prefix=' + enc(prefix))).json()) || []; await ready; if (api) return (await api.store_keys(prefix)) || []; const all = await tx('readonly', s => s.getAllKeys()); return (all || []).filter(k => String(k).startsWith(prefix)); },
      get desktop(){ return !!api; }, ready,
    };
  })();
  const blobB64 = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(b); });
  async function saveBlob(blob, name){
    if (Store.desktop && window.pywebview.api.save_file){ const p = await window.pywebview.api.save_file(name, await blobB64(blob)); if (p) toast('Gespeichert: ' + p); return; }
    if (window.ThumbNative && window.ThumbNative.saveFile){ const r = window.ThumbNative.saveFile(name, blob.type || 'application/octet-stream', await blobB64(blob)); if (r) toast(r); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); toast('Gespeichert: ' + name);
  }
  const safeName = s => String(s || 'Titelbild').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || 'Titelbild';

  // ───────── Zustand ─────────
  let doc = null, selId = null, hist = [], hi = -1, saveT = 0, tplT = 0, leftTab = 'tpl', mobTab = 'insp';
  const F = () => H.format(doc.format);
  const cur = () => doc && doc.layers.find(L => L.id === selId) || null;
  const bgL = () => doc.layers.find(L => L.type === 'bg');
  const target = () => cur() || bgL();
  const snap = () => JSON.stringify({layers: doc.layers, format: doc.format, tpl: doc.tpl, accent: doc.accent, accentKey: doc.accentKey, keep: doc.keep || {}});
  // Stand festhalten (für Rückgängig) und speichern; ohne Änderung an den Ebenen entsteht kein neuer Schritt
  const pool = {};   // alle Bilder dieser Sitzung – damit Rückgängig auch Ebenen zurückholt, deren Bild inzwischen aufgeräumt wurde
  function commit(){ H.pinTop(doc); H.packFonts(doc); Object.assign(pool, doc.assets); doc.updated = Date.now(); const s = snap(); if (s !== hist[hi]){ hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; } after(); }
  function after(){ $('#undoBtn').disabled = hi <= 0; $('#redoBtn').disabled = hi >= hist.length - 1; $('#saved').textContent = '…'; clearTimeout(saveT); saveT = setTimeout(saveNow, 700); draw(); layerList(); clearTimeout(tplT); tplT = setTimeout(tplGrid, 500); }
  function travel(d){ if (hi + d < 0 || hi + d >= hist.length) return; hi += d; Object.assign(doc, JSON.parse(hist[hi])); doc.assets = {...pool, ...doc.assets}; if (!cur()) selId = null; fillBar(); fitStage(); after(); inspector(); }
  async function saveNow(){
    if (!doc) return; clearTimeout(saveT);
    try { const d = H.prune(H.clone(doc)), pv = H.render(doc, 480).toDataURL('image/jpeg', 0.8);
      await Store.set('thumb:' + d.id, d); await Store.set('meta:' + d.id, {id: d.id, name: d.name, format: d.format, updated: d.updated, preview: pv}); $('#saved').textContent = 'gespeichert'; }
    catch(e){ $('#saved').textContent = 'nicht gespeichert'; toast('Speichern fehlgeschlagen: ' + e.message); }
  }

  // ───────── Übersicht ─────────
  async function showHome(){
    doc = null; selId = null; $('#ed').classList.add('hidden'); $('#home').classList.remove('hidden');
    const metas = []; for (const k of await Store.keys('meta:')){ try { const m = await Store.get(k); if (m && m.id) metas.push(m); } catch(_){} }
    metas.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    $('#homeEmpty').classList.toggle('hidden', metas.length > 0);
    $('#thumbList').innerHTML = metas.map(m => `<div class="thumb-card" data-id="${esc(m.id)}" tabindex="0"><img src="${esc(m.preview || '')}" alt=""><div class="meta"><b>${esc(m.name)}</b><span class="muted small">${esc(H.format(m.format).n)} · ${new Date(m.updated || 0).toLocaleDateString('de-DE')}</span></div>
      <div class="acts"><button data-a="ren" title="Umbenennen">✎</button><button data-a="dup" title="Duplizieren">⧉</button><button data-a="del" title="Löschen">🗑</button></div></div>`).join('');
  }
  $('#thumbList').addEventListener('click', async e => {
    const card = e.target.closest('.thumb-card'); if (!card) return; const id = card.dataset.id, a = e.target.closest('[data-a]'), d = await Store.get('thumb:' + id); if (!d) return showHome();
    if (!a) return openDoc(d);
    if (a.dataset.a === 'ren'){ const n = prompt('Neuer Name', d.name); if (n && n.trim()){ d.name = n.trim(); d.updated = Date.now(); const m = await Store.get('meta:' + id); await Store.set('thumb:' + id, d); await Store.set('meta:' + id, {...m, name: d.name, updated: d.updated}); showHome(); } }
    if (a.dataset.a === 'dup'){ const c = H.clone(d), m = await Store.get('meta:' + id); c.id = H.uid(); c.name = d.name + ' (Kopie)'; c.updated = Date.now(); await Store.set('thumb:' + c.id, c); await Store.set('meta:' + c.id, {...m, id: c.id, name: c.name, updated: c.updated}); showHome(); }
    if (a.dataset.a === 'del' && confirm(`„${d.name}“ löschen?`)){ await Store.del('thumb:' + id); await Store.del('meta:' + id); showHome(); }
  });
  $('#thumbList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('thumb-card')) e.target.click(); });

  // ───────── Dialoge ─────────
  function modal(html, cls = ''){ const old = $('#modalCard'), c = old.cloneNode(false); old.replaceWith(c); c.className = 'modal-card ' + cls; c.innerHTML = html; $('#modal').classList.remove('hidden'); return c; }
  function closeModal(){ $('#modal').classList.add('hidden'); $('#modalCard').innerHTML = ''; }
  $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });


  // ───────── Markenunterlagen: fest hinterlegte Bilder und die Akzentfarbe einer Marke ─────────
  // Eine Marke (z. B. der eigene Kanal oder eine Abgeordnete) trägt Personen (ein oder mehrere freigestellte Bilder), Auflagen (liegen immer ganz oben, je Format;
  // auf Wunsch bei jedem neuen Titelbild dabei), Grafiken (Logos, Wasserzeichen) und Hintergründe. Es gilt immer die gewählte Marke.
  // Speicher des Geräts: „brand:ID“ je Marke, „set:brand“ die gewählte Marke, „lib:ID“ je Eintrag – nur das Leichte (Name, Marke, Vorschaubild, Einstellungen, v: 2).
  // Bilder und Schriftdateien liegen getrennt unter „libd:ID“ (je Bild einer Person „libd:ID.BILD“) und werden erst gelesen, wenn sie gebraucht werden.
  // So liest der Start nur Kleines – vorher las er alles und blieb mit vielen hinterlegten Bildern stehen. „Sichern“ schreibt eine Marke im Ganzen in eine Datei für ein anderes Gerät.
  const KINDS = [
    {k: 'person', n: 'Personen', one: 'Person', hint: 'Menschen, die regelmäßig auf deinen Titelbildern stehen. Je Person ein oder mehrere Bilder – ein Tipp setzt sie ins Titelbild.'},
    {k: 'overlay', n: 'Auflagen', one: 'Auflage', hint: 'Bilder, die immer ganz oben liegen, etwa ein Banner am unteren Rand. Durchsichtige Stellen lassen das Titelbild durch; die Vorlagen ordnen alles in der freien Fläche an.'},
    {k: 'graphic', n: 'Grafiken', one: 'Grafik', hint: 'Logos, Wasserzeichen, Knöpfe und andere Bilder, die du immer wieder brauchst.'},
    {k: 'bg', n: 'Hintergründe', one: 'Hintergrund', hint: 'Bilder, die du immer wieder als Hintergrund nimmst. Ein Tipp setzt sie hinter alles andere.'},
    {k: 'font', n: 'Schriften', one: 'Schrift', hint: 'Eigene Schriftdateien (TTF, OTF, WOFF) – etwa die Schriften deines Kanals. Sie stehen bei jedem Text zur Wahl. „Titel“ und „Klein“ legen fest, welche Schrift die Pinselbalken-Vorlagen nehmen.'},
  ];
  let lib = [], libP = null, brands = [], brandId = null;
  const brand = () => brands.find(b => b.id === brandId) || brands[0] || {id: null, name: 'Meine Marke', accentKey: 'rot'};
  const mine = k => lib.filter(i => i.brand === brandId && (!k || i.kind === k));
  async function brandSave(b){ const i = brands.findIndex(x => x.id === b.id); if (i < 0) brands.push(b); else brands[i] = b; brands.sort((a, c) => String(a.name).localeCompare(String(c.name), 'de')); await Store.set('brand:' + b.id, b); return b; }
  async function brandUse(id){ brandId = id; await Store.set('set:brand', id); if (!doc) document.documentElement.style.setProperty('--acc', H.accent(brand().accentKey).dark); await autoReady(); }
  async function brandDel(id){ for (const it of lib.filter(i => i.brand === id)) await libDel(it.id); brands = brands.filter(b => b.id !== id); await Store.del('brand:' + id); await brandUse(brands[0].id); }
  const DATA = /^data:image\/(png|jpeg|webp|gif);base64,/;
  const libSort = () => lib.sort((a, b) => String(a.name).localeCompare(String(b.name), 'de'));
  const dKey = (it, pic) => 'libd:' + it.id + (pic ? '.' + pic.id : '');
  async function heavy(it, pic){ const d = await Store.get(dKey(it, pic)); if (!d) throw new Error(`Die Daten zu „${it.name}“ fehlen auf diesem Gerät.`); return d; }
  async function dataDel(id){ for (const k of await Store.keys('libd:' + id)) if (k === 'libd:' + id || k.startsWith('libd:' + id + '.')) await Store.del(k); }
  // Vollständigen Eintrag (aus einer Datei oder aus 1.1–1.4) aufteilen: erst das Schwere ablegen, dann den leichten Eintrag
  async function split(full){
    const it = {...full, v: 2};
    if (it.kind === 'person'){ it.pics = []; for (const q of full.pics || []){ if (!q || !q.img) continue; const id = q.id || H.uid(); await Store.set(dKey(it, {id}), {img: q.img, mask: q.mask || null, src: q.src || null}); it.pics.push({id, thumb: q.thumb || '', m: !!q.mask, s: !!q.src}); } }
    else if (it.kind === 'font'){ await Store.set(dKey(it), {url: full.url}); delete it.url; }
    else { await Store.set(dKey(it), {img: full.img}); delete it.img; }
    await Store.set('lib:' + it.id, it); return it;
  }
  // Einträge lesen – nur das Leichte. Läuft nach dem Start im Hintergrund; alles, was die Einträge braucht, wartet darauf.
  function libReady(){ return libP ||= (async () => {
    for (const k of await Store.keys('brand:')){ try { const b = await Store.get(k); if (b && b.id) brands.push(b); } catch(_){} }
    brandId = await Store.get('set:brand').catch(() => null);
    if (!brands.length) await brandSave({id: H.uid(), name: 'Meine Marke', accentKey: 'rot'});   // auch für Einträge aus 1.1.0, die noch keine Marke tragen
    if (!brands.some(b => b.id === brandId)) brandId = brands[0].id;
    for (const k of await Store.keys('lib:')){ try { let it = await Store.get(k); if (!it || !it.id || !KINDS.some(x => x.k === it.kind)) continue;
      if (it.v !== 2) it = await split(it);
      if (!brands.some(b => b.id === it.brand)){ it.brand = brandId; await Store.set('lib:' + it.id, it); }
      lib.push(it); } catch(_){} }
    libSort(); })().catch(() => null); }
  // Auflagen der gewählten Marke, die „immer dabei“ sind: Bild holen und dekodieren – für neue Titelbilder und ihre Vorschauen
  const ovImg = new Map();
  async function autoReady(){ await libReady(); for (const it of mine('overlay')){ if (!it.auto || ovImg.has(it.id)) continue; try { const d = await heavy(it); await H.decode(d.img); ovImg.set(it.id, d.img); } catch(_){} } }
  // Eigene Schriften anmelden (im Hintergrund, eine nach der anderen)
  async function fontsBg(){ await libReady(); for (const it of lib) if (it.kind === 'font' && !H.userFonts.has('u:' + it.id)){ try { await H.addFont('u:' + it.id, it.name, (await heavy(it)).url); } catch(_){} } if (doc) inspector(); }
  // Schriftdatei wählen und in die Markenunterlagen aufnehmen
  let fontRes = null;
  function pickFont(){ return new Promise(res => { fontRes = res; const i = $('#fontIn'); i.value = ''; i.click(); }); }
  $('#fontIn').addEventListener('change', e => { const f = e.target.files[0], res = fontRes; fontRes = null; if (res) res(f || null); });
  async function libAddFont(file){
    const ext = (file.name.split('.').pop() || '').toLowerCase(); if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) throw new Error('HoneyThumb liest Schriften als TTF, OTF oder WOFF.'); if (file.size > 4e6) throw new Error('Die Schriftdatei ist größer als 4 MB.');
    await libReady(); const id = H.uid(), url = `data:font/${ext};base64,` + await blobB64(file), name = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 60);
    await H.addFont('u:' + id, name, url); await Store.set('libd:' + id, {url}); return libSave({id, kind: 'font', name, v: 2});
  }
  const fontsOf = () => { const f = brand().fonts || {}, ok = k => k && mine('font').some(i => 'u:' + i.id === k) ? k : null; return {title: ok(f.title), small: ok(f.small)}; };
  async function libSave(it){ it.updated = Date.now(); it.brand ||= brandId; const i = lib.findIndex(x => x.id === it.id); if (i < 0) lib.push(it); else lib[i] = it; libSort(); await Store.set('lib:' + it.id, it); return it; }
  async function libDel(id){ lib = lib.filter(x => x.id !== id); ovImg.delete(id); await Store.del('lib:' + id); await dataDel(id); }
  // Kleines Vorschaubild (freigestellt, mit Transparenz)
  async function thumbOf(url, maskUrl){ const im = await H.decode(url), mk = maskUrl ? await H.decode(maskUrl) : null, src = H.cutout(im, mk), w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, k = Math.min(1, 220 / Math.max(w, h)), c = H.mkCanvas(w * k, h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/png'); }
  // Hat das Bild schon einen durchsichtigen Hintergrund?
  function hasAlpha(im){ const c = H.mkCanvas(48, 48), x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(im, 0, 0, 48, 48); const d = x.getImageData(0, 0, 48, 48).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 128) n++; return n > 48 * 48 * 0.03; }
  const nearFmt = ar => H.FORMATS.reduce((a, f) => Math.abs(Math.log(f.w / f.h / ar)) < Math.abs(Math.log(a.w / a.h / ar)) ? f : a).k;
  // Bild in die Markenunterlagen aufnehmen. Person: freigestellte Bilder bleiben, wie sie sind; alle anderen werden freigestellt.
  async function libAddImage(kind, url, o = {}){
    await libReady(); const im = await H.decode(url), ar = im.naturalWidth / im.naturalHeight, name = String(o.name || pickImage.last || KINDS.find(x => x.k === kind).one).slice(0, 60);
    if (kind === 'person'){ let d;
      if (o.pic) d = {img: o.pic.img, mask: o.pic.mask || null, src: o.pic.src || null};
      else if (hasAlpha(im)) d = {img: url, mask: null, src: null};
      else { busy('Stelle die Person frei …'); try { const r = await CUT.person(im, {msg: busy}), c = CUT.crop(im, r.mask, r.box); d = {img: c.img, mask: c.mask, src: url}; } finally { busy(''); } }
      const it = (o.id && lib.find(x => x.id === o.id)) || {id: H.uid(), kind, name, pics: [], v: 2}, pic = {id: H.uid(), thumb: await thumbOf(d.img, d.mask), m: !!d.mask, s: !!d.src};
      await Store.set(dKey(it, pic), d); it.pics.push(pic); return libSave(it); }
    const it = kind === 'overlay' ? {id: H.uid(), kind, name, ar, band: H.bandOf(im), formats: [nearFmt(ar)], auto: true, thumb: await thumbOf(url), v: 2} : {id: H.uid(), kind, name, ar, thumb: await thumbOf(url), v: 2};
    await Store.set(dKey(it), {img: url}); if (kind === 'overlay') ovImg.set(it.id, url); return libSave(it);
  }
  // Auflagen, die bei neuen Titelbildern dieses Formats immer dabei sind (ohne die, die das Titelbild schon trägt)
  function autoTops(fmt, have){ const holder = {assets: {}}, extra = [];
    for (const it of mine('overlay')){ const img = ovImg.get(it.id); if (!it.auto || !(it.formats || []).includes(fmt) || !img) continue; if (have && have.layers.some(L => L.lib === it.id)) continue;
      extra.push(H.overlayLayer(fmt, H.addAsset(holder, img), {lib: it.id, name: it.name, fmts: it.formats.slice(), band: it.band, ar: it.ar})); }
    return {assets: holder.assets, extra}; }
  // Einsetzen ins offene Titelbild
  async function putPerson(L, it, pic){ const d = await heavy(it, pic); L.img = H.addAsset(doc, d.img); if (d.mask) L.mask = H.addAsset(doc, d.mask); else delete L.mask; if (d.src) L.src = H.addAsset(doc, d.src); else delete L.src; delete L.auto; await H.load(doc); return L; }
  async function usePerson(it, pic){
    let L = doc.layers.find(x => x.type === 'img' && x.slot === 'person' && (!x.img || x.auto));
    if (L) await putPerson(L, it, pic);
    else { L = await putPerson(H.newLayer(doc, 'img', {pos: {x: 0.5, y: 1}, outline: {w: 9, c: H.lum(H.bgColor(doc)) < 0.5 ? PAL.cream : PAL.ink}}), it, pic); const im = H.imgOf(doc, L.img); standPerson(L, im.naturalWidth / im.naturalHeight); doc.layers.push(L); }
    commit(); select(L.id); setMob('insp'); return L;
  }
  async function useOverlay(it){
    if (doc.layers.some(L => L.lib === it.id)) return void toast(`„${it.name}“ liegt schon auf diesem Titelbild.`);
    const L = H.overlayLayer(doc.format, H.addAsset(doc, (await heavy(it)).img), {lib: it.id, name: it.name, fmts: [...new Set([...(it.formats || []), doc.format])], band: it.band, ar: it.ar}); await H.load(doc); doc.layers.push(L);
    const ins = H.topInset([L], F()); if (doc.tpl && ins.t + ins.b > 0){ doc = H.retemplate(doc, doc.tpl); toast(`„${it.name}“ liegt obenauf. Die Vorlage ist neu angeordnet, damit nichts darunter verschwindet.`); } else toast(`„${it.name}“ liegt obenauf.`);
    selId = null; commit(); inspector(); return L;
  }
  async function useBg(it){ await setImage(bgL(), (await heavy(it)).img); selId = null; commit(); inspector(); toast(`Hintergrund „${it.name}“ gesetzt.`); }
  async function useGraphic(it){ const id = H.addAsset(doc, (await heavy(it)).img); await H.load(doc); const im = H.imgOf(doc, id); return addLayer(H.newLayer(doc, 'img', {img: id, name: it.name, ratio: im.naturalWidth / im.naturalHeight})); }

  // Dialog der Markenunterlagen. o.kind: Reiter zu Beginn; o.pick(Bild der Person | Eintrag): statt ins Titelbild einzusetzen
  // Ansichten: Liste (Reiter), eine Person (open), die Marke selbst (view 'brand'), Eintrag in eine andere Marke legen (view 'move')
  function libDialog(o = {}){
    let kind = o.kind || 'person', open = null, view = '', mv = null;
    const c = modal('', 'lib'), can = !!doc, K = () => KINDS.find(x => x.k === kind), item = id => lib.find(i => i.id === id), tap = k => k === 'graphic' || k === 'bg';
    const card = (attr, thumb, body, acts) => `<div class="lib-card" ${attr}><div class="pic"><img src="${esc(thumb || '')}" alt=""></div>${body}${acts ? `<div class="acts">${acts}</div>` : ''}</div>`;
    const moveBtn = () => brands.length > 1 ? `<button data-lb="move" title="In eine andere Marke legen" aria-label="In eine andere Marke legen">⇄</button>` : '';
    const paint = () => {
      const p = open && item(open), B = brand(); let h = `<h2>Markenunterlagen</h2>`;
      if (view === 'brand'){ h += `<div class="row"><button class="btn ghost" data-lb="back">‹ Zurück</button><input id="lbBName" value="${esc(B.name)}" maxlength="60" aria-label="Name der Marke" spellcheck="false"></div>
          <div class="f"><span>Akzentfarbe neuer Titelbilder</span><div class="acc-pop">${H.ACCENTS.map(a => `<button data-lacc="${a.k}" class="${a.k === H.accent(B.accentKey).k ? 'on' : ''}" style="background:${a.dark}" title="${esc(a.n)}" aria-label="${esc(a.n)}"></button>`).join('')}</div></div>
          <p class="hint">${mine().length === 1 ? '1 Eintrag' : mine().length + ' Einträge'} in dieser Marke. „Sichern“ schreibt die Marke im Ganzen in eine Datei – Name, Farbe, Personen, Auflagen, Grafiken und Hintergründe. Auf einem anderen Gerät liest „Laden“ oder „Öffnen“ sie ein.</p>
          <div class="modal-foot"><button class="btn ghost" data-lb="bdel"${brands.length > 1 ? '' : ' disabled title="Die letzte Marke bleibt"'}>Marke löschen</button><span class="grow"></span><button class="btn primary" data-lb="save">Sichern (Datei)</button><button class="btn ghost" data-lb="x">Schließen</button></div>`; }
      else if (view === 'move'){ const it = item(mv); h += `<div class="row"><button class="btn ghost" data-lb="back">‹ Zurück</button><b>„${esc(it.name)}“ in eine andere Marke legen</b></div><div class="row wrap">${brands.filter(b => b.id !== it.brand).map(b => `<button class="btn" data-lmv="${b.id}">${esc(b.name)}</button>`).join('')}</div>`; }
      else if (p){ h += `<div class="row"><button class="btn ghost" data-lb="back">‹ Personen</button><input id="lbName" value="${esc(p.name)}" maxlength="60" aria-label="Name der Person" spellcheck="false"></div>
          <div class="lib-grid">${p.pics.map(q => card(`data-lp="${q.id}"${can ? ' tabindex="0" title="Ins Titelbild einsetzen"' : ''}`, q.thumb, can ? `<span class="go">Einsetzen</span>` : '', `<button data-lb="delpic" title="Bild löschen" aria-label="Bild löschen">🗑</button>`)).join('') || '<p class="hint">Noch kein Bild. Füge eines hinzu.</p>'}</div>
          <p class="hint">Bilder mit durchsichtigem Hintergrund bleiben, wie sie sind. Bei allen anderen stellt HoneyThumb die Person frei.</p>
          <div class="modal-foot"><button class="btn ghost" data-lb="delitem">Person löschen</button>${brands.length > 1 ? `<button class="btn ghost" data-lb="move">⇄ Andere Marke</button>` : ''}<span class="grow"></span><button class="btn primary" data-lb="addpic">＋ Bild hinzufügen</button><button class="btn ghost" data-lb="x">Schließen</button></div>`; }
      else { h += `<div class="row brand-row"><label class="sel-lbl grow"><span>Marke</span><select id="lbBrand" aria-label="Marke">${brands.map(b => `<option value="${b.id}"${b.id === brandId ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label><button class="btn small" data-lb="bedit" title="Name, Farbe, sichern, löschen">✎ Marke</button><button class="btn small" data-lb="bnew">＋ Neue Marke</button></div>
          <div class="tabs">${KINDS.map(x => `<button data-lk="${x.k}" class="${x.k === kind ? 'on' : ''}">${esc(x.n)}</button>`).join('')}</div><p class="hint">${esc(K().hint)}</p><div class="lib-grid">`;
        for (const it of mine(kind)){
          if (kind === 'person') h += card(`data-li="${it.id}" tabindex="0"`, it.pics[0] && it.pics[0].thumb, `<b>${esc(it.name)}</b><span class="muted small">${it.pics.length === 1 ? '1 Bild' : it.pics.length + ' Bilder'}</span>`, `<button data-lb="edit" title="Bilder und Name bearbeiten" aria-label="Bearbeiten">✎</button>`);
          else if (kind === 'font'){ const k = 'u:' + it.id, fo = fontsOf(), ff = (H.FONTS.find(x => x.k === k) || {}).f;
            h += `<div class="lib-card" data-li="${it.id}"><div class="pic font" style="font-family:'${ff || 'Inter'}'">${ff ? 'Abc 123' : 'nicht lesbar'}</div><b>${esc(it.name)}</b><div class="seg fm" title="Schrift der Pinselbalken-Vorlagen"><button data-lrole="title" class="${fo.title === k ? 'on' : ''}">Titel</button><button data-lrole="small" class="${fo.small === k ? 'on' : ''}">Klein</button></div><div class="acts">${moveBtn()}<button data-lb="delitem" title="Löschen" aria-label="Löschen">🗑</button></div></div>`; }
          else h += card(`data-li="${it.id}"${can && tap(kind) ? ' tabindex="0" title="Ins Titelbild einsetzen"' : ''}`, it.thumb, `<input class="nm" data-ln="${it.id}" value="${esc(it.name)}" maxlength="60" aria-label="Name" spellcheck="false">` +
            (kind === 'overlay' ? `<div class="seg fm" title="Formate, für die diese Auflage gilt">${H.FORMATS.map(f => `<button data-lf="${f.k}" class="${(it.formats || []).includes(f.k) ? 'on' : ''}">${f.k}</button>`).join('')}</div><label class="chk small"><input type="checkbox" data-lauto${it.auto ? ' checked' : ''}> Immer dabei</label>` : '') +
            (can ? `<span class="go" data-lb="use">Einsetzen</span>` : ''), moveBtn() + `<button data-lb="delitem" title="Löschen" aria-label="Löschen">🗑</button>`); }
        h += (mine(kind).length ? '' : `<p class="hint">Noch nichts hinterlegt.</p>`) + `</div>` + (kind === 'overlay' ? `<p class="hint">„Immer dabei“: Jedes neue Titelbild in den gewählten Formaten bekommt die Auflage von selbst – solange diese Marke gewählt ist.</p>` : '') +
          `<div class="modal-foot"><button class="btn ghost small" data-lb="load" title="Markenunterlagen von einem anderen Gerät einlesen">Laden</button><button class="btn ghost small" data-lb="save" title="Diese Marke im Ganzen als Datei sichern – für ein anderes Gerät"${mine().length ? '' : ' disabled'}>Sichern</button><span class="grow"></span><button class="btn primary" data-lb="add">＋ ${esc(K().one)}</button><button class="btn ghost" data-lb="x">Schließen</button></div>`; }
      c.innerHTML = h;
    };
    const fail = e => { busy(''); toast((e && e.message) || 'Das hat nicht geklappt.'); };
    const use = async (it, pic) => { closeModal(); try { if (o.pick) await o.pick(pic || it, it); else if (it.kind === 'person') await usePerson(it, pic); else if (it.kind === 'overlay') await useOverlay(it); else if (it.kind === 'bg') await useBg(it); else await useGraphic(it); } catch(e){ fail(e); } };
    c.addEventListener('click', async e => {
      const t = e.target, b = t.closest('[data-lb]'), a = b && b.dataset.lb, cd = t.closest('.lib-card'), it = cd && cd.dataset.li ? item(cd.dataset.li) : open ? item(open) : null;
      try {
        if (t.closest('[data-lk]')){ kind = t.closest('[data-lk]').dataset.lk; paint(); }
        else if (a === 'x') closeModal();
        else if (a === 'back'){ if (view) view = ''; else open = null; paint(); }
        else if (a === 'save') brandFile();
        else if (a === 'load'){ closeModal(); $('#homeImport').click(); }
        else if (a === 'bedit'){ view = 'brand'; paint(); }
        else if (a === 'bnew'){ const n = await brandSave({id: H.uid(), name: 'Neue Marke', accentKey: 'rot'}); await brandUse(n.id); view = 'brand'; open = null; paint(); const i = $('#lbBName'); i.focus(); i.select(); }
        else if (a === 'bdel'){ const B = brand(); if (brands.length > 1 && confirm(`Die Marke „${B.name}“ mit allen ${mine().length} Einträgen löschen? Titelbilder, die sie schon tragen, behalten ihre Bilder.`)){ await brandDel(B.id); view = ''; paint(); } }
        else if (t.closest('[data-lacc]')){ const B = brand(); B.accentKey = t.closest('[data-lacc]').dataset.lacc; await brandSave(B); await brandUse(B.id); paint(); }
        else if (t.closest('[data-lrole]')){ const B = brand(), r = t.closest('[data-lrole]').dataset.lrole, k = 'u:' + it.id; B.fonts = {...fontsOf()}; B.fonts[r] = B.fonts[r] === k ? null : k; await brandSave(B); paint(); }
        else if (a === 'move'){ mv = it.id; view = 'move'; paint(); }
        else if (t.closest('[data-lmv]')){ const m = item(mv), to = brands.find(x => x.id === t.closest('[data-lmv]').dataset.lmv); m.brand = to.id; await libSave(m); ovImg.delete(m.id); await autoReady(); view = ''; open = null; paint(); toast(`„${m.name}“ liegt jetzt bei „${to.name}“.`); }
        else if (a === 'add'){ if (kind === 'person'){ const n = await libSave({id: H.uid(), kind, name: 'Neue Person', pics: []}); open = n.id; paint(); const i = $('#lbName'); i.focus(); i.select(); }
          else if (kind === 'font'){ const f = await pickFont(); if (!f) return; busy('Lade Schrift …'); await libAddFont(f); busy(''); paint(); if (doc) inspector(); }
          else { const url = await pickImage(); if (!url) return; await libAddImage(kind, url); paint(); if (kind === 'overlay') toast('Hinterlegt. Die Auflage ist bei neuen Titelbildern im passenden Format immer dabei.'); } }
        else if (a === 'addpic'){ const url = await pickImage(); if (!url) return; await libAddImage('person', url, {id: open}); paint(); }
        else if (a === 'delpic'){ const p = item(open), q = cd.dataset.lp; if (confirm('Dieses Bild aus den Markenunterlagen löschen?')){ p.pics = p.pics.filter(x => x.id !== q); await libSave(p); await Store.del(dKey(p, {id: q})); paint(); } }
        else if (a === 'delitem'){ if (it && confirm(`„${it.name}“ aus den Markenunterlagen löschen? Titelbilder, die es schon tragen, behalten es.`)){ await libDel(it.id); open = null; paint(); } }
        else if (a === 'edit'){ open = it.id; paint(); }
        else if (t.closest('[data-lf]')){ const f = t.closest('[data-lf]').dataset.lf; it.formats = (it.formats || []).includes(f) ? it.formats.filter(x => x !== f) : [...(it.formats || []), f]; await libSave(it); paint(); }
        else if (t.closest('input,label,select')) return;
        else if (cd && cd.dataset.lp){ if (can) await use(item(open), item(open).pics.find(q => q.id === cd.dataset.lp)); }
        else if (cd && it){ if (it.kind === 'person'){ if (can && it.pics.length === 1) await use(it, it.pics[0]); else { open = it.id; paint(); } } else if (can && (a === 'use' || tap(it.kind))) await use(it); }
      } catch(err){ fail(err); }
    });
    c.addEventListener('change', async e => { const t = e.target;
      if (t.id === 'lbBrand'){ await brandUse(t.value); open = null; paint(); }
      else if (t.id === 'lbBName'){ const B = brand(); B.name = t.value.trim() || 'Marke'; await brandSave(B); }
      else if (t.id === 'lbName'){ const p = item(open); p.name = t.value.trim() || 'Person'; await libSave(p); }
      else if (t.dataset.ln){ const it = item(t.dataset.ln); it.name = t.value.trim() || K().one; await libSave(it); }
      else if ('lauto' in t.dataset){ const it = item(t.closest('.lib-card').dataset.li); it.auto = t.checked; await libSave(it); await autoReady(); } });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('lib-card')) e.target.click(); else if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });
    libReady().then(paint);
  }
  // Bild einer Ebene in den Markenunterlagen hinterlegen: freigestellte Bilder bei einer Person, den Hintergrund als Hintergrund, alle anderen als Grafik
  function toLibDialog(L){
    const isBg = L.type === 'bg', person = !isBg && (L.slot === 'person' || !!L.mask), ps = mine('person'), u = id => doc.assets[id] || null;
    const c = modal(`<h2>Hinterlegen in „${esc(brand().name)}“</h2>` + (person ? `<label class="f"><span>Neue Person</span><input id="tlName" placeholder="Name der Person" maxlength="60" spellcheck="false"></label>
        ${ps.length ? `<div class="f"><span>Oder als weiteres Bild zu</span><div class="row wrap">${ps.map(p => `<button class="btn small" data-tp="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>` : ''}`
      : `<label class="f"><span>Name</span><input id="tlName" value="${esc(L.name || '')}" placeholder="${isBg ? 'z. B. Studio' : 'z. B. Logo'}" maxlength="60" spellcheck="false"></label>`) +
      `<div class="modal-foot"><button class="btn ghost" id="tlX">Abbrechen</button><button class="btn primary" id="tlOk">Hinterlegen</button></div>`, 'narrow');
    const done = async id => { const name = $('#tlName').value.trim(); if (!id && !name){ $('#tlName').focus(); return toast('Gib einen Namen ein.'); } closeModal();
      try { const it = person ? await libAddImage('person', u(L.img), {id, name, pic: {img: u(L.img), mask: u(L.mask), src: u(L.src)}}) : await libAddImage(isBg ? 'bg' : 'graphic', u(isBg ? L.fill.img : L.img), {name}); toast(`Hinterlegt: ${it.name}`); inspector(); } catch(e){ toast(e.message || 'Das hat nicht geklappt.'); } };
    c.addEventListener('click', e => { const p = e.target.closest('[data-tp]'); if (p) done(p.dataset.tp); else if (e.target.id === 'tlOk') done(null); else if (e.target.id === 'tlX') closeModal(); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'tlName') done(null); });
    if (!compact()) $('#tlName').focus();
  }
  // Markenunterlagen als Datei: eine Marke im Ganzen sichern und einlesen (Marke und Einträge mit derselben Kennung werden ersetzt).
  // Gelesen werden auch Dateien aus 1.1.0 (ohne Marke): ihre Einträge kommen in die gewählte Marke.
  async function brandFile(){ await libReady(); const B = brand(), items = [];
    busy('Sichere die Markenunterlagen …');
    try { for (const it of mine()){ const o = {...it}; delete o.v;
        if (it.kind === 'person'){ o.pics = []; for (const q of it.pics){ const d = await heavy(it, q).catch(() => null); if (d) o.pics.push({id: q.id, thumb: q.thumb, img: d.img, mask: d.mask || null, src: d.src || null}); } }
        else { const d = await heavy(it).catch(() => null); if (!d) continue; Object.assign(o, d); }
        items.push(o); } }
    finally { busy(''); }
    await saveBlob(new Blob([JSON.stringify({app: 'honeythumb-marke', v: 1, brand: {id: B.id, name: B.name, accentKey: B.accentKey, fonts: fontsOf()}, items})], {type: 'application/json'}), `Markenunterlagen-${safeName(B.name)}.json`); }
  // Vollständigen Eintrag aus einer Datei aufnehmen (ersetzt einen mit derselben Kennung samt seinen Daten)
  async function libPutFull(full){ await dataDel(full.id); full.brand = brandId; full.updated = Date.now(); const it = await split(full), i = lib.findIndex(x => x.id === it.id); if (i < 0) lib.push(it); else lib[i] = it; ovImg.delete(it.id); libSort(); return it; }
  async function libImport(raw){
    await libReady(); const ID = /^[\w-]{1,40}$/, ok = u => typeof u === 'string' && DATA.test(u), opt = u => u == null || ok(u), str = (v, d) => String(v || d).slice(0, 60), ONE = {overlay: 'Auflage', graphic: 'Grafik', bg: 'Hintergrund'}; let n = 0, B = null;
    if (raw.app === 'honeythumb-marke' && raw.brand && typeof raw.brand.id === 'string' && ID.test(raw.brand.id)){ const rf = raw.brand.fonts || {}, fk = v => typeof v === 'string' && /^u:[\w-]{1,40}$/.test(v) ? v : null; B = await brandSave({id: raw.brand.id, name: str(raw.brand.name, 'Marke'), accentKey: H.accent(raw.brand.accentKey).k, fonts: {title: fk(rf.title), small: fk(rf.small)}}); await brandUse(B.id); }
    for (const r of Array.isArray(raw.items) ? raw.items.slice(0, 500) : []){ if (!r || typeof r.id !== 'string' || !ID.test(r.id)) continue; let it = null;
      if (r.kind === 'person' && Array.isArray(r.pics)) it = {id: r.id, kind: 'person', name: str(r.name, 'Person'), pics: r.pics.filter(q => q && ok(q.img) && opt(q.mask) && opt(q.src) && opt(q.thumb)).slice(0, 60).map(q => ({id: ID.test(q.id || '') ? q.id : H.uid(), img: q.img, mask: q.mask || null, src: q.src || null, thumb: q.thumb || q.img}))};
      else if (r.kind === 'font' && typeof r.url === 'string' && H.FONT_URL.test(r.url)){ if (!await H.addFont('u:' + r.id, str(r.name, 'Schrift'), r.url).catch(() => null)) continue; it = {id: r.id, kind: 'font', name: str(r.name, 'Schrift'), url: r.url}; }
      else if (ONE[r.kind] && ok(r.img)){ const im = await H.decode(r.img).catch(() => null); if (!im) continue; it = {id: r.id, kind: r.kind, name: str(r.name, ONE[r.kind]), img: r.img, ar: im.naturalWidth / im.naturalHeight, thumb: ok(r.thumb) ? r.thumb : await thumbOf(r.img)};
        if (r.kind === 'overlay'){ it.band = H.bandOf(im); it.formats = (Array.isArray(r.formats) ? r.formats : []).filter(f => H.FORMATS.some(x => x.k === f)); it.auto = !!r.auto; } }
      if (it){ await libPutFull(it); n++; } }
    await autoReady();
    const cnt = `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`;
    toast(B ? `Markenunterlagen „${B.name}“ eingelesen: ${cnt}.` : n ? `Eingelesen in „${brand().name}“: ${cnt}.` : 'In dieser Datei stehen keine Markenunterlagen.'); if (B || n) libDialog();
  }

  // Neues Titelbild: Format und Vorlage wählen. pre: {url} – ein schon gewähltes Bild
  function newDialog(pre){
    let fmt = '16:9';
    const c = modal(`<h2>Neues Titelbild</h2>
      <div class="f"><span>Format</span><div class="seg" id="ndFmt">${H.FORMATS.map(f => `<button data-f="${f.k}" title="${esc(f.hint)}">${esc(f.n)}</button>`).join('')}</div></div>
      <div class="f"><span>Vorlage</span><div class="pick-grid" id="ndGrid"></div></div>
      <div class="modal-foot"><button class="btn ghost" id="ndCancel">Abbrechen</button><button class="btn" id="ndBlank">Leer beginnen</button></div>`);
    const paint = () => { $$('#ndFmt button').forEach(b => b.classList.toggle('on', b.dataset.f === fmt));
      const g = $('#ndGrid'); g.innerHTML = '';
      for (const t of H.TEMPLATES){ const b = document.createElement('button'); b.dataset.t = t.id; const d = H.fromTemplate(t.id, fmt, {}, {...autoTops(fmt), accentKey: brand().accentKey, fonts: fontsOf()}); b.append(H.render(d, 340, {edit: true})); const s = document.createElement('span'); s.textContent = t.n; b.append(s); g.append(b); } };
    const start = async tpl => { closeModal(); const ax = {...autoTops(fmt), accentKey: brand().accentKey, fonts: fontsOf()}; let d = tpl ? H.fromTemplate(tpl, fmt, {}, ax) : H.blank(fmt);
      if (!tpl){ Object.assign(d.assets, ax.assets); d.layers.push(...ax.extra); d.accentKey = H.accent(ax.accentKey).k; d.accent = H.accent(ax.accentKey).dark; }
      if (pre && pre.url){ const id = H.addAsset(d, pre.url); if (tpl) d = H.fromTemplate(tpl, fmt, {person: {img: id, mask: null}}, {id: d.id, assets: d.assets, extra: ax.extra, accentKey: ax.accentKey, fonts: ax.fonts}); else { await H.load(d); const im = H.imgOf(d, id); d.layers.push(H.newLayer(d, 'img', {img: id, ratio: im.naturalWidth / im.naturalHeight})); } }
      await openDoc(d, true); if (ax.extra.length) toast(`Auflage „${ax.extra.map(L => L.name).join('“, „')}“ ist dabei – sie liegt immer ganz oben.`);
      const p = doc.layers.find(L => L.type === 'img' && L.slot === 'person' && L.img && !L.mask); if (p){ select(p.id); await cutLayer(p, true); } };
    H.fonts().then(autoReady).then(paint);
    c.addEventListener('click', e => { const f = e.target.closest('[data-f]'), t = e.target.closest('[data-t]'); if (f){ fmt = f.dataset.f; paint(); } else if (t) start(t.dataset.t); else if (e.target.id === 'ndBlank') start(null); else if (e.target.id === 'ndCancel') closeModal(); });
  }

  // ───────── Editor öffnen ─────────
  async function openDoc(d, fresh){
    busy('Öffne …'); try { doc = d; await H.load(doc); } finally { busy(''); }
    for (const k of Object.keys(pool)) delete pool[k]; Object.assign(pool, doc.assets);
    selId = null; hist = [snap()]; hi = 0; $('#home').classList.add('hidden'); $('#ed').classList.remove('hidden');
    fillBar(); setLeft('tpl'); setMob('insp'); fitStage(); inspector(); layerList(); tplGrid(); $('#undoBtn').disabled = $('#redoBtn').disabled = true; $('#saved').textContent = '';
    if (fresh) saveNow();
  }
  function fillBar(){
    $('#edName').value = doc.name; $('#edFmt').innerHTML = H.FORMATS.map(f => `<option value="${f.k}"${f.k === doc.format ? ' selected' : ''}>${esc(f.n)} – ${esc(f.hint)}</option>`).join('');
    document.documentElement.style.setProperty('--acc', H.accent(doc.accentKey).dark);
  }
  $('#edName').addEventListener('change', e => { doc.name = e.target.value.trim() || 'Titelbild'; e.target.value = doc.name; commit(); });
  function setFormat(k){ if (k === doc.format) return; const had = !!doc.tpl; doc = H.retemplate(doc, null, k);
    const ax = autoTops(k, doc); if (ax.extra.length){ Object.assign(doc.assets, ax.assets); doc.layers.push(...ax.extra); if (doc.tpl) doc = H.retemplate(doc, doc.tpl); }
    selId = null; fillBar(); fitStage(); commit(); inspector(); if (had) toast('Die Vorlage ist für das neue Format neu angeordnet.'); }
  $('#edFmt').addEventListener('change', e => setFormat(e.target.value));
  $('#edBack').onclick = async () => { await saveNow(); showHome(); };
  $('#undoBtn').onclick = () => travel(-1); $('#redoBtn').onclick = () => travel(1);
  $('#edAcc').onclick = () => { const c = modal(`<h2>Akzentfarbe</h2><div class="acc-pop">${H.ACCENTS.map(a => `<button data-a="${a.k}" class="${a.k === doc.accentKey ? 'on' : ''}" style="background:${a.dark}" title="${esc(a.n)}" aria-label="${esc(a.n)}"></button>`).join('')}</div><p class="hint">Tauscht die Akzentfarbe an allen Stellen des Titelbilds.</p>`, 'narrow');
    c.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; doc = H.recolor(doc, b.dataset.a); closeModal(); fillBar(); commit(); inspector(); }); };
  $('#edMore').onclick = () => { const c = modal(`<h2>Format und Datei</h2><div class="f"><span>Format</span><div class="seg">${H.FORMATS.map(f => `<button data-f="${f.k}" class="${f.k === doc.format ? 'on' : ''}">${esc(f.n)}</button>`).join('')}</div></div>
      <div class="modal-foot"><button class="btn" id="mFile">Als Datei sichern (.honeythumb)</button><button class="btn ghost" id="mClose">Schließen</button></div>`, 'narrow');
    c.addEventListener('click', e => { const f = e.target.closest('[data-f]'); if (f){ closeModal(); setFormat(f.dataset.f); } else if (e.target.id === 'mFile'){ closeModal(); exportFile(); } else if (e.target.id === 'mClose') closeModal(); }); };

  // ───────── Bühne ─────────
  const stage = $('#stage'), box = $('#stageBox'), selEl = $('#sel');
  let sc = 1, raf = 0;
  function fitStage(){
    if (!doc) return; const w = $('#stageWrap').clientWidth, h = $('#stageWrap').clientHeight, f = F(); if (!w || !h) return;
    sc = Math.min(w / f.w, h / f.h); box.style.width = Math.floor(f.w * sc) + 'px'; box.style.height = Math.floor(f.h * sc) + 'px'; draw();
  }
  function draw(){ if (raf || !doc) return; raf = requestAnimationFrame(() => { raf = 0; if (!doc) return;
    const px = Math.min(2200, Math.max(200, Math.round(box.clientWidth * (window.devicePixelRatio || 1)))); H.render(doc, px, {canvas: stage, edit: true}); placeSel();
    const sh = stage._info.shrunk.length; $('#warn').classList.toggle('hidden', !sh); if (sh) $('#warn').textContent = 'Ein Text ist stark verkleinert, damit er in sein Feld passt. Kürze ihn oder ziehe das Feld größer.'; }); }
  function placeSel(){
    const L = cur(); selEl.classList.toggle('hidden', !L || L.type === 'bg' || !!L.hide); if (!L || L.type === 'bg') return;
    selEl.style.left = L.x * sc + 'px'; selEl.style.top = L.y * sc + 'px'; selEl.style.width = L.w * sc + 'px'; selEl.style.height = L.h * sc + 'px'; selEl.style.transform = `rotate(${L.rot || 0}deg)`;
    selEl.classList.toggle('small', Math.min(L.w, L.h) * sc < 44); selEl.classList.toggle('locked', !!L.lock);
  }
  function select(id){ selId = id; placeSel(); inspector(); layerList(); }
  const pt = e => { const r = box.getBoundingClientRect(); return {x: (e.clientX - r.left) / sc, y: (e.clientY - r.top) / sc}; };
  const guides = (vx, hy) => { const v = $('#guideV'), h = $('#guideH'); v.classList.toggle('hidden', vx == null); h.classList.toggle('hidden', hy == null); if (vx != null) v.style.left = vx * sc + 'px'; if (hy != null) h.style.top = hy * sc + 'px'; };
  let drag = null;
  box.addEventListener('pointerdown', e => {
    if (e.button || !doc) return; const p = pt(e), hd = e.target.closest('[data-h]'); let L = cur(), mode = 'move';
    if (hd && L && !L.lock) mode = hd.dataset.h; else { const hitL = H.hit(doc, p.x, p.y); if ((hitL ? hitL.id : null) !== selId) select(hitL ? hitL.id : null); L = hitL; if (!L) return; }
    e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch(_){}
    drag = {mode, p0: p, L0: H.clone(L), moved: false, id: L.id};
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return; const L = cur(); if (!L || L.id !== drag.id) return; const p = pt(e), o = drag.L0, f = F(), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (!drag.moved && Math.hypot(dx, dy) * sc < 3) return; drag.moved = true;
    if (drag.mode === 'move'){ const thr = 7 / sc; let x = o.x + dx, y = o.y + dy, gv = null, gh = null;
      for (const [v, g] of [[f.w / 2 - L.w / 2, f.w / 2], [0, 0], [f.w - L.w, f.w], [f.w * 0.05, f.w * 0.05], [f.w * 0.95 - L.w, f.w * 0.95]]) if (Math.abs(x - v) < thr){ x = v; gv = g; break; }
      for (const [v, g] of [[f.h / 2 - L.h / 2, f.h / 2], [0, 0], [f.h - L.h, f.h], [f.h * 0.05, f.h * 0.05], [f.h * 0.95 - L.h, f.h * 0.95]]) if (Math.abs(y - v) < thr){ y = v; gh = g; break; }
      if (e.shiftKey){ if (Math.abs(dx) > Math.abs(dy)) y = o.y; else x = o.x; }
      // Unter einer Auflage ist kein Platz: Texte, Formen und Symbole bleiben ganz in der freien Fläche, Bilder mit ihrer Mitte (eine Person darf hinter dem Banner enden); die Unterkante rastet an der Kante der Auflage ein
      const fa = freeArea(); if (fa.on && !L.top){ if (Math.abs(y + L.h - fa.y1) < thr && gh == null){ y = fa.y1 - L.h; gh = fa.y1; } if (Math.abs(y - fa.y0) < thr && fa.y0 > 0 && gh == null){ y = fa.y0; gh = fa.y0; } const half = L.type === 'img' ? L.h / 2 : 0; y = H.clamp(y, Math.min(fa.y0 - half, fa.y1 - L.h + half), Math.max(fa.y1 - L.h + half, fa.y0 - half)); }
      L.x = x; L.y = y; guides(gv, gh); }
    else if (drag.mode === 'rot'){ const cx = o.x + o.w / 2, cy = o.y + o.h / 2; let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90; a = ((a + 540) % 360) - 180;
      const st = e.shiftKey ? 15 : 45, near = Math.round(a / st) * st; if (e.shiftKey || Math.abs(a - near) < 3) a = near; L.rot = Math.round(a * 10) / 10; }
    else { const hx = /e/.test(drag.mode) ? 1 : /w/.test(drag.mode) ? -1 : 0, hy = /s/.test(drag.mode) ? 1 : /n/.test(drag.mode) ? -1 : 0, a = (o.rot || 0) * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)];
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, ax = cx - hx * o.w / 2 * ux[0] - hy * o.h / 2 * uy[0], ay = cy - hx * o.w / 2 * ux[1] - hy * o.h / 2 * uy[1], vx = p.x - ax, vy = p.y - ay;
      let w = hx ? Math.max(12, hx * (vx * ux[0] + vy * ux[1])) : o.w, h = hy ? Math.max(12, hy * (vx * uy[0] + vy * uy[1])) : o.h;
      const corner = hx && hy, keep = corner && (L.type !== 'shape' ? !e.shiftKey : e.shiftKey);
      if (keep){ const k = Math.max(w / o.w, h / o.h); w = o.w * k; h = o.h * k; if (L.type === 'text') L.size = Math.max(8, o.size * k); }
      const ncx = ax + hx * w / 2 * ux[0] + hy * h / 2 * uy[0], ncy = ay + hx * w / 2 * ux[1] + hy * h / 2 * uy[1];
      L.w = w; L.h = h; L.x = ncx - w / 2; L.y = ncy - h / 2; }
    draw();
  });
  const endDrag = () => { if (!drag) return; const m = drag.moved; drag = null; guides(null, null); if (m){ commit(); inspector(); } };
  box.addEventListener('pointerup', endDrag); box.addEventListener('pointercancel', endDrag);
  box.addEventListener('dblclick', () => { const L = cur(); if (!L) return; if (L.type === 'text'){ setMob('insp'); const t = $('#insp textarea'); if (t){ t.focus(); t.select(); } } else if (L.type === 'img' && !L.img) act('pick'); });
  new ResizeObserver(fitStage).observe($('#stageWrap'));

  // ───────── Bilder holen ─────────
  let imgRes = null;
  const readUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Die Datei lässt sich nicht lesen.')); r.readAsDataURL(f); });
  // Große Bilder verkleinern (längste Seite 2400); PNG, WebP und GIF behalten ihre Transparenz
  async function normalize(file){
    const url = await readUrl(file), im = await H.decode(url), w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, 2400 / Math.max(w, h)), alpha = /png|webp|gif|svg/.test(file.type);
    if (k === 1 && /jpeg|png/.test(file.type) && url.length < 6e6) return url;
    const c = H.mkCanvas(w * k, h * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
  }
  function pickImage(){ return new Promise(res => { imgRes = res; const i = $('#imgIn'); i.value = ''; i.click(); }); }
  $('#imgIn').addEventListener('change', async e => { const f = e.target.files[0], res = imgRes; imgRes = null; if (!f || !res) return; pickImage.last = f.name.replace(/\.[a-z0-9]+$/i, ''); try { busy('Lade Bild …'); res(await normalize(f)); } catch(err){ toast(err.message); res(null); } finally { busy(''); } });
  async function setImage(L, url){ const id = H.addAsset(doc, url); if (L.type === 'bg'){ L.fill.kind = 'img'; L.fill.img = id; } else { L.img = id; delete L.mask; delete L.src; } delete L.auto; await H.load(doc); }
  // Person in der Ebene freistellen. neu: Bild auf die Person zuschneiden (für frisch eingesetzte Bilder)
  async function cutLayer(L, crop){
    const im = H.imgOf(doc, L.img); if (!im) return false;
    try { busy('Stelle die Person frei …'); const r = await CUT.person(im, {msg: busy});
      delete L.auto;
      if (crop){ const c = CUT.crop(im, r.mask, r.box); L.src = L.src || L.img; L.img = H.addAsset(doc, c.img); L.mask = H.addAsset(doc, c.mask); if (!L.slot){ const cx = L.x + L.w / 2, w = L.h * c.w / c.h; L.x = cx - w / 2; L.w = w; } }
      else L.mask = H.addAsset(doc, r.mask.toDataURL('image/png'));
      await H.load(doc); commit(); inspector(); return true; }
    catch(e){ toast((e && e.message) || 'Das Freistellen hat nicht geklappt.'); commit(); inspector(); return false; }
    finally { busy(''); }
  }

  // ───────── Hinzufügen ─────────
  // Eine Person steht unten in der freien Fläche (über einer Auflage am unteren Rand)
  function standPerson(L, ratio){ const f = F(), ins = H.topInset(doc.layers, f), fh = f.h * (1 - ins.t - ins.b); L.h = fh * 0.92; L.w = L.h * ratio; if (L.w > f.w * 1.1){ L.w = f.w * 1.1; L.h = L.w / ratio; } L.x = f.w / 2 - L.w / 2; L.y = f.h * ins.t + fh * 1.02 - L.h; return L; }
  // Freie Fläche über bzw. unter den Auflagen (Entwurfspixel): Neues kommt dorthin, und beim Ziehen bleibt die Mitte einer Ebene darin
  function freeArea(){ const f = F(), ins = H.topInset(doc.layers, f); return {y0: f.h * ins.t, y1: f.h * (1 - ins.b), on: ins.t + ins.b > 0}; }
  function intoFree(L){ const a = freeArea(); if (!a.on || L.top) return L; const fh = a.y1 - a.y0; if (L.h > fh * 0.9){ const k = fh * 0.9 / L.h, cx = L.x + L.w / 2; L.w *= k; L.h *= k; L.x = cx - L.w / 2; if (L.size) L.size *= k; } L.y = a.y0 + (fh - L.h) / 2; return L; }
  function addLayer(L){ intoFree(L); doc.layers.push(L); commit(); select(L.id); setMob('insp'); return L; }
  $('#addBar').addEventListener('click', async e => {
    const b = e.target.closest('[data-add]'); if (!b) return; const k = b.dataset.add;
    if (k === 'text'){ addLayer(H.newLayer(doc, 'text')); const t = $('#insp textarea'); if (t && !compact()){ t.focus(); t.select(); } }
    else if (k === 'shape'){ const c = modal(`<h2>Form</h2><div class="seg">${H.SHAPES.map(s => `<button data-s="${s.k}">${esc(s.n)}</button>`).join('')}</div>`, 'narrow'); c.addEventListener('click', ev => { const s = ev.target.closest('[data-s]'); if (!s) return; closeModal(); addLayer(H.newLayer(doc, 'shape', {shape: s.dataset.s})); }); }
    else if (k === 'bar'){ const c = modal(`<h2>Balken</h2><div class="seg"><button data-b="brush">Pinselstrich</button><button data-b="ink">Schwarz, gerissen</button><button data-b="paper">Kleines Wort auf Papier</button></div><p class="hint">Farbe, Balkenart und raue Schrift änderst du danach bei den Eigenschaften.</p>`, 'narrow'); c.addEventListener('click', ev => { const b = ev.target.closest('[data-b]'); if (!b) return; closeModal(); addLayer(H.newLayer(doc, 'bar', {kind: b.dataset.b})); const t = $('#insp textarea'); if (t && !compact()){ t.focus(); t.select(); } }); }
    else if (k === 'icon') iconDialog(ic => addLayer(H.newLayer(doc, 'icon', {icon: ic})));
    else if (k === 'img'){ const url = await pickImage(); if (!url) return; const id = H.addAsset(doc, url); await H.load(doc); const im = H.imgOf(doc, id); addLayer(H.newLayer(doc, 'img', {img: id, ratio: im.naturalWidth / im.naturalHeight})); }
    else if (k === 'person'){ const url = await pickImage(); if (!url) return; const id = H.addAsset(doc, url); await H.load(doc); const im = H.imgOf(doc, id);
      let L = doc.layers.find(x => x.type === 'img' && x.slot === 'person' && !x.img);
      if (L){ L.img = id; select(L.id); } else { const f = F(); L = H.newLayer(doc, 'img', {img: id, ratio: im.naturalWidth / im.naturalHeight, pos: {x: 0.5, y: 1}, outline: {w: 9, c: H.lum(H.bgColor(doc)) < 0.5 ? PAL.cream : PAL.ink}}); standPerson(L, im.naturalWidth / im.naturalHeight); doc.layers.push(L); select(L.id); }
      setMob('insp'); await cutLayer(L, true); }
    else if (k === 'lib') libDialog();
  });
  function iconDialog(done){
    const c = modal(`<h2>Symbol</h2><input type="search" id="icQ" placeholder="Symbol suchen – z. B. Streik, Miete, Polizei"><div class="ic-grid" id="icG"></div><div class="modal-foot"><button class="btn ghost" id="icX">Abbrechen</button></div>`);
    const paint = () => { $('#icG').innerHTML = IC.search($('#icQ').value).slice(0, 240).map(i => `<button data-i="${esc(i.k)}" title="${esc(i.label)}">${IC.svg(i.k)}<span>${esc(i.label)}</span></button>`).join('') || '<p class="hint">Nichts gefunden.</p>'; };
    paint(); $('#icQ').addEventListener('input', paint); if (!compact()) $('#icQ').focus();
    c.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b){ closeModal(); done(b.dataset.i); } else if (e.target.id === 'icX') closeModal(); });
  }

  // ───────── Eigenschaften ─────────
  const gp = (o, k) => k.split('.').reduce((a, p) => a == null ? a : a[p], o);
  const sp = (o, k, v) => { const ps = k.split('.'); let a = o; for (let i = 0; i < ps.length - 1; i++) a = a[ps[i]] ??= {}; if (v === undefined) delete a[ps.at(-1)]; else a[ps.at(-1)] = v; };
  const nf = v => Number.isInteger(v) ? String(v) : (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(0)).replace('.', ',');
  const fRange = (L, k, label, min, max, step, def) => { const v = gp(L, k) ?? def; return `<label class="f"><span>${label}<b class="val" data-val="${k}">${nf(+v)}</b></span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`; };
  const swatches = () => [PAL.ink, PAL.cream, PAL.sand, PAL.white, H.accent(doc.accentKey).dark, H.accent(doc.accentKey).light, PAL.gray];
  const fColor = (L, k, label, o = {}) => { const v = String(gp(L, k) ?? o.def ?? '').toLowerCase(); return `<div class="f"><span>${label}</span><div class="sw">${swatches().map(c => `<button class="${c.toLowerCase() === v ? 'on' : ''}" style="background:${c}" data-k="${k}" data-j='"${c}"' title="${c}" aria-label="Farbe ${c}"></button>`).join('')}${o.none ? `<button data-k="${k}" data-j="null" title="${esc(o.none)}" class="${v ? '' : 'on'}">∅</button>` : ''}<input type="color" data-k="${k}" value="${/^#[0-9a-f]{6}$/.test(v) ? v : '#000000'}" aria-label="Eigene Farbe"></div></div>`; };
  const fSeg = (L, k, label, opts, def) => { const v = gp(L, k) ?? def; return `<div class="f">${label ? `<span>${label}</span>` : ''}<div class="seg">${opts.map(([val, n]) => `<button class="${val === v ? 'on' : ''}" data-k="${k}" data-j='${esc(JSON.stringify(val))}'>${esc(n)}</button>`).join('')}</div></div>`; };
  const fChk = (L, k, label, def = false) => `<label class="chk"><input type="checkbox" data-k="${k}"${(gp(L, k) ?? def) ? ' checked' : ''}> ${label}</label>`;
  const fTog = (L, k, label, defObj) => `<label class="chk"><input type="checkbox" data-tog="${k}" data-def='${esc(JSON.stringify(defObj))}'${gp(L, k) ? ' checked' : ''}> ${label}</label>`;
  const btn = (a, label, cls = '') => `<button class="btn small ${cls}" data-act="${a}">${label}</button>`;
  const grp = (title, html) => `<div class="grp"><span>${title}</span>${html}</div>`;
  const layerName = L => L.type === 'bg' ? 'Hintergrund' : L.type === 'text' ? (String(L.text || '').replace(/\s+/g, ' ').slice(0, 26) || 'Text') : L.type === 'img' ? (L.name || (L.top ? 'Auflage' : L.slot === 'person' || L.mask ? 'Person' : 'Bild')) : L.type === 'shape' ? (H.SHAPES.find(s => s.k === L.shape) || {n: 'Form'}).n : (IC.LIB.get(L.icon) || {label: 'Symbol'}).label;
  function inspector(){
    if (!doc) return; const L = target(), el = $('#insp'), f = F(), u = Math.min(f.w, f.h); let h = '';
    $('#inspTitle').textContent = layerName(L);
    if (L.type === 'bg'){ const fl = L.fill ||= {kind: 'color'}; if (fl.c && !fl.a){ fl.a = fl.c; } delete fl.c; const k = fl.kind;
      h += fSeg(L, 'fill.kind', 'Art', H.BG_KINDS.map(b => [b.k, b.n]), 'color');
      if (k === 'img'){ h += `<div class="row wrap">${btn('pick', fl.img ? 'Bild ersetzen' : 'Bild wählen', fl.img ? '' : 'primary')}${btn('libbg', 'Aus den Markenunterlagen')}${fl.img ? btn('tolib', 'Hinterlegen') : ''}</div>`;
        if (fl.img) h += fRange(L, 'fill.blur', 'Weichzeichnen', 0, 40, 1, 0) + fRange(L, 'fill.dim', 'Abdunkeln', 0, 0.9, 0.01, 0) + fChk(L, 'fill.gray', 'Schwarz-weiß') + fRange(L, 'fill.zoom', 'Vergrößern', 1, 3, 0.01, 1) + fRange(L, 'fill.pos.x', 'Ausschnitt waagerecht', 0, 1, 0.01, 0.5) + fRange(L, 'fill.pos.y', 'Ausschnitt senkrecht', 0, 1, 0.01, 0.5); }
      else { if (mine('bg').length) h += `<div class="row wrap">${btn('libbg', 'Hintergrund aus den Markenunterlagen')}</div>`; h += fColor(L, 'fill.a', 'Farbe', {def: PAL.ink}); if (k !== 'color') h += fColor(L, 'fill.b', 'Zweite Farbe', {def: PAL.ink2}); }
      if (k === 'grad') h += fRange(L, 'fill.ang', 'Richtung', 0, 360, 5, 90);
      if (k === 'rays') h += fRange(L, 'fill.cx', 'Mitte waagerecht', 0, 1, 0.01, 0.5) + fRange(L, 'fill.cy', 'Mitte senkrecht', 0, 1, 0.01, 0.5) + fRange(L, 'fill.n', 'Strahlen', 4, 40, 1, 14);
      if (k === 'diag') h += fRange(L, 'fill.split', 'Teilung', 0.1, 0.9, 0.01, 0.5) + fRange(L, 'fill.slant', 'Schräge', -0.5, 0.5, 0.01, 0.16);
      if (k === 'dots') h += fRange(L, 'fill.step', 'Abstand', 20, 140, 2, 46);
      if (k === 'grid') h += fRange(L, 'fill.step', 'Abstand', 30, 240, 5, 80);
      h += fRange(L, 'fill.vig', 'Ränder abdunkeln', 0, 0.9, 0.01, 0);
      h += `<p class="hint">Tippe im Bild auf einen Text oder ein Bild, um es zu bearbeiten.</p>`; }
    else {
      if (L.type === 'text'){
        h += `<label class="f"><span>Text</span><textarea data-k="text" rows="3" spellcheck="false">${esc(L.text)}</textarea></label><p class="hint">*Sternchen* um ein Wort färben es in der Akzentfarbe.</p>`;
        h += `<label class="f"><span>Schrift</span><select data-k="font">${H.FONTS.map(x => `<option value="${x.k}"${x.k === L.font ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select></label>`;
        h += fRange(L, 'size', 'Größe', 16, Math.round(u * 1.3), 1, 80) + fColor(L, 'color', 'Farbe', {def: PAL.cream}) + fColor(L, 'accent', 'Farbe der Hervorhebung', {none: 'Akzentfarbe des Titelbilds'});
        h += `<div class="row wrap">${fSeg(L, 'align', '', [['l', 'Links'], ['c', 'Mitte'], ['r', 'Rechts']], 'l')}${fSeg(L, 'valign', '', [['t', 'Oben'], ['m', 'Mitte'], ['b', 'Unten']], 'm')}</div>`;
        h += `<div class="row wrap">${fChk(L, 'upper', 'Großbuchstaben')}${fChk(L, 'fit', 'Verkleinern, bis er passt', true)}</div>` + fRange(L, 'lh', 'Zeilenabstand', 0.8, 1.8, 0.01, 1.05);
        h += grp('Balken hinter dem Text', fTog(L, 'box', 'Balken', {c: H.accent(doc.accentKey).light, pad: 0.2}) + (L.box ? fColor(L, 'box.c', 'Farbe') + fSeg(L, 'box.style', '', [['rect', 'Glatt'], ['brush', 'Pinselstrich'], ['torn', 'Papier']], 'rect') + fSeg(L, 'box.mode', '', [['line', 'Je Zeile'], ['block', 'Ein Block']], 'line') + fRange(L, 'box.pad', 'Rand', 0, 0.6, 0.01, 0.2) : ''));
        h += grp('Raue Schrift', fRange(L, 'rough', 'Stärke', 0, 1, 0.05, 0) + (L.rough > 0 || (L.box && L.box.style && L.box.style !== 'rect') ? `<div class="row wrap">${btn('seed', 'Anderes Muster')}</div>` : ''));
        h += grp('Kontur und Schatten', fTog(L, 'stroke', 'Kontur', {w: 6, c: PAL.ink}) + (L.stroke ? fRange(L, 'stroke.w', 'Stärke', 1, 30, 0.5, 6) + fColor(L, 'stroke.c', 'Farbe') : '') + fTog(L, 'shadow', 'Schatten', {b: 18, x: 0, y: 8, c: 'rgba(0,0,0,0.5)'}));
      }
      if (L.type === 'img' && L.top){
        h += `<p class="hint">Auflage aus den Markenunterlagen. Sie liegt immer ganz oben; die Vorlage ordnet Texte und Bilder in der freien Fläche an.</p>` + fRange(L, 'op', 'Deckkraft', 0, 1, 0.01, 1) + `<div class="row wrap">${btn('lock', L.lock ? 'Entsperren (verschieben)' : 'Sperren')}${btn('del', 'Aus diesem Titelbild nehmen')}${btn('lib-overlay', 'Markenunterlagen öffnen')}</div>`;
        el.innerHTML = h; return; }
      if (L.type === 'img'){
        if (!L.img) h += `<div class="big-drop"><span>${L.slot === 'person' ? 'Hier kommt die Person hin.' : 'Hier kommt ein Bild hin.'}</span>${L.slot === 'person' ? btn('libperson', 'Person aus den Markenunterlagen', mine('person').some(i => i.pics.length) ? 'primary' : '') + btn('pickcut', 'Bild wählen und freistellen', mine('person').some(i => i.pics.length) ? '' : 'primary') + btn('pick', 'Bild ohne Freistellen') : btn('pick', 'Bild wählen', 'primary') + btn('pickcut', 'Bild wählen und Person freistellen') + btn('libgraphic', 'Aus den Markenunterlagen')}</div>`;
        else { h += `<div class="row wrap">${btn('pick', 'Bild ersetzen')}${L.mask ? btn('mask', 'Maske nachbessern') + btn('uncut', 'Freistellung aufheben') : btn('cut', 'Person freistellen', 'primary')}</div>`;
          h += fSeg(L, 'fit', 'Im Feld', [['contain', 'Ganz zeigen'], ['cover', 'Feld füllen']], 'cover') + fRange(L, 'zoom', 'Vergrößern', 1, 3, 0.01, 1) + fRange(L, 'pos.x', 'Lage waagerecht', 0, 1, 0.01, 0.5) + fRange(L, 'pos.y', 'Lage senkrecht', 0, 1, 0.01, 0.5);
          h += `<div class="row wrap">${fChk(L, 'flip', 'Spiegeln')}${fChk(L, 'gray', 'Schwarz-weiß')}</div>`;
          h += grp('Umriss und Schatten', fTog(L, 'outline', 'Umriss', {w: 9, c: PAL.cream}) + (L.outline ? fRange(L, 'outline.w', 'Stärke', 1, 40, 0.5, 9) + fColor(L, 'outline.c', 'Farbe') : '') + fTog(L, 'shadow', 'Schatten', {b: 40, x: 0, y: 14, c: 'rgba(0,0,0,0.45)'}));
          h += grp('Markenunterlagen', `<div class="row wrap">${btn('tolib', 'Hinterlegen')}${btn(L.slot === 'person' || L.mask ? 'libperson' : 'libgraphic', 'Daraus ersetzen')}</div>`);
          if (!L.mask) h += grp('Rahmen', fRange(L, 'round', 'Ecken runden', 0, Math.round(u * 0.3), 1, 0) + fTog(L, 'frame', 'Rahmen', {w: 10, c: PAL.cream}) + (L.frame ? fRange(L, 'frame.w', 'Stärke', 1, 40, 0.5, 10) + fColor(L, 'frame.c', 'Farbe') : '')); }
      }
      if (L.type === 'shape'){ h += `<label class="f"><span>Form</span><select data-k="shape">${H.SHAPES.map(x => `<option value="${x.k}"${x.k === L.shape ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select></label>` + fColor(L, 'fill', 'Farbe', {def: doc.accent});
        if (L.shape === 'rect') h += fRange(L, 'round', 'Ecken runden', 0, Math.round(u * 0.3), 1, 0); if (L.shape === 'ring') h += fRange(L, 'thick', 'Stärke', 0.04, 0.9, 0.01, 0.18); if (L.shape === 'burst') h += fRange(L, 'n', 'Zacken', 6, 40, 1, 16);
        h += grp('Kontur', fTog(L, 'stroke', 'Kontur', {w: 6, c: PAL.ink}) + (L.stroke ? fRange(L, 'stroke.w', 'Stärke', 1, 40, 0.5, 6) + fColor(L, 'stroke.c', 'Farbe') : '')); }
      if (L.type === 'icon') h += `<div class="row wrap">${btn('icon', 'Symbol wählen')}</div>` + fColor(L, 'color', 'Farbe', {def: PAL.cream}) + fColor(L, 'accent', 'Zweite Farbe', {none: 'Akzentfarbe des Titelbilds'});
      h += grp('Lage', fRange(L, 'op', 'Deckkraft', 0, 1, 0.01, 1) + fRange(L, 'rot', 'Drehung', -180, 180, 1, 0) +
        `<div class="row wrap">${btn('al', 'Links')}${btn('ac', 'Mitte')}${btn('ar', 'Rechts')}${btn('at', 'Oben')}${btn('am', 'Mittig')}${btn('ab', 'Unten')}</div>`);
      h += grp('Ebene', `<div class="row wrap">${btn('up', 'Nach vorn')}${btn('down', 'Nach hinten')}${btn('dup', 'Duplizieren')}${btn('lock', L.lock ? 'Entsperren' : 'Sperren')}${btn('del', 'Löschen')}</div>`);
    }
    el.innerHTML = h;
  }
  const insp = $('#insp');
  insp.addEventListener('input', e => { const t = e.target, k = t.dataset.k, L = target(); if (!k || t.type === 'checkbox' || t.tagName === 'SELECT') return;
    if (t.type === 'range'){ sp(L, k, +t.value); const v = insp.querySelector(`[data-val="${k}"]`); if (v) v.textContent = nf(+t.value); } else sp(L, k, t.value);
    if (k === 'text') $('#inspTitle').textContent = layerName(L); draw(); });
  insp.addEventListener('change', e => { const t = e.target, L = target();
    if (t.dataset.tog){ sp(L, t.dataset.tog, t.checked ? JSON.parse(t.dataset.def) : undefined); commit(); return inspector(); }
    if (!t.dataset.k) return;
    if (t.type === 'checkbox'){ sp(L, t.dataset.k, t.checked); commit(); return inspector(); }
    if (t.tagName === 'SELECT'){ sp(L, t.dataset.k, t.value); commit(); return inspector(); }
    commit(); if (t.type === 'color') inspector(); });
  insp.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const L = target();
    if (b.dataset.k){ const v = JSON.parse(b.dataset.j); sp(L, b.dataset.k, v === null ? undefined : v); if (b.dataset.k === 'fill.kind' && v !== 'color' && v !== 'img' && !L.fill.b) L.fill.b = H.accent(doc.accentKey).light; commit(); inspector(); }
    else if (b.dataset.act) act(b.dataset.act); });
  async function act(a){
    const L = target(), f = F(), i = doc.layers.indexOf(L);
    if (a === 'pick' || a === 'pickcut'){ const url = await pickImage(); if (!url) return; await setImage(L, url); if (a === 'pickcut') return void await cutLayer(L, true); commit(); inspector(); }
    else if (a === 'cut') await cutLayer(L, false);
    else if (a === 'uncut'){ delete L.mask; if (L.src){ L.img = L.src; delete L.src; } commit(); inspector(); }
    else if (a === 'mask') maskDialog(L);
    else if (a === 'icon') iconDialog(ic => { L.icon = ic; commit(); inspector(); });
    else if (a === 'del'){ doc.layers.splice(i, 1); selId = null; if (L.top && L.band && doc.tpl) doc = H.retemplate(doc, doc.tpl); commit(); inspector(); }
    else if (a === 'libperson') libDialog({kind: 'person', pick: async (pic, it) => { await putPerson(L, it, pic); commit(); select(L.id); }});
    else if (a === 'libgraphic') libDialog({kind: 'graphic', pick: async it => { await setImage(L, (await heavy(it)).img); commit(); select(L.id); }});
    else if (a === 'lib-overlay') libDialog({kind: 'overlay'});
    else if (a === 'libbg') libDialog({kind: 'bg'});
    else if (a === 'seed'){ L.seed = 1 + Math.floor(Math.random() * 2e9); commit(); }
    else if (a === 'tolib') toLibDialog(L);
    else if (a === 'dup'){ const c = H.clone(L); c.id = H.uid(); delete c.slot; c.user = true; c.x += 30; c.y += 30; doc.layers.splice(i + 1, 0, c); commit(); select(c.id); }
    else if (a === 'lock'){ L.lock = !L.lock; commit(); inspector(); }
    else if (a === 'up' || a === 'down'){ const j = a === 'up' ? i + 1 : i - 1; if (j < 1 || j >= doc.layers.length) return; doc.layers.splice(i, 1); doc.layers.splice(j, 0, L); commit(); }
    else if (/^a[lcrtmb]$/.test(a)){ if (a === 'al') L.x = f.w * 0.05; if (a === 'ac') L.x = (f.w - L.w) / 2; if (a === 'ar') L.x = f.w * 0.95 - L.w; if (a === 'at') L.y = f.h * 0.05; if (a === 'am') L.y = (f.h - L.h) / 2; if (a === 'ab') L.y = f.h * 0.95 - L.h; commit(); }
  }

  // Maske nachbessern: mit dem Pinsel entfernen oder zurückholen
  function maskDialog(L){
    const im = H.imgOf(doc, L.img), mk = H.imgOf(doc, L.mask); if (!im || !mk) return;
    const k = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight)), W = Math.round(im.naturalWidth * k), Hh = Math.round(im.naturalHeight * k);
    const c = modal(`<h2>Maske nachbessern</h2><div class="row wrap"><div class="seg" id="mkMode"><button data-m="erase" class="on">Entfernen</button><button data-m="restore">Zurückholen</button></div><label class="f grow"><span>Pinsel</span><input type="range" id="mkSize" min="4" max="160" value="40"></label></div>
      <div class="mask-wrap"><canvas id="mkView" width="${W}" height="${Hh}"></canvas></div><p class="hint">Blass sichtbar ist, was die Maske ausblendet.</p><div class="modal-foot"><button class="btn ghost" id="mkX">Abbrechen</button><button class="btn primary" id="mkOk">Fertig</button></div>`);
    const view = $('#mkView'), vx = view.getContext('2d'), mask = H.mkCanvas(W, Hh), mx = mask.getContext('2d'), tmp = H.mkCanvas(W, Hh), tx = tmp.getContext('2d'); mx.drawImage(mk, 0, 0, W, Hh);
    let mode = 'erase', last = null;
    const paint = () => { tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, W, Hh); tx.drawImage(im, 0, 0, W, Hh); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(mask, 0, 0);
      vx.clearRect(0, 0, W, Hh); vx.globalAlpha = 0.28; vx.drawImage(im, 0, 0, W, Hh); vx.globalAlpha = 1; vx.drawImage(tmp, 0, 0); };
    const at = e => { const r = view.getBoundingClientRect(); return {x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * Hh / r.height, s: W / r.width}; };
    const stroke = (a, b) => { mx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over'; mx.strokeStyle = mx.fillStyle = '#fff'; mx.lineCap = 'round'; mx.lineWidth = +$('#mkSize').value * b.s; mx.beginPath(); mx.moveTo(a.x, a.y); mx.lineTo(b.x + 0.01, b.y); mx.stroke(); paint(); };
    view.addEventListener('pointerdown', e => { e.preventDefault(); view.setPointerCapture(e.pointerId); last = at(e); stroke(last, last); });
    view.addEventListener('pointermove', e => { if (!last) return; const p = at(e); stroke(last, p); last = p; });
    view.addEventListener('pointerup', () => { last = null; }); view.addEventListener('pointercancel', () => { last = null; });
    paint();
    c.addEventListener('click', async e => { const m = e.target.closest('[data-m]');
      if (m){ mode = m.dataset.m; $$('#mkMode button').forEach(b => b.classList.toggle('on', b === m)); }
      else if (e.target.id === 'mkX') closeModal();
      else if (e.target.id === 'mkOk'){ L.mask = H.addAsset(doc, mask.toDataURL('image/png')); closeModal(); await H.load(doc); commit(); } });
  }

  // ───────── Vorlagen und Ebenen ─────────
  function tplGrid(){
    if (!doc || $('#tplGrid').offsetParent === null) return; const g = $('#tplGrid'), cont = H.contentOf(doc); g.innerHTML = '';
    for (const t of H.TEMPLATES){ const b = document.createElement('button'); b.dataset.t = t.id; b.className = t.id === doc.tpl ? 'on' : ''; b.title = t.n;
      const d = H.fromTemplate(t.id, doc.format, cont, {accentKey: doc.accentKey, assets: doc.assets, extra: doc.layers.filter(L => L.top), fonts: doc.tfonts}); b.append(H.render(d, 240, {edit: true})); const s = document.createElement('span'); s.textContent = t.n; b.append(s); g.append(b); }
  }
  $('#tplGrid').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; doc = H.retemplate(doc, b.dataset.t); selId = null; commit(); inspector(); tplGrid(); toast('Vorlage „' + H.template(b.dataset.t).n + '“ – Texte und Bilder sind übernommen.'); });
  const GLYPH = {bg: '▦', text: 'T', img: '▣', shape: '◆', icon: '★'};
  const glyph = L => L.top ? '⬓' : GLYPH[L.type];
  function layerList(){
    if (!doc) return; $('#layerList').innerHTML = [...doc.layers].reverse().map(L => `<div class="lay${L.id === (selId || bgL().id) ? ' on' : ''}${L.hide ? ' off' : ''}" data-id="${L.id}"><span class="k"${L.top ? ' title="Auflage – liegt immer ganz oben"' : ''}>${glyph(L)}</span><span class="n">${esc(layerName(L))}</span>${L.type === 'bg' ? '' : `<button data-a="hide" title="${L.hide ? 'Einblenden' : 'Ausblenden'}" aria-label="${L.hide ? 'Einblenden' : 'Ausblenden'}">${L.hide ? '◌' : '●'}</button><button data-a="lock" title="${L.lock ? 'Entsperren' : 'Sperren'}" aria-label="${L.lock ? 'Entsperren' : 'Sperren'}">${L.lock ? '🔒' : '🔓'}</button>`}</div>`).join('');
  }
  $('#layerList').addEventListener('click', e => { const r = e.target.closest('.lay'); if (!r) return; const L = doc.layers.find(x => x.id === r.dataset.id), a = e.target.closest('[data-a]');
    if (a){ L[a.dataset.a] = !L[a.dataset.a]; commit(); inspector(); } else { select(L.type === 'bg' ? null : L.id); if (compact()) setMob('insp'); } });
  function setLeft(t){ leftTab = t; $$('#leftTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $('#tplGrid').classList.toggle('hidden', t !== 'tpl'); $('#layerList').classList.toggle('hidden', t !== 'layers'); if (t === 'tpl') tplGrid(); }
  $('#leftTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) setLeft(b.dataset.t); });
  function setMob(t){ mobTab = t; $$('#mobTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $('#paneL').classList.toggle('mob-off', t === 'insp'); $('#paneInsp').classList.toggle('mob-off', t !== 'insp'); if (t !== 'insp') setLeft(t); }
  $('#mobTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) setMob(b.dataset.t); });
  const applyCompact = () => { if (!compact()){ $('#paneL').classList.remove('mob-off'); $('#paneInsp').classList.remove('mob-off'); } else setMob(mobTab); };
  addEventListener('resize', applyCompact);

  // ───────── Export ─────────
  const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
  async function exportImage(W, type){
    busy('Rechne das Bild …'); try { const c = H.render(doc, W), ext = type === 'image/png' ? 'png' : 'jpg'; let q = 0.93, b = await toBlob(c, type, q);
      // YouTube nimmt Titelbilder bis 2 MB: JPG so lange stärker packen, bis es passt
      while (type === 'image/jpeg' && b.size > 2e6 && q > 0.55){ q -= 0.07; b = await toBlob(c, type, q); }
      await saveBlob(b, `${safeName(doc.name)}-${c.width}x${c.height}.${ext}`); if (b.size > 2e6) toast(`Die Datei hat ${(b.size / 1e6).toFixed(1).replace('.', ',')} MB – YouTube nimmt höchstens 2 MB. Wähle JPG.`); }
    catch(e){ toast('Export fehlgeschlagen: ' + e.message); } finally { busy(''); }
  }
  async function exportFile(){ await saveNow(); const d = H.prune(H.clone(doc)); await saveBlob(new Blob([JSON.stringify(d)], {type: 'application/json'}), safeName(doc.name) + '.honeythumb'); }
  $('#edExport').onclick = () => { const f = F(); let type = 'image/jpeg';
    const c = modal(`<h2>Exportieren</h2><div class="f"><span>Dateiart</span><div class="seg" id="exType"><button data-y="image/jpeg" class="on">JPG (klein, für YouTube)</button><button data-y="image/png">PNG (verlustfrei)</button></div></div>
      <div class="f"><span>Größe</span><div class="row wrap">${f.out.map(([w, h]) => `<button class="btn primary" data-w="${w}">${w} × ${h}</button>`).join('')}</div></div>
      <div class="modal-foot"><button class="btn" id="exFile" title="Zum Weiterbearbeiten auf einem anderen Gerät">Als Datei sichern (.honeythumb)</button><button class="btn ghost" id="exX">Schließen</button></div>`, 'narrow');
    c.addEventListener('click', e => { const y = e.target.closest('[data-y]'), w = e.target.closest('[data-w]');
      if (y){ type = y.dataset.y; $$('#exType button').forEach(b => b.classList.toggle('on', b === y)); } else if (w){ closeModal(); exportImage(+w.dataset.w, type); } else if (e.target.id === 'exFile'){ closeModal(); exportFile(); } else if (e.target.id === 'exX') closeModal(); }); };

  // ───────── Öffnen und Importieren ─────────
  async function importFile(file){
    try { if (/\.(honeythumb|json)$/i.test(file.name)){ const raw = JSON.parse(await file.text()); if (raw && (raw.app === 'honeythumb-marke' || raw.app === 'honeythumb-ablage')) return void await libImport(raw); const d = H.parse(raw); if (doc) await saveNow(); await openDoc(d, true); toast(`„${d.name}“ geöffnet`); }
      else if (/^image\//.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name)){ busy('Lade Bild …'); const url = await normalize(file); busy('');
        if (doc){ const id = H.addAsset(doc, url); await H.load(doc); const im = H.imgOf(doc, id); addLayer(H.newLayer(doc, 'img', {img: id, ratio: im.naturalWidth / im.naturalHeight})); } else newDialog({url}); }
      else toast('Diese Datei kann HoneyThumb nicht öffnen.'); }
    catch(e){ busy(''); toast(e.message || 'Die Datei lässt sich nicht öffnen.'); }
  }
  $('#homeImport').onclick = () => { const i = $('#fileIn'); i.value = ''; i.click(); };
  $('#fileIn').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); });
  $('#homeNew').onclick = $('#emptyNew').onclick = () => newDialog();
  $('#homeLib').onclick = () => libDialog();
  const b64File = (name, b64) => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); const ext = (name.split('.').pop() || '').toLowerCase(), type = {png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif'}[ext] || ''; return new File([a], name, {type}); };
  window.HTImportB64 = (name, b64) => importFile(b64File(name, b64));
  window.HTImportText = () => toast('HoneyThumb öffnet Bilder und .honeythumb-Dateien.');
  window.HTBack = () => { if (!$('#modal').classList.contains('hidden')){ closeModal(); return true; } if (doc){ $('#edBack').click(); return true; } return false; };
  addEventListener('paste', e => { if (!doc || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); if (it){ e.preventDefault(); importFile(it.getAsFile()); } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) importFile(f); });

  // ───────── Tastatur ─────────
  addEventListener('keydown', e => {
    if (!doc || !$('#modal').classList.contains('hidden')) { if (e.key === 'Escape') closeModal(); return; }
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.type !== 'range', mod = e.ctrlKey || e.metaKey, L = cur();
    if (mod && e.key.toLowerCase() === 'z'){ if (typing) return; e.preventDefault(); travel(e.shiftKey ? 1 : -1); }
    else if (mod && e.key.toLowerCase() === 'y'){ if (typing) return; e.preventDefault(); travel(1); }
    else if (typing) { if (e.key === 'Escape') document.activeElement.blur(); }
    else if (e.key === 'Escape') select(null);
    else if (!L || L.lock) return;
    else if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); act('del'); }
    else if (mod && e.key.toLowerCase() === 'd'){ e.preventDefault(); act('dup'); }
    else if (/^Arrow/.test(e.key)){ e.preventDefault(); const d = e.shiftKey ? 10 : 1; if (e.key === 'ArrowLeft') L.x -= d; if (e.key === 'ArrowRight') L.x += d; if (e.key === 'ArrowUp') L.y -= d; if (e.key === 'ArrowDown') L.y += d; draw(); clearTimeout(act._t); act._t = setTimeout(commit, 400); }
  });
  addEventListener('beforeunload', () => { if (doc) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && doc) saveNow(); });

  // Für Prüfläufe und Fehlersuche
  window.HT = {get lib(){ return lib; }, heavy, libReady, autoReady, libDialog, libSave, libAddImage, usePerson, useOverlay, useGraphic, libImport, libAddFont, brandFile, brandSave, brandUse, get brand(){ return brand(); }, get brands(){ return brands; }, mine, useBg, setFormat,
    get doc(){ return doc; }, get sel(){ return selId; }, select, commit, openDoc, showHome, newDialog, saveNow, Store, act, cutLayer, importFile, get scale(){ return sc; }};

  // ───────── Start ─────────
  (async () => {
    // Der Start wartet auf nichts Schweres: Schriften höchstens kurz, die Übersicht sofort; Markenunterlagen kommen im Hintergrund
    await Promise.race([H.fonts(), new Promise(r => setTimeout(r, 2500))]); await showHome();
    libReady().then(() => { document.documentElement.style.setProperty('--acc', H.accent(brand().accentKey).dark); autoReady(); fontsBg(); });
    const o = location.hash.match(/open=([\w-]+=*)/);
    if (o && DESKTOP) await Store.ready;
    if (o && Store.desktop){ try { const f = await window.pywebview.api.open_file(o[1]); if (f) importFile(b64File(f.name, f.data)); } catch(e){ toast(e.message); } }
  })();
})();
