/**
 * Sync Page.
 */
import { useState } from 'react';
import { RotateCw, RefreshCw } from 'lucide-react';

export default function SyncPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sync</h1>
          <p className="text-slate-400 mt-1">Manage synchronization with field nodes.</p>
        </div>
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Sync Now
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <RotateCw className="w-6 h-6 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Sync Status</h2>
        </div>
        <p className="text-slate-500">No pending sync requests.</p>
      </div>
    </div>
  );
}
