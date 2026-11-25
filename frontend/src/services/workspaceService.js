import api from './api';

export const getWorkspaces = async () => {
  const response = await api.get('/workspaces');
  return response.data.data.workspaces;
};
