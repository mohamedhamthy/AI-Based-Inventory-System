import api from './api';

export const getCategories = async () => {
  const response = await api.get('/categories');
  return (response.data.data.categories || []).map((category) => ({ ...category, id: category.id || category._id }));
};

export const createCategory = async (data) => {
  const response = await api.post('/categories', data);
  return { ...response.data.data.category, id: response.data.data.category.id || response.data.data.category._id };
};

export const updateCategory = async (id, data) => {
  const response = await api.put(`/categories/${id}`, data);
  return { ...response.data.data.category, id: response.data.data.category.id || response.data.data.category._id };
};

export const deleteCategory = async (id) => {
  const response = await api.delete(`/categories/${id}`);
  return response.data.success;
};
