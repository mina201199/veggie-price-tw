"""抓農業部農產品交易行情（蔬菜 N04、水果 N05），依品種、日期存成每月一個檔：data/raw/YYYY-MM.json.

用法：
    python tools/fetch.py              # 每日更新：重抓最近 10 天（市場偶爾會補登、修正），合併進月檔
    python tools/fetch.py --days 30    # 重抓最近 30 天
    python tools/fetch.py 2021-09-01 2026-09-30   # 指定區間（第一次建資料用）

月檔格式：{"種類|作物代號|完整品名": {"115.09.30": [全台加權均價 元/公斤, 交易量 公斤], ...}, ...}
"""
import json, datetime as dt, urllib.request, urllib.parse, collections, sys, time, ssl, pathlib
from concurrent.futures import ThreadPoolExecutor

B = "https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx"
RAW = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw"
TODAY = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()  # GitHub 的機器是 UTC，日期一律用台灣時間

args = sys.argv[1:]
if len(args) >= 2 and args[0] != "--days":
    START, END = dt.date.fromisoformat(args[0]), dt.date.fromisoformat(args[1])
else:
    days = int(args[1]) if args[:1] == ["--days"] and len(args) > 1 else 10
    START, END = TODAY - dt.timedelta(days=days - 1), TODAY

# 伺服器部分節點的憑證缺 Subject Key Identifier，Python 3.13 的嚴格檢查會擋；保留驗證、只關嚴格旗標
CTX = ssl.create_default_context(); CTX.verify_flags &= ~ssl.VERIFY_X509_STRICT
CAP = 9999  # API 單次最多回 9999 筆
FAILS = [0]


def roc(d): return f"{d.year - 1911}.{d.month:02d}.{d.day:02d}"


def chunks():
    for t, span in (("N04", 3), ("N05", 7)):
        d = START
        while d <= END:
            e = min(d + dt.timedelta(days=span - 1), END)
            yield t, d, e
            d = e + dt.timedelta(days=1)


def fetch(t, s, e):
    url = B + "?" + urllib.parse.urlencode({"StartDate": roc(s), "EndDate": roc(e), "TcType": t})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120, context=CTX) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as ex:
            time.sleep(3 * (attempt + 1)); err = ex
    print("FAIL", t, s, e, err, file=sys.stderr); FAILS[0] += 1
    if FAILS[0] > 5: raise SystemExit("太多請求失敗，停止（月檔沒有被改動）")
    return []


def get(a):
    t, s, e = a
    rows = fetch(t, s, e)
    if len(rows) >= CAP and s < e:  # 被截斷就逐日重抓
        rows = []
        d = s
        while d <= e:
            day = fetch(t, d, d)
            if len(day) >= CAP: print("CAPPED DAY", t, d, file=sys.stderr)
            rows += day; d += dt.timedelta(days=1)
    return a, rows


# key: (種類, 作物代號, 完整品名含品種) -> 民國日期 -> [sum(p*v), sum(v)]；進口與各品種都保留，歸類交給 build.py
agg = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
n_rows = 0
with ThreadPoolExecutor(4) as ex:
    for (t, _, _), rows in ex.map(get, list(chunks())):
        n_rows += len(rows)
        for x in rows:
            name, code, p, v = (x.get("作物名稱") or "").strip(), x.get("作物代號") or "", x.get("平均價"), x.get("交易量")
            if not name or not p or not v or name == "休市":
                continue
            a = agg[(t, code, name)][x["交易日期"]]
            a[0] += p * v; a[1] += v
if not agg:
    raise SystemExit("沒抓到資料，月檔不動")

# 依月份分組，合併進既有月檔（同一天的資料以新抓的為準）
by_month = collections.defaultdict(lambda: collections.defaultdict(dict))
for (t, c, n), days in agg.items():
    for d, (pv, v) in days.items():
        if v <= 0: continue
        y, m, _ = d.split(".")
        by_month[f"{int(y) + 1911}-{m}"][f"{t}|{c}|{n}"][d] = [round(pv / v, 2), round(v)]

RAW.mkdir(parents=True, exist_ok=True)
for ym, new in sorted(by_month.items()):
    path = RAW / f"{ym}.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for k, days in new.items():
        old.setdefault(k, {}).update(days)
    merged = {k: dict(sorted(v.items())) for k, v in sorted(old.items())}
    path.write_text(json.dumps(merged, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{ym}: 更新 {sum(len(v) for v in new.values())} 筆品項日資料")
print(f"{START}～{END}：原始 {n_rows} 筆，{len(agg)} 個品項")
