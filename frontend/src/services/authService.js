import api from "./api";

export const loginUser = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const loginDemoUser = async () => {
  const response = await api.post("/auth/demo-login");
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data.data;
};

export const logoutUser = async () => {
  await api.post("/auth/logout");
};

export const changePassword = async ({
  currentPassword,
  newPassword,
  confirmPassword,
}) => {
  const response = await api.post("/auth/change-password", {
    currentPassword,
    newPassword,
    confirmPassword,
  });
  return response.data;
};
