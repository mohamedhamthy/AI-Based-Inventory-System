import api from './api';
import { invalidateCache } from './queryCache';

const resource = '/purchase-orders';

export const getPurchaseOrders = async (params = {}) => {
  const response = await api.get(resource, { params });
  return response.data.data;
};

export const getPurchaseOrder = async (id) => {
  const response = await api.get(`${resource}/${id}`);
  return response.data.data.purchaseOrder;
};

export const createPurchaseOrder = async (data) => {
  const response = await api.post(resource, data);
  invalidateCache('purchase-orders:');
  return response.data.data.purchaseOrder;
};

export const updatePurchaseOrder = async (id, data) => {
  const response = await api.put(`${resource}/${id}`, data);
  invalidateCache('purchase-orders:');
  return response.data.data.purchaseOrder;
};

export const orderPurchaseOrder = async (id) => {
  const response = await api.post(`${resource}/${id}/order`);
  invalidateCache('purchase-orders:');
  return response.data.data.purchaseOrder;
};

export const cancelPurchaseOrder = async (id) => {
  const response = await api.post(`${resource}/${id}/cancel`);
  invalidateCache('purchase-orders:');
  return response.data.data.purchaseOrder;
};

export const receivePurchaseOrder = async (id, items, idempotencyKey) => {
  const response = await api.post(`${resource}/${id}/receipts`, { items }, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  invalidateCache('purchase-orders:', 'products:');
  return response.data.data;
};
