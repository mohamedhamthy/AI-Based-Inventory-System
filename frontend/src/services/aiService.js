import api from "./api";

export const getDemandInsights = async () => {
  const response = await api.get("/ai/demand");
  return response.data.data;
};

export const askInventoryAssistant = async (question) => {
  const response = await api.get("/ai/assistant", { params: { q: question } });
  return response.data.data;
};
