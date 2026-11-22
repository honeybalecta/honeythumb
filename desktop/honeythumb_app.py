"""
HoneyThumb als Windows-Programm: eigenes Fenster (Edge WebView2) mit der gemeinsamen Oberfläche aus web/.

Gespeichert wird in %APPDATA%\\HoneyThumb\\store (eine JSON-Datei je Titelbild) – unabhängig vom Fenster.
Die Oberfläche liest und schreibt den Speicher über den eigenen Server (/__store/…): Die Brücke von pywebview ist für
Megabytes zu langsam – mit ihr stand das Programm beim Öffnen, sobald Bilder hinterlegt waren. Der Server hört nur auf
127.0.0.1 und verlangt den Schlüssel dieses Programmlaufs (TOKEN) als Kopfzeile, damit keine fremde Seite an den Speicher kommt.
HoneyCut findet HoneyThumb über den Registry-Eintrag HKCU\\Software\\HoneyBalecta\\HoneyThumb\\WebDir (setzt der Installer)
und kann dieselbe Oberfläche einbetten.
"""
from __future__ import annotations

import base64
import json
import os
import hmac
import re
import secrets
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

FROZEN = bool(getattr(sys, "frozen", False))
APP_DIR = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent
RES_DIR = Path(getattr(sys, "_MEIPASS", APP_DIR))
WEB_DIR = next((p for p in (APP_DIR / "web", RES_DIR / "web", APP_DIR.parent / "dist-web") if (p / "index.html").is_file()), APP_DIR / "web")
DATA = Path(os.environ.get("APPDATA") or Path.home()) / "HoneyThumb"
STORE = DATA / "store"
STORE.mkdir(parents=True, exist_ok=True)
TITLE = "HoneyThumb"
TOKEN = secrets.token_urlsafe(18)   # Schlüssel dieses Programmlaufs für /__store/


def fail(msg: str):
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, msg, TITLE, 0x10)
    except Exception:
        print(msg, file=sys.stderr)
    sys.exit(1)


def key_file(key: str) -> Path:
    return STORE / (re.sub(r"[^A-Za-z0-9_.-]", "_", key)[:120] + ".json")


def store_get(key):
    f = key_file(key)
    return f.read_text(encoding="utf-8") if f.is_file() else None


def store_set(key, value):
    f = key_file(key)
    tmp = f.with_name(f.name + ".tmp")
    tmp.write_text(value, encoding="utf-8")
    tmp.replace(f)
    return True


def store_del(key):
    f = key_file(key)
    if f.is_file():
        f.unlink()
    return True


def store_keys(prefix):
    out, pre = [], re.sub(r"[^A-Za-z0-9_.-]", "_", prefix)
    for f in STORE.glob("*.json"):
        k = f.name[:-5]   # nicht f.stem: Schlüssel wie libd_ID.BILD tragen selbst einen Punkt
        if k.startswith(pre):
            out.append(k.replace("_", ":", 1))   # thumb_ID → thumb:ID, meta_ID → meta:ID
    return out


class Api:
    """Aufrufbar aus der Oberfläche über window.pywebview.api."""
    window = None

    def store_get(self, key):
        return store_get(key)

    def store_set(self, key, value):
        return store_set(key, value)

    def store_del(self, key):
        return store_del(key)

    def store_keys(self, prefix):
        return store_keys(prefix)

    def open_file(self, b64path):
        """Beim Start übergebene Datei (Doppelklick auf .honeythumb, „Öffnen mit“) an die Oberfläche geben."""
        p = Path(base64.urlsafe_b64decode(b64path.encode()).decode())
        return {"name": p.name, "data": base64.b64encode(p.read_bytes()).decode()}

    def save_file(self, name, b64):
        import webview
        ext = Path(name).suffix.lstrip(".") or "*"
        try:
            res = self.window.create_file_dialog(webview.SAVE_DIALOG, save_filename=name,
                                                 file_types=(f"{ext.upper()}-Datei (*.{ext})", "Alle Dateien (*.*)"))
        except Exception:
            res = self.window.create_file_dialog(webview.SAVE_DIALOG, save_filename=name)
        if not res:
            return None
        dest = res[0] if isinstance(res, (list, tuple)) else res
        Path(dest).write_bytes(base64.b64decode(b64))
        return dest


class Quiet(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".webmanifest": "application/manifest+json",
                      ".ttf": "font/ttf", ".otf": "font/otf", ".svg": "image/svg+xml"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(WEB_DIR), **k)

    def log_message(self, *a):
        pass

    # Speicher für die Oberfläche: nur mit dem Schlüssel dieses Programmlaufs und nur für Anfragen an 127.0.0.1
    def _store(self, body=None):
        u = urlsplit(self.path)
        if not u.path.startswith("/__store/"):
            return False
        host = (self.headers.get("Host") or "").split(":")[0]
        if host not in ("127.0.0.1", "localhost") or not hmac.compare_digest(self.headers.get("X-HoneyThumb") or "", TOKEN):
            self.send_error(403)
            return True
        op, q = u.path[len("/__store/"):], parse_qs(u.query)
        key, out, typ = (q.get("key") or [""])[0], b"", "application/json"
        try:
            if op == "get" and body is None:
                out = (store_get(key) or "").encode("utf-8")
            elif op == "keys" and body is None:
                out = json.dumps(store_keys((q.get("prefix") or [""])[0])).encode("utf-8")
            elif op == "set" and body is not None and key:
                store_set(key, body.decode("utf-8"))
            elif op == "del" and body is not None and key:
                store_del(key)
            else:
                self.send_error(404)
                return True
        except Exception as e:  # noqa: BLE001
            self.send_error(500, str(e)[:120])
            return True
        self.send_response(200)
        self.send_header("Content-Type", typ + "; charset=utf-8")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        try:
            self.wfile.write(out)
        except ConnectionError:   # das Fenster hat die Anfrage abgebrochen (neu geladen, geschlossen)
            pass
        return True

    def do_GET(self):
        if not self._store():
            super().do_GET()

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 400_000_000:
            self.send_error(413)
            return
        if not self._store(self.rfile.read(n)):
            self.send_error(405)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def free_port(start=8790):
    for p in range(start, start + 40):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return 0


def fenster_einrichten(fenster, titel: str, maximieren: bool):
    """Fenster mittig auf den Bildschirm setzen und auf Wunsch maximieren.

    Windows legt neue Fenster sonst versetzt nach rechts unten ab. Läuft über die Win32-Funktionen,
    damit Position und Größe bei jeder Bildschirmskalierung in denselben (physischen) Pixeln gerechnet werden."""
    if sys.platform != "win32":
        return
    try:
        import ctypes
        from ctypes import wintypes
        u = ctypes.windll.user32
        hwnd = 0
        try:
            hwnd = int(fenster.native.Handle.ToInt64())
        except Exception:  # noqa: BLE001
            hwnd = u.FindWindowW(None, titel)
        if not hwnd:
            return

        class MONITORINFO(ctypes.Structure):
            _fields_ = [("cbSize", wintypes.DWORD), ("rcMonitor", wintypes.RECT), ("rcWork", wintypes.RECT), ("dwFlags", wintypes.DWORD)]

        r = wintypes.RECT()
        u.GetWindowRect(hwnd, ctypes.byref(r))
        mi = MONITORINFO()
        mi.cbSize = ctypes.sizeof(MONITORINFO)
        u.GetMonitorInfoW(u.MonitorFromWindow(hwnd, 2), ctypes.byref(mi))   # 2 = nächster Bildschirm
        a = mi.rcWork
        aw, ah = a.right - a.left, a.bottom - a.top
        w, h = min(r.right - r.left, int(aw * 0.94)), min(r.bottom - r.top, int(ah * 0.94))
        u.SetWindowPos(hwnd, 0, a.left + (aw - w) // 2, a.top + (ah - h) // 2, w, h, 0x0004 | 0x0010)   # ohne Z-Reihenfolge/Aktivierung
        if maximieren:
            u.ShowWindow(hwnd, 3)   # SW_MAXIMIZE
    except Exception:  # noqa: BLE001
        pass


def main():
    if not (WEB_DIR / "index.html").is_file():
        fail(f"Oberfläche nicht gefunden: {WEB_DIR}")
    try:
        import webview
    except Exception:
        fail("pywebview fehlt – bitte HoneyThumb neu installieren.")
    port = free_port()
    srv = ThreadingHTTPServer(("127.0.0.1", port), Quiet)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("HoneyThumb.App")
    except Exception:
        pass
    api = Api()
    url = f"http://127.0.0.1:{port}/index.html?desktop=1&k={TOKEN}"
    if len(sys.argv) > 1 and Path(sys.argv[1]).is_file():   # „Öffnen mit“ / Doppelklick auf .honeythumb
        url += "#open=" + base64.urlsafe_b64encode(str(Path(sys.argv[1]).resolve()).encode()).decode()
    api.window = webview.create_window(TITLE, url, js_api=api, width=1440, height=900, min_size=(900, 600),
                                       background_color="#131312", text_select=False)
    api.window.events.shown += lambda: fenster_einrichten(api.window, TITLE, True)
    webview.start(private_mode=False, storage_path=str(DATA / "webview"))


if __name__ == "__main__":
    main()
