"""把 site/data.json 塞進 tools/template.html，產出網站首頁 site/index.html.

用法：python tools/inject.py [--artifact 輸出路徑]   # --artifact 另存一份不含 <html> 外殼的版本（發布到 claude.ai 用）
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
page = (ROOT / "tools" / "template.html").read_text(encoding="utf-8").replace(
    "/*DATA*/", (SITE / "data.json").read_text(encoding="utf-8"))
full = ('<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + page + '\n</body>\n</html>\n')
(SITE / "index.html").write_text(full, encoding="utf-8")
if "--artifact" in sys.argv:
    pathlib.Path(sys.argv[sys.argv.index("--artifact") + 1]).write_text(page, encoding="utf-8")
print("已產生", SITE / "index.html")
