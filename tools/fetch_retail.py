"""抓臺北市市場處「臺北市公有零售市場行情」（每月各品項平均零售價，元/台斤）.

用法：python tools/fetch_retail.py  → data/retail_taipei.json  {"2025-09": {"甘藍": 68, ...}, ...}
"""
import json, urllib.request, csv, io, re, ssl, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "retail_taipei.json"

DATASET = "54d9d492-1e2e-40d1-ae7b-fbce6f271bf1"
# 和農業部一樣，憑證缺 Subject Key Identifier；保留驗證、只關 Python 3.13 的嚴格旗標
CTX = ssl.create_default_context(); CTX.verify_flags &= ~ssl.VERIFY_X509_STRICT


def get(url):
    with urllib.request.urlopen(url, timeout=60, context=CTX) as r:
        return r.read()


meta = json.loads(get(f"https://data.taipei/api/frontstage/tpeod/dataset.view?id={DATASET}"))["payload"]
out = {}
for res in meta["resources"]:
    m = re.match(r"(\d+)年(\d+)月", res["name"])
    if not m: continue
    ym = f"{int(m.group(1)) + 1911}-{int(m.group(2)):02d}"
    txt = get(f"https://data.taipei/api/dataset/{DATASET}/resource/{res['rid']}/download").decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(txt)))
    col = next(k for k in rows[0] if "平均" in k)
    out[ym] = {r["項目"].strip(): float(r[col]) for r in rows if r[col].strip() not in ("-", "")}
    print(ym, len(out[ym]), "項")
if not out: raise SystemExit("沒抓到零售資料，沿用舊檔")
json.dump(dict(sorted(out.items())), open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
