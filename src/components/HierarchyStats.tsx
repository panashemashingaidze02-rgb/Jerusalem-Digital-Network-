import React, { useState, useEffect } from 'react';
import { UserProfile, JdnLevel, Member } from '../types';
import { getMembers, getUserProfiles, isCodeInScope } from '../lib/storage';
import { Layers, Search, FileText, Download, Building, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  const parts = text.split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === search.toLowerCase() 
          ? <span key={i} className="bg-yellow-100 font-extrabold text-[#1a1a1a] px-0.5 rounded border border-yellow-300 shadow-sm">{part}</span> 
          : part
      )}
    </>
  );
}

interface HierarchyStatsProps {
  currentUser: UserProfile;
}

export default function HierarchyStats({ currentUser }: HierarchyStatsProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const ms = await getMembers();
      setMembers(ms);
      const us = await getUserProfiles();
      setUsers(us);
      setIsLoading(false);
    };
    load();
  }, []);

  // Filter users who represent administrative units under current user scope
  const isGlobal = currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM;
  
  const [jurisdictionFilter, setJurisdictionFilter] = useState<'all' | 'mine'>('all');

  const baseUnitsForList = jurisdictionFilter === 'all'
    ? users.filter(u => u.level !== JdnLevel.SYSTEM)
    : users.filter(u => {
        if (u.level === JdnLevel.SYSTEM) return false;
        if (isGlobal) return true;
        return u.levelCode.startsWith(currentUser.levelCode);
      });

  const uniqueUnitsMap = new Map<string, UserProfile>();
  baseUnitsForList.forEach(u => {
    if (!u.levelCode) return;
    if (!uniqueUnitsMap.has(u.levelCode)) {
      uniqueUnitsMap.set(u.levelCode, u);
    }
  });
  const targetUnitsForList = Array.from(uniqueUnitsMap.values());

  // Helper to resolve full slash-delimited level code for any unit code
  const getFullCode = (tabCode: string) => {
    if (!tabCode) return '';
    if (tabCode.includes('/')) return tabCode;
    const match = users.find(u => 
      u.level === JdnLevel.TABHERA && 
      (u.levelCode === tabCode || u.levelCode.endsWith('/' + tabCode) || u.levelCode.split('/').pop() === tabCode)
    );
    if (match) return match.levelCode;
    const matchAny = users.find(u => 
      u.levelCode === tabCode || u.levelCode.endsWith('/' + tabCode) || u.levelCode.split('/').pop() === tabCode
    );
    if (matchAny) return matchAny.levelCode;
    return tabCode;
  };

  // Calculate stats for all hierarchy levels
  const getSubdivisionMetrics = (level: JdnLevel) => {
    const matchingUnits = targetUnitsForList.filter(u => u.level === level);
    const totalMembers = members.filter(m => {
      return matchingUnits.some(unit => isCodeInScope(m.tabheraCode, unit.levelCode, users));
    }).length;

    return {
      unitCount: matchingUnits.length,
      memberCount: totalMembers
    };
  };

  const nationalMetrics = getSubdivisionMetrics(JdnLevel.NATIONAL);
  const provincialMetrics = getSubdivisionMetrics(JdnLevel.PROVINCIAL);
  const districtMetrics = getSubdivisionMetrics(JdnLevel.DISTRICT);
  const nyikaMetrics = getSubdivisionMetrics(JdnLevel.NYIKA);
  const tabheraMetrics = getSubdivisionMetrics(JdnLevel.TABHERA);
  const wellnessMetrics = getSubdivisionMetrics(JdnLevel.WELLNESS_CENTER);

  // Compute calculated metrics for each subdivision row
  const computedRows = targetUnitsForList.map(unit => {
    const unitMemberCount = members.filter(m => {
      return isCodeInScope(m.tabheraCode, unit.levelCode, users);
    }).length;
    return {
      unit,
      id: unit.id,
      name: unit.branchName || 'Unnamed Unit',
      level: unit.level,
      levelCode: unit.levelCode,
      memberCount: unitMemberCount
    };
  });

  // Filter by search query and tier filter
  const filteredRows = computedRows.filter(row => {
    const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          row.levelCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'All' || row.level === tierFilter;
    return matchesSearch && matchesTier;
  });

  // Strict pagination: exactly 10 units per page close loop
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tierFilter, jurisdictionFilter]);

  // CSV Export
  const exportToCSV = () => {
    const headers = ['Branch Name', 'Hierarchy Level', 'Level Code Path', 'Active Members footprint'];
    const delimiter = ',';
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(delimiter), ...filteredRows.map(r => [
        `"${r.name.replace(/"/g, '""')}"`,
        r.level,
        r.levelCode,
        r.memberCount
      ].join(delimiter))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JDN_Hierarchy_Analysis_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text("Jerusalem Digital Network (JDN) Hierarchy & Statistical Report", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Active Jurisdiction: ${currentUser.levelCode || 'Jerusalem HQ'}`, 14, 21);

    const headers = [['Branch Name', 'Level', 'Internal Code Path', ' footprint Members']];
    const rows = filteredRows.map(r => [
      r.name,
      r.level,
      r.levelCode,
      r.memberCount.toString()
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [29, 78, 216] }, // blue colors for hierarchy
      styles: { fontSize: 8 }
    });

    doc.save(`JDN_HierarchyStats_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 animate-fade-in h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading hierarchy stats...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="hierarchy-analysis-root">
      {/* Header Bar with Export Options */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
             <Layers className="h-6 w-6 text-[#1D4ED8]" />
             Hierarchy & Stats Analysis
          </h2>
          <p className="text-xs text-gray-550 mt-1">
            Detailed breakdown of administrative subdivision counts and nesting member footprints across all levels (Nationals, Provinces, Districts, Nyikas, Tabheras).
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto self-end">
          <button
            onClick={exportToCSV}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={exportToPDF}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#166534] hover:bg-green-800 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Aggregate Tiers Bento Grid Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* National Tier */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Nationals</div>
          <div className="mt-4">
            <span className="text-2xl font-mono font-black text-gray-900">{nationalMetrics.unitCount}</span>
            <span className="text-[10px] text-gray-400 font-medium ml-1">Units</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
            <Users className="h-3 w-3 text-emerald-600" /> {nationalMetrics.memberCount} Members
          </p>
          <div className="absolute right-2 top-2 opacity-[0.06] text-emerald-800"><Building className="h-10 w-10" /></div>
        </div>

        {/* Provincial Tier */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Provinces</div>
          <div className="mt-4">
            <span className="text-2xl font-mono font-black text-gray-900">{provincialMetrics.unitCount}</span>
            <span className="text-[10px] text-gray-400 font-medium ml-1">Units</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
            <Users className="h-3 w-3 text-blue-600" /> {provincialMetrics.memberCount} Members
          </p>
          <div className="absolute right-2 top-2 opacity-[0.06] text-blue-800"><Building className="h-10 w-10" /></div>
        </div>

        {/* District Tier */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Districts</div>
          <div className="mt-4">
            <span className="text-2xl font-mono font-black text-gray-900">{districtMetrics.unitCount}</span>
            <span className="text-[10px] text-gray-400 font-medium ml-1">Units</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
            <Users className="h-3 w-3 text-purple-600" /> {districtMetrics.memberCount} Members
          </p>
          <div className="absolute right-2 top-2 opacity-[0.06] text-purple-800"><Building className="h-10 w-10" /></div>
        </div>

        {/* Nyika Tier */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Nyikas</div>
          <div className="mt-4">
            <span className="text-2xl font-mono font-black text-gray-900">{nyikaMetrics.unitCount}</span>
            <span className="text-[10px] text-gray-400 font-medium ml-1">Units</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
            <Users className="h-3 w-3 text-amber-600" /> {nyikaMetrics.memberCount} Members
          </p>
          <div className="absolute right-2 top-2 opacity-[0.06] text-amber-800"><Building className="h-10 w-10" /></div>
        </div>

        {/* Tabhera Tier */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase text-pink-700 tracking-wider">Tabheras</div>
          <div className="mt-4">
            <span className="text-2xl font-mono font-black text-gray-900">{tabheraMetrics.unitCount}</span>
            <span className="text-[10px] text-gray-400 font-medium ml-1">Units</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
            <Users className="h-3 w-3 text-pink-600" /> {tabheraMetrics.memberCount} Members
          </p>
          <div className="absolute right-2 top-2 opacity-[0.06] text-pink-850"><Building className="h-10 w-10" /></div>
        </div>

        {/* Wellness Center Tier */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Wellness Centers</div>
          <div className="mt-4">
            <span className="text-2xl font-mono font-black text-gray-900">{wellnessMetrics.unitCount}</span>
            <span className="text-[10px] text-gray-400 font-medium ml-1">Units</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
            <Users className="h-3 w-3 text-teal-600" /> {wellnessMetrics.memberCount} Members
          </p>
          <div className="absolute right-2 top-2 opacity-[0.06] text-teal-850"><Building className="h-10 w-10" /></div>
        </div>
      </div>

      {/* Subdivisions Interactive Ledger */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Filters and Searches */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search units by name or code path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            {/* Real-time Indicator listing of fields being searched */}
            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-sans mt-0.5 flex-wrap">
              <span className="font-bold uppercase tracking-wider text-gray-400">Searching:</span>
              <span className={`px-1.5 py-0.2 rounded font-semibold transition-all ${searchQuery && computedRows.some(row => row.name.toLowerCase().includes(searchQuery.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-bold' : 'bg-gray-100'}`}>Subdivision Name</span>
              <span className={`px-1.5 py-0.2 rounded font-semibold transition-all ${searchQuery && computedRows.some(row => row.levelCode.toLowerCase().includes(searchQuery.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-bold' : 'bg-gray-100'}`}>Internal Code Path</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={jurisdictionFilter}
              onChange={(e) => setJurisdictionFilter(e.target.value as 'all' | 'mine')}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-250 bg-white rounded-lg text-gray-750 focus:outline-none cursor-pointer"
            >
              <option value="all">Organization-Wide Units ({users.filter(u => u.level !== JdnLevel.SYSTEM).length})</option>
              {!isGlobal && (
                <option value="mine">My Jurisdiction Local ({users.filter(u => u.id !== currentUser.id && u.level !== JdnLevel.SYSTEM && u.levelCode.startsWith(currentUser.levelCode)).length})</option>
              )}
            </select>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-250 bg-white rounded-lg text-gray-750 focus:outline-none cursor-pointer"
            >
              <option value="All">All Tiers ({targetUnitsForList.length})</option>
              <option value={JdnLevel.NATIONAL}>National Tier ({targetUnitsForList.filter(u => u.level === JdnLevel.NATIONAL).length})</option>
              <option value={JdnLevel.PROVINCIAL}>Provincial Tier ({targetUnitsForList.filter(u => u.level === JdnLevel.PROVINCIAL).length})</option>
              <option value={JdnLevel.DISTRICT}>District Tier ({targetUnitsForList.filter(u => u.level === JdnLevel.DISTRICT).length})</option>
              <option value={JdnLevel.NYIKA}>Nyika Tier ({targetUnitsForList.filter(u => u.level === JdnLevel.NYIKA).length})</option>
              <option value={JdnLevel.TABHERA}>Tabhera Tier ({targetUnitsForList.filter(u => u.level === JdnLevel.TABHERA).length})</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="bg-gray-100/70 text-[10px] uppercase font-bold text-gray-500 tracking-wider border-b border-gray-200">
                <th className="px-4 py-3">Subdivision Unit Name</th>
                <th className="px-4 py-3">Tier level</th>
                <th className="px-4 py-3">Internal Code Path</th>
                <th className="px-4 py-3 text-right">Scope Footprint Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {pagedRows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900 flex flex-col gap-0.5 justify-center">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-450 shrink-0" />
                      <span>
                        <HighlightText text={row.name} search={searchQuery} />
                      </span>
                    </div>
                    {searchQuery && (
                      <div className="flex gap-1.5 mt-1">
                        {row.name.toLowerCase().includes(searchQuery.toLowerCase()) && (
                          <span className="text-[8px] bg-amber-50 text-amber-900 border border-amber-200 px-1 py-0.2 rounded font-bold uppercase tracking-wider">Matched Name</span>
                        )}
                        {row.levelCode.toLowerCase().includes(searchQuery.toLowerCase()) && (
                          <span className="text-[8px] bg-indigo-50 text-[#3730a3] border border-indigo-200 px-1 py-0.2 rounded font-bold uppercase tracking-wider">Matched Code Path</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                      row.level === JdnLevel.NATIONAL ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                      row.level === JdnLevel.PROVINCIAL ? 'bg-blue-50 text-blue-800 border-blue-100' :
                      row.level === JdnLevel.DISTRICT ? 'bg-purple-50 text-purple-800 border-purple-100' :
                      row.level === JdnLevel.NYIKA ? 'bg-amber-50 text-amber-800 border-amber-100' :
                      'bg-pink-50 text-pink-800 border-pink-100'
                    }`}>
                      {row.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500 text-[10px]">
                    <HighlightText text={row.levelCode} search={searchQuery} />
                  </td>
                  <td className="px-4 py-3 text-right font-black text-blue-700">{row.memberCount}</td>
                </tr>
              ))}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-xs italic">
                    No administrative subdivisions matching your filters were found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls for subdivision list (exactly 10 per page) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-250 px-4 py-3 bg-gray-50">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-gray-700">
                  Showing <span className="font-semibold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                  <span className="font-semibold">
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)}
                  </span>{' '}
                  of <span className="font-semibold">{filteredRows.length}</span> subdivisions
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-xs bg-white border border-gray-200" aria-label="Pagination">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="relative inline-flex items-center rounded-l-md px-2 py-1 bg-white text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    First
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="relative inline-flex items-center px-2 py-1 bg-white text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages)
                    .map((page, idx, arr) => {
                      const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && (
                            <span className="relative inline-flex items-center px-3 py-1 text-xs text-gray-500 font-bold border-r border-gray-200 bg-gray-50">
                              ...
                            </span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-3 py-1 text-xs font-bold ${
                              currentPage === page
                                ? 'z-10 bg-blue-600 text-white'
                                : 'bg-white text-gray-755 hover:bg-gray-50 border-r border-gray-200'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="relative inline-flex items-center px-2 py-1 bg-white text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="relative inline-flex items-center rounded-r-md px-2 py-1 bg-white text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Last
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
