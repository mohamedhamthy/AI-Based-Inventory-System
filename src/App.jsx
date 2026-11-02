import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceProvider';
import AppRoutes from './routes/AppRoutes';
import 'react-toastify/dist/ReactToastify.css';
import './styles/globals.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <WorkspaceProvider>
          <AppRoutes />
          <ToastContainer position="top-right" theme="dark" />
        </WorkspaceProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
