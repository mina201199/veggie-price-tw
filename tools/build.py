"""把農業部每日行情（品種層級，含進口）整理成 demo 要用的指標.

用法：python tools/build.py [YYYY-MM-DD]
    讀 data/raw/*.json（fetch.py 的月檔）與 data/retail_taipei.json，寫出 site/data.json
"""
import json, sys, os, datetime as dt, statistics as st, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TODAY = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
RETAIL = ROOT / "data" / "retail_taipei.json"
# 往年同期要看前五年，多讀兩個月當緩衝
fm = dt.date(TODAY.year - 5, TODAY.month, 1) - dt.timedelta(days=62)
first_month = f"{fm.year}-{fm.month:02d}"
raw = {}
for f in sorted((ROOT / "data" / "raw").glob("*.json")):
    if first_month <= f.stem <= f"{TODAY.year}-{TODAY.month:02d}":
        for k, days in json.loads(f.read_text(encoding="utf-8")).items():
            raw.setdefault(k, {}).update(days)

from catalog import classify, parse, years_ago, same_period_baseline


def wavg(pairs):
    v = sum(x[1] for x in pairs); return sum(x[0] * x[1] for x in pairs) / v if v else None


# 依常用名合併
merged = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
meta, official, comp_vol = {}, collections.defaultdict(set), collections.Counter()
for key, days in raw.items():
    c = classify(key)
    if not c: continue
    name, cat, imp, split, dom = c
    full = key.split("|", 2)[2]
    meta[name] = (cat, imp, dom)
    official[name].add(full if (split or imp) else full.split("-")[0])
    for d, (p, v) in days.items():
        a = merged[name][d]; a[0] += p * v; a[1] += v
        comp_vol[(name, full if (split or imp) else full.split("-")[0])] += v

r2 = lambda x: None if x is None else round(x, 1)
out, dropped = [], []
for name, days in merged.items():
    s = {parse(d): (pv / v, v) for d, (pv, v) in days.items() if v > 0 and parse(d) <= TODAY}
    dates = sorted(s)
    recent_days = [d for d in dates if d > TODAY - dt.timedelta(days=730)]
    if len(recent_days) < 10:
        dropped.append(name); continue
    # 每日價會因各市場休市、到貨組合而鋸齒跳動，一律用「近 5 天依交易量加權」的平滑價
    sm, d = {}, dates[0]
    while d <= TODAY:
        w = [s[d - dt.timedelta(days=k)] for k in range(5) if d - dt.timedelta(days=k) in s]
        if w: sm[d] = wavg(w)
        d += dt.timedelta(days=1)
    last = dates[-1]
    off = last < TODAY - dt.timedelta(days=10)          # 最近 10 天沒交易：非產季
    cur = None if off else (sm.get(TODAY) or sm[last])
    # 零售價跟著批發價調整會慢一拍，估零售用近 14 天的批發均價
    w14 = wavg([s[d] for d in dates if d > TODAY - dt.timedelta(days=14)])
    # 往年同期（規則在 catalog.py，本機頁面也用同一套）
    base = same_period_baseline(sm, TODAY)[0]
    p365 = sorted(v for d, v in sm.items() if d > TODAY - dt.timedelta(days=365))
    enough = len(p365) >= 30
    last365 = [s[d] for d in dates if d > TODAY - dt.timedelta(days=365)]
    avg_vol = sum(x[1] for x in last365) / 365
    # 供應量：近 14 天日均量 vs 過去一年日均量（以交易日算）
    v14 = [s[d][1] for d in dates if d > TODAY - dt.timedelta(days=14)]
    sup = (sum(v14) / len(v14)) / (sum(x[1] for x in last365) / len(last365)) if (v14 and last365) else 0
    # 月份輪廓：用日曆天數正規化（季節性作物沒貨的日子也要算進去）
    span_days = collections.Counter()
    d = dates[0]
    while d <= TODAY:
        span_days[d.month] += 1; d += dt.timedelta(days=1)
    mv, mp = collections.defaultdict(float), collections.defaultdict(list)
    for d in dates:
        mv[d.month] += s[d][1]; mp[d.month].append(s[d])
    all_rate = sum(mv.values()) / sum(span_days.values())
    all_p = wavg([s[d] for d in dates])
    months = [[round(mv[m] / span_days[m] / all_rate, 2) if span_days[m] else 0,
               round(wavg(mp[m]) / all_p, 2) if mp[m] else 0] for m in range(1, 13)]
    series, ly = [], []
    for i in range(59, -1, -1):
        d = TODAY - dt.timedelta(days=i)
        series.append(r2(sm.get(d)))
        ly.append(r2(sm.get(years_ago(d, 1))))
    cat, imp, _ = meta[name]
    top_official = sorted(official[name], key=lambda o: -comp_vol[(name, o)])[:3]
    out.append({
        "n": name, "c": cat, "imp": imp, "o": "・".join(top_official),
        "cur": r2(cur), "base": r2(base), "r": round(cur / base, 3) if (cur and base) else None,
        "pct": round(sum(p < cur for p in p365) / len(p365), 3) if (cur and enough) else None,
        "lo": r2(p365[0]) if enough else None, "hi": r2(p365[-1]) if enough else None,
        "m30": r2(sm.get(TODAY - dt.timedelta(days=30))), "w14": None if off else r2(w14), "sup": round(sup, 2), "vol": round(avg_vol),
        "last": last.isoformat(), "lastp": r2(sm[last]), "mo": months, "s": series, "ly": ly,
    })

# 國產 <-> 進口互相連結，方便「國產非產季時看進口貨」
kept = {x["n"] for x in out}
imp_of = {meta[x["n"]][2]: x["n"] for x in out if x["imp"]}
for x in out:
    tw = meta[x["n"]][2] if x["imp"] else imp_of.get(x["n"])
    x["tw"] = tw if tw in kept and tw != x["n"] else None
# 攤販零售價參考：臺北市公有零售市場月均零售價 vs 同月批發價，每個品項各自配一條「零售 ≈ a + b × 批發」
if os.path.exists(RETAIL):
    import markup
    retail = json.load(open(RETAIL, encoding="utf-8"))
    pairs = markup.pairs_by_item(raw, retail)
    models, cat_ratio = {}, collections.defaultdict(list)
    for disp, ps in pairs.items():
        if len(ps) < 4: continue
        m = markup.model(ps)
        ws = [w for _, _, w in ps]
        m.update(wlo=round(min(ws), 1), whi=round(max(ws), 1))
        models[disp] = m
        if disp in meta: cat_ratio[meta[disp][0]] += [r / w for _, r, w in ps]
    ly_month = f"{TODAY.year - 1}-{TODAY.month:02d}"
    for x in out:
        if x["n"] in models:
            x["rm"] = dict(models[x["n"]], src="item")
        elif x["imp"] and x["tw"] in models:          # 進口貨借用國產同品項的零售關係
            x["rm"] = dict(models[x["tw"]], src="twin")
        elif cat_ratio.get(x["c"]):                    # 沒有零售資料：用同類的中位數倍數，範圍放寬
            x["rm"] = {"a": 0, "b": round(st.median(cat_ratio[x["c"]]), 3), "err": 0.25, "n": 0, "src": "cat"}
        vals = [r for ym, r, _ in pairs.get(x["n"], []) if ym == ly_month]
        x["rly"] = round(st.mean(vals)) if vals else None
    months = sorted(retail)
    retail_meta = {"from": months[0], "to": months[-1], "items": len(models), "ly": ly_month}
else:
    retail_meta = None
    print("找不到", RETAIL, "：略過零售價參考")
out.sort(key=lambda x: -x["vol"])
first = min(parse(d) for v in raw.values() for d in v)
(ROOT / "site").mkdir(exist_ok=True)
json.dump({"asof": TODAY.isoformat(), "from": first.isoformat(), "retail": retail_meta, "items": out},
          open(ROOT / "site" / "data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
n_off = sum(1 for x in out if x["cur"] is None)
print(f"{len(out)} 項（進口 {sum(x['imp'] for x in out)}、非產季 {n_off}、無同期可比 {sum(1 for x in out if x['cur'] and x['base'] is None)}）")
print("近兩年幾乎沒交易、不收：", "、".join(dropped))
if retail_meta:
    src = collections.Counter(x.get("rm", {}).get("src", "無") for x in out)
    print(f"零售參考：自有資料 {src['item']}、借用國產 {src['twin']}、同類估計 {src['cat']}、無 {src['無']}")
