import api from './api';

export const getSales = async () => {
  const response = await api.get('/sales');
  return response.data.data.sales;
};

export const createSale = async (data) => {
  const response = await api.post('/sales', data);
  return response.data.data.sale;
};
