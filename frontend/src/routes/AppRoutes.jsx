import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../utils/permissions';

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
const MarketPricesPage = lazy(() => import('../pages/MarketPricesPage'));
const StockMovementsPage = lazy(() => import('../pages/StockMovementsPage'));
const SalesPage = lazy(() => import('../pages/SalesPage'));
const CustomersPage = lazy(() => import('../pages/CustomersPage'));
const PurchaseOrdersPage = lazy(() => import('../pages/PurchaseOrdersPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const UsersPage = lazy(() => import('../pages/UsersPage'));
const AIAssistantPage = lazy(() => import('../pages/AIAssistantPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PermissionRoute = ({ permission, children }) => {
  const { user } = useAuth();
  return hasPermission(user, permission) ? children : <Navigate to="/dashboard" replace />;
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
          <Route index element={<PermissionRoute permission="dashboard:read"><DashboardPage /></PermissionRoute>} />
          <Route path="dashboard" element={<PermissionRoute permission="dashboard:read"><DashboardPage /></PermissionRoute>} />
          <Route path="inventory" element={<PermissionRoute permission="products:read"><InventoryPage /></PermissionRoute>} />
          <Route path="inventory/add" element={<PermissionRoute permission="products:create"><AddProductPage /></PermissionRoute>} />
          <Route path="inventory/:id" element={<PermissionRoute permission="products:read"><ProductDetailsPage /></PermissionRoute>} />
          <Route path="inventory/:id/edit" element={<PermissionRoute permission="products:update"><EditProductPage /></PermissionRoute>} />
          <Route path="categories" element={<PermissionRoute permission="categories:read"><CategoriesPage /></PermissionRoute>} />
          <Route path="suppliers" element={<PermissionRoute permission="suppliers:read"><SuppliersPage /></PermissionRoute>} />
          <Route path="stock" element={<PermissionRoute permission="stock:read"><StockMovementsPage /></PermissionRoute>} />
          <Route path="sales" element={<PermissionRoute permission="sales:read"><SalesPage /></PermissionRoute>} />
          <Route path="customers" element={<PermissionRoute permission="sales:read"><CustomersPage /></PermissionRoute>} />
          <Route path="purchase-orders" element={<PermissionRoute permission="purchaseOrders:read"><PurchaseOrdersPage /></PermissionRoute>} />
          <Route path="reports" element={<PermissionRoute permission="reports:read"><ReportsPage /></PermissionRoute>} />
          <Route path="users" element={<PermissionRoute permission="users:manage"><UsersPage /></PermissionRoute>} />
          <Route path="forecast" element={<PermissionRoute permission="forecast:read"><ForecastPage /></PermissionRoute>} />
          <Route path="ai-assistant" element={<PermissionRoute permission="ai:use"><AIAssistantPage /></PermissionRoute>} />
          <Route path="market-prices" element={<PermissionRoute permission="marketPrices:read"><MarketPricesPage /></PermissionRoute>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
