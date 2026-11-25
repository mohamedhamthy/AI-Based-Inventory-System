import unittest
import math
from datetime import date, timedelta

from market_price_forecast import forecast


class MarketPriceForecastTests(unittest.TestCase):
    def test_insufficient_history_does_not_return_a_prediction(self):
        records = [
            {"recordedAt": "2026-01-01", "price": 1000},
            {"recordedAt": "2026-01-02", "price": 1010},
        ]
        result = forecast(records, 7)
        self.assertEqual(result["status"], "insufficient_data")
        self.assertEqual(result["forecastPoints"], [])
        self.assertEqual(result["metrics"]["validationMethod"], "Rolling-origin time-series holdout")

    def test_sufficient_history_returns_a_reliable_trend_for_each_supported_horizon(self):
        start = date(2026, 1, 1)
        records = [
            {"recordedAt": (start + timedelta(days=day)).isoformat(), "price": 1000 + day * 5}
            for day in range(21)
        ]
        for horizon in (7, 30, 60):
            with self.subTest(horizon=horizon):
                result = forecast(records, horizon)
                self.assertEqual(result["status"], "reliable")
                self.assertEqual(len(result["forecastPoints"]), horizon)
                self.assertGreater(result["forecastPoints"][-1]["predictedPrice"], 1100)
                self.assertGreaterEqual(result["metrics"]["testingObservations"], 2)
                self.assertIsNotNone(result["metrics"]["mae"])
                self.assertEqual(result["metrics"]["model"], "linear trend")

    def test_volatile_history_suppresses_unreliable_forecast(self):
        start = date(2026, 1, 1)
        records = [
            {"recordedAt": (start + timedelta(days=day)).isoformat(), "price": 100 if day % 2 else 1000}
            for day in range(30)
        ]
        result = forecast(records, 7)
        self.assertEqual(result["status"], "insufficient_data")
        self.assertEqual(result["forecastPoints"], [])
        self.assertEqual(result["metrics"]["confidence"], 0)
        self.assertTrue(result["dataQualityWarnings"])

    def test_duplicate_day_records_are_averaged_before_validation(self):
        start = date(2026, 1, 1)
        records = [
            {"recordedAt": (start + timedelta(days=day)).isoformat(), "price": 1000 + day * 5}
            for day in range(21)
        ]
        records.extend([
            {"recordedAt": start.isoformat(), "price": 1200},
            {"recordedAt": start.isoformat(), "price": 800},
        ])
        result = forecast(records, 7)
        self.assertEqual(result["metrics"]["observations"], 21)
        self.assertEqual(result["status"], "reliable")

    def test_zero_and_near_zero_prices_do_not_break_validation_metrics(self):
        start = date(2026, 1, 1)
        records = [
            {"recordedAt": (start + timedelta(days=day)).isoformat(), "price": 1000 + day * 5}
            for day in range(19)
        ]
        records.extend([
            {"recordedAt": (start + timedelta(days=19)).isoformat(), "price": 0},
            {"recordedAt": (start + timedelta(days=20)).isoformat(), "price": 1e-12},
        ])

        result = forecast(records, 7)

        self.assertEqual(result["status"], "insufficient_data")
        self.assertTrue(math.isfinite(result["metrics"]["mape"]))
        self.assertEqual(result["forecastPoints"], [])

    def test_all_zero_prices_return_insufficient_data_and_negative_prices_are_rejected(self):
        start = date(2026, 1, 1)
        zero_records = [
            {"recordedAt": (start + timedelta(days=day)).isoformat(), "price": 0}
            for day in range(21)
        ]
        result = forecast(zero_records, 7)
        self.assertEqual(result["status"], "insufficient_data")
        self.assertEqual(result["message"], "No positive price observations are available for prediction")

        with self.assertRaisesRegex(ValueError, "non-negative"):
            forecast([{"recordedAt": start.isoformat(), "price": -1}], 7)


if __name__ == "__main__":
    unittest.main()
