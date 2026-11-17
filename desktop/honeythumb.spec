# PyInstaller-Bauplan für HoneyThumb (Windows, Ordner-Build)
# Vorher: python build.py dist-web    Aufruf: pyinstaller desktop/honeythumb.spec
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

HERE = Path(SPECPATH)
datas = [(str(HERE.parent / "dist-web"), "web"), (str(HERE / "honeythumb.ico"), ".")]
binaries, hiddenimports = [], []
for pkg in ("webview", "clr_loader", "pythonnet"):
    d, b, h = collect_all(pkg)
    datas += d; binaries += b; hiddenimports += h

a = Analysis([str(HERE / "honeythumb_app.py")], pathex=[str(HERE)], binaries=binaries, datas=datas,
             hiddenimports=hiddenimports, excludes=["matplotlib", "PyQt5", "PySide6", "IPython", "pytest", "tkinter", "numpy"], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="HoneyThumb", console=False, icon=str(HERE / "honeythumb.ico"))
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="HoneyThumb")
