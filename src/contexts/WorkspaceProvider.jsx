import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';
import { createWorkspace as createWorkspaceRequest, getWorkspaces } from '../services/workspaceService';
import WorkspaceContext from './workspaceContext';

const STORAGE_KEY = 'activeWorkspaceId';

export const WorkspaceProvider = ({ children }) => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [error, setError] = useState('');
  const [loadedForUser, setLoadedForUser] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const userId = user?._id || user?.id || null;

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !userId) return undefined;

    let isCurrent = true;
    getWorkspaces()
      .then((availableWorkspaces) => {
        if (!isCurrent) return;
        const preferredId = localStorage.getItem(STORAGE_KEY);
        const selectedWorkspace = availableWorkspaces.find((workspace) => workspace._id === preferredId)
          || availableWorkspaces[0]
          || null;

        setWorkspaces(availableWorkspaces);
        setActiveWorkspace(selectedWorkspace);
        setError('');
        setLoadedForUser(userId);
        if (selectedWorkspace) {
          localStorage.setItem(STORAGE_KEY, selectedWorkspace._id);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch((requestError) => {
        if (!isCurrent) return;
        setError(requestError.message);
        setLoadedForUser(userId);
        toast.error(`Could not load workspaces: ${requestError.message}`);
      });

    return () => {
      isCurrent = false;
    };
  }, [isAuthenticated, isAuthLoading, reloadKey, userId]);

  const loadWorkspaces = useCallback(() => {
    setError('');
    setLoadedForUser(null);
    setReloadKey((key) => key + 1);
  }, []);

  const selectWorkspace = useCallback((workspaceId) => {
    const workspace = workspaces.find((item) => item._id === workspaceId);
    if (!workspace) return;
    localStorage.setItem(STORAGE_KEY, workspace._id);
    window.location.reload();
  }, [workspaces]);

  const createWorkspace = useCallback(async (name) => {
    const workspace = await createWorkspaceRequest(name);
    localStorage.setItem(STORAGE_KEY, workspace._id);
    window.location.reload();
  }, []);

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      isLoading: isAuthLoading || (isAuthenticated && loadedForUser !== userId),
      error,
      loadWorkspaces,
      selectWorkspace,
      createWorkspace,
    }),
    [workspaces, activeWorkspace, isAuthLoading, isAuthenticated, loadedForUser, userId, error, loadWorkspaces, selectWorkspace, createWorkspace],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
