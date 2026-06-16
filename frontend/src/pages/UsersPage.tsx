/**
 * Users Page — full CRUD with Add User modal.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import { apiUsers } from '../lib/api-client';
import type { User } from '../types/api';

const ROLES = ['VIEWER', 'TECHNICIAN', 'LEAD', 'ADMIN'] as const;

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !email.trim() || !password) return;
      setLoading(true);
      setErrorMsg('');
      setSuccess(false);
      try {
        await apiUsers.create({
          username: username.trim(),
          email: email.trim(),
          password,
          role,
        });
        setSuccess(true);
        setTimeout(() => {
          onCreated();
          onClose();
        }, 800);
        return;
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to create user');
        return;
      } finally {
        setLoading(false);
      }
    },
    [username, email, password, role, onClose, onCreated]
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Add User</h2>

        {success && (
          <div className="bg-green-900/30 border border-green-700 text-green-400 px-4 py-2 rounded-md text-sm mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            User created successfully
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-2 rounded-md text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-md"
              placeholder="Enter username"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-md"
              placeholder="Enter email"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-md"
              placeholder="Enter password"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-md"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white py-2 rounded-md text-sm font-medium"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserRow({ user, onDelete }: { user: User; onDelete: (id: string) => void }) {
  const roleColor: Record<string, string> = {
    VIEWER: 'text-slate-400',
    TECHNICIAN: 'text-cyan-400',
    LEAD: 'text-green-400',
    ADMIN: 'text-red-400 font-bold',
  };

  const isAdmin = user.role === 'ADMIN';

  return (
    <tr className="hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3 text-sm text-white">{user.username}</td>
      <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
      <td className={`px-4 py-3 text-sm ${roleColor[user.role] || 'text-slate-300'}`}>{user.role}</td>
      <td className="px-4 py-3 text-sm">
        <span className="text-slate-500">
          {new Date(user.created_at).toLocaleString()}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        {isAdmin ? (
          <span className="text-slate-500 text-xs">Protected</span>
        ) : (
          <button
            onClick={() => onDelete(user.id)}
            className="text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1 rounded border border-red-800 hover:border-red-600 transition-colors"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiUsers.list();
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    if (!confirm(`Delete user "${users.find(u => u.id === id)?.username}"? This cannot be undone.`)) return;
    setDeleteError('');
    try {
      await apiUsers.delete(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }, [users]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-white placeholder-slate-500"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Username</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td>
              </tr>
            ) : deleteError ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-red-400 bg-red-900/20 text-sm">{deleteError}</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No users found.</td>
              </tr>
            ) : (
              filtered.map((u) => <UserRow key={u.id} user={u} onDelete={deleteUser} />)
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddUserModal onClose={() => setShowModal(false)} onCreated={loadUsers} />
      )}
    </div>
  );
}
