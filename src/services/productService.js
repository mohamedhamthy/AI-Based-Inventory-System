import api from './api';
import { getCategories as fetchCategories } from './categoryService';
import { getSuppliers as fetchSuppliers } from './supplierService';

export const getDashboardOverview = async () => {
  const response = await api.get('/dashboard/overview');
  return response.data.data;
};

const normalizeProduct = (product) => ({
  ...product,
  id: product?.id || product?._id,
  status: product?.stockStatus || product?.status || 'In Stock',
});

export const getProducts = async (params = {}) => {
  const response = await api.get('/products', { params });
  return {
    ...response.data.data,
    products: (response.data.data.products || []).map(normalizeProduct),
  };
};

export const getProductById = async (id) => {
  const response = await api.get(`/products/${id}`);
  return normalizeProduct(response.data.data.product);
};

export const createProduct = async (data) => {
  const response = await api.post('/products', data);
  return normalizeProduct(response.data.data.product);
};

export const updateProduct = async (id, data) => {
  const response = await api.put(`/products/${id}`, data);
  return normalizeProduct(response.data.data.product);
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/products/${id}`);
  return response.data.success;
};

export const getCategories = async () => fetchCategories();

export const getSuppliers = async () => fetchSuppliers();
