import { useEffect, useMemo, useRef, useState } from 'react';
import { FiActivity, FiCalendar, FiEdit2, FiMinus, FiPlus, FiRefreshCw, FiTarget, FiTrash2, FiTrendingDown, FiTrendingUp, FiUpload } from 'react-icons/fi';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../utils/permissions';
import PageHeader from '../components/common/PageHeader';
import { getAllProducts } from '../services/productService';
import {
  createMarketPrice,
  deleteMarketPrice,
  forecastMarketPrice,
  getLatestMarketPriceForecast,
  getMarketPriceHistory,
  importMarketPrices,
  updateMarketPrice,
} from '../services/marketPriceService';
import { parseCsv } from '../utils/parseCsv';
import { formatBusinessDate, formatLkr, toBusinessDateInputValue } from '../utils/formatters';

const priceTypes = ['Retail', 'Wholesale', 'Online', 'Other'];
const initialForm = { price: '', source: '', priceType: 'Retail', recordedAt: toBusinessDateInputValue() };
const formatPrice = formatLkr;
const dateInputValue = (value) => value ? toBusinessDateInputValue(new Date(value)) : '';
const normalizeHeader = (header) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

const MarketPricesPage = () => {
  const { user } = useAuth();
  const canManagePrices = hasPermission(user, 'marketPrices:manage');
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [records, setRecords] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [days, setDays] = useState(7);
  const [priceType, setPriceType] = useState('Retail');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isForecasting, setIsForecasting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [forecastError, setForecastError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const forecastRequestId = useRef(0);

  useEffect(() => {
    let active = true;
    getAllProducts()
      .then((availableProducts) => {
        if (!active) return;
        setProducts(availableProducts);
        setIsLoadingData(Boolean(availableProducts[0]));
        setSelectedProductId((current) => current || availableProducts[0]?.id || '');
        if (!availableProducts.length) setIsLoadingData(false);
      })
      .catch((error) => {
        if (!active) return;
        setIsLoadingData(false);
        setLoadError(error.message || 'Unable to load spare parts');
        toast.error(error.message || 'Unable to load spare parts');
      })
      .finally(() => {
        if (active) setIsLoadingProducts(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedProductId) return undefined;
    let active = true;
    getMarketPriceHistory(selectedProductId)
      .then((result) => {
        if (!active) return;
        setRecords(result.records || []);
        setAnalysis(result);
        setLoadError('');
      })
      .catch((error) => {
        if (!active) return;
        setRecords([]);
        setAnalysis(null);
        setLoadError(error.message || 'Unable to load market price history');
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });
    return () => { active = false; };
  }, [selectedProductId, refreshKey]);

  useEffect(() => {
    if (!selectedProductId) return undefined;
    let active = true;
    const requestId = ++forecastRequestId.current;
    getLatestMarketPriceForecast(selectedProductId, days, priceType)
      .then((result) => {
        if (active && requestId === forecastRequestId.current) setForecast(result);
      })
      .catch((error) => {
        if (active && requestId === forecastRequestId.current) {
          setForecastError(error.message || 'Unable to load the saved price forecast');
        }
      });
    return () => { active = false; };
  }, [selectedProductId, days, priceType, refreshKey]);

  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedRecords = records.filter((record) => record.priceType === priceType);
  const priceAnalysis = analysis?.analysis?.byPriceType?.[priceType];
  const sellingPriceRecommendation = analysis?.sellingPriceRecommendation;
  const chartData = useMemo(() => {
    const actualPoints = selectedRecords
      .slice()
      .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt))
      .map((record) => ({
        date: new Date(record.recordedAt).toISOString(),
        actualPrice: Number(record.price),
        predictedPrice: null,
      }));
    const futurePoints = forecast?.forecast?.status === 'reliable'
      ? forecast.forecast.forecastPoints.map((point) => ({
          date: new Date(point.date).toISOString(),
          actualPrice: null,
          predictedPrice: Number(point.predictedPrice),
        }))
      : [];
    if (actualPoints.length && futurePoints.length) {
      actualPoints[actualPoints.length - 1].predictedPrice = actualPoints[actualPoints.length - 1].actualPrice;
    }
    return [...actualPoints, ...futurePoints];
  }, [selectedRecords, forecast]);

  const latestRecord = selectedRecords.reduce(
    (latest, record) => {
      if (!latest) return record;
      const recordedAtDifference = new Date(record.recordedAt) - new Date(latest.recordedAt);
      const createdAtDifference = new Date(record.createdAt || 0) - new Date(latest.createdAt || 0);
      return recordedAtDifference > 0 || (recordedAtDifference === 0 && createdAtDifference > 0)
        ? record
        : latest;
    },
    null,
  );
  const currentPrice = latestRecord?.price ?? null;
  const currentRecordedAt = latestRecord?.recordedAt ?? null;
  const predictedPrice = forecast?.forecast?.status === 'reliable' ? forecast.forecast.predictedPrice : null;
  const prediction = forecast?.forecast;
  const observationAgeDays = forecast?.latestObservationAgeDays;
  const forecastRunAt = prediction?.generatedAt;
  const trendIcon = prediction?.trend === 'Increasing'
    ? FiTrendingUp
    : prediction?.trend === 'Decreasing' ? FiTrendingDown : FiMinus;
  const TrendIcon = trendIcon;

  const resetForm = () => {
    setForm({ ...initialForm, recordedAt: toBusinessDateInputValue() });
    setEditingId('');
  };

  const updateProductSelection = (productId) => {
    setIsLoadingData(true);
    setRecords([]);
    setAnalysis(null);
    setForecast(null);
    setForecastError('');
    setIsForecasting(false);
    setLoadError('');
    forecastRequestId.current += 1;
    setSelectedProductId(productId);
  };

  const refreshAnalysis = () => {
    setIsLoadingData(true);
    setForecast(null);
    setForecastError('');
    setIsForecasting(false);
    setLoadError('');
    forecastRequestId.current += 1;
    setRefreshKey((key) => key + 1);
  };

  const runForecast = async () => {
    if (!selectedProductId || isForecasting) return;
    const requestId = ++forecastRequestId.current;
    setIsForecasting(true);
    setForecastError('');
    try {
      const result = await forecastMarketPrice(selectedProductId, days, priceType);
      if (requestId === forecastRequestId.current) setForecast(result);
    } catch (error) {
      if (requestId === forecastRequestId.current) {
        setForecast(null);
        setForecastError(error.message || 'Unable to calculate price prediction');
      }
    } finally {
      if (requestId === forecastRequestId.current) setIsForecasting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProductId) return;
    setIsSaving(true);
    const payload = {
      productId: selectedProductId,
      price: Number(form.price),
      source: form.source.trim(),
      priceType: form.priceType,
      currency: 'LKR',
      recordedAt: form.recordedAt,
    };
    try {
      if (editingId) {
        await updateMarketPrice(editingId, payload);
        toast.success('Market price updated');
      } else {
        await createMarketPrice(payload);
        toast.success('Market price recorded');
      }
      resetForm();
      refreshAnalysis();
    } catch (error) {
      toast.error(error.message || 'Unable to save market price');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record._id);
    setForm({
      price: String(record.price),
      source: record.source,
      priceType: record.priceType,
      recordedAt: dateInputValue(record.recordedAt),
    });
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Delete this market price record?')) return;
    try {
      await deleteMarketPrice(recordId);
      toast.success('Market price deleted');
      if (editingId === recordId) resetForm();
      refreshAnalysis();
    } catch (error) {
      toast.error(error.message || 'Unable to delete market price');
    }
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const parsedRows = parseCsv(await file.text());
      const rows = parsedRows.map((parsedRow) => {
        const row = Object.fromEntries(Object.entries(parsedRow).map(([key, value]) => [normalizeHeader(key), value]));
        const type = row.pricetype || 'Retail';
        const normalizedType = priceTypes.find((option) => option.toLowerCase() === type.toLowerCase()) || type;
        return {
          productId: row.productid || row.id,
          sku: row.sku,
          price: row.price,
          source: row.source || row.shop || row.shopname,
          priceType: normalizedType,
          currency: row.currency || 'LKR',
          recordedAt: row.recordedat || row.recordeddate || row.date,
        };
      });
      const result = await importMarketPrices(rows);
      toast.success(`${result.imported} market price records imported`);
      refreshAnalysis();
    } catch (error) {
      const rowErrors = Array.isArray(error.details)
        ? error.details.slice(0, 5).map((item) => `row ${item.row}: ${item.field} ${item.message}`).join('; ')
        : '';
      toast.error(rowErrors ? `${error.message}: ${rowErrors}` : error.message || 'Unable to import CSV records');
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

  const chartDate = formatBusinessDate;
  const displayRecordedDate = formatBusinessDate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Price Intelligence"
        description="Analyze recorded LKR market observations and predict price trends from historical data. Predictions are estimates, not guaranteed future prices."
        action={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <label className="w-full text-sm text-slate-400 sm:w-auto">
              <span className="sr-only">Select spare part</span>
              <select
                aria-label="Select spare part"
                value={selectedProductId}
                onChange={(event) => updateProductSelection(event.target.value)}
                disabled={isLoadingProducts || products.length === 0}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-white sm:min-w-52 sm:w-auto"
              >
                {products.length === 0 && <option value="">{isLoadingProducts ? 'Loading parts...' : 'No active parts'}</option>}
                {products.map((product) => <option key={product.id} value={product.id}>{product.productName} · Part number: {product.sku}{product.oemPartNumber ? ` · OEM: ${product.oemPartNumber}` : ''}</option>)}
              </select>
            </label>
            <button type="button" onClick={refreshAnalysis} disabled={!selectedProductId || isLoadingData} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50 sm:w-auto">
              <FiRefreshCw size={16} /> Refresh
            </button>
            <button type="button" onClick={runForecast} disabled={!selectedProductId || isLoadingData || isForecasting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50 sm:w-auto">
              <FiActivity size={16} />{isForecasting ? 'Predicting...' : `Run ${days}-day prediction`}
            </button>
          </div>
        )}
      />

      {loadError ? (
        <div role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4 text-sm text-rose-200">{loadError}</div>
      ) : null}
      {forecastError ? (
        <div role="alert" className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100">{forecastError}</div>
      ) : null}
      {!isLoadingProducts && products.length === 0 && !loadError ? (
        <div role="status" className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
          No active products are available for market-price analysis. Add or activate a product in this workspace to continue.
        </div>
      ) : null}

      <section className="grid gap-4 rounded-[24px] border border-white/10 bg-slate-900/70 p-4 md:grid-cols-3">
        <label className="text-sm text-slate-300">
          Price series
          <select value={priceType} onChange={(event) => { setForecast(null); setForecastError(''); setIsForecasting(false); forecastRequestId.current += 1; setPriceType(event.target.value); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white">
            {priceTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Forecast horizon
          <select value={days} onChange={(event) => { setForecast(null); setForecastError(''); setIsForecasting(false); forecastRequestId.current += 1; setDays(Number(event.target.value)); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white">
            {[7, 30, 60].map((period) => <option key={period} value={period}>{period} days</option>)}
          </select>
        </label>
        <div className="flex items-end text-xs leading-5 text-slate-400">
          Forecasts use only {priceType.toLowerCase()} market records in LKR. Market, supplier cost, and selling prices remain separate.
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">Latest recorded market price</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatPrice(currentPrice)}</p>
          <p className="mt-1 text-xs text-slate-500">{currentRecordedAt ? `Recorded ${displayRecordedDate(currentRecordedAt)}` : 'No matching market observations'}</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">Average recorded market price</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatPrice(priceAnalysis?.averagePrice)}</p>
          <p className="mt-1 text-xs text-slate-500">{priceAnalysis?.observationCount || 0} {priceType.toLowerCase()} observations used</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">{days}-day predicted market price</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatPrice(predictedPrice)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {prediction?.status === 'reliable'
              ? 'Model estimate; not a supplier quote'
              : prediction ? 'Prediction withheld; review validation details' : 'Run a prediction to evaluate stored history'}
          </p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">Expected price change</p>
          <p className="mt-3 text-2xl font-semibold text-white">{prediction?.percentageChange === null || prediction?.percentageChange === undefined ? '—' : `${prediction.percentageChange > 0 ? '+' : ''}${prediction.percentageChange}%`}</p>
          <p className="mt-1 text-xs text-slate-500">{formatPrice(prediction?.changeAmount)} over {days} days</p>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">Price trend</p>
          <p className="mt-3 flex items-center gap-2 text-2xl font-semibold text-white"><TrendIcon className="text-cyan-300" />{prediction?.status === 'reliable' ? prediction.trend : 'Uncertain'}</p>
          <p className="mt-1 text-xs text-slate-500">Model confidence {prediction?.status === 'reliable' ? `${prediction.metrics.confidence}%` : 'not available'}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Historical market analysis</h2>
              <p className="text-sm text-slate-400">{priceType} observations for {selectedProduct?.productName || 'the selected part'} · Part number: {selectedProduct?.sku || 'not recorded'}{selectedProduct?.oemPartNumber ? ` · OEM: ${selectedProduct.oemPartNumber}` : ''}</p>
            </div>
            <span className="text-xs text-slate-500">
              {analysis?.analysis?.observationsUsed || 0} observations analyzed
              {analysis?.analysis?.truncated ? ` · latest ${analysis.analysis.historyLimit}` : ''}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-slate-400">First observed</p>
              <p className="mt-1 text-sm font-medium text-white">{formatPrice(priceAnalysis?.earliestPrice)}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-slate-400">Latest vs first change</p>
              <p className="mt-1 text-sm font-medium text-white">
                {priceAnalysis?.changeAmount === null || priceAnalysis?.changeAmount === undefined
                  ? '—'
                  : `${priceAnalysis.changeAmount > 0 ? '+' : ''}${formatPrice(priceAnalysis.changeAmount)} (${priceAnalysis.percentageChange}%)`}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-xs text-slate-400">Latest source</p>
              <p className="mt-1 truncate text-sm font-medium text-white">{priceAnalysis?.latestSource || 'No observations'}</p>
            </div>
          </div>
          <h3 className="mt-5 text-sm font-medium text-white">Recorded source comparison</h3>
          {priceAnalysis?.sourceComparisons?.length ? (
            <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">Observations</th><th className="px-3 py-2">Average</th><th className="px-3 py-2">Latest</th></tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {priceAnalysis.sourceComparisons.map((source) => (
                    <tr key={source.source}>
                      <td className="px-3 py-2">{source.source}</td>
                      <td className="px-3 py-2">{source.observationCount}</td>
                      <td className="px-3 py-2">{formatPrice(source.averagePrice)}</td>
                      <td className="px-3 py-2">{formatPrice(source.latestPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-sm text-slate-400">No recorded {priceType.toLowerCase()} observations are available.</p>}
        </div>

        <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/5 p-5">
          <h2 className="text-lg font-semibold text-white">Selling price recommendation</h2>
          <p className="mt-1 text-xs text-slate-400">{selectedProduct?.productName || 'Select a part'} · Part number: {selectedProduct?.sku || 'not recorded'}{selectedProduct?.oemPartNumber ? ` · OEM: ${selectedProduct.oemPartNumber}` : ''}</p>
          <p className="mt-1 text-sm text-slate-400">An estimate from saved product cost and recorded Retail market observations. Nothing is changed automatically.</p>
          {sellingPriceRecommendation?.status === 'available' ? (
            <>
              <p className="mt-4 text-2xl font-semibold text-emerald-200">{formatPrice(sellingPriceRecommendation.suggestedSellingPrice)}</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-400">Expected gross profit / unit</dt><dd className="text-white">{formatPrice(sellingPriceRecommendation.expectedGrossProfitPerUnit)}</dd></div>
                <div><dt className="text-slate-400">Expected gross margin</dt><dd className="text-white">{sellingPriceRecommendation.expectedGrossProfitMarginPercent}%</dd></div>
                <div><dt className="text-slate-400">Recorded Retail average</dt><dd className="text-white">{formatPrice(sellingPriceRecommendation.marketAveragePrice)}</dd></div>
                <div><dt className="text-slate-400">Current selling price</dt><dd className="text-white">{formatPrice(sellingPriceRecommendation.currentSellingPrice)}</dd></div>
              </dl>
            </>
          ) : (
            <p className="mt-4 text-sm text-amber-100">{sellingPriceRecommendation?.explanation || 'Loading product cost and market observations…'}</p>
          )}
          {sellingPriceRecommendation?.status === 'available' ? (
            <p className="mt-3 text-xs leading-5 text-slate-400">{sellingPriceRecommendation.explanation}</p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">Recommendation uses the average of up to 10 latest Retail observations and adds no assumed target margin. Review before changing the product’s actual selling price.</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Historical and predicted prices</h2>
              <p className="text-sm text-slate-400">{selectedProduct?.productName || 'Select a part'} · Part number: {selectedProduct?.sku || 'not recorded'}{selectedProduct?.oemPartNumber ? ` · OEM: ${selectedProduct.oemPartNumber}` : ''} · {priceType} · LKR</p>
            </div>
            <span className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">Data recorded in your inventory only</span>
          </div>
          {isLoadingData ? (
            <div className="grid h-80 place-items-center text-sm text-slate-400">Loading market history and evaluating forecast...</div>
          ) : chartData.length ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#ffffff12" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={chartDate} minTickGap={24} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis width={72} tickFormatter={(value) => Number(value).toLocaleString()} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={chartDate} formatter={(value, name) => [formatPrice(value), name === 'actualPrice' ? 'Recorded' : 'Predicted']} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
                  <Line type="monotone" dataKey="actualPrice" name="actualPrice" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="predictedPrice" name="predictedPrice" stroke="#a78bfa" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-80 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-slate-400">
              <p>No {priceType.toLowerCase()} market price records exist for this part.<br />Add verified observations or import a CSV to begin.</p>
            </div>
          )}
          {forecast ? (
            <div role="status" className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs leading-5 text-slate-300">
              {forecast.currentRecordedAt ? (
                <>
                  <p>
                    Forecast horizons are measured after the last recorded observation ({displayRecordedDate(forecast.currentRecordedAt)}).
                    {forecastRunAt && Number.isInteger(observationAgeDays)
                      ? observationAgeDays >= 0
                        ? ` That observation was ${observationAgeDays} Colombo calendar ${observationAgeDays === 1 ? 'day' : 'days'} before this forecast ran on ${displayRecordedDate(forecastRunAt)}.`
                        : ` That observation is dated ${Math.abs(observationAgeDays)} Colombo calendar ${observationAgeDays === -1 ? 'day' : 'days'} after this forecast ran on ${displayRecordedDate(forecastRunAt)}.`
                      : ''}
                  </p>
                  <p className="mt-1 text-slate-400">Review the observation age and data-quality warnings; no automatic staleness cutoff is configured.</p>
                </>
              ) : (
                <p>No recorded observation date is available for this forecast; no reliable future price is shown.</p>
              )}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-violet-400/20 bg-violet-400/5 p-5">
            <div className="flex items-center gap-2 text-violet-200"><FiTarget /><h2 className="text-lg font-semibold">Recommendation</h2></div>
            <p className="mt-4 text-2xl font-semibold text-white">{prediction?.recommendation || 'Monitor Price'}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{forecast?.recommendationNote || 'Forecast is unavailable. Check that Python is configured for the API, then refresh; no recommendation is made without a valid model result.'}</p>
            <p className="mt-3 text-xs leading-5 text-slate-400">Buy Now also requires low stock and the saved supplier cost below the forecast. Compare a current supplier quote and business needs before purchasing.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <div className="flex items-center gap-2 text-cyan-300"><FiActivity /><h2 className="text-lg font-semibold text-white">Model evaluation</h2></div>
            {prediction?.status === 'reliable' ? (
              <>
                <p className="mt-3 text-sm text-slate-300">
                  Selected model: {prediction.metrics.model || 'local baseline'} · rolling-origin validation across {prediction.metrics.trainingObservations} training and {prediction.metrics.testingObservations} test observations ({prediction.metrics.observations} distinct dates).
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-400">MAE</dt><dd className="text-white">{formatPrice(prediction.metrics.mae)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-400">RMSE</dt><dd className="text-white">{formatPrice(prediction.metrics.rmse)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-400">MAPE</dt><dd className="text-white">{prediction.metrics.mape}%</dd></div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-slate-500">Confidence is a conservative score derived from holdout MAPE and history volume; it is not a probability that the price will be correct.</p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-amber-100">
                {prediction?.message || 'Insufficient data for reliable prediction. Add at least 8 distinct recorded dates spanning 14 or more days; high rolling-validation error suppresses the forecast.'}
              </p>
            )}
            {prediction?.dataQualityWarnings?.length ? (
              <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-200/80">
                {prediction.dataQualityWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
              </ul>
            ) : null}
          </div>
        </aside>
      </section>

      {canManagePrices && (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit market price' : 'Record market price'}</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-sm text-slate-300">
                  Spare part
                  <select required value={selectedProductId} onChange={(event) => updateProductSelection(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white">
                    {products.map((product) => <option key={product.id} value={product.id}>{product.productName} · Part number: {product.sku}{product.oemPartNumber ? ` · OEM: ${product.oemPartNumber}` : ''}</option>)}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Market price (LKR)
                    <input type="number" min="0.01" step="0.01" required value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white" />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Price type
                    <select value={form.priceType} onChange={(event) => setForm((current) => ({ ...current, priceType: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white">
                      {priceTypes.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-sm text-slate-300">
                  Source / shop name
                  <input type="text" maxLength="120" required value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white" placeholder="Where was this price observed?" />
                </label>
                <label className="block text-sm text-slate-300">
                  Recorded date
                  <input type="date" required value={form.recordedAt} onChange={(event) => setForm((current) => ({ ...current, recordedAt: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={isSaving || !selectedProductId} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60">
                    <FiPlus />{isSaving ? 'Saving...' : editingId ? 'Save changes' : 'Add observation'}
                  </button>
                  {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200">Cancel edit</button>}
                </div>
              </div>
            </form>

            <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center gap-2 text-cyan-300"><FiUpload /><h2 className="text-lg font-semibold text-white">Import historical CSV</h2></div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Use real observations only. Required headers: <code className="text-slate-200">productId</code> (or <code className="text-slate-200">sku</code>), <code className="text-slate-200">price</code>, <code className="text-slate-200">source</code>, <code className="text-slate-200">priceType</code>, and <code className="text-slate-200">recordedAt</code>. Currency may be omitted (LKR).</p>
              <label className="mt-4 block text-sm text-slate-300">
                Choose CSV file (up to 500 records)
                <input type="file" accept=".csv,text/csv" disabled={isImporting} onChange={handleCsvImport} className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:font-semibold file:text-slate-950" />
              </label>
              {isImporting && <p role="status" className="mt-2 text-sm text-cyan-200">Validating and importing rows...</p>}
            </div>
          </div>

          <div className="min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-white">Recorded market prices</h2>
                <p className="text-sm text-slate-400">{records.length} records · latest 500 · edit or remove a record</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"><FiCalendar /> Actual observations</div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[700px] divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr><th className="px-3 py-3">Recorded</th><th className="px-3 py-3">Part</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/60 text-slate-200">
                  {records.map((record) => (
                    <tr key={record._id}>
                      <td className="px-3 py-3">{displayRecordedDate(record.recordedAt)}</td>
                      <td className="px-3 py-3 font-medium text-white">{record.productName}<p className="text-xs text-slate-500">Part number: {selectedProduct?.sku || 'not recorded'}</p></td>
                      <td className="px-3 py-3">{record.source}</td>
                      <td className="px-3 py-3">{record.priceType}</td>
                      <td className="px-3 py-3">{formatPrice(record.price)}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEdit(record)} aria-label={`Edit ${record.productName} price`} className="rounded-lg p-2 text-cyan-300 hover:bg-cyan-400/10"><FiEdit2 /></button>
                          <button type="button" onClick={() => handleDelete(record._id)} aria-label={`Delete ${record.productName} price`} className="rounded-lg p-2 text-rose-300 hover:bg-rose-400/10"><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!records.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400">No market price history recorded for this spare part.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default MarketPricesPage;
