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

CAT_BY_PREFIX = {"L": "葉菜", "F": "瓜果豆", "S": "根莖", "M": "菇類"}
SKIP_BASE = {"其他", "其他菇類", "其他花類", "休市"}

# 官方品名（去掉品種）-> (常用名, 分類)；沒列到的直接用官方品名、分類看作物代號
NAMES = {
    # 葉菜
    "甘藍": ("高麗菜", "葉菜"), "包心白": ("大白菜", "葉菜"), "包心白菜": ("大白菜", "葉菜"),
    "小白菜": ("小白菜", "葉菜"), "青江白菜": ("青江菜", "葉菜"), "蕹菜": ("空心菜", "葉菜"),
    "甘薯葉": ("地瓜葉", "葉菜"), "芥藍菜": ("芥藍", "葉菜"), "莧菜": ("莧菜", "葉菜"), "油菜": ("油菜", "葉菜"),
    "菠菜": ("菠菜", "葉菜"), "芹菜": ("芹菜", "葉菜"), "芥菜": ("芥菜", "葉菜"), "皇宮菜": ("皇宮菜", "葉菜"),
    "紅鳳菜": ("紅鳳菜", "葉菜"), "茼蒿": ("茼蒿", "葉菜"), "韭菜": ("韭菜", "葉菜"), "蕨菜": ("過貓・蕨菜", "葉菜"),
    "藤川七": ("川七", "葉菜"), "菾菜": ("甜菜・菾菜", "葉菜"), "西洋菜": ("西洋菜", "葉菜"),
    "黑甜仔菜": ("黑甜仔菜", "葉菜"), "塌棵菜": ("塌棵菜", "葉菜"), "萵苣菜": ("萵苣", "葉菜"), "海菜": ("海菜", "葉菜"),
    # 辛香
    "九層塔": ("九層塔", "辛香"), "芫荽": ("香菜", "辛香"), "辣椒": ("辣椒", "辛香"), "青蔥": ("青蔥", "辛香"),
    "大蒜": ("大蒜", "辛香"), "薑": ("薑", "辛香"), "茴香": ("茴香", "辛香"), "香茅": ("香茅", "辛香"),
    "巴西利": ("巴西利", "辛香"), "羅勒": ("羅勒", "辛香"), "蕎頭": ("蕗蕎・蕎頭", "辛香"),
    # 花果・瓜・豆
    "花椰菜": ("花椰菜", "瓜果豆"), "青花苔": ("青花菜・綠花椰", "瓜果豆"), "胡瓜": ("大黃瓜", "瓜果豆"),
    "花胡瓜": ("小黃瓜", "瓜果豆"), "冬瓜": ("冬瓜", "瓜果豆"), "絲瓜": ("絲瓜", "瓜果豆"),
    "苦瓜": ("苦瓜", "瓜果豆"), "扁蒲": ("蒲瓜・瓠瓜", "瓜果豆"), "茄子": ("茄子", "瓜果豆"),
    "番茄": ("番茄", "瓜果豆"), "甜椒": ("甜椒・青椒", "瓜果豆"), "菜豆": ("菜豆・長豆", "瓜果豆"),
    "敏豆": ("四季豆", "瓜果豆"), "豌豆": ("荷蘭豆", "瓜果豆"), "毛豆": ("毛豆", "瓜果豆"),
    "南瓜": ("南瓜", "瓜果豆"), "玉米": ("玉米", "瓜果豆"), "隼人瓜": ("佛手瓜", "瓜果豆"),
    "黃秋葵": ("秋葵", "瓜果豆"), "萊豆": ("皇帝豆・萊豆", "瓜果豆"), "落花生": ("花生", "瓜果豆"),
    "越瓜": ("越瓜", "瓜果豆"), "金針花": ("金針花", "瓜果豆"), "虎豆": ("虎豆", "瓜果豆"),
    "花豆": ("花豆", "瓜果豆"), "鵲豆": ("鵲豆", "瓜果豆"), "蠶豆": ("蠶豆", "瓜果豆"),
    # 根莖
    "蘿蔔": ("白蘿蔔", "根莖"), "胡蘿蔔": ("紅蘿蔔", "根莖"), "馬鈴薯": ("馬鈴薯", "根莖"),
    "洋蔥": ("洋蔥", "根莖"), "竹筍": ("竹筍", "根莖"), "芋": ("芋頭", "根莖"), "甘薯": ("地瓜", "根莖"),
    "茭白筍": ("茭白筍", "根莖"), "蘆筍": ("蘆筍", "根莖"), "蓮藕": ("蓮藕", "根莖"), "牛蒡": ("牛蒡", "根莖"),
    "薯蕷": ("山藥", "根莖"), "芽菜類": ("豆芽菜", "根莖"), "菱角": ("菱角", "根莖"),
    "球莖甘藍": ("大頭菜", "根莖"), "豆薯": ("豆薯", "根莖"), "大心菜": ("大心菜", "根莖"),
    "萵苣莖": ("A菜心・萵苣莖", "根莖"), "荸薺": ("荸薺・馬蹄", "根莖"), "晚香玉筍": ("晚香玉筍", "根莖"),
    "半天筍": ("半天筍", "根莖"), "甘蔗筍": ("甘蔗筍", "根莖"), "金針筍": ("金針筍", "根莖"),
    "菊芋": ("菊芋", "根莖"), "百合": ("百合", "根莖"),
    # 菇
    "洋菇": ("洋菇", "菇類"), "濕香菇": ("香菇", "菇類"), "金絲菇": ("金針菇", "菇類"),
    "杏鮑菇": ("杏鮑菇", "菇類"), "鴻喜菇": ("鴻喜菇", "菇類"), "秀珍菇": ("秀珍菇", "菇類"),
    "濕木耳": ("木耳", "菇類"), "蠔菇": ("蠔菇", "菇類"), "珊瑚菇": ("珊瑚菇", "菇類"), "草菇": ("草菇", "菇類"),
    "柳松菇": ("柳松菇", "菇類"), "巴西蘑菇": ("巴西蘑菇", "菇類"), "猴頭菇": ("猴頭菇", "菇類"),
    # 水果
    "香蕉": ("香蕉", "水果"), "鳳梨": ("鳳梨", "水果"), "番石榴": ("芭樂", "水果"), "西瓜": ("西瓜", "水果"),
    "木瓜": ("木瓜", "水果"), "蓮霧": ("蓮霧", "水果"), "芒果": ("芒果", "水果"), "葡萄": ("葡萄", "水果"),
    "甜橙": ("柳丁", "水果"), "椪柑": ("椪柑", "水果"), "桶柑": ("桶柑", "水果"), "柚子": ("柚子・文旦", "水果"),
    "梨": ("梨", "水果"), "蘋果": ("蘋果", "水果"), "釋迦": ("釋迦", "水果"), "紅龍果": ("火龍果", "水果"),
    "百香果": ("百香果", "水果"), "奇異果": ("奇異果", "水果"), "草莓": ("草莓", "水果"), "柿子": ("柿子", "水果"),
    "楊桃": ("楊桃", "水果"), "龍眼": ("龍眼", "水果"), "荔枝": ("荔枝", "水果"), "酪梨": ("酪梨", "水果"),
    "小番茄": ("小番茄", "水果"), "棗子": ("棗子", "水果"), "李": ("李子", "水果"), "桃子": ("水蜜桃", "水果"),
    "洋香瓜": ("洋香瓜・哈密瓜", "水果"), "甜瓜": ("香瓜", "水果"), "椰子": ("椰子", "水果"),
    "茂谷柑": ("茂谷柑", "水果"), "雜柑": ("雜柑", "水果"), "黃金果": ("黃金果", "水果"), "甘蔗": ("甘蔗", "水果"),
    "佛利蒙柑": ("佛利蒙柑", "水果"), "梅": ("梅子", "水果"), "珍珠柑": ("珍珠柑", "水果"), "枇杷": ("枇杷", "水果"),
    "葡萄柚": ("葡萄柚", "水果"), "蛋黃果": ("蛋黃果", "水果"), "海梨柑": ("海梨柑", "水果"), "榴槤蜜": ("榴槤蜜", "水果"),
    "柑橘": ("柑橘", "水果"), "虎頭柑": ("虎頭柑", "水果"), "波蘿蜜": ("菠蘿蜜", "水果"), "栗子": ("栗子", "水果"),
    "紅毛丹": ("紅毛丹", "水果"), "紅柑": ("紅柑", "水果"), "橄欖": ("橄欖", "水果"), "香瓜梨": ("香瓜梨", "水果"),
    "樹葡萄": ("樹葡萄", "水果"), "豔陽柑": ("豔陽柑", "水果"), "桑椹": ("桑椹", "水果"), "楊梅": ("楊梅", "水果"),
    "溫州柑": ("溫州柑", "水果"), "山竹": ("山竹", "水果"), "藍莓": ("藍莓", "水果"), "榴槤": ("榴槤", "水果"),
    "香櫞": ("香櫞", "水果"),
}
# 同一個官方品名底下，買菜的人會當成不同的菜：依品種拆開（依序比對，第一個符合的算）
SPLIT = {
    "萵苣菜": [("油麥", "A菜・油麥菜"), ("本島圓葉", "大陸妹"), ("蘿美", "蘿蔓"), ("水耕", "水耕萵苣"),
              ("結球", "美生菜"), ("", "其他萵苣")],
    "雜柑": [("檸檬", "檸檬"), ("桔子", "桔子"), ("", "其他雜柑")],
    "海菜": [("水蓮", "水蓮"), ("海帶", "海帶"), ("", "海菜")],
    "玉米": [("玉米筍", "玉米筍"), ("", "玉米")],
}
IMPORT_NAME = {"柳丁": "柳橙"}  # 進口版改用比較自然的叫法


def classify(key):
    """(種類|代號|品名) -> (常用名, 分類, 是否進口, 是否依品種拆分, 對應的國產名) 或 None（不收）."""
    t, code, full = key.split("|", 2)
    base, _, variety = full.partition("-")
    if base in SKIP_BASE or (t == "N04" and code.startswith("O")):  # O 開頭是醃漬加工品
        return None
    name, cat = NAMES.get(base, (base, CAT_BY_PREFIX.get(code[:1], "其他") if t == "N04" else "水果"))
    split = False
    for needle, sub in SPLIT.get(base, []):
        if needle in variety:
            name, split = sub, True
            break
    imp, dom = "進口" in full, name
    if imp:
        name = IMPORT_NAME.get(name, name.split("・")[0]) + "（進口）"
    return name, cat, imp, split, dom


def years_ago(d, n):
    """往回 n 年的同一天；2/29 在平年改成 2/28（每天自動跑，閏年那天不能當掉）."""
    try:
        return d.replace(year=d.year - n)
    except ValueError:
        return d.replace(year=d.year - n, day=28)


def parse(roc):
    y, m, d = roc.split("."); return dt.date(int(y) + 1911, int(m), int(d))


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
    # 往年同期：前五年 ±15 天的價格中位數（避免單一颱風年失真）
    same = []
    for yrs in range(1, 6):
        c = years_ago(TODAY, yrs)
        same += [v for d, v in sm.items() if abs((d - c).days) <= 15]
    base = st.median(same) if len(same) >= 20 else None
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
