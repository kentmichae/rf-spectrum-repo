/**
 * Observations Page - Full CRUD with API-bound table.
 * Supports: frequency ranges, bandwidth, modulation, classification, coordinator/technician, timestamp.
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Filter, Edit, Trash2, Save, X, RotateCw } from 'lucide-react';
import { apiObservations, apiUsers, apiHealth } from '../lib/api-client';
import type { Observation, ObservationCreatePayload, ObservationUpdatePayload, User } from '../types/api';

// Classification options
const CLASSIFICATIONS = ['UNCLASSIFIED', 'CONFIDENTIAL', 'CLASSIFIED', 'UNCERTAIN'] as const;
type Classification = typeof CLASSIFICATIONS[number];

export default function ObservationsPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Editor state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<ObservationCreatePayload>({
    timestamp: new Date().toISOString().slice(0, 19),
    frequency_start: 0,
    frequency_end: 0,
    bandwidth: null,
    modulation_type: null,
    signal_strength: null,
    classification_status: 'UNCERTAIN',
    notes: null,
    equipment_id: null,
    technician_id: null,
    location_wkt: '0 0',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // User list for technician selector
  const [users, setUsers] = useState<User[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load observations
  const loadObservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof apiObservations.list>[0] = {
        page_size: pageSize,
        page_num: page,
      };
      if (classificationFilter) params.classification = classificationFilter;
      // Search text filter
      if (search.trim()) {
        // Try parsing as number for frequency-based search
        const num = Number(search.trim());
        if (isNaN(num)) {
          params.freq_min = 0;
          params.freq_max = 999999999;
        } else {
          params.freq_min = num - 1000;
          params.freq_max = num + 1000;
        }
      }
      const data = await apiObservations.list(params);
      setObservations(data.data);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load observations');
      setObservations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, classificationFilter, search]);

  useEffect(() => {
    // Debounced search
    const timer = setTimeout(loadObservations, 400);
    return () => clearTimeout(timer);
  }, [loadObservations]);

  // Load users for technician selector
  useEffect(() => {
    apiUsers.list()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      timestamp: new Date().toISOString().slice(0, 19),
      frequency_start: 0,
      frequency_end: 0,
      bandwidth: null,
      modulation_type: null,
      signal_strength: null,
      classification_status: 'UNCERTAIN',
      notes: null,
      equipment_id: null,
      technician_id: null,
      location_wkt: '0 0',
    });
    setEditingId(null);
    setFormError(null);
    setShowForm(false);
    setCreating(false);
  };

  // Open editor for new
  const startCreate = () => {
    resetForm();
    setCreating(true);
    setShowForm(true);
  };

  // Open editor for edit
  const startEdit = (obs: Observation) => {
    resetForm();
    setEditingId(obs.id);
    setCreating(false);
    setFormData({
      timestamp: obs.timestamp,
      frequency_start: obs.frequency_start,
      frequency_end: obs.frequency_end,
      bandwidth: obs.bandwidth,
      modulation_type: obs.modulation_type,
      signal_strength: obs.signal_strength,
      classification_status: obs.classification_status,
      notes: obs.notes,
      equipment_id: obs.equipment_id,
      technician_id: obs.technician_id,
      location_wkt: obs.location_wkt || '0 0',
    });
    setShowForm(true);
  };

  // Submit form
  const handleSubmit = async () => {
    setFormError(null);

    // Validation
    if (formData.frequency_start >= formData.frequency_end) {
      setFormError('frequency_start must be less than frequency_end');
      return;
    }

    const locationParts = formData.location_wkt.trim().split(/\s+/);
    if (locationParts.length < 2) {
      setFormError('location_wkt must be "lng lat" format (e.g., "51.505 -0.09")');
      return;
    }

    try {
      if (creating && editingId === null) {
        const created = await apiObservations.create(formData);
        setObservations(prev => [created, ...prev]);
        setTotal(prev => prev + 1);
        resetForm();
        setShowForm(false);
      } else {
        if (editingId === null) return;
        const updatePayload: Record<string, any> = { ...formData };
        Object.keys(updatePayload).forEach(key => {
          if (updatePayload[key] === null || updatePayload[key] === undefined) {
            delete updatePayload[key];
          }
        });
        const updated = await apiObservations.update(editingId, updatePayload as ObservationUpdatePayload);
        setObservations(prev =>
          prev.map(o => o.id === editingId ? updated : o)
        );
        resetForm();
        setShowForm(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save observation');
    }
  };

  // Delete observation
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this observation?')) return;
    try {
      await apiObservations.delete(id);
      setObservations(prev => prev.filter(o => o.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  // Page navigation
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  // Count by classification
  const classCounts = observations.reduce<Record<string, number>>((acc, obs) => {
    acc[obs.classification_status] = (acc[obs.classification_status] || 0) + 1;
    return acc;
  }, {});
  const totalByClass = observations.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Signal Record Management</h1>
          <p className="text-slate-400 mt-1">
            {loading ? 'Loading...' : `${total} observations · Page ${page} of ${totalPages}`}
          </p>
        </div>
        <button
          onClick={startCreate}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Observation
        </button>
      </div>

      {/* Error messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => loadObservations()} className="text-red-400 hover:text-red-300">
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by frequency or status..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-white placeholder-slate-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-md text-sm transition-colors ${
            showFilters || classificationFilter
              ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-400'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg space-y-4">
          <h3 className="text-sm font-semibold text-white">Classification Filters</h3>
          <div className="flex flex-wrap gap-2">
            {CLASSIFICATIONS.map(cls => (
              <button
                key={cls}
                onClick={() => {
                  setClassificationFilter(classificationFilter === cls ? null : cls);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  classificationFilter === cls
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {cls}
                {classCounts[cls] && (
                  <span className="ml-1 opacity-60">({classCounts[cls]})</span>
                )}
              </button>
            ))}
          </div>
          {classificationFilter && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-400">
                Showing <strong className="text-white">{classCounts[classificationFilter] || 0}</strong> of {total}
              </span>
              <button
                onClick={() => setClassificationFilter(null)}
                className="text-cyan-400 hover:text-cyan-300"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editor Form */}
      {showForm && (
        <div className="p-4 border border-cyan-500/30 rounded-lg bg-slate-900/50 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {creating ? 'New Observation' : `Edit Observation #${editingId}`}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Timestamp */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Timestamp (ISO)</label>
              <input
                type="datetime-local"
                defaultValue={formData.timestamp.slice(0, 16)}
                onChange={e => setFormData({ ...formData, timestamp: e.target.value + 'Z' })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              />
            </div>

            {/* Frequency Start */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Frequency Start (MHz)</label>
              <input
                type="number"
                step="0.001"
                value={formData.frequency_start}
                onChange={e => setFormData({ ...formData, frequency_start: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              />
            </div>

            {/* Frequency End */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Frequency End (MHz)</label>
              <input
                type="number"
                step="0.001"
                value={formData.frequency_end}
                onChange={e => setFormData({ ...formData, frequency_end: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              />
            </div>

            {/* Bandwidth */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bandwidth (MHz)</label>
              <input
                type="number"
                step="0.001"
                value={formData.bandwidth || ''}
                onChange={e => setFormData({ ...formData, bandwidth: parseFloat(e.target.value) || null })}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm placeholder-slate-500"
              />
            </div>

            {/* Modulation Type */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Modulation Type</label>
              <select
                value={formData.modulation_type || ''}
                onChange={e => setFormData({ ...formData, modulation_type: e.target.value || null })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              >
                <option value="">None</option>
                <option value="AM">AM (Amplitude Modulation)</option>
                <option value="FM">FM (Frequency Modulation)</option>
                <option value="SSB">SSB (Single Sideband)</option>
                <option value="ASK">ASK (Amplitude Shift Keying)</option>
                <option value="FSK">FSK (Frequency Shift Keying)</option>
                <option value="PSK">PSK (Phase Shift Keying)</option>
                <option value="QAM">QAM (Quadrature AM)</option>
                <option value="OFDM">OFDM</option>
                <option value="CW">CW (Continuous Wave)</option>
              </select>
            </div>

            {/* Signal Strength */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Signal Strength (dBm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.signal_strength || ''}
                onChange={e => setFormData({ ...formData, signal_strength: parseFloat(e.target.value) || null })}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm placeholder-slate-500"
              />
            </div>

            {/* Classification */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Classification</label>
              <select
                value={formData.classification_status}
                onChange={e => setFormData({ ...formData, classification_status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              >
                {CLASSIFICATIONS.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Location (lat/lng stored as WKT) */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Location (Lat, Lng) <span className="text-slate-500">e.g. 51.505, -0.09</span>
              </label>
              <input
                type="text"
                value={formData.location_wkt.includes(' ')
                  ? formData.location_wkt
                  : (formData.location_wkt || '0 0').split(' ').reverse().join(', ')}
                onChange={e => {
                  const parts = e.target.value.replace(/\s+/g, ' ').split(',').map(s => s.trim());
                  const wkt = parts.length >= 2
                    ? `${parts[1]} ${parts[0]}` // SWAP to lng lat for WKT
                    : '0 0';
                  setFormData({ ...formData, location_wkt: wkt });
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                placeholder="Lat, Lng"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value || null })}
                rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {creating ? 'Create' : 'Update'}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-md text-sm border border-slate-700"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Observations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Freq Range</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Bandwidth</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Modulation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Strength</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Classification</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Timestamp</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500"><RotateCw className="w-6 h-6 inline mr-2 animate-spin"/>Loading...</td></tr>
            ) : observations.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No observations. Click "New Observation" to create one.</td></tr>
            ) : (
              observations.map(obs => (
                <tr key={obs.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-cyan-400 font-mono">#{obs.id}</td>
                  <td className="px-4 py-3 text-sm text-cyan-400">
                    {obs.frequency_start.toFixed(3)}–{obs.frequency_end.toFixed(3)} MHz
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {obs.bandwidth != null ? `${obs.bandwidth.toFixed(3)} MHz` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {obs.modulation_type || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {obs.signal_strength != null ? `${obs.signal_strength.toFixed(1)} dBm` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      obs.classification_status === 'CLASSIFIED' ? 'bg-red-500/20 text-red-400' :
                      obs.classification_status === 'CONFIDENTIAL' ? 'bg-yellow-500/20 text-yellow-400' :
                      obs.classification_status === 'UNCLASSIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {obs.classification_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 text-xs">
                    {new Date(obs.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(obs)}
                        className="text-slate-400 hover:text-cyan-400 transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(obs.id)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800">
            <p className="text-sm text-slate-400">{total} total observations</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={!canGoPrev}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-400 disabled:opacity-30 hover:bg-slate-700 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-sm text-slate-400">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={!canGoNext}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-400 disabled:opacity-30 hover:bg-slate-700 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
