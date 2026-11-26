import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getCurrentUser, loginDemoUser, loginUser, logoutUser } from '../services/authService';
import { setCsrfToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      localStorage.removeItem('token');

      try {
        const session = await getCurrentUser();
        setCsrfToken(session.csrfToken);
        setUser(session.user);
        setIsAuthenticated(true);
      } catch {
        setCsrfToken(null);
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
    setCsrfToken(response.data.csrfToken);
    setUser(response.data.user);
    setIsAuthenticated(true);
    toast.success('Login successful');
    return response;
  };

  const loginDemo = async () => {
    const response = await loginDemoUser();
    setCsrfToken(response.data.csrfToken);
    setUser(response.data.user);
    setIsAuthenticated(true);
    toast.success('Entered read-only demo mode');
    return response;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      toast.error(`Could not confirm server logout: ${error.message}`);
    } finally {
      setCsrfToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = useMemo(
    () => ({ user, isAuthenticated, isLoading, login, loginDemo, logout }),
    [user, isAuthenticated, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
