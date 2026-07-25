import api from './api';

export const getSuppliers = async () => {
  const response = await api.get('/suppliers');
  return (response.data.data.suppliers || []).map((supplier) => ({ ...supplier, id: supplier.id || supplier._id }));
};

export const createSupplier = async (data) => {
  const response = await api.post('/suppliers', data);
  return { ...response.data.data.supplier, id: response.data.data.supplier.id || response.data.data.supplier._id };
};

export const updateSupplier = async (id, data) => {
  const response = await api.put(`/suppliers/${id}`, data);
  return { ...response.data.data.supplier, id: response.data.data.supplier.id || response.data.data.supplier._id };
};

export const deleteSupplier = async (id) => {
  const response = await api.delete(`/suppliers/${id}`);
  return response.data.success;
};
