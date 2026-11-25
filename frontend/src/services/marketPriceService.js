import api from './api';

export const getMarketPriceHistory = async (productId) => {
  const response = await api.get(`/market-prices/history/${productId}`);
  return response.data.data;
};

export const getLatestMarketPriceForecast = async (productId, days = 7, priceType = 'Retail') => {
  const response = await api.get(`/market-prices/${productId}/forecast`, { params: { days, priceType } });
  return response.data.data;
};

export const createMarketPrice = async (record) => {
  const response = await api.post('/market-prices', record);
  return response.data.data.record;
};

export const updateMarketPrice = async (id, record) => {
  const response = await api.put(`/market-prices/${id}`, record);
  return response.data.data.record;
};

export const deleteMarketPrice = async (id) => {
  const response = await api.delete(`/market-prices/${id}`);
  return response.data.success;
};

export const importMarketPrices = async (rows) => {
  const response = await api.post('/market-prices/import', { rows });
  return response.data.data;
};

export const forecastMarketPrice = async (productId, days, priceType) => {
  const response = await api.post(`/market-prices/${productId}/forecast`, { days, priceType });
  return response.data.data;
};
