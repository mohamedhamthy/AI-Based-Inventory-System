import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getCurrentUser, loginUser, logoutUser } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const response = await loginUser(credentials.email, credentials.password);
    localStorage.setItem('token', response.token);
    setUser(response.data.user);
    setIsAuthenticated(true);
    toast.success('Login successful');
    return response;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      // ignore logout errors and clear local state
    }
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = useMemo(() => ({ user, isAuthenticated, isLoading, login, logout }), [user, isAuthenticated, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
