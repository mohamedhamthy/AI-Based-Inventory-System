import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = lazy(() => import('../components/layout/MainLayout'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const InventoryPage = lazy(() => import('../pages/inventory/InventoryPage'));
const AddProductPage = lazy(() => import('../pages/inventory/AddProductPage'));
const EditProductPage = lazy(() => import('../pages/inventory/EditProductPage'));
const ProductDetailsPage = lazy(() => import('../pages/inventory/ProductDetailsPage'));
const CategoriesPage = lazy(() => import('../pages/CategoriesPage'));
const SuppliersPage = lazy(() => import('../pages/SuppliersPage'));
const ForecastPage = lazy(() => import('../pages/ForecastPage'));
const StockMovementsPage = lazy(() => import('../pages/StockMovementsPage'));
const SalesPage = lazy(() => import('../pages/SalesPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<div role="status" className="grid min-h-[40vh] place-items-center text-sm text-slate-400">Loading page...</div>}>
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
          <Route path="stock" element={<StockMovementsPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="forecast" element={<ForecastPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
