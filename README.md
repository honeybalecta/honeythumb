# HoneyThumb

Titelbilder für Videos: Vorlage wählen, Bild einsetzen, HoneyThumb stellt die Person frei und setzt sie vor einen eigenen Hintergrund. Dazu Texte, Formen und Piktogramme – im eigenen Design, in jedem Format.
HoneyThumb läuft eigenständig (Windows, Android, Browser). Seine Vorlagen sind auch für den Bereich „Titelbild“ in HoneyCut gedacht.

## Wo es läuft

| Plattform | Download |
|---|---|
| Windows | `HoneyThumb-Setup-x.y.z.exe` (Release `v…`) |
| Android | `HoneyThumb-Android-x.y.z.apk` (Release `android-v…`) |
| Web | `honeybalecta.github.io/honeythumb/` |

## Was es kann

- **Vierzehn Vorlagen:** Pinselbalken unten, Pinselbalken Mitte, Pinselbalken (drei Zeilen), Pinselbalken mit Person, Person rechts, Person links (hell), Bild mit Balken, Kreis, Strahlen, Zitat, Schlagzeile, Frage, Ausschnitt, Geteilt. Jede Vorlage gibt es für alle Formate. Beim Wechsel der Vorlage bleiben Texte, Bilder und eigene Ebenen erhalten; die Vorschauen zeigen gleich den eigenen Inhalt.
- **Pinselbalken:** Bild über die ganze Fläche, darauf drei leicht gedrehte Balken – Titel auf einem Pinselstrich in der Akzentfarbe, ein kleines Wort in Schreibmaschinenschrift auf einem Papierfetzen, die zweite Zeile auf Schwarz. Farbe, Balkenart (glatt, Pinselstrich, Papier), „Raue Schrift“ und „Anderes Muster“ stehen bei den Eigenschaften jedes Texts. „＋ Balken“ legt einen weiteren Balken dazu: Pinselstrich, schwarz gerissen oder ein kleines Wort auf Papier.
- **Formate:** Quer 16:9 (YouTube), Hoch 9:16 (Reels, TikTok, Shorts), Quadrat 1:1, Hoch 4:5.
- **Person freistellen:** Bild wählen, HoneyThumb erkennt die Person und blendet den Rest aus. Die Erkennung wird beim ersten Mal aus dem Netz geladen (ca. 10 MB), das Bild bleibt auf dem Gerät. Mit „Maske nachbessern“ lässt sich mit dem Pinsel etwas entfernen oder zurückholen; „Freistellung aufheben“ zeigt wieder das ganze Bild.
- **Umriss und Schatten** um die freigestellte Person, Schwarz-weiß, Spiegeln, Ausschnitt.
- **Hintergrund:** Farbe, Verlauf, Bild (weichzeichnen, abdunkeln, schwarz-weiß), Strahlen, Punkte, Schräg geteilt, Raster; dazu abgedunkelte Ränder.
- **Text:** elf Schriften (dazu eigene), `*Sternchen*` färben ein Wort in der Akzentfarbe, Balken hinter dem Text (je Zeile oder als Block), Kontur, Schatten. Ein Text wird verkleinert, bis er in sein Feld passt; wird er dabei sehr klein, erscheint ein Hinweis.
- **Formen und Piktogramme:** Rechteck, Kreis, Dreieck, Stern, Zacken, Pfeil, Sprechblase, Ring, Linie; rund 500 Piktogramme (dieselben wie in HoneyDeck) mit Suche.
- **Bühne:** Ebenen anfassen, verschieben (rastet an Mitte, Rändern und Schutzrand ein), an den Ecken im Verhältnis vergrößern, an den Seiten die Breite ändern, drehen. Pfeiltasten schieben fein, Strg+D dupliziert, Entf löscht, Strg+Z macht rückgängig.
- **Ebenen:** Liste von vorn nach hinten, ausblenden, sperren, nach vorn und nach hinten.
- **Akzentfarbe:** Rot, Grün, Petrol, Blau, Violett, Magenta, Orange, Ocker – tauscht die Farbe an allen Stellen.
- **Export:** JPG (für YouTube unter 2 MB gehalten) oder PNG; 16:9 in 1280 × 720 und 1920 × 1080, Hochformate in 1080 Breite. Dazu `.honeythumb` zum Weiterbearbeiten auf einem anderen Gerät.
- **Markenunterlagen – fest hinterlegte Bilder je Marke** (Knopf „▤ Markenunterlagen“ in der Übersicht und im Editor). Eine Marke ist etwa der eigene Kanal oder eine Abgeordnete; es gilt immer die gewählte Marke. Sie trägt einen Namen, die Akzentfarbe neuer Titelbilder und vier Arten von Einträgen:
  - **Personen:** Menschen, die regelmäßig auf Titelbildern stehen, je Person ein oder mehrere Bilder. Ein Tipp setzt die Person ins freie Feld der Vorlage oder als eigene Ebene dazu. Bilder mit durchsichtigem Hintergrund bleiben, wie sie sind; alle anderen stellt HoneyThumb frei.
  - **Auflagen:** Bilder, die immer ganz oben liegen (etwa ein Banner am unteren Rand), je Format wählbar. Mit „Immer dabei“ bekommt jedes neue Titelbild in diesen Formaten die Auflage von selbst. Die Vorlagen ordnen Texte und Bilder in der freien Fläche an, damit nichts unter der Auflage verschwindet.
  - **Grafiken:** Logos, Wasserzeichen und andere wiederkehrende Bilder.
  - **Hintergründe:** Bilder, die immer wieder als Hintergrund dienen.
  - **Schriften:** eigene Schriftdateien (TTF, OTF, WOFF). Sie stehen bei jedem Text zur Wahl; „Titel“ und „Klein“ legen fest, welche Schrift die Pinselbalken-Vorlagen nehmen. Eine genutzte eigene Schrift steckt in der Datei `.honeythumb`.
  - Person, Bild oder Hintergrund eines Titelbilds lassen sich mit „Hinterlegen“ direkt in die gewählte Marke aufnehmen; Einträge lassen sich in eine andere Marke legen.
  - **Auf ein anderes Gerät:** „Sichern“ schreibt die Marke im Ganzen in eine Datei (`Markenunterlagen-Name.json`: Name, Farbe, alle Einträge). „Laden“ oder „Öffnen“ liest sie ein; die Marke ist danach gewählt, schon vorhandene Einträge werden ersetzt. Die Unterlagen liegen je Gerät getrennt.
- **Bilder holen:** Datei wählen, aus der Zwischenablage einfügen oder ins Fenster ziehen. Ein geöffnetes Foto wird in der gewählten Vorlage gleich freigestellt.

## Auf dem Handy

Das Bild steht oben, darunter die Knöpfe zum Hinzufügen. Drei Reiter unten: Vorlagen, Bearbeiten, Ebenen. Format und Datei liegen unter „⋯“.

## Das Format .honeythumb

JSON, UTF-8. Maße in Entwurfspixeln des Formats (16:9 = 1600 × 900, 9:16 = 900 × 1600, 1:1 = 1200 × 1200, 4:5 = 1080 × 1350).

```json
{
  "app": "honeythumb", "v": 1,
  "name": "Die bestellte Distanz",
  "format": "16:9", "tpl": "rechts", "accentKey": "rot", "accent": "#E5402A",
  "assets": {"a1": "data:image/jpeg;base64,…", "a2": "data:image/png;base64,…"},
  "layers": [
    {"type": "bg", "fill": {"kind": "grad", "a": "#131312", "b": "#232321", "ang": 0, "vig": 0.35}},
    {"type": "img", "slot": "person", "img": "a1", "mask": "a2", "x": 800, "y": 45, "w": 832, "h": 918, "fit": "contain", "pos": {"x": 0.5, "y": 1}, "outline": {"w": 9, "c": "#EDE7DA"}},
    {"type": "text", "slot": "title", "text": "Die bestellte *Distanz*", "x": 96, "y": 225, "w": 736, "h": 450, "font": "anton", "size": 170, "color": "#EDE7DA", "upper": true}
  ]
}
```

| Ebene | Felder |
|---|---|
| alle außer `bg` | `x`, `y`, `w`, `h`, `rot` (Grad), `op` (Deckkraft 0…1), `hide`, `lock`, `slot` (Feld einer Vorlage: `person`, `photo`, `title`, `kicker`, `sub`) |
| `bg` | `fill.kind`: `color`, `grad`, `img`, `rays`, `dots`, `diag`, `grid`; Farben `a`, `b`; bei `img`: `img`, `blur`, `dim`, `gray`, `zoom`, `pos`; `vig` dunkelt die Ränder ab |
| `img` | `img` (Bild), `mask` (PNG, dessen Deckkraft die Maske ist), `src` (unbeschnittenes Original), `fit` (`cover`/`contain`), `zoom`, `pos`, `flip`, `gray`, `outline {w, c}`, `shadow {b, x, y, c}`, `round`, `frame {w, c}` |
| `text` | `text`, `font` (auch `u:ID` für eine eigene Schrift aus `fonts`), `size`, `color`, `accent`, `align` (`l`/`c`/`r`), `valign` (`t`/`m`/`b`), `lh`, `upper`, `fit`, `box {c, pad, mode, style}` (`style`: `rect`, `brush`, `torn`), `rough` (0…1), `seed` (Muster), `stroke {w, c}`, `shadow` |
| `shape` | `shape`: `rect`, `ellipse`, `tri`, `star`, `burst`, `arrow`, `bubble`, `ring`, `line`; `fill`, `stroke {w, c}`, `round` |
| `icon` | `icon` (Name des Piktogramms), `color`, `accent` |
| Auflage (`img` mit `top: true`) | liegt immer zuletzt in `layers`; `lock`, `name`, `lib` (Eintrag der Ablage), `fmts` (Formate), `ar` (Seitenverhältnis des Bildes), `band {t, b}` (deckende Streifen oben und unten als Anteil der Bildhöhe) |

## Entwicklung

- `web/` – Oberfläche: `thumb-engine.js` (Datenmodell, Zeichnen, Vorlagen), `thumb-cut.js` (Person freistellen), `thumb-icons.js` (Piktogramme), `thumb-app.js` (Editor), `thumb.css`
- Rechenkern: `HoneyThumb.fromTemplate(vorlage, format, inhalt)` baut ein Titelbild, `HoneyThumb.render(titelbild, breite)` zeichnet es, `HoneyThumb.retemplate(titelbild, vorlage, format)` wechselt Vorlage oder Format, `HoneyThumb.recolor(titelbild, farbe)` tauscht die Akzentfarbe
- Auflagen: `HoneyThumb.overlayLayer(format, bild, {band, ar, fmts, …})`, `bandOf(bild)` misst die deckenden Streifen, `topInset(ebenen, format)` die verdeckte Fläche; `fromTemplate` baut die Vorlage in die freie Fläche (`base.extra` trägt die Auflagen), `pinTop` hält Auflagen oben
- Markenunterlagen (`thumb-app.js`): im Speicher des Geräts `brand:ID` je Marke, `lib:ID` je Eintrag (mit `brand`), `set:brand` die gewählte Marke; Datei `{app: "honeythumb-marke", brand, items}`
- Freistellen: `HoneyThumbCut.person(bild)` liefert die Maske; `HoneyThumbCut.setSegmenter(fn)` setzt eine eigene Erkennung ein (HoneyCut, Prüfläufe)
- `fonts/` – Schriften (dieselben wie in HoneyCut und HoneyDeck, Lizenzen in `fonts/LIZENZ.md`)
- `build.py ZIEL` – stellt Oberfläche und Schriften zusammen (Web, Android, Windows)
- `android/` – Android-App (WebView, Paket `de.honeybalecta.honeythumb`), `desktop/` – Windows-Programm (pywebview) und Installer
- Builds: `.github/workflows/build.yml` (Android + Windows, Releases `android-v…` und `v…`), `pages.yml` (Web)
- Prüflauf: `python3 build.py /tmp/ht/site`, den Ordner auf Port 8801 ausliefern (`python3 -m http.server 8801`), dann `node tests/p_thumb.mjs` und `node tests/p_marke.mjs`. Playwright wird aus dem Ordner in `HT_PW` geladen. Der Lauf nutzt ein künstliches Foto und eine eigene Erkennung; die echte Erkennung aus dem Netz prüft er nicht.
