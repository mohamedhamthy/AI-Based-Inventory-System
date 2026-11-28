import api from "./api";
import { getCached, getWorkspaceCacheKey, invalidateCache } from "./queryCache";

export const getCategories = async ({ includeInactive = false } = {}) => {
  return getCached(
    `categories:${getWorkspaceCacheKey()}:${includeInactive}`,
    30000,
    async () => {
      const response = await api.get("/categories", {
        params: includeInactive ? { active: false } : {},
      });
      return (response.data.data.categories || []).map((category) => ({
        ...category,
        id: category.id || category._id,
      }));
    },
  );
};

export const createCategory = async (data) => {
  const response = await api.post("/categories", data);
  invalidateCache("categories:", "products:");
  return {
    ...response.data.data.category,
    id: response.data.data.category.id || response.data.data.category._id,
  };
};

export const updateCategory = async (id, data) => {
  const response = await api.put(`/categories/${id}`, data);
  invalidateCache("categories:", "products:");
  return {
    ...response.data.data.category,
    id: response.data.data.category.id || response.data.data.category._id,
  };
};

export const deleteCategory = async (id) => {
  const response = await api.delete(`/categories/${id}`);
  invalidateCache("categories:", "products:");
  return response.data.success;
};
