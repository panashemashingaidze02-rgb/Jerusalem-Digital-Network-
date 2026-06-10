import React, { useState, useEffect } from 'react';
import { UserProfile, JdnLevel, PlatformAuditLog } from '../types';
import { getPlatformLogs } from '../lib/storage';
import { ShieldCheck, Search, Filter, RefreshCw, Layers, Calendar, Terminal, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PlatformLogsProps {
  currentUser: UserProfile;
}

export function PlatformLogs({ currentUser }: PlatformLogsProps) {
  const [logs, setLogs] = useState<PlatformAuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const allLogs = await getPlatformLogs();
      setLogs(allLogs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No audit logs available for export matching current filters.');
      return;
    }

    const headers = ['Log ID', 'Timestamp', 'Actor ID', 'Actor Name', 'Actor Level', 'Action', 'Details', 'Category'];
    
    // Helper to safely format Excel-compatible values with quotes
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredLogs.map(log => [
      escapeCSV(log.logId),
      escapeCSV(log.timestamp),
      escapeCSV(log.actorId),
      escapeCSV(log.actorName),
      escapeCSV(log.actorLevel),
      escapeCSV(log.action),
      escapeCSV(log.details),
      escapeCSV(log.category)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jdn_platform_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${filteredLogs.length} audit log entries to CSV`);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(search.toLowerCase()) ||
                          log.actorName.toLowerCase().includes(search.toLowerCase()) ||
                          log.action.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeColor = (cat: PlatformAuditLog['category']) => {
    switch (cat) {
      case 'auth': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'payment': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'member': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'system': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'contribution': return 'bg-violet-100 text-violet-800 border-violet-200';
      case 'ungano': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Platform Audit Logs</h1>
          <p className="text-sm text-[#6B7280]">
            Jerusalem & National Headquarters administrative ledger tracking all operational writes, deactivations, and security audits.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="bg-[#166534] hover:bg-[#166534]/90 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          
          <button
            id="refresh-logs-btn"
            onClick={loadLogs}
            disabled={isLoading}
            className="bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-2 border border-gray-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Security alert context */}
      <div className="bg-emerald-50 border border-emerald-200/60 p-4 rounded-xl flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[#166534] shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-xs text-emerald-800 uppercase tracking-wider">Immutable Security Ledger active</h4>
          <p className="text-[11px] text-emerald-700 mt-1 leading-normal">
            Every transaction, membership change, password override, and synchronization batch triggers a tamper-evident audit entry. Your current administrative level is <strong>{currentUser.level} ({currentUser.role})</strong>.
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search payload details, actors, actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:bg-white"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block w-full py-2 px-3 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#166534] focus:bg-white"
          >
            <option value="all">📁 All Audit Domains</option>
            <option value="auth">🔑 Authentication & Safety</option>
            <option value="member">👥 Congregation Members</option>
            <option value="contribution">💰 Murairo Policies</option>
            <option value="ungano">🧾 Special Murairos</option>
            <option value="system">⚙️ Core Systems Overrides</option>
          </select>
        </div>

        <div className="flex items-center text-xs text-gray-500 justify-end font-medium">
          Showing {filteredLogs.length} matching logs
        </div>
      </div>

      {/* Logs stack */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredLogs.length > 0 ? (
          <div className="divide-y divide-gray-100 font-mono text-[11px]">
            {filteredLogs.map((log) => (
              <div key={log.logId} className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start">
                <div className="space-y-1.5 flex-1 select-all">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#111827] bg-gray-100 px-1.5 py-0.5 rounded text-[10px] border border-gray-200">
                      {log.action}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${getCategoryBadgeColor(log.category)}`}>
                      {log.category.toUpperCase()}
                    </span>
                    <span className="text-gray-400 font-sans font-normal text-[10px] flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-[#111827] font-semibold leading-relaxed font-sans">{log.details}</p>
                  
                  <div className="text-gray-500 flex flex-wrap items-center gap-1.5 text-[10px] font-sans">
                    <span>Actor:</span>
                    <span className="bg-gray-100 text-gray-700 font-medium px-1.5 py-0.5 rounded font-mono text-[9px]">{log.actorName}</span>
                    <span className="text-gray-400">|</span>
                    <span>Admin Level:</span>
                    <span className="text-amber-800 hover:underline">{log.actorLevel}</span>
                    <span className="text-gray-400">|</span>
                    <span>Actor ID:</span>
                    <span className="font-mono text-[9px] text-gray-400">{log.actorId}</span>
                  </div>
                </div>

                <div className="text-right text-[10px] text-gray-400 font-mono font-normal flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-gray-100 shrink-0 select-all">
                  <span>LOG: #{log.logId}</span>
                  <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold tracking-wide text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                    <Terminal className="h-2.5 w-2.5" /> SECURE_SEC_LOCK
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center space-y-2">
            <Layers className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-400">No security audit logs found</p>
            <p className="text-xs text-gray-400">Try adjusting your keyword filters or choose another audit domain.</p>
          </div>
        )}
      </div>
    </div>
  );
}
