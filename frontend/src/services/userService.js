import api from "./api";

export const getUsers = async (params = {}) => {
  const response = await api.get("/users", { params });
  return response.data.data;
};

export const createUser = async (user) => {
  const response = await api.post("/users", user);
  return response.data.data.user;
};

export const updateUser = async (id, changes) => {
  const response = await api.patch(`/users/${id}`, changes);
  return response.data.data.user;
};
