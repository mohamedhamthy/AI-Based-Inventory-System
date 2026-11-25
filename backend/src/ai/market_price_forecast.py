import json
import math
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta


MIN_OBSERVATIONS = 8
MIN_SPAN_DAYS = 14
ALLOWED_HORIZONS = {7, 30, 60}
DAMPING_FACTOR = 0.8
MAPE_EPSILON = 1e-8


def _parse_day(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _daily_observations(records):
    grouped = defaultdict(list)
    for record in records:
        day = _parse_day(record["recordedAt"])
        try:
            price = float(record["price"])
        except (TypeError, ValueError) as error:
            raise ValueError("Prices must be finite non-negative numbers") from error
        if not math.isfinite(price) or price < 0:
            raise ValueError("Prices must be finite non-negative numbers")
        grouped[day].append(price)
    return [(day, sum(prices) / len(prices)) for day, prices in sorted(grouped.items())]


def _fit(points, origin):
    xs = [(day - origin).days for day, _ in points]
    ys = [price for _, price in points]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    variance = sum((x - mean_x) ** 2 for x in xs)
    if variance == 0:
        return mean_y, 0.0
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / variance
    return mean_y - slope * mean_x, slope


def _predict_linear(points, day, origin):
    intercept, slope = _fit(points, origin)
    return max(0.01, intercept + slope * (day - origin).days)


def _predict_last(points, _day, _origin):
    return points[-1][1]


def _predict_average(points, _day, _origin):
    recent = [price for _, price in points[-3:]]
    return sum(recent) / len(recent)


def _predict_damped_trend(points, day, _origin):
    recent = points[-min(12, len(points)):]
    _, slope = _fit(recent, recent[0][0])
    elapsed_days = max(0, (day - points[-1][0]).days)
    damped_days = DAMPING_FACTOR * (1 - DAMPING_FACTOR ** elapsed_days) / (1 - DAMPING_FACTOR)
    return max(0.01, points[-1][1] + slope * damped_days)


MODELS = (
    ("last observation", _predict_last),
    ("three-observation average", _predict_average),
    ("linear trend", _predict_linear),
    ("damped trend", _predict_damped_trend),
)


def _metrics(observations, training_count, testing_count, mae=None, rmse=None, mape=None, confidence=0, model=None):
    return {
        "observations": observations,
        "trainingObservations": training_count,
        "testingObservations": testing_count,
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "confidence": confidence,
        "model": model,
        "validationMethod": "Rolling-origin time-series holdout",
    }


def _warnings(observations):
    warnings = []
    if len(observations) < 16:
        warnings.append("Limited price history; the selected model may be unstable.")
    gaps = [(right[0] - left[0]).days for left, right in zip(observations, observations[1:])]
    if gaps and max(gaps) > max(14, 3 * (sum(gaps) / len(gaps))):
        warnings.append("Price observations have long gaps; recent market changes may be missing.")
    return warnings


def _insufficient_result(count, training_count, testing_count, warnings, metrics=None, message="Insufficient data for reliable prediction"):
    return {
        "status": "insufficient_data",
        "message": message,
        "metrics": metrics or _metrics(count, training_count, testing_count),
        "dataQualityWarnings": warnings,
        "forecastPoints": [],
    }


def forecast(records, horizon):
    if horizon not in ALLOWED_HORIZONS:
        raise ValueError("Forecast period must be 7, 30, or 60 days")

    observations = _daily_observations(records)
    count = len(observations)
    span_days = (observations[-1][0] - observations[0][0]).days if count else 0
    warnings = _warnings(observations)
    if observations and not any(price > 0 for _, price in observations):
        return _insufficient_result(
            count,
            0,
            0,
            warnings,
            message="No positive price observations are available for prediction",
        )
    if count < MIN_OBSERVATIONS or span_days < MIN_SPAN_DAYS:
        return _insufficient_result(count, 0, 0, warnings)

    test_count = min(5, max(2, math.ceil(count * 0.2)))
    training_count = count - test_count
    if training_count < 5:
        return _insufficient_result(count, training_count, test_count, warnings)

    model_scores = []
    for model_name, predictor in MODELS:
        errors = []
        percentages = []
        for offset in range(test_count):
            training = observations[:training_count + offset]
            actual_day, actual_price = observations[training_count + offset]
            predicted_price = predictor(training, actual_day, observations[0][0])
            error = actual_price - predicted_price
            errors.append(error)
            percentages.append(abs(error) / max(abs(actual_price), MAPE_EPSILON))
        mape = sum(percentages) / len(percentages) * 100
        model_scores.append((mape, model_name, predictor, errors))
    model_scores.sort(key=lambda result: result[0])
    mape, model_name, predictor, errors = model_scores[0]

    mae = sum(abs(error) for error in errors) / len(errors)
    rmse = math.sqrt(sum(error * error for error in errors) / len(errors))
    if not all(math.isfinite(metric) for metric in (mae, rmse, mape)):
        return _insufficient_result(count, training_count, test_count, warnings)

    if mape > 50:
        warnings.append("Rolling validation error is high; no price prediction or action recommendation is provided.")
        return _insufficient_result(
            count,
            training_count,
            test_count,
            warnings,
            _metrics(count, training_count, test_count, round(mae, 2), round(rmse, 2), round(mape, 2), 0, model_name),
            "Recent prices were too variable for a reliable prediction",
        )

    if count < 30:
        confidence = round(max(0, min(100, (1 - mape / 50) * (count / 30) * 100)))
    else:
        confidence = round(max(0, min(100, (1 - mape / 50) * 100)))

    final_day = observations[-1][0]
    forecast_points = [
        {
            "date": (final_day + timedelta(days=day)).isoformat(),
            "predictedPrice": round(
                predictor(observations, final_day + timedelta(days=day), observations[0][0]),
                2,
            ),
        }
        for day in range(1, horizon + 1)
    ]

    return {
        "status": "reliable",
        "message": None,
        "metrics": _metrics(
            count,
            training_count,
            test_count,
            round(mae, 2),
            round(rmse, 2),
            round(mape, 2),
            confidence,
            model_name,
        ),
        "dataQualityWarnings": warnings,
        "forecastPoints": forecast_points,
    }


def main():
    request = json.load(sys.stdin)
    result = forecast(request.get("records", []), int(request.get("horizon", 7)))
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
