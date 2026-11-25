import api from './api';
import { invalidateCache } from './queryCache';
import { normalizeProduct } from './productService';

export const getStockMovements = async (params = {}) => {
  const response = await api.get('/stock-movements', { params });
  return response.data.data;
};

export const receiveStock = async (data, idempotencyKey) => {
  const response = await api.post('/stock-movements/stock-in', data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  invalidateCache('products:');
  return {
    ...response.data.data,
    product: normalizeProduct(response.data.data.product),
  };
};

export const adjustProductStock = async (data, idempotencyKey) => {
  const response = await api.post('/stock-movements/adjustments', data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  invalidateCache('products:');
  return {
    ...response.data.data,
    product: normalizeProduct(response.data.data.product),
  };
};
