/**
 * Observations Page.
 */
import { useState, useEffect } from 'react';
import { Search, Plus, Filter } from 'lucide-react';

export default function ObservationsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Observations</h1>
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium">
          <Plus className="w-4 h-4 inline mr-2" />
          New Observation
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search observations..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-white placeholder-slate-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Frequency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="px-4 py-3 text-sm text-slate-500">No observations yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
