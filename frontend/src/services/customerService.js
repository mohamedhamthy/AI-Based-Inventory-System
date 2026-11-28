import api from "./api";

export const getCustomers = async (params = {}) => {
  const response = await api.get("/customers", { params });
  return response.data.data;
};

export const createCustomer = async (data) => {
  const response = await api.post("/customers", data);
  return response.data.data.customer;
};
