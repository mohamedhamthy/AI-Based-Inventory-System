import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import InventoryPage from '../pages/inventory/InventoryPage';
import AddProductPage from '../pages/inventory/AddProductPage';
import EditProductPage from '../pages/inventory/EditProductPage';
import ProductDetailsPage from '../pages/inventory/ProductDetailsPage';
import CategoriesPage from '../pages/CategoriesPage';
import SuppliersPage from '../pages/SuppliersPage';
import ForecastPage from '../pages/ForecastPage';
import NotFoundPage from '../pages/NotFoundPage';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/add" element={<AddProductPage />} />
        <Route path="inventory/:id" element={<ProductDetailsPage />} />
        <Route path="inventory/:id/edit" element={<EditProductPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="forecast" element={<ForecastPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRoutes;
