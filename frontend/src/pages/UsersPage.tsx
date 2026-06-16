/**
 * Users Page — full CRUD with modal dialogs.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { apiUsers, apiAuth } from '../lib/api-client';
import type { User } from '../types/api';

type ModalMode = 'create' | 'edit' | null;

interface UserFormData {
  userId?: string;
  username: string;
  email: string;
  password: string;
  role: 'VIEWER' | 'TECHNICIAN' | 'LEAD' | 'ADMIN';
}

const ROLES: UserFormData['role'][] = ['VIEWER', 'TECHNICIAN', 'LEAD', 'ADMIN'];

const emptyForm = (): UserFormData => ({
  username: '',
  email: '',
  password: '',
  role: 'VIEWER',
});

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiUsers.list();
      setUsers(Array.isArray(result) ? result : []);
    } catch (err: any) {
      // Check if it's an auth error (422 missing token)
      const isAuthError = err.message && err.message.includes('missing');
      setError(isAuthError ? 'Authentication required. Please log in.' : `Failed to load users: ${err.message}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setToast({ msg, ok: true });
  };
  const showError = (msg: string) => {
    setError(msg);
    setToast({ msg, ok: false });
  };

  // Create
  const handleCreate = async () => {
    if (!formData.username.trim() || !formData.email.trim()) {
      showError('Username and email are required.');
      return;
    }
    if (!formData.password) {
      showError('Password is required.');
      return;
    }
    if (formData.password.length < 8) {
      showError('Password must be at least 8 characters.');
      return;
    }
    try {
      const created = await apiUsers.create({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      showSuccess(`User "${created.username}" created successfully.`);
      setModalMode(null);
      setFormData(emptyForm());
      loadUsers();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Update
  const handleUpdate = async (id: string) => {
    try {
      const updated = await apiUsers.update(id, {
        username: formData.username,
        email: formData.email,
        password: formData.password || undefined,
        role: formData.role,
      });
      showSuccess(`User "${updated.username}" updated.`);
      setModalMode(null);
      setFormData(emptyForm());
      loadUsers();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Delete
  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    try {
      await apiUsers.delete(user.id);
      showSuccess(`User "${user.username}" deleted.`);
      loadUsers();
    } catch (err: any) {
      showError(`Delete failed: ${err.message}`);
    }
  };

  // Open modal
  const openCreate = () => {
    setModalMode('create');
    setFormData(emptyForm());
  };
  const openEdit = (user: User) => {
    setModalMode('edit');
    setFormData({
      userId: user.id,
      username: user.username,
      email: user.email,
      password: '', // always leave blank for edit (optional)
      role: user.role as UserFormData['role'],
    });
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const isEditing = modalMode === 'edit';

  const handleSubmit = async () => {
    if (isEditing && formData.userId) {
      await handleUpdate(formData.userId);
    } else {
      await handleCreate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <button
          onClick={openCreate}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="text-slate-400 text-sm">Loading users...</div>
          </div>
        ) : users.length === 0 && !loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">No users found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-sm">No matching users.</td></tr>
              ) : (
                filtered.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-white">{user.username}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        user.role === 'ADMIN' ? 'bg-red-900/50 text-red-300' :
                        user.role === 'LEAD' ? 'bg-orange-900/50 text-orange-300' :
                        user.role === 'TECHNICIAN' ? 'bg-cyan-900/50 text-cyan-300' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-6 relative">
            {/* Close button */}
            <button
              onClick={() => { setModalMode(null); setFormData(emptyForm()); }}
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">
              {isEditing ? 'Edit User' : 'Create User'}
            </h2>

            <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData(f => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder="username"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{isEditing ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  placeholder={isEditing ? '••••••••' : '••••••••'}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData(f => ({ ...f, role: e.target.value as UserFormData['role'] }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500 appearance-none"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Note about privileged roles */}
              {!isEditing && formData.role !== 'VIEWER' && formData.role !== 'TECHNICIAN' && (
                <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-3 py-2 rounded text-xs">
                  Note: Privileged roles require admin approval. Auto-grant disabled.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalMode(null); setFormData(emptyForm()); }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-sm font-medium border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  {isEditing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
