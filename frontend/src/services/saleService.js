import api from './api';

export const getSales = async (params = {}) => {
  const response = await api.get('/sales', { params });
  return response.data.data;
};

export const createSale = async (data, idempotencyKey) => {
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    throw new Error('A valid idempotency key is required to record a sale.');
  }
  const response = await api.post('/sales', data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data.data;
};
