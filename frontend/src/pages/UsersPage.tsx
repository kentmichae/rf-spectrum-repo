/**
 * Users Page.
 */
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';

export default function UsersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2">
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
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="px-4 py-3 text-sm text-slate-500">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
