/**
 * Sync Page - Real sync status display with backend integration.
 * Shows: sync status, pending uploads/downloads, node status, sync history log, and manual sync controls.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  RotateCw, RefreshCw, CheckCircle, AlertTriangle, Clock, Server,
  ArrowUpCircle, ArrowDownCircle, Plus, Trash2, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiSync, apiHealth } from '../lib/api-client';
import type { SyncStatus, SyncNode } from '../types/api';

type SyncLogEntry = {
  timestamp: string;
  type: 'upload' | 'download' | 'merge' | 'error';
  message: string;
  details?: string;
};

export default function SyncPage() {
  const [syncState, setSyncState] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState<'up' | 'down' | 'both' | null>(null);
  const [nodes, setNodes] = useState<SyncNode[]>([]);
  const [logs, setLogs] = useState<SyncLogEntry[]>([
    { timestamp: new Date(Date.now() - 86400000).toISOString(), type: 'info', message: 'Sync initialized' },
  ]);
  const [showLog, setShowLog] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiSync.getStatus();
      setSyncState(data);
      setNodes(data.nodes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await apiSync.triggerSync(syncDirection || undefined);

      const entry: SyncLogEntry = {
        timestamp: new Date().toISOString(),
        type: 'upload',
        message: result.status,
        details: `Sync completed: ${result.status}`,
      };

      setLogs(prev => [entry, ...prev]);
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Sync failed');
      setLogs(prev => [{
        timestamp: new Date().toISOString(),
        type: 'error',
        message: 'Sync failed',
        details: err.message,
      }, ...prev]);
    } finally {
      setSyncing(false);
    }
  };

  const addNode = () => {
    const nodeId = `node-${Date.now()}`;
    const newNode: SyncNode = {
      node_id: nodeId,
      last_seen: new Date().toISOString(),
      status: 'pending',
      pending_uploads: 0,
      pending_downloads: 0,
    };
    setNodes(prev => [...prev, newNode]);
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      type: 'info',
      message: `Node ${nodeId} added`,
    }, ...prev]);
  };

  const removeNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.node_id !== nodeId));
    setLogs(prev => [{
      timestamp: new Date().toISOString(),
      type: 'info',
      message: `Node ${nodeId} removed`,
    }, ...prev]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-emerald-400';
      case 'synced': return 'text-blue-400';
      case 'pending': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getLogTypeIcon = (type: string) => {
    switch (type) {
      case 'upload': return <ArrowUpCircle className="w-4 h-4" />;
      case 'download': return <ArrowDownCircle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'starting': return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sync</h1>
          <p className="text-slate-400 mt-1">Manage synchronization between field nodes and the central database.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={addNode}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-sm border border-slate-700"
          >
            <Plus className="w-4 h-4" /> Add Node
          </button>
          <div className="flex items-center gap-2">
            <select
              value={syncDirection || 'both'}
              onChange={e => setSyncDirection(e.target.value as any)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white text-sm"
            >
              <option value="both">↕ Both Ways</option>
              <option value="up">↑ Upload to Core</option>
              <option value="down">↓ Download from Core</option>
            </select>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
            >
              {syncing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" /> Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Sync Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sync Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Overall Status */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            {loading ? (
              <RotateCw className="w-6 h-6 text-cyan-400 animate-spin" />
            ) : getStatusIcon(syncState?.last_sync_status || 'unknown')}
            <div>
              <h3 className="text-lg font-semibold text-white">Sync Status</h3>
              <p className="text-sm text-slate-400">
                {syncState?.last_sync_at
                  ? new Date(syncState.last_sync_at).toLocaleString()
                  : 'No sync yet'}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Last Status:</span>
              <span className={`${getStatusColor(syncState?.last_sync_status || '')} font-medium`}>
                {syncState?.last_sync_status || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Sync:</span>
              <span className="text-white font-medium">
                {syncState?.last_sync_at ? new Date(syncState.last_sync_at).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Uploads */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <ArrowUpCircle className="w-6 h-6 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Pending Uploads</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Count:</span>
              <span className="text-white font-medium">{syncState?.pending_uploads || 0}</span>
            </div>
            {syncState?.pending_uploads && syncState.pending_uploads > 0 ? (
              <div className="text-xs text-yellow-400 bg-yellow-400/10 p-2 rounded">
                {syncState.pending_uploads} observation(s) ready to upload
              </div>
            ) : (
              <div className="text-xs text-emerald-400 bg-emerald-400/10 p-2 rounded">
                All observations uploaded
              </div>
            )}
          </div>
        </div>

        {/* Pending Downloads */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <ArrowDownCircle className="w-6 h-6 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Pending Downloads</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Count:</span>
              <span className="text-white font-medium">{syncState?.pending_downloads || 0}</span>
            </div>
            {syncState?.pending_downloads && syncState.pending_downloads > 0 ? (
              <div className="text-xs text-blue-400 bg-blue-400/10 p-2 rounded">
                {syncState.pending_downloads} update(s) from core
              </div>
            ) : (
              <div className="text-xs text-emerald-400 bg-emerald-400/10 p-2 rounded">
                All updates applied
              </div>
            )}
          </div>
        </div>

        {/* Nodes */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-6 h-6 text-violet-400" />
            <h3 className="text-lg font-semibold text-white">Nodes</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total:</span>
              <span className="text-white font-medium">{nodes.length}</span>
            </div>
            {nodes.length > 0 && nodes.map(node => (
              <div key={node.node_id} className="flex items-center justify-between text-xs bg-slate-800 px-2 py-1 rounded">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(node.status)}`}></div>
                  <span className="text-white">{node.node_id}</span>
                </div>
                <span className={getStatusColor(node.status)}>{node.status}</span>
                <button onClick={() => removeNode(node.node_id)} className="text-slate-500 hover:text-red-400 ml-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sync Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Sync Log</h2>
            <span className="text-sm text-slate-400">({logs.length} entries)</span>
          </div>
          {showLog ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {showLog && (
          <div className="border-t border-slate-800">
            <div className="max-h-60 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No sync logs yet.</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <div className={`flex-shrink-0 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'upload' ? 'text-cyan-400' :
                      log.type === 'download' ? 'text-emerald-400' :
                      'text-slate-400'
                    }`}>
                      {getLogTypeIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{log.message}</p>
                      {log.details && <p className="text-xs text-slate-400 mt-1">{log.details}</p>}
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
