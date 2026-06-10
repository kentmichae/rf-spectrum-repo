import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ObservationsPage from './pages/ObservationsPage';
import MapPage from './pages/MapPage';
import UsersPage from './pages/UsersPage';
import SyncPage from './pages/SyncPage';
import ImportPage from './pages/ImportPage';
import SettingsPage from './pages/SettingsPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'observations', element: <ObservationsPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'sync', element: <SyncPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export default router;
