import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserProfile, UnganoRecord, JdnLevel, Member } from '../types';
import {
  getUnganoRecords,
  saveUnganoRecords,
  getUserProfiles,
  getMembers,
  addPlatformLog,
  getNetworkStatus,
  getCurrencies
} from '../lib/storage';
import {
  Users,
  Coins,
  Calendar,
  Plus,
  Search,
  MapPin,
  ClipboardList,
  UserCheck,
  Percent,
  TrendingUp,
  Award,
  BookOpen,
  DollarSign,
  Briefcase,
  Layers,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Trophy
} from 'lucide-react';

interface UnganoProps {
  currentUser: UserProfile;
}

export function Ungano({ currentUser }: UnganoProps) {
  const [records, setRecords] = useState<UnganoRecord[]>([]);
  const [allLeaders, setAllLeaders] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<UnganoRecord | null>(null);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(['USD', 'ZWG', 'ZAR']);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination bounds for listed collections
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Ungano creation states
  const [name, setName] = useState('');
  const [date, setDate] = useState('2026-05-27');
  const [location, setLocation] = useState('');
  const [menCount, setMenCount] = useState('0');
  const [womenCount, setWomenCount] = useState('0');
  const [youthCount, setYouthCount] = useState('0');
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [leaderSearch, setLeaderSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Sub-offering payment logs state
  const [contribName, setContribName] = useState('');
  const [contribAmount, setContribAmount] = useState('');
  const [contribCurrency, setContribCurrency] = useState('USD');
  const [contribMethod, setContribMethod] = useState('Cash');
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);

  const isOnline = getNetworkStatus();

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const recs = await getUnganoRecords();
      setRecords(recs);

      const members = await getMembers();
      // Leaders are members from mabasa who have isLeadership = true
      const leaders = members.filter(m => m.isLeadership);
      setAllLeaders(leaders);

      const currValues = await getCurrencies();
      setSupportedCurrencies(currValues);
      if (currValues.length > 0 && !currValues.includes(contribCurrency)) {
        setContribCurrency(currValues[0]);
      }

    } catch (e) {
      toast.error('Failed to load Ungano assembly parameters.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUngano = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please specify the Ungano Assembly name.');
      return;
    }
    if (!location.trim()) {
      toast.error('Please specify the gathering location/venue.');
      return;
    }

    const men = parseInt(menCount) || 0;
    const women = parseInt(womenCount) || 0;
    const youth = parseInt(youthCount) || 0;
    const totalAtt = men + women + youth;

    if (totalAtt <= 0) {
      toast.error('Please enter attendance values for at least one cohort (men, women, youth).');
      return;
    }

    try {
      const uId = `ung-rec-${Date.now()}`;
      const newRec: UnganoRecord = {
        id: uId,
        name: name.trim(),
        date: date,
        location: location.trim(),
        totalMoneyContributed: 0,
        contributions: [],
        totalAttendance: totalAtt,
        attendanceDetails: {
          men,
          women,
          youth
        },
        leadersAttendedIds: selectedLeaderIds,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      const updated = [newRec, ...records];
      await saveUnganoRecords(updated);

      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'UNGANO_SESSION_CREATE',
        details: `Created new Ungano Assembly "${newRec.name}" on ${newRec.date} with ${newRec.totalAttendance} attendees.`,
        category: 'ungano'
      });

      toast.success(`Registered Ungano Assembly "${newRec.name}"!`);
      
      // Reset Form State
      setName('');
      setDate('2026-05-27');
      setLocation('');
      setMenCount('0');
      setWomenCount('0');
      setYouthCount('0');
      setSelectedLeaderIds([]);
      setNotes('');
      setIsCreateOpen(false);

      await loadData();
    } catch (e) {
      toast.error('Could not save Ungano assembly. Please try again.');
    }
  };

  // Log contribution specifically inside an Ungano session
  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    const amt = parseFloat(contribAmount);
    if (!contribName.trim()) {
      toast.error('Please fill in the donor/contributor name.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      toast.error('Offering amount must be a number greater than 0.');
      return;
    }

    try {
      // Standardize to USD for cumulative calculations
      let usdVal = amt;
      if (contribCurrency === 'ZAR') usdVal = amt / 18.5;
      if (contribCurrency === 'ZWG') usdVal = amt / 25.0;

      const updatedContributions = [
        ...selectedRecord.contributions,
        {
          contributorName: contribName.trim(),
          amount: amt,
          currency: contribCurrency,
          paymentMethod: contribMethod
        }
      ];

      const newTotalUSD = selectedRecord.totalMoneyContributed + usdVal;

      const updatedRecord: UnganoRecord = {
        ...selectedRecord,
        contributions: updatedContributions,
        totalMoneyContributed: newTotalUSD
      };

      const allRecords = records.map(r => r.id === selectedRecord.id ? updatedRecord : r);
      await saveUnganoRecords(allRecords);

      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'UNGANO_CONTRIBUTION_LOG',
        details: `Logged offering of ${contribCurrency} ${amt} inside Ungano "${selectedRecord.name}".`,
        category: 'ungano'
      });

      toast.success('Contribution offering saved successfully.');
      
      // Reset Sub-Form
      setContribName('');
      setContribAmount('');
      setIsAddPaymentOpen(false);
      
      // Refresh current states
      setSelectedRecord(updatedRecord);
      setRecords(allRecords);
    } catch (err) {
      toast.error('Failed to log payment transaction.');
    }
  };

  const handleToggleLeader = (leaderId: string) => {
    if (selectedLeaderIds.includes(leaderId)) {
      setSelectedLeaderIds(selectedLeaderIds.filter(id => id !== leaderId));
    } else {
      setSelectedLeaderIds([...selectedLeaderIds, leaderId]);
    }
  };

  const filteredRecords = records.filter(r => {
    return r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           r.location.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const pagedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Calculate Cumulative Dashboard States for Ungano
  const totalMoneyUSD = records.reduce((sum, curr) => sum + curr.totalMoneyContributed, 0);
  const totalAttendanceAll = records.reduce((sum, curr) => sum + curr.totalAttendance, 0);

  const menSum = records.reduce((sum, curr) => sum + (curr.attendanceDetails?.men || 0), 0);
  const womenSum = records.reduce((sum, curr) => sum + (curr.attendanceDetails?.women || 0), 0);
  const youthSum = records.reduce((sum, curr) => sum + (curr.attendanceDetails?.youth || 0), 0);

  const getLeaderDetails = (leaderId: string) => {
    const match = allLeaders.find(l => l.memberId === leaderId);
    return match ? `${match.fullName} (${match.basa || 'Leader'})` : 'Unrecognized Minister';
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Synchronizing Ungano Assemblies...</p>
      </div>
    );
  }

  // Double Check Security Authorization limits
  if (currentUser.level !== JdnLevel.JERUSALEM) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 text-red-900 rounded-xl max-w-lg mx-auto text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-red-650 mx-auto stroke-1" />
        <h4 className="font-bold text-sm uppercase tracking-wider">Access Restricted</h4>
        <p className="text-xs">
          The Ungano assembly registry and micro-ledgering dashboard are strictly reserved for the **Jerusalem HQ Supervising Overseer** profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="ungano-page">
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-[#166534]" />
            Jerusalem Ungano Assembly Hub
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Global repository to oversee Ungano gatherings, log attendance divisions, check leadership attendance, and record offerings.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <Plus className="h-4 w-4" /> Create Ungano Gathering
        </button>
      </div>

      {/* Aggregate Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 col-span-1">
          <div className="p-3 bg-green-50 rounded-lg text-[#166534]">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-2xl font-black text-gray-900">
              ${totalMoneyUSD.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-gray-500">Cumulative offerings (USD)</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 col-span-1">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-2xl font-black text-gray-900">
              {totalAttendanceAll}
            </span>
            <span className="text-xs font-semibold text-gray-500">Total Gathered Attendees</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center col-span-1 md:col-span-2">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Cohort Breakdown</span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold">
            <div className="bg-amber-50 text-amber-900 p-1.5 rounded-lg border border-amber-100">
              <span className="block text-sm font-black">{menSum}</span>
              <span className="text-[9px] text-amber-700 uppercase">Men</span>
            </div>
            <div className="bg-purple-50 text-purple-900 p-1.5 rounded-lg border border-purple-100">
              <span className="block text-sm font-black">{womenSum}</span>
              <span className="text-[9px] text-purple-700 uppercase">Women</span>
            </div>
            <div className="bg-rose-50 text-rose-900 p-1.5 rounded-lg border border-rose-100">
              <span className="block text-sm font-black">{youthSum}</span>
              <span className="text-[9px] text-rose-700 uppercase">Youth</span>
            </div>
          </div>
        </div>
      </div>

      {/* Special Murairo Currency Rankings Leaderboard */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-500 animate-bounce" /> Special Murairo Currency Leaderboard
            </h3>
            <p className="text-[10px] text-gray-500">Official ranks of raised ungano contributions normalized in standard USD equivalence.</p>
          </div>
          {(() => {
            const unganoContribs = records.flatMap(r => r.contributions || []);
            const totalByCurrency: Record<string, number> = {};
            supportedCurrencies.forEach(curr => { totalByCurrency[curr] = 0; });
            unganoContribs.forEach(c => {
              totalByCurrency[c.currency] = (totalByCurrency[c.currency] || 0) + c.amount;
            });
            const ranks = Object.entries(totalByCurrency).map(([curr, rawAmt]) => {
              const usdVal = curr === 'ZAR' ? rawAmt / 18.5 : curr === 'ZWG' ? rawAmt / 25.0 : rawAmt;
              return { curr, rawAmt, usdEq: usdVal };
            }).filter(r => r.usdEq > 0).sort((a, b) => b.usdEq - a.usdEq);

            if (ranks.length === 0) return (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-400 border border-gray-200 rounded-full text-[10px] font-bold">
                No Special Murairo offerings recorded
              </span>
            );
            const top = ranks[0];
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-black uppercase tracking-wide">
                 👑 Top Performer: {top.curr} (${top.usdEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} equivalent)
              </span>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-150 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-extrabold uppercase text-gray-400 border-b border-gray-150">
                  <th className="py-3 px-4 text-center w-12">Rank</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4 text-right">Raw Total Raised</th>
                  <th className="py-3 px-4 text-right">USD Equiv. Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {(() => {
                  const unganoContribs = records.flatMap(r => r.contributions || []);
                  const totalByCurrency: Record<string, number> = {};
                  supportedCurrencies.forEach(curr => { totalByCurrency[curr] = 0; });
                  unganoContribs.forEach(c => {
                    totalByCurrency[c.currency] = (totalByCurrency[c.currency] || 0) + c.amount;
                  });
                  const ranks = Object.entries(totalByCurrency).map(([curr, rawAmt]) => {
                    const usdVal = curr === 'ZAR' ? rawAmt / 18.5 : curr === 'ZWG' ? rawAmt / 25.0 : rawAmt;
                    return { curr, rawAmt, usdEq: usdVal };
                  }).sort((a, b) => b.usdEq - a.usdEq);

                  return ranks.map((item, idx) => {
                    const isTop = idx === 0 && item.usdEq > 0;
                    return (
                      <tr key={item.curr} className={isTop ? "bg-amber-50/10 font-semibold text-gray-900" : ""}>
                        <td className="py-3 px-4 text-center">
                          {idx === 0 && item.usdEq > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 bg-amber-100 text-amber-700 rounded-full font-bold text-[10px] shadow-sm animate-pulse">🥇</span>
                          ) : idx === 1 && item.usdEq > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 bg-slate-100 text-slate-700 rounded-full font-bold text-[10px] shadow-sm">🥈</span>
                          ) : idx === 2 && item.usdEq > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 bg-orange-100 text-orange-700 rounded-full font-bold text-[10px] shadow-sm">🥉</span>
                          ) : (
                            <span className="font-bold text-gray-400">#{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 uppercase font-black tracking-wider text-gray-850 font-mono">
                          {item.curr}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-700">
                          {item.curr === 'USD' ? '$' : item.curr === 'ZAR' ? 'R' : ''}
                          {item.rawAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {item.curr !== 'USD' && item.curr !== 'ZAR' ? ` ${item.curr}` : ''}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-950 font-black text-[#166534]">
                          ${item.usdEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <div className="p-5 bg-gray-50 rounded-xl border border-gray-150 space-y-4 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block font-sans">Ungano Funding Contribution Share</span>
            <div className="space-y-4">
              {(() => {
                const unganoContribs = records.flatMap(r => r.contributions || []);
                const totalByCurrency: Record<string, number> = {};
                supportedCurrencies.forEach(curr => { totalByCurrency[curr] = 0; });
                unganoContribs.forEach(c => {
                  totalByCurrency[c.currency] = (totalByCurrency[c.currency] || 0) + c.amount;
                });
                const ranks = Object.entries(totalByCurrency).map(([curr, rawAmt]) => {
                  const usdVal = curr === 'ZAR' ? rawAmt / 18.5 : curr === 'ZWG' ? rawAmt / 25.0 : rawAmt;
                  return { curr, usdEq: usdVal };
                }).sort((a, b) => b.usdEq - a.usdEq);

                const totalUSD = ranks.reduce((sum, r) => sum + r.usdEq, 0) || 1;

                return ranks.map((item, idx) => {
                  const pct = Math.min(100, Math.round((item.usdEq / totalUSD) * 100));
                  const colors = ['bg-[#166534]', 'bg-[#1D4ED8]', 'bg-[#D97706]', 'bg-slate-500'];
                  const barColCurrent = colors[idx % colors.length];

                  return (
                    <div key={item.curr} className="space-y-2">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="font-bold text-gray-700">{item.curr}</span>
                        <span className="text-gray-500 font-medium">{pct}% (${item.usdEq.toLocaleString('en-US', { maximumFractionDigits: 2 })} eq)</span>
                      </div>
                      <div className="w-full bg-gray-250 h-2.5 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full ${barColCurrent} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List of Gatherings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Ungano name or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-gray-400 text-gray-900"
            />
          </div>

          <div className="space-y-3">
            {filteredRecords.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-500">
                <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="font-bold text-xs">No assemblies on file</p>
                <p className="text-[11px] text-gray-500">Click &quot;Create Ungano Gathering&quot; to register.</p>
              </div>
            ) : (
              pagedRecords.map((rec) => {
                const isActive = selectedRecord?.id === rec.id;
                return (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedRecord(rec)}
                    className={`bg-white p-5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      isActive 
                        ? 'border-[#166534] ring-1 ring-[#166534] shadow' 
                        : 'border-gray-200 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-2">
                       <div className="flex items-center gap-2.5">
                         <span className="bg-[#166534]/15 text-[#166534] font-black font-mono text-[9px] uppercase px-2 py-0.5 rounded-full tracking-wide">
                           Ungano
                         </span>
                         <h4 className="font-bold text-gray-900 text-base">{rec.name}</h4>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
                         <div className="flex items-center gap-1.5">
                           <Calendar className="h-3.5 w-3.5 text-gray-400" />
                           {rec.date}
                         </div>
                         <div className="flex items-center gap-1.5">
                           <MapPin className="h-3.5 w-3.5 text-gray-400" />
                           {rec.location}
                         </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-6 sm:text-right font-mono border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0 shrink-0">
                      <div>
                        <span className="block text-[9px] text-gray-400 font-sans font-black uppercase tracking-wider">Attendance</span>
                        <span className="text-gray-900 font-black text-sm">{rec.totalAttendance}</span>
                      </div>
                      <div className="border-l border-gray-200 h-8 hidden sm:block"></div>
                      <div>
                        <span className="block text-[9px] text-gray-400 font-sans font-black uppercase tracking-wider">Offerings</span>
                        <span className="text-emerald-700 font-black text-sm">${rec.totalMoneyContributed.toFixed(2)}</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 hidden sm:block" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border border-gray-200 px-4 py-3 bg-white rounded-xl mt-3 shadow-xs">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="relative ml-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between font-sans">
                <div>
                  <p className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">
                    Page {currentPage} of {totalPages} ({filteredRecords.length} Assemblies)
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 rounded text-[11px] font-bold text-gray-600 disabled:opacity-50 cursor-pointer"
                  >
                    First
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 rounded text-[11px] font-bold text-gray-600 disabled:opacity-50 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 rounded text-[11px] font-bold text-gray-600 disabled:opacity-50 cursor-pointer"
                  >
                    Next
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 rounded text-[11px] font-bold text-gray-600 disabled:opacity-50 cursor-pointer"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Detailed Inspector Card */}
        <div className="lg:col-span-1">
          {selectedRecord ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
              <div className="p-5 border-b border-gray-200 bg-gray-50/70 flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-black uppercase text-gray-450 tracking-wider">Gathering Inspector</span>
                  <h3 className="font-extrabold text-gray-900 text-lg mt-0.5 leading-snug">{selectedRecord.name}</h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {selectedRecord.location} • {selectedRecord.date}</p>
                </div>
                {(currentUser.level as any) === JdnLevel.SYSTEM || (currentUser.level as any) === JdnLevel.JERUSALEM ? (
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to delete this assembly and all its logs?')) return;
                      const kept = records.filter(r => r.id !== selectedRecord.id);
                      setRecords(kept);
                      await saveUnganoRecords(kept);
                      setSelectedRecord(null);
                    }}
                    className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 transition-colors shadow-sm"
                  >
                    Delete Log
                  </button>
                ) : null}
              </div>

              <div className="p-5 space-y-6">
                {/* Cohort Attendance breakdown */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Attendance Dividends
                  </h4>
                  <div className="bg-gray-50 p-3 rounded-lg grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold">
                    <div>
                      <span className="block text-gray-450 text-[9px] uppercase">Men</span>
                      <span className="text-gray-900 text-sm">{selectedRecord.attendanceDetails?.men || 0}</span>
                    </div>
                    <div className="border-x border-gray-200">
                      <span className="block text-gray-450 text-[9px] uppercase">Women</span>
                      <span className="text-gray-900 text-sm">{selectedRecord.attendanceDetails?.women || 0}</span>
                    </div>
                    <div>
                      <span className="block text-gray-450 text-[9px] uppercase">Youth</span>
                      <span className="text-gray-900 text-sm">{selectedRecord.attendanceDetails?.youth || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Leaders Attended */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" /> Present Cabinet Ministers ({selectedRecord.leadersAttendedIds.length})
                  </h4>
                  {selectedRecord.leadersAttendedIds.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic pl-1">No cabinet ministers recorded present.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {selectedRecord.leadersAttendedIds.map((lId) => (
                        <div key={lId} className="bg-green-50/50 border border-green-150/40 p-2 rounded text-xs text-green-950 font-bold flex items-center gap-2">
                          <Award className="h-3.5 w-3.5 text-green-700 shrink-0" />
                          <span className="truncate">{getLeaderDetails(lId)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Offling Ledger list */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" /> Offering Transactions ({selectedRecord.contributions.length})
                    </h4>
                    <button
                      onClick={() => setIsAddPaymentOpen(true)}
                      className="text-[10px] font-bold text-[#166534] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      + Add Offering
                    </button>
                  </div>

                  {selectedRecord.contributions.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic pl-1">No monetary contributions registered yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-mono text-[11px]">
                      {selectedRecord.contributions.map((c, idx) => (
                        <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-100 flex justify-between items-center gap-2">
                          <div>
                            <span className="font-bold text-gray-900 block font-sans truncate pr-2">{c.contributorName}</span>
                            <span className="text-[9px] text-gray-400 uppercase font-sans">{c.paymentMethod}</span>
                          </div>
                          <span className="font-black text-emerald-800 shrink-0">
                            {c.currency} {c.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedRecord.notes && (
                  <div className="space-y-1 bg-amber-50/55 p-3.5 rounded-lg border border-amber-100 flex flex-col text-xs text-amber-950">
                    <span className="font-extrabold uppercase text-[9px] text-amber-800 tracking-wider">HQ Assembly Notes</span>
                    <p className="leading-relaxed mt-1 font-sans">{selectedRecord.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 flex flex-col justify-center items-center h-80 shadow-sm sticky top-8">
              <ClipboardList className="h-10 w-10 text-gray-300 stroke-1 mb-2 animate-bounce" />
              <p className="font-bold text-xs uppercase tracking-wider">Select assembly context</p>
              <p className="text-[10px] mt-1 pl-4 pr-4">Pick an Ungano from the left list to review detailed cohort logs, leader checklists, and recorded oferings.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Register New Ungano Gathering */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-extrabold text-[#111827] text-sm uppercase tracking-wide">
                Create Ungano Assembly Log
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-900 font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateUngano} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 mb-2">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                    Assembly Name/Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Masvingo Province Ungano"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                  />
                </div>

                <div className="space-y-1.5 mb-2">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                    Assembly Gathering Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                  />
                </div>
              </div>

              <div className="space-y-1.5 mb-2">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                  Assembly Venue Address / Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mutare Main Temple Ground"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full p-2.5 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                />
              </div>

              {/* Attendance Inputs */}
              <div className="space-y-2 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-wider block mb-1">
                  Attendance Cohort breakdown
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 text-center">
                    <span className="text-[9px] text-gray-500 font-bold uppercase">Men</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={menCount}
                      onChange={(e) => setMenCount(e.target.value)}
                      className="w-full p-1.5 text-center text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="text-[9px] text-gray-500 font-bold uppercase">Women</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={womenCount}
                      onChange={(e) => setWomenCount(e.target.value)}
                      className="w-full p-1.5 text-center text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="text-[9px] text-gray-500 font-bold uppercase">Youth</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={youthCount}
                      onChange={(e) => setYouthCount(e.target.value)}
                      className="w-full p-1.5 text-center text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                    />
                  </div>
                </div>
              </div>

              {/* Leaders attending list selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-wider block">
                  Select Attending Leaders & Ministers
                </label>
                <div className="relative mb-1">
                  <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search leaders..."
                    value={leaderSearch}
                    onChange={(e) => setLeaderSearch(e.target.value)}
                    className="w-full text-xs pl-7 pr-3 py-1.5 border border-gray-250 bg-white rounded focus:outline-[#166534] focus:outline-none placeholder-gray-400"
                  />
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3.5 max-h-36 overflow-y-auto space-y-1.5">
                  {allLeaders.filter(lead => lead.fullName.toLowerCase().includes(leaderSearch.toLowerCase())).map((lead) => {
                    const isChecked = selectedLeaderIds.includes(lead.memberId);
                    return (
                      <label key={lead.memberId} className="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer font-medium hover:bg-gray-50 p-1 rounded-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleLeader(lead.memberId)}
                          className="rounded text-[#166534] border-gray-300 focus:ring-[#166534] h-3.5 w-3.5"
                        />
                        <span className="truncate">{lead.fullName} <span className="text-[10px] text-gray-450 font-mono">({lead.basa || 'Leader'})</span></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 mb-2">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                  Gathering Assembly Notes
                </label>
                <textarea
                  placeholder="Review overall key sermon insights or resolution logs..."
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-200 relative">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-lg shadow"
                >
                  Confirm Assembly
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Money Offering inside current Ungano Context */}
      {isAddPaymentOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center text-xs">
              <span className="font-extrabold uppercase tracking-wide text-gray-900">Add Offering Line</span>
              <button
                onClick={() => setIsAddPaymentOpen(false)}
                className="text-gray-400 hover:text-gray-900 font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddContribution} className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Contributor Label / Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masvingo Ruwadzano Guild"
                  value={contribName}
                  onChange={(e) => setContribName(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Offering Amount</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    placeholder="e.g. 150"
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Currency</label>
                  <select
                    value={contribCurrency}
                    onChange={(e) => setContribCurrency(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ZAR">ZAR (R)</option>
                    <option value="ZWG">ZWG (ZiG)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Payment Method Channel</label>
                <select
                  value={contribMethod}
                  onChange={(e) => setContribMethod(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg bg-white"
                >
                  <option value="Cash">Cash Offering</option>
                  <option value="Ecocash">Ecocash Mobile Transfer</option>
                  <option value="Swipe">Swipe Debit Card</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentOpen(false)}
                  className="px-3 py-1.5 border border-gray-250 text-gray-800 rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#166534] text-white font-bold rounded shadow cursor-pointer"
                >
                  Confirm Line
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default Ungano;
