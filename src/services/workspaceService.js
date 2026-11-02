import api from './api';

export const getWorkspaces = async () => {
  const response = await api.get('/workspaces');
  return response.data.data.workspaces;
};

export const createWorkspace = async (name) => {
  const response = await api.post('/workspaces', { name });
  return response.data.data.workspace;
};
