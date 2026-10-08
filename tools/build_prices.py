"""本機「今日菜價」頁面（prototype-3d/prices.html）要讀的逐品種快照.

用法：python tools/build_prices.py [YYYY-MM-DD]
    讀 data/raw/*.json（fetch.py 的月檔），寫出 prototype-3d/prices-data.json；不抓資料、不補價。

和公開網站刻意不同的地方：每個品種各自一列，顯示最後交易日的當日價（不平滑）。
名稱、分類、哪些不收、往年同期怎麼算，都跟公開網站共用 catalog.py；
「攤販賣多少」的零售估計直接用公開網站的計算（build.py），以常用名為鍵放在 retail。
"""
import datetime as dt
import json
import math
import pathlib
import re
import sys

import build as site_build  # 公開網站的計算（build.py）
from catalog import SEARCH_ALIASES, classify, parse, same_period_baseline

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "prototype-3d" / "prices-data.json"
ROC_DATE = re.compile(r"\d{3}\.\d{2}\.\d{2}")
INACTIVE_DAYS = 730  # 兩年沒交易就不列
RECENT_DAYS, SERIES_DAYS = 7, 30


def load_raw():
    raw = {}
    for f in sorted((ROOT / "data" / "raw").glob("*.json")):
        if re.fullmatch(r"\d{4}-\d{2}", f.stem):
            for key, days in json.loads(f.read_text(encoding="utf-8")).items():
                raw.setdefault(key, {}).update(days)
    return raw


def positive(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and x > 0


def observations(days, end):
    """{民國日期: [價, 量]} -> 依日期排序的 (日期, 價, 量)；壞日期、零價零量、晚於分析日的都丟掉."""
    rows = []
    for roc, pair in days.items():
        if not (ROC_DATE.fullmatch(roc) and isinstance(pair, list) and len(pair) >= 2
                and positive(pair[0]) and positive(pair[1])):
            continue
        try:
            d = parse(roc)
        except ValueError:  # 例如 2 月 30 日
            continue
        if d <= end:
            rows.append((d, pair[0], pair[1]))
    return sorted(rows)


def build(raw, today):
    end = dt.date.fromisoformat(today)
    items = []
    for key, days in raw.items():
        kind, _, official = key.split("|", 2)
        c = classify(key) if kind in ("N04", "N05") else None
        rows = observations(days, end) if c else []
        if not rows:
            continue
        name, category, imported, _, domestic = c
        anchor, price, volume = rows[-1]
        if (end - anchor).days > INACTIVE_DAYS:
            continue
        prior = [r for r in rows if anchor - dt.timedelta(days=RECENT_DAYS) <= r[0] < anchor]
        baseline, count, years = same_period_baseline({d: p for d, p, _ in rows}, anchor)
        aliases = [domestic] if imported else []
        aliases += [SEARCH_ALIASES[official.split("-")[0]]] if official.split("-")[0] in SEARCH_ALIASES else []
        items.append({
            "id": key, "official": official, "name": name, "aliases": " ".join(aliases), "category": category,
            "date": anchor.isoformat(), "price": price, "volume": volume,
            "baseline": baseline, "historyCount": count, "historyYears": years,
            "recent": sum(p * v for _, p, v in prior) / sum(v for _, _, v in prior) if prior else None,
            "recentCount": len(prior),
            "series": [{"date": d.isoformat(), "price": p} for d, p, _ in rows
                       if d >= anchor - dt.timedelta(days=SERIES_DAYS - 1)],
        })
    items.sort(key=lambda x: x["volume"], reverse=True)
    items.sort(key=lambda x: x["date"], reverse=True)
    return {"schema": 1, "asOf": today, "latest": items[0]["date"] if items else None,
            "scope": "全臺有回報之果菜批發市場，依交易量加權", "source": "農業部農產品交易行情（本機匯入資料）",
            "items": items}


def retail_map(items):
    """公開網站的品項 -> 首頁「攤販賣多少」要的零售估計（元/台斤），以常用名為鍵；估不出來的不列."""
    out = {}
    for x in items:
        e = site_build.retail_estimate(x)
        if e:
            rm = x["rm"]
            out[x["n"]] = dict({k: round(v, 2) for k, v in e.items()}, src=rm["src"], err=rm["err"], months=rm["n"],
                               twin=x.get("tw") if rm["src"] == "twin" else None)
    return out


def main():
    today = sys.argv[1] if len(sys.argv) > 1 else dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
    data = build(load_raw(), today)
    retail = json.loads(site_build.RETAIL.read_text(encoding="utf-8")) if site_build.RETAIL.exists() else None
    if retail is not None:
        day = dt.date.fromisoformat(today)
        public = site_build.summarize(site_build.load_raw(day), day, retail)
        data["retail"], data["retailSource"] = retail_map(public["items"]), public["retail"]
    data["generatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(data['items'])} 個品種；最新交易日 {data['latest']}，分析日 {today}；零售估計 {len(data.get('retail', {}))} 種")


if __name__ == "__main__":
    main()
