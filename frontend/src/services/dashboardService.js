import api from "./api";

export const getDashboardOverview = async () => {
  const response = await api.get("/dashboard/overview");
  return response.data.data;
};

export const getLowStockAlerts = async () => {
  const response = await api.get("/dashboard/alerts");
  return response.data.data;
};
