import { Outlet, Link, NavLink } from 'react-router-dom';
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
} from 'lucide-react';

export default function Layout() {
  const menuItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Observations', path: '/observations', icon: Radio },
    { label: 'Map View', path: '/map', icon: Map },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Sync', path: '/sync', icon: RotateCw },
    { label: 'Import', path: '/import', icon: Upload },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h1 className="text-xl font-bold text-cyan-400">RF-SOR</h1>
            <p className="text-xs text-slate-500">v0.3.0</p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {menuItems.map(item => (
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
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-800">
            <div className="items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-500 hover:text-white">
              <LogOut className="w-4 h-4" />
              Logout
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="border-b border-slate-800 p-4">
            <Outlet />
          </div>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
