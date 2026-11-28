import api from "./api";
import { getCached, getWorkspaceCacheKey, invalidateCache } from "./queryCache";

export const getSuppliers = async ({ includeInactive = false } = {}) => {
  return getCached(
    `suppliers:${getWorkspaceCacheKey()}:${includeInactive}`,
    30000,
    async () => {
      const params = includeInactive
        ? { active: false, page: 1, limit: 100 }
        : {};
      const firstPage = await api.get("/suppliers", { params });
      const suppliers = [...(firstPage.data.data.suppliers || [])];
      const totalPages = firstPage.data.data.pagination?.totalPages || 1;
      for (let page = 2; page <= totalPages; page += 1) {
        const response = await api.get("/suppliers", {
          params: { ...params, page },
        });
        suppliers.push(...(response.data.data.suppliers || []));
      }
      return suppliers.map((supplier) => ({
        ...supplier,
        id: supplier.id || supplier._id,
      }));
    },
  );
};

export const createSupplier = async (data) => {
  const response = await api.post("/suppliers", data);
  invalidateCache("suppliers:", "products:");
  return {
    ...response.data.data.supplier,
    id: response.data.data.supplier.id || response.data.data.supplier._id,
  };
};

export const updateSupplier = async (id, data) => {
  const response = await api.put(`/suppliers/${id}`, data);
  invalidateCache("suppliers:", "products:");
  return {
    ...response.data.data.supplier,
    id: response.data.data.supplier.id || response.data.data.supplier._id,
  };
};

export const deleteSupplier = async (id) => {
  const response = await api.delete(`/suppliers/${id}`);
  invalidateCache("suppliers:", "products:");
  return response.data.success;
};
