/**
 * Settings Page - Configurable with real save (persisted to localStorage).
 * Includes API endpoint, Keycloak OIDC integration, and local auth mode toggle.
 */
import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Save, Check } from 'lucide-react';
import { apiSettings } from '../lib/api-client';
import type { AppSettings } from '../types/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    api_endpoint: '',
    keycloak_url: '',
    keycloak_realm: 'rf-sor',
  });
  const [client_id, setClientId] = useState('rf-sor-client');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const current = apiSettings.getPersisted();
    setSettings(current);
    setClientId(current.keycloak_url.includes('keycloak') ? 'rf-sor-client' : '');
    setLoading(false);
  }, []);

  const handleSave = async () => {
    await apiSettings.update({
      api_endpoint: settings.api_endpoint,
      keycloak_url: settings.keycloak_url,
      keycloak_realm: settings.keycloak_realm,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Configure application settings and integrations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">General</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">API Endpoint</label>
              <input
                type="text"
                value={settings.api_endpoint}
                onChange={e => setSettings({ ...settings, api_endpoint: e.target.value })}
                placeholder="http://localhost:8000"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm"
              />
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        {/* Keycloak Auth Settings */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Auth (Keycloak)</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Keycloak URL</label>
              <input
                type="text"
                value={settings.keycloak_url}
                onChange={e => setSettings({ ...settings, keycloak_url: e.target.value })}
                placeholder="http://keycloak:8080"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Realm</label>
              <input
                type="text"
                value={settings.keycloak_realm}
                onChange={e => setSettings({ ...settings, keycloak_realm: e.target.value })}
                defaultValue="rf-sor"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Client ID</label>
              <input
                type="text"
                value={client_id}
                onChange={e => setClientId(e.target.value)}
                placeholder="rf-sor-client"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm"
              />
            </div>
            <div className="text-xs text-slate-400">
              <p>When Keycloak URL is provided, authentication will use OIDC Password Grant flow. Otherwise, local JWT auth is used.</p>
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                saved ? 'bg-emerald-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <SettingsIcon className="w-6 h-6 text-rose-400" />
          <h2 className="text-lg font-semibold text-white">Security</h2>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">CORS Configuration</h3>
            <p className="text-xs text-slate-400 mt-1">
              Origin is set in <code className="text-cyan-400">backend/app/cors_config.py</code>. Update to production URLs.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Secret Key</h3>
            <p className="text-xs text-slate-400 mt-1">
              JWT secret key is in <code className="text-cyan-400">backend/app/config.py</code> → <code className="text-cyan-400">API_SECRET_KEY</code>. Set production value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
