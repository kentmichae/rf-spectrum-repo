/**
 * Settings Page.
 */
import { Settings as SettingsIcon, Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Configure application settings and integrations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">General</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400">API Endpoint</label>
              <input
                type="text"
                defaultValue="http://localhost:8000"
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
              />
            </div>
            <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium">
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Auth (Keycloak)</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400">Keycloak URL</label>
              <input
                type="text"
                placeholder="http://keycloak:8080"
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">Realm</label>
              <input
                type="text"
                defaultValue="rf-sor"
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
