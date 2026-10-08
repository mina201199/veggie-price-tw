"""攤販零售價估計（build.py 的 retail_estimate，公開網站與本機首頁共用）與本機快照的零售區塊.

執行：python -m unittest discover -s tools
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build  # noqa: E402  匯入時不能跑整支建置、也不能寫檔
import build_prices  # noqa: E402


class RetailEstimateTests(unittest.TestCase):
    """零售 ≈ a + b × 批發（元/台斤），批發用近 14 天均價；區間寬度是驗證誤差的 1.5 倍，夾在 12%～35%."""

    def test_ratio_model_on_14_day_wholesale(self):
        e = build.retail_estimate({"rm": {"a": 0, "b": 2, "err": .1}, "w14": 30, "cur": 25})
        self.assertAlmostEqual(e["est"], 36)  # 30 元/公斤 = 18 元/台斤，× 2
        self.assertAlmostEqual(e["lo"], 36 * .85)
        self.assertAlmostEqual(e["hi"], 36 * 1.15)

    def test_falls_back_to_current_price(self):
        self.assertAlmostEqual(build.retail_estimate({"rm": {"a": 0, "b": 2, "err": .1}, "w14": None, "cur": 30})["est"], 36)

    def test_linear_model_keeps_the_edge_ratio_outside_seen_wholesale(self):
        e = build.retail_estimate({"rm": {"a": 10, "b": 1.5, "err": .3, "wlo": 20, "whi": 40}, "w14": 100, "cur": None})
        self.assertAlmostEqual(e["est"], 60 * (10 + 1.5 * 40) / 40)  # 60 元/台斤，超出 40 就用 40 那點的倍數
        self.assertAlmostEqual(e["lo"], e["est"] * .65)  # .3 × 1.5 超過上限，夾在 35%

    def test_band_has_a_floor(self):
        e = build.retail_estimate({"rm": {"a": 0, "b": 2, "err": .02}, "w14": 30, "cur": None})
        self.assertAlmostEqual(e["hi"], 36 * 1.12)

    def test_no_estimate_without_model_or_price(self):
        self.assertIsNone(build.retail_estimate({"w14": 30, "cur": 30}))
        self.assertIsNone(build.retail_estimate({"rm": {"a": 0, "b": 2, "err": .1}, "w14": None, "cur": None}))


class SummarizeTests(unittest.TestCase):
    def test_public_summary_is_a_function(self):
        raw = {"N04|LA1|甘藍-初秋": {f"115.09.{d:02d}": [30, 1000] for d in range(1, 31)}}
        data = build.summarize(raw, build.dt.date(2026, 10, 1), None)
        self.assertEqual([x["n"] for x in data["items"]], ["高麗菜"])
        self.assertIsNone(data["retail"])


class SnapshotRetailTests(unittest.TestCase):
    def test_retail_map_keeps_what_the_stall_check_needs(self):
        items = [
            {"n": "高麗菜", "rm": {"a": 0, "b": 2, "err": .1, "n": 18, "src": "item"}, "w14": 30, "cur": 28, "tw": None},
            {"n": "冬瓜", "w14": 10, "cur": 10, "tw": None},
            {"n": "南瓜", "rm": {"a": 0, "b": 2, "err": .25, "n": 0, "src": "cat"}, "w14": None, "cur": None, "tw": None},
        ]
        self.assertEqual(build_prices.retail_map(items), {
            "高麗菜": {"est": 36.0, "lo": 30.6, "hi": 41.4, "src": "item", "err": .1, "months": 18, "twin": None}})


if __name__ == "__main__":
    unittest.main()
