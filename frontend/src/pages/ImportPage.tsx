/**
 * Import Page - Bulk data upload.
 */
import { useState } from 'react';
import { Upload, FileText } from 'lucide-react';

export default function ImportPage() {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Import Data</h1>
        <p className="text-slate-400 mt-1">Upload observation data via CSV or JSON bulk import.</p>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive ? 'border-cyan-500 bg-cyan-50/10' : 'border-slate-700 bg-slate-900'
        }`}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(); setDragActive(false); }}
      >
        <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Drop files here or click to upload</h3>
        <p className="text-slate-500 mb-4">Supports CSV and JSON files</p>
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-md text-sm font-medium">
          Select File
        </button>
      </div>

      <div className="mt-8 bg-slate-900 border border-slate-800 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-6 h-6 text-slate-500" />
          <h2 className="text-lg font-semibold text-white">Upload History</h2>
        </div>
        <p className="text-slate-500">No uploads yet.</p>
      </div>
    </div>
  );
}
