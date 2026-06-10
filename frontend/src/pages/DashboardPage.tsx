/**
 * Dashboard Page.
 */
import { useState, useEffect } from 'react';
import { Activity, Users, Radio, Map } from 'lucide-react';

export default function DashboardPage() {
  const [stats] = useState({
    totalObservations: 0,
    activeUsers: 0,
    regionsCount: 0,
    systemStatus: 'Starting...',
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">RF Spectrum Observation Repository</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Observations', value: stats.totalObservations, icon: Radio, color: 'text-cyan-400' },
          { label: 'Active Users', value: stats.activeUsers, icon: Users, color: 'text-emerald-400' },
          { label: 'Regions', value: stats.regionsCount, icon: Map, color: 'text-violet-400' },
          { label: 'System Status', value: stats.systemStatus, icon: Activity, color: 'text-rose-400' },
        ].map(card => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-slate-400 text-sm">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <p className="text-slate-500">No recent activity to display.</p>
      </div>
    </div>
  );
}
