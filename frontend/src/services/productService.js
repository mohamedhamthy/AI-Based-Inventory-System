import api from "./api";
import { getCategories as fetchCategories } from "./categoryService";
import { getSuppliers as fetchSuppliers } from "./supplierService";
import { getCached, getWorkspaceCacheKey, invalidateCache } from "./queryCache";

export const normalizeProduct = (product) => ({
  ...product,
  id: product?.id || product?._id,
  status: product?.stockStatus || product?.status || "In Stock",
});

export const getProducts = async (params = {}) => {
  const key = `products:${getWorkspaceCacheKey()}:${JSON.stringify({ ...params, limit: params.limit ?? 10 })}`;
  return getCached(key, 5000, async () => {
    const response = await api.get("/products", { params });
    return {
      ...response.data.data,
      products: (response.data.data.products || []).map(normalizeProduct),
    };
  });
};

export const getAllProducts = async ({ includeInactive = false } = {}) => {
  const loadPages = async (params = {}) => {
    const firstPage = await getProducts({ ...params, page: 1, limit: 100 });
    const products = [...firstPage.products];
    for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
      const nextPage = await getProducts({ ...params, page, limit: 100 });
      products.push(...nextPage.products);
    }
    return products;
  };
  const activeProducts = await loadPages();
  if (!includeInactive) return activeProducts;
  const inactiveProducts = await loadPages({ status: "Inactive" });
  return [...activeProducts, ...inactiveProducts];
};

export const getProductById = async (id) => {
  const response = await api.get(`/products/${id}`);
  return normalizeProduct(response.data.data.product);
};

export const createProduct = async (data) => {
  const response = await api.post("/products", data);
  invalidateCache("products:");
  return normalizeProduct(response.data.data.product);
};

export const updateProduct = async (id, data) => {
  const response = await api.put(`/products/${id}`, data);
  invalidateCache("products:");
  return normalizeProduct(response.data.data.product);
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/products/${id}`);
  invalidateCache("products:");
  return response.data.success;
};

export const getCategories = async () => {
  return fetchCategories();
};

export const getSuppliers = async () => {
  return fetchSuppliers();
};
