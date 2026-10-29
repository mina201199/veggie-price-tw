"""本機「今日菜價」快照（build_prices.py）與共用名稱表、往年同期規則（catalog.py）的測試.

執行：python -m unittest discover -s tools
"""
import datetime as dt
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_prices  # noqa: E402
import catalog  # noqa: E402


def days(years, month, day_range, price=20, volume=100):
    return {f"{y}.{month:02d}.{d:02d}": [price, volume] for y in years for d in day_range}


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.data = build_prices.build({
            "N04|LA1|甘藍-初秋": {**days([113, 114], 10, range(1, 13)),
                               "115.10.01": [10, 100], "115.10.06": [30, 300], "115.10.08": [999, 10]},
            "N04|LA2|甘藍-改良種": {"115.10.06": [12, 100]},
            "N04|XX|壞資料": {"115.10.06": [0, 0]},
        }, "2026-10-07")
        self.item = next(x for x in self.data["items"] if x["id"] == "N04|LA1|甘藍-初秋")

    def test_latest_is_last_trade_day_on_or_before_analysis_date(self):
        self.assertEqual(self.data["latest"], "2026-10-06")
        self.assertEqual(len(self.data["items"]), 2)

    def test_price_is_the_latest_daily_price_not_a_smoothed_one(self):
        self.assertEqual(self.item["price"], 30)
        self.assertEqual(self.item["volume"], 300)

    def test_baseline_is_median_of_same_period_in_previous_years(self):
        self.assertEqual(self.item["baseline"], 20)
        self.assertEqual(self.item["historyCount"], 24)
        self.assertEqual(self.item["historyYears"], 2)

    def test_recent_average_excludes_the_latest_day(self):
        self.assertEqual(self.item["recent"], 10)
        self.assertEqual(self.item["recentCount"], 1)

    def test_series_only_has_observed_days_of_last_30(self):
        self.assertEqual(self.item["series"], [{"date": "2026-10-01", "price": 10},
                                               {"date": "2026-10-06", "price": 30}])

    def test_empty_and_invalid_dates(self):
        self.assertIsNone(build_prices.build({}, "2026-10-07")["latest"])
        self.assertEqual(build_prices.build({"N04|LA1|甘藍-初秋": {"115.02.30": [10, 100]}}, "2026-10-07")["items"], [])

    def test_items_not_traded_for_two_years_are_left_out(self):
        self.assertEqual(build_prices.build({"N04|LA1|甘藍-初秋": {"112.10.01": [10, 100]}}, "2026-10-07")["items"], [])

    def test_january_windows_include_previous_december(self):
        raw = {"115.01.05": [30, 100]}
        for year in (113, 114):
            raw.update(days([year], 1, range(1, 11), price=10))
            raw.update(days([year - 1], 12, range(21, 32), price=100))
        item = build_prices.build({"N04|LA1|甘藍-初秋": raw}, "2026-01-05")["items"][0]
        self.assertEqual((item["historyCount"], item["baseline"], item["historyYears"]), (42, 100, 2))


class SharedCatalogTests(unittest.TestCase):
    """本機頁面和公開網站用同一份名稱、分類與收錄規則."""

    def build_one(self, key):
        items = build_prices.build({key: {"115.10.06": [30, 100]}}, "2026-10-07")["items"]
        return items[0] if items else None

    def test_names_and_categories_match_public_site(self):
        cabbage = self.build_one("N04|LA1|甘藍-初秋")
        self.assertEqual((cabbage["name"], cabbage["category"]), ("高麗菜", "葉菜"))
        self.assertEqual(self.build_one("N04|FB2|青花苔-青花苔")["name"], "青花菜・綠花椰")
        self.assertEqual(self.build_one("N04|SG1|芫荽-芫荽")["category"], "辛香")
        self.assertEqual(self.build_one("N04|LO1|萵苣菜-本島圓葉")["name"], "大陸妹")

    def test_imports_are_named_like_public_site_and_found_by_domestic_name(self):
        item = self.build_one("N05|A1|甜橙-進口")
        self.assertEqual(item["name"], "柳橙（進口）")
        self.assertIn("柳丁", item["aliases"])

    def test_old_search_synonyms_still_work(self):
        self.assertIn("蕃茄", self.build_one("N04|FJ3|番茄-黑柿")["aliases"])
        self.assertIn("綠花椰菜", self.build_one("N04|FB2|青花苔-青花苔")["aliases"])

    def test_skips_what_public_site_skips(self):
        self.assertIsNone(self.build_one("N04|OA1|醃瓜-醃漬"))
        self.assertIsNone(self.build_one("N04|LZ1|其他-其他"))
        self.assertIsNone(self.build_one("N04|FZ1|其他花類-其他"))


class SamePeriodBaselineTests(unittest.TestCase):
    anchor = dt.date(2026, 10, 7)

    def test_median_over_previous_years_within_15_days(self):
        prices = {dt.date(y, 10, d): p for y, p in ((2025, 10), (2024, 30)) for d in range(1, 13)}
        prices[dt.date(2025, 11, 30)] = 999  # 超過 ±15 天，不算
        self.assertEqual(catalog.same_period_baseline(prices, self.anchor), (20, 24, 2))

    def test_needs_at_least_two_years(self):
        prices = {dt.date(2025, 10, d): 10 for d in range(1, 22)}
        self.assertEqual(catalog.same_period_baseline(prices, self.anchor), (None, 21, 1))

    def test_needs_at_least_20_days(self):
        prices = {dt.date(y, 10, d): 10 for y in (2024, 2025) for d in range(1, 10)}
        self.assertEqual(catalog.same_period_baseline(prices, self.anchor), (None, 18, 2))

    def test_leap_day_anchor(self):
        prices = {dt.date(y, 2, 28): 10 for y in (2025, 2024, 2023)}
        self.assertEqual(catalog.same_period_baseline(prices, dt.date(2028, 2, 29))[1:], (3, 3))


if __name__ == "__main__":
    unittest.main()
