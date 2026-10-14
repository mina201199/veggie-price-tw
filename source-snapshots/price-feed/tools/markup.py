"""用臺北市公有零售市場的月均零售價，對上農業部同月批發價，算出每種菜「零售約是批發的幾倍」.

build.py 會 import 這個檔；單獨執行則印出每個品項的倍數與驗證誤差：
    python markup.py raw_v.json retail_taipei.json
"""
import collections, statistics as st

JIN = 0.6  # 1 台斤 = 0.6 公斤

# 臺北市零售品項 -> (demo 裡的常用名, 批發官方品名, 批發品種關鍵字 None=全部, 是否含進口批發)
# 零售品項沒註明內銷/進口時，市場上兩種都有賣，批發也一起算
RETAIL_MAP = {
    "蘿蔔": ("白蘿蔔", ["蘿蔔"], None, True), "胡蘿蔔": ("紅蘿蔔", ["胡蘿蔔"], None, True),
    "牛蒡": ("牛蒡", ["牛蒡"], None, True), "生薑(嫩薑)": ("薑", ["薑"], ["嫩薑"], False),
    "芋頭": ("芋頭", ["芋"], None, True), "綠竹筍": ("竹筍", ["竹筍"], ["綠竹筍", "烏殼綠"], False),
    "麻竹筍": ("竹筍", ["竹筍"], ["麻竹筍"], False), "綠蘆筍": ("蘆筍", ["蘆筍"], ["綠蘆筍"], True),
    "茭白筍(帶殼)": ("茭白筍", ["茭白筍"], ["帶殼"], False), "大芥菜": ("芥菜", ["芥菜"], ["大芥菜"], False),
    "馬鈴薯": ("馬鈴薯", ["馬鈴薯"], None, True), "青蔥": ("青蔥", ["青蔥"], None, True),
    "洋蔥(內銷)": ("洋蔥", ["洋蔥"], None, False), "蒜頭": ("大蒜", ["大蒜"], ["蒜頭"], False),
    "韭菜": ("韭菜", ["韭菜"], None, True), "蕹菜(空心菜)": ("空心菜", ["蕹菜"], None, True),
    "芹菜(土芹菜)": ("芹菜", ["芹菜"], ["白梗", "青梗"], False), "甘藍": ("高麗菜", ["甘藍"], None, True),
    "小白菜": ("小白菜", ["小白菜"], None, True), "青江白菜": ("青江菜", ["青江白菜"], None, True),
    "結球白菜": ("大白菜", ["包心白", "包心白菜"], None, True), "菠菜": ("菠菜", ["菠菜"], None, True),
    "芥藍": ("芥藍", ["芥藍菜"], None, True), "莧菜": ("莧菜", ["莧菜"], None, True),
    "萵苣(油麥菜)": ("A菜・油麥菜", ["萵苣菜"], ["油麥"], False),
    "本島萵苣": ("大陸妹", ["萵苣菜"], ["本島圓葉", "本島尖葉"], False), "茼萵": ("茼蒿", ["茼蒿"], None, True),
    "花椰菜": ("花椰菜", ["花椰菜"], None, True), "青花苔": ("青花菜・綠花椰", ["青花苔"], None, True),
    "胡瓜": ("大黃瓜", ["胡瓜"], None, True), "花胡瓜": ("小黃瓜", ["花胡瓜"], None, True),
    "冬瓜": ("冬瓜", ["冬瓜"], None, True), "苦瓜": ("苦瓜", ["苦瓜"], None, True),
    "絲瓜": ("絲瓜", ["絲瓜"], None, True), "扁蒲": ("蒲瓜・瓠瓜", ["扁蒲"], None, True),
    "茄子": ("茄子", ["茄子"], None, True), "番茄": ("番茄", ["番茄"], None, True),
    "甜椒(青椒)": ("甜椒・青椒", ["甜椒"], ["青椒"], False), "敏豆(四季豆)": ("四季豆", ["敏豆"], None, True),
    "豇豆": ("菜豆・長豆", ["菜豆"], None, True), "豌豆": ("荷蘭豆", ["豌豆"], ["白花", "紅花"], True),
    "甜豌豆": ("荷蘭豆", ["豌豆"], ["甜豌豆"], True), "甜玉米": ("玉米", ["玉米"], ["甜"], False),
    "香菇(太空包)鮮": ("香菇", ["濕香菇"], None, True), "木耳(黑色溼)": ("木耳", ["濕木耳"], None, True),
    "西瓜(大粒)": ("西瓜", ["西瓜"], ["大西瓜", "紅肉"], False),
    "西瓜(小粒)": ("西瓜", ["西瓜"], ["黃肉", "甜美人", "秀鈴", "黑美人", "鳳光"], False),
    "洋香瓜(秋蜜)": ("洋香瓜・哈密瓜", ["洋香瓜"], None, False), "香瓜(美濃瓜)": ("香瓜", ["甜瓜"], ["美濃"], False),
    "芒果(愛文)": ("芒果", ["芒果"], ["愛文"], False), "芒果(金煌)": ("芒果", ["芒果"], ["金煌"], False),
    "芒果(在來)": ("芒果", ["芒果"], ["本島"], False), "番石榴(世紀)": ("芭樂", ["番石榴"], ["世紀"], False),
    "番石榴(珍珠)": ("芭樂", ["番石榴"], ["珍珠"], False), "蓮霧": ("蓮霧", ["蓮霧"], None, False),
    "荔枝(玉荷)": ("荔枝", ["荔枝"], ["玉荷"], False), "荔枝(黑葉)": ("荔枝", ["荔枝"], ["黑葉"], False),
    "龍眼(大粒)": ("龍眼", ["龍眼"], ["粉殼"], False), "棗子": ("棗子", ["棗子"], None, False),
    "番荔枝(釋迦)": ("釋迦", ["釋迦"], None, False), "楊桃": ("楊桃", ["楊桃"], None, False),
    "木瓜": ("木瓜", ["木瓜"], None, False), "香蕉(內銷)": ("香蕉", ["香蕉"], None, False),
    "鳳梨(開英)": ("鳳梨", ["鳳梨"], ["開英"], False), "鳳梨(17號)": ("鳳梨", ["鳳梨"], ["金鑽"], False),
    "椪柑": ("椪柑", ["椪柑"], None, False), "桶柑": ("桶柑", ["桶柑"], None, False),
    "海梨柑": ("海梨柑", ["海梨柑"], None, False), "茂谷柑": ("茂谷柑", ["茂谷柑"], None, False),
    "檸檬": ("檸檬", ["雜柑"], ["檸檬"], False), "文旦": ("柚子・文旦", ["柚子"], ["文旦"], False),
    "白柚": ("柚子・文旦", ["柚子"], ["白柚"], False), "柳橙": ("柳丁", ["甜橙"], None, True),
    "李(紅肉)": ("李子", ["李"], ["紅肉"], False), "水蜜桃": ("水蜜桃", ["桃子"], ["水蜜桃"], False),
    "鶯歌桃": ("水蜜桃", ["桃子"], ["鶯歌桃"], False), "甜柿": ("柿子", ["柿子"], ["甜柿"], False),
    "紅柿(軟柿)": ("柿子", ["柿子"], ["紅柿"], False), "新世紀梨": ("梨", ["梨"], ["世紀"], False),
    "新興梨": ("梨", ["梨"], ["新興"], False), "巨峰葡萄": ("葡萄", ["葡萄"], ["巨峰"], False),
    "火龍果": ("火龍果", ["紅龍果"], None, False), "小番茄(玉女)": ("小番茄", ["小番茄"], ["玉女"], False),
    "小番茄(聖女)": ("小番茄", ["小番茄"], ["聖女"], False),
}


def monthly_wholesale(raw, bases, varieties, imports_ok):
    """符合條件的批發交易，依月加權平均（元/公斤）."""
    acc = collections.defaultdict(lambda: [0.0, 0.0])
    for key, days in raw.items():
        full = key.split("|", 2)[2]
        base, _, var = full.partition("-")
        if base not in bases or (not imports_ok and "進口" in full):
            continue
        if varieties and not any(v in var for v in varieties):
            continue
        for d, (p, v) in days.items():
            y, m, _ = d.split(".")
            a = acc[f"{int(y) + 1911}-{m}"]; a[0] += p * v; a[1] += v
    return {ym: pv / v for ym, (pv, v) in acc.items() if v > 0}


def pairs_by_item(raw, retail):
    """常用名 -> [(月份, 零售元/台斤, 批發元/台斤)]."""
    out = collections.defaultdict(list)
    for rname, (disp, bases, vars_, imp) in RETAIL_MAP.items():
        wh = monthly_wholesale(raw, bases, vars_, imp)
        for ym, prices in retail.items():
            if rname in prices and ym in wh:
                out[disp].append((ym, prices[rname], wh[ym] * JIN))
    return out


def fit(pairs):
    """零售 ≈ a + b × 批發（最小平方）。攤商有固定成本，批發很便宜時倍數會變大，線性比單一倍數準."""
    xs, ys = [w for _, _, w in pairs], [r for _, r, _ in pairs]
    mx, my = st.mean(xs), st.mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx if sxx else 0
    return my - b * mx, b


def _ratio(rest, w):
    return w * st.median(r / ww for _, r, ww in rest)


def _linear(rest, w):
    a, b = fit(rest)
    return a + b * w if b > 0 else None


def _loo(pairs, predict):
    """留一驗證：每次拿掉一個月，用其他月份預測它，回傳相對誤差清單（預測失敗回 None）."""
    errs = []
    for i, (_, r, w) in enumerate(pairs):
        pred = predict(pairs[:i] + pairs[i + 1:], w)
        if pred is None:
            return None
        errs.append(abs(pred - r) / r)
    return errs


def model(pairs):
    """單一倍數 vs 線性，留一驗證誤差小的勝出。回傳 {a, b, err, n}：零售 ≈ a + b × 批發（元/台斤）；
    err 是驗證誤差的中位數，前端拿來決定「合理範圍」的寬度."""
    er = _loo(pairs, _ratio)
    el = _loo(pairs, _linear) if len(pairs) >= 8 else None
    if el is not None and st.median(el) < st.median(er):
        a, b = fit(pairs)
        errs = el
    else:
        a, b = 0.0, st.median(r / w for _, r, w in pairs)
        errs = er
    return {"a": round(a, 2), "b": round(b, 3), "err": round(st.median(errs), 3), "n": len(pairs)}


if __name__ == "__main__":
    import json, sys
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    retail = json.load(open(sys.argv[2], encoding="utf-8"))
    for disp, ps in sorted(pairs_by_item(raw, retail).items(), key=lambda kv: -len(kv[1])):
        if len(ps) < 4:
            print(f"{disp:<10} 資料太少 {len(ps)}"); continue
        m = model(ps)
        ratios = sorted(r / w for _, r, w in ps)
        print(f"{disp:<10} n={m['n']:>2} 零售≈{m['a']:>6.1f}+{m['b']:.2f}×批發  驗證誤差{m['err']:>5.0%}  "
              f"單純倍數 {st.median(ratios):.2f}（{ratios[0]:.1f}–{ratios[-1]:.1f}）")
