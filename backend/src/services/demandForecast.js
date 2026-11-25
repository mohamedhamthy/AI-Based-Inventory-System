const VALIDATION_WEEKS = 6;
const MIN_ACTIVE_WEEKS = 6;
const MIN_RECENT_ACTIVE_WEEKS = 3;
const DEFAULT_FORECAST_WEEK_DAY_COUNTS = [7, 7, 7, 7];

const average = (values) => values.length
  ? values.reduce((total, value) => total + value, 0) / values.length
  : 0;

const recentAverage = (values) => {
  const baseline = average(values.slice(-4));
  return Math.max(0, baseline);
};

const weightedAverage = (values) => {
  const recent = values.slice(-8);
  const weightedTotal = recent.reduce((total, value, index) => total + value * (index + 1), 0);
  const weights = recent.reduce((total, _value, index) => total + index + 1, 0);
  return weights ? Math.max(0, weightedTotal / weights) : 0;
};

const linearTrend = (values, horizon) => {
  const recent = values.slice(-12);
  if (recent.length < 2) return Math.max(0, recent.at(-1) || 0);

  const meanX = (recent.length - 1) / 2;
  const meanY = average(recent);
  const variance = recent.reduce((total, _value, index) => total + (index - meanX) ** 2, 0);
  const covariance = recent.reduce(
    (total, value, index) => total + (index - meanX) * (value - meanY),
    0,
  );
  const slope = variance ? covariance / variance : 0;
  return Math.max(0, meanY + slope * (recent.length - 1 + horizon - meanX));
};

const models = [
  { name: 'Four-week average', predict: recentAverage },
  { name: 'Weighted eight-week average', predict: weightedAverage },
  { name: 'Recent linear trend', predict: linearTrend },
];

const insufficient = (series, reason) => ({
  status: 'insufficient_data',
  reason,
  model: null,
  confidence: 0,
  validationWape: null,
  activeWeeks: series.filter((quantity) => quantity > 0).length,
  weeksAnalyzed: series.length,
  averageWeeklyDemand: Number(average(series).toFixed(2)),
  next28DayDemand: null,
  weeklyForecast: [],
});

export const buildDemandForecast = (
  weeklySales,
  forecastWeekDayCounts = DEFAULT_FORECAST_WEEK_DAY_COUNTS,
) => {
  if (
    !Array.isArray(forecastWeekDayCounts)
    || forecastWeekDayCounts.some((days) => !Number.isInteger(days) || days < 0 || days > 7)
    || forecastWeekDayCounts.reduce((total, days) => total + days, 0) !== 28
  ) {
    throw new RangeError('Forecast week day counts must cover exactly 28 calendar days.');
  }

  const series = weeklySales.map((quantity) => (
    Number.isFinite(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 0
  ));
  const activeWeeks = series.filter((quantity) => quantity > 0).length;
  const recentActiveWeeks = series.slice(-13).filter((quantity) => quantity > 0).length;

  if (series.length < 12 || activeWeeks < MIN_ACTIVE_WEEKS || recentActiveWeeks < MIN_RECENT_ACTIVE_WEEKS) {
    return insufficient(series, 'Record sales in at least 6 different weeks, including 3 of the last 13 weeks, to validate demand.');
  }

  const validationStart = series.length - VALIDATION_WEEKS;
  const validationActual = series.slice(validationStart);
  const actualTotal = validationActual.reduce((total, quantity) => total + quantity, 0);
  if (actualTotal <= 0) {
    return insufficient(series, 'Recent sales are too sparse to validate a demand forecast.');
  }

  const scoredModels = models.map((model) => {
    const errors = validationActual.map((actual, offset) => {
      const history = series.slice(0, validationStart + offset);
      return Math.abs(actual - model.predict(history, 1));
    });
    const absoluteError = errors.reduce((total, error) => total + error, 0);
    return {
      ...model,
      wape: absoluteError / actualTotal * 100,
    };
  });
  scoredModels.sort((left, right) => left.wape - right.wape);

  const selectedModel = scoredModels[0];
  const validationWape = selectedModel.wape;
  if (validationWape > 100) {
    return {
      status: 'uncertain',
      reason: 'Recent sales were too variable for a reliable 28-day estimate.',
      model: selectedModel.name,
      confidence: 0,
      validationWape: Number(validationWape.toFixed(1)),
      activeWeeks,
      weeksAnalyzed: series.length,
      averageWeeklyDemand: Number(average(series).toFixed(2)),
      next28DayDemand: null,
      weeklyForecast: [],
    };
  }

  const weeklyForecast = Array.from({ length: forecastWeekDayCounts.length }, (_, index) => (
    Number(selectedModel.predict(series, index + 1).toFixed(2))
  ));
  const next28DayDemand = Number(weeklyForecast.reduce(
    (total, quantity, index) => total + quantity * (forecastWeekDayCounts[index] / 7),
    0,
  ).toFixed(2));
  const dataCoverage = Math.min(1, activeWeeks / 16);
  const validationScore = Math.max(0, 1 - validationWape / 100);
  const confidence = Math.round(validationScore * dataCoverage * 100);

  return {
    status: 'reliable',
    reason: null,
    model: selectedModel.name,
    confidence,
    validationWape: Number(validationWape.toFixed(1)),
    activeWeeks,
    weeksAnalyzed: series.length,
    averageWeeklyDemand: Number(average(series).toFixed(2)),
    next28DayDemand,
    weeklyForecast,
  };
};
