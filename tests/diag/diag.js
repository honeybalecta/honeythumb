// Diagnose: kommt die gewählte Schrift auf einer Leinwand außerhalb der Seite (Export) genauso an wie auf der Bühne?
window.__diag = null;
(async () => {
  const out = {ua: navigator.userAgent, dpr: devicePixelRatio, err: null, pics: {}};
  try {
    const H = HoneyThumb, sleep = ms => new Promise(r => setTimeout(r, ms)), raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sig = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 2166136261; for (let i = 0; i < d.length; i += 4){ if (d[i] > 128) n++; h ^= d[i]; h = Math.imul(h, 16777619); } return n + ':' + (h >>> 0).toString(36); };
    const small = c => { const k = 480 / c.width, s = document.createElement('canvas'); s.width = 480; s.height = Math.round(c.height * k); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); return s.toDataURL('image/jpeg', 0.8); };
    out.faces0 = [...document.fonts].map(f => f.family + '=' + f.status);
    await Promise.race([H.fonts(), sleep(8000)]);
    out.faces1 = [...document.fonts].map(f => f.family + '=' + f.status);
    // 1. Rohtest: dieselbe Zeile auf einer Leinwand in der Seite und einer außerhalb
    out.raw = {};
    for (const f of ['TSF-anton', 'TSF-poppins', 'TSF-lora', 'TSF-bebas', 'TSF-typewriter', 'TSF-gibtsnicht']){
      const mk = on => { const c = document.createElement('canvas'); c.width = 900; c.height = 160; if (on) document.body.append(c); const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 900, 160); x.fillStyle = '#fff'; x.font = `90px "${f}"`; x.fillText('Hamburg Wetter 123', 10, 110); const r = [sig(c), x.font, Math.round(x.measureText('Hamburg Wetter 123').width)]; if (on) c.remove(); return r; };
      out.raw[f] = {in: mk(true), out: mk(false), check: document.fonts.check(`90px "${f}"`)};
    }
    // 2. Rechenkern: Ebene mit Schrift, Bühne (in der Seite) gegen Export (außerhalb)
    out.eng = {};
    for (const f of H.FONTS.map(x => x.k)){
      const doc = H.blank('16:9'); doc.layers.push(H.newLayer(doc, 'text', {text: 'Hamburg Wetter', font: f, upper: false}));
      const st = document.createElement('canvas'); document.body.append(st); H.render(doc, 800, {canvas: st});
      const ex = H.render(doc, 800), big = H.render(doc, 1920);
      out.eng[f] = [sig(st), sig(ex), sig(big)]; if (f === 'poppins' || f === 'lora'){ out.pics['eng-' + f + '-buehne'] = small(st); out.pics['eng-' + f + '-export'] = small(ex); out.pics['eng-' + f + '-1920'] = small(big); } st.remove();
    }
    // 3. Echte Bedienung: Titelbild aus Vorlage, Schrift über die Auswahlliste, dann wie „Exportieren“
    out.ui = {};
    for (const tpl of ['schlagzeile', 'pinsel']){
      await HT.openDoc(H.fromTemplate(tpl, '16:9', {}, {}), true); await raf();
      const t = HT.doc.layers.find(l => l.slot === 'title'); HT.select(t.id); await raf();
      const r = out.ui[tpl] = {};
      for (const f of ['poppins', 'lora', 'typewriter']){
        const s = document.querySelector('#insp select[data-k="font"]'); s.value = f; s.dispatchEvent(new Event('change', {bubbles: true})); await raf(); await sleep(400);
        const stage = document.querySelector('#stage'), same = H.render(HT.doc, stage.width, {edit: true}), ex = H.render(HT.doc, 1920);
        r[f] = {font: HT.doc.layers.find(l => l.slot === 'title').font, stage: sig(stage), same: sig(same), ex: sig(ex)};
        if (f !== 'typewriter'){ out.pics[`ui-${tpl}-${f}-buehne`] = small(stage); out.pics[`ui-${tpl}-${f}-export`] = small(ex); }
      }
    }
    // 4. Nach einer Pause noch einmal (Schrift inzwischen verworfen?)
    await sleep(15000);
    { const ex = H.render(HT.doc, 1920); out.spaet = sig(ex); out.pics['ui-spaet-export'] = small(ex); out.faces2 = [...document.fonts].map(f => f.family + '=' + f.status); }
  } catch(e){ out.err = String(e && e.stack || e); }
  window.__diag = JSON.stringify(out);
})();
