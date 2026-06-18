import { Outlet } from 'react-router-dom';
/**
 * Layout - Sidebar navigation + Login modal.
 */
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import {
  LayoutDashboard,
  Radio,
  Users,
  Map,
  Settings,
  Upload,
  RefreshCw,
  Activity,
  LogOut,
  KeyRound,
  User,
  Lock,
} from 'lucide-react';

export default function Layout() {
  const { user, isAuthenticated, isAdmin, login, logout, isLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(!isAuthenticated);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      await login(username, password);
      setShowLogin(false);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setShowLogin(true);
    setUsername('');
    setPassword('');
  };

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, required: ['VIEWER', 'OPERATOR', 'ADMIN'] },
    { label: 'Observations', path: '/observations', icon: Radio, required: ['VIEWER', 'OPERATOR', 'ADMIN'] },
    { label: 'Map View', path: '/map', icon: Map, required: ['VIEWER', 'OPERATOR', 'ADMIN'] },
    { label: 'Import', path: '/import', icon: Upload, required: ['OPERATOR', 'ADMIN'] },
    { label: 'Users', path: '/users', icon: Users, required: ['ADMIN'] },
    { label: 'Sync', path: '/sync', icon: RefreshCw, required: ['ADMIN', 'OPERATOR'] },
    { label: 'Settings', path: '/settings', icon: Settings, required: ['ADMIN'] },
  ];

  const userCan = (roles: string[]) => {
    return isAuthenticated && roles.includes(user?.role || 'NONE');
  };

  if (showLogin && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Radio className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">RF-SOR</h1>
            <p className="text-white/80 mt-2">RF Spectrum Observation Repository</p>
            <p className="text-white/60 text-sm mt-1">v0.4.2</p>
          </div>
          <div className="p-8">
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder="Enter your username"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {loginError && (
              <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loginLoading || !username || !password}
              className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {loginLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-pulse" />
                  Authenticating...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <KeyRound className="w-5 h-5" />
                  Sign In
                </span>
              )}
            </button>

            <p className="text-xs text-slate-500 mt-4 text-center">
              Default: admin / admin123 (JWT) or Keycloak OIDC
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className={`bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}>
          {/* Brand */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              {sidebarOpen && (
                <div>
                  <h1 className="text-xl font-bold text-cyan-400">RF-SOR</h1>
                  <p className="text-xs text-slate-500">v0.4.2</p>
                </div>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-slate-400 hover:text-white"
              >
                {sidebarOpen ? '◀' : '▶'}
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {menuItems.map(item => (
              userCan(item.required) ? (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-cyan-500 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              ) : null
            ))}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-slate-800">
            {sidebarOpen ? (
              <div className="mb-3">
                <div className="flex items-center gap-2 px-2 mb-2">
                  <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{user?.username}</div>
                    <div className="text-xs text-slate-400">{user?.role}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors ${
                sidebarOpen ? 'px-2 py-2' : 'justify-center px-1'
              }`}
            >
              <LogOut className="w-4 h-4" />
              {sidebarOpen && <span className="text-sm">Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">
                RF Spectrum Observation Repository
              </h2>
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full font-medium">
                {isAuthenticated ? 'Authenticated' : 'Guest'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {isLoading ? (
                <span className="text-slate-400">Loading...</span>
              ) : (
                <span className="text-slate-400">
                  {isAuthenticated ? `${user?.username} (${user?.email})` : 'Not logged in'}
                </span>
              )}
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
