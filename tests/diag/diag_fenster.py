"""Diagnose im echten Fenster (pywebview, WebView2): Schrift auf der Bühne gegen Schrift im Export."""
import base64, json, sys, threading, time
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "desktop"))
import honeythumb_app as A  # noqa: E402
import webview  # noqa: E402

OUT = ROOT / "diag-out" / "fenster"
OUT.mkdir(parents=True, exist_ok=True)
port = A.free_port()
srv = ThreadingHTTPServer(("127.0.0.1", port), A.Quiet)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{port}/index.html?desktop=1&k={A.TOKEN}"
win = webview.create_window(A.TITLE, url, width=1440, height=900, min_size=(900, 600), background_color="#131312", text_select=False)
JS = (ROOT / "tests" / "diag" / "diag.js").read_text(encoding="utf-8")


def lauf():
    try:
        t0 = time.time()
        while time.time() - t0 < 60:
            try:
                if win.evaluate_js("!!(window.HT && window.HoneyThumb && !document.querySelector('#home').classList.contains('hidden'))"):
                    break
            except Exception as e:  # noqa: BLE001
                print("warte:", e)
            time.sleep(1)
        win.evaluate_js(JS)
        res = None
        t0 = time.time()
        while time.time() - t0 < 120:
            res = win.evaluate_js("window.__diag")
            if res:
                break
            time.sleep(1)
        if not res:
            print("KEIN ERGEBNIS")
        else:
            d = json.loads(res)
            for name, uri in d.pop("pics", {}).items():
                (OUT / f"{name}.jpg").write_bytes(base64.b64decode(uri.split(",", 1)[1]))
            (OUT / "ergebnis.json").write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
            print(json.dumps(d, indent=1, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        print("FEHLER:", repr(e))
    finally:
        win.destroy()


threading.Timer(240, lambda: win.destroy()).start()
webview.start(lauf, private_mode=False, storage_path=str(ROOT / "diag-out" / "profil"))
