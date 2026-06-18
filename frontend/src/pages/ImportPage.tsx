/**
 * Import Page - Bulk data upload with CSV/JSON parsing and API submission.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, ChevronDown, ChevronUp, X, Clock } from 'lucide-react';
import { apiIngestion } from '../lib/api-client';
import type { IngestionResult } from '../types/api';

interface ImportState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  result: IngestionResult | null;
  errors: { row: number; field: string; error: string; }[];
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += ch;
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(text: string): string {
  const first = text.split('\n')[0];
  const best = [',', ';', '\t', '|'].sort((a, b) =>
    (first.match(new RegExp(String(b), 'g')) || []).length -
    (first.match(new RegExp(String(a), 'g')) || []).length
  ).pop() || ',';
  return best;
}

type ColumnMap = Record<string, number | null>;

export default function ImportPage() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<ImportState>({ status: 'idle', result: null, errors: [] });
  const [showErrors, setShowErrors] = useState(false);
  const [columnMap, setColumnMap] = useState<ColumnMap | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      if (f.name.toLowerCase().endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          const arr = Array.isArray(data) ? data.length > 0 ? [data[0]] : [] : [];
          if (arr[0]) {
            setHeaders(Object.keys(arr[0]));
            setPreviewRows(arr.slice(0, 3));
          }
        } catch {
          setHeaders(['error']);
        }
      } else {
        const d = detectDelimiter(text);
        const rawParts = text.trim().split('\n')[0].split(d);
        const parsedHeaders = rawParts.map((p) => p.trim());
        setHeaders(parsedHeaders);
        setPreviewRows(
          text.trim().split('\n').slice(1, 4).map((r) =>
            r.split(d).map((p) => p.trim())
          )
        );
        // Auto-detect columns
        const map: ColumnMap = {};
        for (let i = 0; i < parsedHeaders.length; i++) {
          const h = parsedHeaders[i];
          const low = h.toLowerCase();
          if (/freq_start|fstart|start_freq/.test(low)) map.frequency_start = i;
          else if (/freq_end|fend|end_freq/.test(low)) map.frequency_end = i;
          else if (/time|date|timestamp|dt|date_time/.test(low)) map.timestamp = i;
          else if (/modulation|mod_type|modulation_type/.test(low)) map.modulation_type = i;
          else if (/bandwidth|band|bw/.test(low)) map.bandwidth = i;
          else if (/strength|signal|rss|dbm|power|db_power/.test(low)) map.signal_strength = i;
          else if (/classification|class_status|classif|status/.test(low)) map.classification_status = i;
          else if (/lat|latitude|y_coord/.test(low)) map.location_lat = i;
          else if (/lon|longitude|x_coord|lng|longi/.test(low)) map.location_lon = i;
          else if (/location_wkt|wkt|point|loc_wkt/.test(low)) map.location_wkt = i;
        }
        if (Object.keys(map).length > 0) setColumnMap(map);
      }
    };
    reader.readAsText(f);
  }, [file]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiIngestion.getHistory();
      setHistory(data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    setImportState({ status: 'uploading', result: null, errors: [] });
    setLoading(true);
    try {
      const result = file.name.endsWith('.json')
        ? await apiIngestion.postJson(file)
        : await apiIngestion.postCsv(file);
      setImportState({ status: 'success', result, errors: result.errors });
      setShowErrors(result.errors.length > 0);
      loadHistory();
    } catch (err: any) {
      setImportState({ status: 'error', result: null, errors: [{ row: 0, field: 'upload', error: err.message || 'Upload failed' }] });
    } finally {
      setLoading(false);
    }
  }, [file, loadHistory]);

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setColumnMap(null);
    setShowColumns(false);
    setImportState({ status: 'idle', result: null, errors: [] });
    setShowErrors(false);
  };

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleAreaClick = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Import Data</h1>
          <p className="text-slate-400 mt-1">Upload observation data via CSV or JSON bulk import.</p>
        </div>
        {importState.status !== 'idle' && (
          <button onClick={reset} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-sm border border-slate-700">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragActive ? 'border-cyan-500 bg-cyan-50/10' : file ? 'border-cyan-500/50 bg-cyan-50/5' : 'border-slate-700 bg-slate-900'
        }`}
        onClick={handleAreaClick}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(), setDragActive(false), e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]) }}
      >
        <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-cyan-400' : 'text-slate-500'}`} />
        {file ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{file.name}</h3>
              <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB · {file.type || 'unknown type'}</p>
            </div>
            {columnMap && Object.keys(columnMap).length > 0 && showColumns && (
              <div className="bg-slate-800 rounded-lg p-4 max-w-2xl mx-auto text-left">
                <h4 className="text-sm font-semibold text-white mb-2">Auto-detected Column Mapping</h4>
                <div className="space-y-1 text-xs text-slate-300">
                  {Object.entries(columnMap).map(([field, idx]) =>
                    idx !== null ? <div key={field}><span className="text-slate-400">{field}</span> → <span className="text-cyan-400">{headers[idx]}</span></div> : null
                  )}
                </div>
              </div>
            )}
            {previewRows.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-4 max-w-2xl mx-auto text-left overflow-x-auto">
                <h4 className="text-sm font-semibold text-white mb-2">Preview</h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      {headers.map((h, i) => <th key={i} className="px-2 py-1 text-left">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="border-t border-slate-700">
                        {row.map((cell, ci) => <td key={ci} className="px-2 py-1 whitespace-nowrap">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div>
              <button
                onClick={handleSubmit}
                disabled={loading || importState.status === 'uploading'}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-6 py-2 rounded-md text-sm font-medium"
              >
                {loading || importState.status === 'uploading' ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white mb-2">Drop files here or click to upload</h3>
            <p className="text-slate-500 mb-4">Supports CSV and JSON files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,application/json"
              className="hidden"
              id="file-upload"
              onChange={e => { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); }}
            />
            <label htmlFor="file-upload" className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-md text-sm font-medium cursor-pointer inline-block">
              Select File
            </label>
          </>
        )}
      </div>

      {/* Results */}
      {(importState.result || importState.status === 'error') && (
        <div className="max-w-lg mx-auto">
          {importState.status === 'success' && importState.result && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-semibold text-emerald-400">Import Successful</h3>
                  {importState.result.created !== undefined && importState.result.updated !== undefined ? (
                    <p className="text-sm text-slate-400">{importState.result.created} created, {importState.result.updated} updated, {importState.result.total} total</p>
                  ) : (
                    <p className="text-sm text-slate-400">Import complete</p>
                  )}
                </div>
              </div>
              {importState.result.errors && importState.result.errors.length > 0 && (
                <div className="border-t border-emerald-500/30 pt-4">
                  <button onClick={() => setShowErrors(!showErrors)} className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300">
                    {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {importState.result.errors.length} Errors
                  </button>
                  {showErrors && (
                    <div className="mt-3 space-y-2">
                      {importState.result.errors.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-orange-300 bg-orange-500/10 rounded p-3 border border-orange-500/20">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-mono">Row {err.row + 1}, field &quot;{err.field}&quot;:</span> {err.error}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {importState.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <div>
                  <h3 className="text-lg font-semibold text-red-400">Import Failed</h3>
                  <p className="text-sm text-slate-400">{importState.errors[0]?.error || 'Upload failed'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-6 h-6 text-slate-500" />
          <h2 className="text-lg font-semibold text-white">Upload History</h2>
        </div>
        {historyLoading ? (
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 inline animate-spin" />
            Loading...
          </div>
        ) : history.length === 0 ? (
          <p className="text-slate-500 text-sm">No previous uploads.</p>
        ) : (
          <div className="space-y-3">
            {history.map((entry, idx) => (
              <div key={entry.id || idx} className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3 border border-slate-800">
                <Clock className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">
                    {entry.frequency_start?.toFixed(1) ?? '?'}–{entry.frequency_end?.toFixed(1) ?? '?'} MHz
                  </div>
                  <div className="text-xs text-slate-500">
                    {entry.modulation_type || 'No modulation'} · {entry.classification_status || 'Uncertain'}
                    {entry.timestamp ? ` · ${new Date(entry.timestamp).toLocaleString()}` : ''}
                  </div>
                </div>
                <span className="text-xs text-cyan-400 font-medium flex-shrink-0">{entry.imported && 'Imported'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
