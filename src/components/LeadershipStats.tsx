import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, JdnLevel, Member } from '../types';
import { getMembers, saveMembers, getAttendanceRecords, getContributions, getUnganoPayments, resolveBranchName, getUserProfiles, getSettings } from '../lib/storage';
import { Award, Search, FileText, Download, Ban, CheckCircle, Settings, Image as ImageIcon, Sparkles, Printer, Layers } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toCanvas } from 'html-to-image';
import { IDCardTemplate, IDConfig } from './IDCardTemplate';
import { toast } from 'react-hot-toast';

interface LeadershipStatsProps {
  currentUser: UserProfile;
}

interface BrandingPreset {
  name: string;
  orgName: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  layoutStyle: 'modern' | 'classic' | 'minimalist';
  logoUrl: string;
  frontBgUrl: string;
  backBgUrl: string;
}

const CHURCH_PRESETS: BrandingPreset[] = [
  {
    name: "Jerusalem Headquarters (HQ)",
    orgName: "Jerusalem HQ Temple",
    primaryColor: "#065F46",
    secondaryColor: "#F59E0B",
    textColor: "#111827",
    layoutStyle: "modern",
    logoUrl: "https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop",
    frontBgUrl: "",
    backBgUrl: ""
  },
  {
    name: "Makoni Central Church",
    orgName: "Makoni Central Assembly",
    primaryColor: "#15803D",
    secondaryColor: "#EA580C",
    textColor: "#0f172a",
    layoutStyle: "classic",
    logoUrl: "https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop",
    frontBgUrl: "",
    backBgUrl: ""
  },
  {
    name: "Chitungwiza Shrine",
    orgName: "Chitungwiza Unit",
    primaryColor: "#1E3A8A",
    secondaryColor: "#38BDF8",
    textColor: "#030712",
    layoutStyle: "minimalist",
    logoUrl: "https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop",
    frontBgUrl: "",
    backBgUrl: ""
  },
  {
    name: "Gweru Assembly of Healing",
    orgName: "Gweru Assembly",
    primaryColor: "#4338CA",
    secondaryColor: "#EC4899",
    textColor: "#111827",
    layoutStyle: "modern",
    logoUrl: "https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop",
    frontBgUrl: "",
    backBgUrl: ""
  },
  {
    name: "Bulawayo North Tabhera",
    orgName: "Bulawayo North Branch",
    primaryColor: "#7c2d12",
    secondaryColor: "#fb923c",
    textColor: "#1c1917",
    layoutStyle: "classic",
    logoUrl: "https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop",
    frontBgUrl: "",
    backBgUrl: ""
  },
  {
    name: "Mutare Border Assembly",
    orgName: "Mutare Border Tabhera",
    primaryColor: "#701a75",
    secondaryColor: "#f472b6",
    textColor: "#111827",
    layoutStyle: "modern",
    logoUrl: "https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop",
    frontBgUrl: "",
    backBgUrl: ""
  }
];

export default function LeadershipStats({ currentUser }: LeadershipStatsProps) {
  const [leadership, setLeadership] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [specialPayments, setSpecialPayments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const idTemplateRef = useRef<HTMLDivElement>(null);

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'none' | 'attendance' | 'murairo' | 'special_murairo'>('none');

  // ID Config State
  const [idConfig, setIdConfig] = useState<IDConfig>(() => {
    const key = `jdn_id_config_${currentUser?.levelCode || 'global'}`;
    const saved = localStorage.getItem(key) || localStorage.getItem('jdn_id_config');
    const defaultTemplate: IDConfig = {
      logoUrl: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop',
      frontBgUrl: '',
      backBgUrl: '',
      signatureUrl: '',
      primaryColor: '#166534',
      secondaryColor: '#D97706',
      fontFamily: 'Inter, sans-serif',
      textColor: '#111827',
      globalExpiry: '2028-12-31',
      layoutStyle: 'modern',
      orgName: 'Makoni Church',
      globalBasa: ''
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.orgName === 'JOHANE MASOWE CHISHANU' || parsed.orgName === 'JERUSALEM DIGITAL NETWORK') {
          parsed.orgName = 'Makoni Church';
        }
        return { ...defaultTemplate, ...parsed };
      } catch (e) {
        console.error("Error parsing saved ID config", e);
      }
    }
    return defaultTemplate;
  });

  useEffect(() => {
    const key = `jdn_id_config_${currentUser?.levelCode || 'global'}`;
    localStorage.setItem(key, JSON.stringify(idConfig));
    localStorage.setItem('jdn_id_config', JSON.stringify(idConfig));
  }, [idConfig, currentUser]);
  
  const [isIdConfigOpen, setIsIdConfigOpen] = useState(false);
  const [previewLeader, setPreviewLeader] = useState<Member | null>(null);
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);
  const [showPublicScan, setShowPublicScan] = useState(false);
  const [previewIdConfig, setPreviewIdConfig] = useState<IDConfig>(idConfig);
  const [resolutionScale, setResolutionScale] = useState<number>(2.5);

  const toggleSuspend = async (leader: Member) => {
    if (!confirm(`Are you sure you want to ${leader.isSuspended ? 'unsuspend' : 'suspend'} ${leader.fullName}?`)) return;
    const allMembers = await getMembers();
    const updated = allMembers.map(m => m.memberId === leader.memberId ? { ...m, isSuspended: !m.isSuspended } : m);
    await saveMembers(updated);
    setLeadership(updated.filter(m => m.isLeadership)); // refresh
  };

  const bulkSuspend = async () => {
    if (selectedLeaderIds.length === 0) return;
    if (!confirm(`Are you sure you want to suspend ${selectedLeaderIds.length} leader(s)?`)) return;
    const allMembers = await getMembers();
    const updated = allMembers.map(m => selectedLeaderIds.includes(m.memberId) ? { ...m, isSuspended: true } : m);
    await saveMembers(updated);
    setLeadership(updated.filter(m => m.isLeadership)); // refresh
    setSelectedLeaderIds([]);
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const ms = await getMembers();
      setLeadership(ms.filter(m => m.isLeadership));

      const att = await getAttendanceRecords();
      setAttendance(att);

      const cons = await getContributions();
      setContributions(cons);

      const sps = await getUnganoPayments();
      setSpecialPayments(sps);

      const ps = await getUserProfiles();
      setProfiles(ps);

      const sets = await getSettings();
      setSettings(sets);
      
      setIsLoading(false);
    };
    load();
  }, []);

  // Filter based on currentUser Level
  const visibleLeaders = leadership.filter(l => {
     if (currentUser.level === JdnLevel.SYSTEM) return true;
     if (currentUser.level === JdnLevel.JERUSALEM) return true;
     return l.tabheraCode.startsWith(currentUser.levelCode) || (currentUser.level === JdnLevel.TABHERA && l.tabheraCode === currentUser.levelCode);
  });

  // Aggregate stats per leader (moved up to be available for sorting)
  const getLeaderStats = (leader: Member) => {
    const attCount = attendance.filter(a => a.memberId === leader.memberId && a.status === 'Present').length;
    const cAmount = contributions
       .filter(c => c.memberId === leader.memberId && c.currency === 'USD')
       .reduce((sum, c) => sum + c.amount, 0); 
    const specAmount = specialPayments
       .filter(s => s.memberId === leader.memberId)
       .reduce((sum, s) => sum + s.amountPaid, 0);

    return { attCount, cAmount, specAmount };
  };

  // Apply search query and sort
  const searchedLeaders = visibleLeaders
    .filter(l => 
      l.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.tabheraCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.groupId.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'attendance') {
        return getLeaderStats(b).attCount - getLeaderStats(a).attCount;
      }
      if (sortBy === 'murairo') {
        return getLeaderStats(b).cAmount - getLeaderStats(a).cAmount;
      }
      if (sortBy === 'special_murairo') {
        return getLeaderStats(b).specAmount - getLeaderStats(a).specAmount;
      }
      return 0; // default order
    });

  // Pagination constants (strict 10 per page)
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(searchedLeaders.length / ITEMS_PER_PAGE);
  const pagedLeaders = searchedLeaders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when search or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  // CSV Export Method
  const exportToCSV = () => {
    const headers = ['Leader Name', 'Basa (Title)', 'Group', 'Branch', 'Attendance Actions Count', 'Murairo Contributions (USD)', 'Special Contributions (USD)'];
    const rows = searchedLeaders.map(l => {
      const { attCount, cAmount, specAmount } = getLeaderStats(l);
      return [
        `"${l.fullName.replace(/"/g, '""')}"`,
        `"${(l.basa || 'Mutungamiri').replace(/"/g, '""')}"`,
        l.groupId,
        resolveBranchName(l.tabheraCode, profiles),
        attCount,
        cAmount.toFixed(2),
        specAmount.toFixed(2)
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JDN_Mabasa_Stats_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ID Card Export Logic
  const generateIDCard = (leader: Member) => {
    setPreviewLeader(leader);
    setPreviewIdConfig({ ...idConfig });
  };

  const [pngExportSide, setPngExportSide] = useState<'both' | 'front' | 'back'>('both');

  const executeExport = async (type: 'pdf' | 'png') => {
    if (!idTemplateRef.current || !previewLeader) return;
    
    // We have to wait for the fonts/images to render in the template
    try {
      let targetNode = idTemplateRef.current as HTMLElement;
      if (type === 'png') {
         if (pngExportSide === 'front') {
            targetNode = idTemplateRef.current.querySelector('.front-card') as HTMLElement || targetNode;
         } else if (pngExportSide === 'back') {
            targetNode = idTemplateRef.current.querySelector('.back-card') as HTMLElement || targetNode;
         }
      }

      const canvas = await toCanvas(targetNode, {
        pixelRatio: resolutionScale, // higher customizable print resolution
      });

      const sanitizedOrgName = (previewIdConfig.orgName || 'Church').replace(/[^a-z0-9_-]/gi, '_');

      if (type === 'png') {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement("a");
        link.href = url;
        link.download = `JDN_ID_${pngExportSide}_${previewLeader.fullName.replace(/\s+/g, '_')}_${sanitizedOrgName}.png`;
        link.click();
      } else if (type === 'pdf') {
        const fullCanvas = await toCanvas(idTemplateRef.current, { pixelRatio: resolutionScale });
        // CR80: 86mm x 54mm. We export landscape (86x54) but we have two sides.
        // We'll put them on 2 pages.
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [54, 86]
        });
        
        // Split front and back
        const fCanvas = document.createElement('canvas');
        fCanvas.width = fullCanvas.width / 2;
        fCanvas.height = fullCanvas.height;
        fCanvas.getContext('2d')?.drawImage(fullCanvas, 0, 0, fCanvas.width, fCanvas.height, 0, 0, fCanvas.width, fCanvas.height);
        const bCanvas = document.createElement('canvas');
        bCanvas.width = fullCanvas.width / 2;
        bCanvas.height = fullCanvas.height;
        bCanvas.getContext('2d')?.drawImage(fullCanvas, fCanvas.width, 0, bCanvas.width, bCanvas.height, 0, 0, bCanvas.width, bCanvas.height);

        doc.addImage(fCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 86, 54);
        doc.addPage();
        doc.addImage(bCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 86, 54);
        
        doc.save(`JDN_ID_${previewLeader.fullName.replace(/\s+/g, '_')}_${sanitizedOrgName}.pdf`);
      }
    } catch (e) {
      console.error("Failed to export ID", e);
      alert("Failed to export ID card. Ensure background images allow CORS/cross-origin access.");
    }
  };


  // PDF Export Method
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header Letterhead with Church Branding
    const churchName = settings?.churchName || "JERUSALEM DIGITAL NETWORK (JDN)";
    const address = settings?.contactAddress || settings?.churchAddress || "Jerusalem Headquarters, Zimbabwe";
    const phone = settings?.contactPhone || settings?.churchContact || "+263 JDN DIGITAL";
    const email = settings?.contactEmail || "info@jerusalemdigitalnetwork.org";

    // Header background bar
    doc.setFillColor(22, 101, 52); // JDN Brand Green
    doc.rect(14, 10, 182, 3, 'F');

    // Title / Church Details
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text(churchName, 14, 20);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(`Address: ${address} | Tel: ${phone} | Email: ${email}`, 14, 25);

    // Divider line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("OFFICIAL MABASA PERFORMANCE LEADERSHIP REPORT", 14, 35);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Level Code: ${currentUser.levelCode || 'Jerusalem HQ'}`, 14, 40);

    const headers = [['Leader Name', 'Basa (Title)', 'Group', 'Branch', 'Attendance Acts', 'Murairo (USD)', 'Special (USD)']];
    const rows = searchedLeaders.map(l => {
      const { attCount, cAmount, specAmount } = getLeaderStats(l);
      return [
        l.fullName,
        l.basa || 'Mutungamiri',
        l.groupId,
        resolveBranchName(l.tabheraCode, profiles),
        attCount.toString(),
        `$${cAmount.toFixed(2)}`,
        `$${specAmount.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] }, // Jungle Green themes
      styles: { fontSize: 8 },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });

    doc.save(`JDN_Mabasa_Performance_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 animate-fade-in h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading leadership stats...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 animate-fade-in" id="leadership-stats-root">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
             <Award className="h-6 w-6 text-yellow-600" />
             Mabasa Performance & Stats
          </h2>
          <p className="text-xs text-gray-550 mt-1">
            Review attendance, normal murairo, and special murairo statistics specifically for registered Mabasa (leadership) members.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {selectedLeaderIds.length > 0 && (
             <button
                onClick={bulkSuspend}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
             >
                <Ban className="h-3.5 w-3.5" /> Suspend {selectedLeaderIds.length} Leaders
             </button>
          )}
          <button
            onClick={() => setIsIdConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Settings className="h-3.5 w-3.5" /> ID Design Studio
          </button>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              disabled={searchedLeaders.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#1D4ED8] hover:bg-blue-850 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={exportToPDF}
              disabled={searchedLeaders.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#166534] hover:bg-green-800 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search leaders by name, code or group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-[#166534]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider whitespace-nowrap">Rank By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:outline-[#166534] cursor-pointer"
            >
              <option value="none">-- Default Registry Order --</option>
              <option value="attendance">📈 Attendance Sessions Count</option>
              <option value="murairo">💰 Murairo Contributions (USD)</option>
              <option value="special_murairo">💎 Special Murairo</option>
            </select>
          </div>
        </div>
        <div className="text-[10px] text-gray-500 font-bold whitespace-nowrap">
          Showing {pagedLeaders.length} of {searchedLeaders.length} Members
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-left font-sans text-xs">
             <thead>
               <tr className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 tracking-wider border-b border-gray-200">
                 <th className="px-4 py-3 w-4">
                   <input 
                     type="checkbox" 
                     className="rounded border-gray-300 text-[#166534] focus:ring-[#166534]"
                     checked={selectedLeaderIds.length > 0 && selectedLeaderIds.length === pagedLeaders.length}
                     onChange={(e) => {
                       if (e.target.checked) setSelectedLeaderIds(pagedLeaders.map(l => l.memberId));
                       else setSelectedLeaderIds([]);
                     }}
                   />
                 </th>
                 <th className="px-4 py-3">Leader Name</th>
                 <th className="px-4 py-3">Basa (Title)</th>
                 <th className="px-4 py-3">Group</th>
                 <th className="px-4 py-3">Branch</th>
                 <th className="px-4 py-3 text-right text-blue-750">Attendance Acts</th>
                 <th className="px-4 py-3 text-right text-green-750">Murairo (USD Est)</th>
                 <th className="px-4 py-3 text-right text-emerald-750">Special (USD Est)</th>
                 <th className="px-4 py-3 text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100 text-sm">
               {pagedLeaders.map(leader => {
                  const { attCount, cAmount, specAmount } = getLeaderStats(leader);

                  return (
                     <tr key={leader.memberId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                           <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-[#166534] focus:ring-[#166534]"
                              checked={selectedLeaderIds.includes(leader.memberId)}
                              onChange={(e) => {
                                 if(e.target.checked) setSelectedLeaderIds([...selectedLeaderIds, leader.memberId]);
                                 else setSelectedLeaderIds(selectedLeaderIds.filter(id => id !== leader.memberId));
                              }}
                           />
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                             {leader.isSuspended && <Ban className="h-3.5 w-3.5 text-red-500" title="Suspended" />}
                             <span className={leader.isSuspended ? "line-through text-gray-400" : ""}>{leader.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${leader.isSuspended ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-[#166534] border-green-150'} inline-flex px-1.5 py-0.5 rounded border font-bold text-[10px] tracking-wide`}>
                            {leader.isSuspended ? 'Suspended' : (leader.basa || 'Mutungamiri')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{leader.groupId}</td>
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">{resolveBranchName(leader.tabheraCode, profiles)}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">{attCount}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">${cAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">${specAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right flex gap-1 justify-end">
                          <button
                            onClick={() => toggleSuspend(leader)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-bold px-2 py-1 rounded border border-gray-300 shadow-sm cursor-pointer whitespace-nowrap flex items-center justify-center min-w-[30px]"
                            title={leader.isSuspended ? "Unsuspend" : "Suspend"}
                          >
                            {leader.isSuspended ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Ban className="h-3 w-3 text-red-600" />}
                          </button>
                          <button
                            onClick={() => generateIDCard(leader)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-bold px-2 py-1 rounded border border-gray-300 shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            Generate ID
                          </button>
                        </td>
                     </tr>
                  );
               })}
               {pagedLeaders.length === 0 && (
                  <tr>
                     <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-xs italic">
                        No Mabasa members matching your filters were found.
                     </td>
                  </tr>
               )}
             </tbody>
           </table>
         </div>

         {/* Pagination component (strict 10 records per page) */}
         {totalPages > 1 && (
           <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50">
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
                     {Math.min(currentPage * ITEMS_PER_PAGE, searchedLeaders.length)}
                   </span>{' '}
                   of <span className="font-semibold">{searchedLeaders.length}</span> results
                 </p>
               </div>
               <div>
                 <nav className="isolate inline-flex -space-x-px rounded-md shadow-xs bg-white" aria-label="Pagination">
                   <button
                     disabled={currentPage === 1}
                     onClick={() => setCurrentPage(1)}
                     className="relative inline-flex items-center rounded-l-md px-2 py-1 bg-white border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                   >
                     First
                   </button>
                   <button
                     disabled={currentPage === 1}
                     onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                     className="relative inline-flex items-center px-2 py-1 bg-white border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
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
                             <span className="relative inline-flex items-center px-3 py-1 text-xs text-gray-500 font-bold border border-gray-200 select-none bg-gray-50">
                               ...
                             </span>
                           )}
                           <button
                             onClick={() => setCurrentPage(page)}
                             className={`relative inline-flex items-center px-3 py-1 text-xs font-bold border ${
                               currentPage === page
                                 ? 'z-10 bg-[#166534] border-[#166534] text-white'
                                 : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
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
                     className="relative inline-flex items-center px-2 py-1 bg-white border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                   >
                     Next
                   </button>
                   <button
                     disabled={currentPage === totalPages}
                     onClick={() => setCurrentPage(totalPages)}
                     className="relative inline-flex items-center rounded-r-md px-2 py-1 bg-white border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
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
    {/* MODAL: Global ID Config */}
      {isIdConfigOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h3 className="font-extrabold text-[#111827] text-sm uppercase tracking-wide mb-4">
                Customize ID Template
              </h3>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Organization Header Text</label>
                  <input
                    type="text"
                    className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                    value={idConfig.orgName}
                    placeholder="Makoni Church"
                    onChange={e => setIdConfig({...idConfig, orgName: e.target.value})}
                  />
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Global Title / Basa Override</label>
                   <input
                     type="text"
                     className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                     value={idConfig.globalBasa}
                     placeholder="Leave blank to use personal titles"
                     onChange={e => setIdConfig({...idConfig, globalBasa: e.target.value})}
                   />
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-1.5">
                     <ImageIcon className="h-3 w-3" /> Church Logo Image
                   </label>
                   <div className="flex gap-2">
                     <input
                       type="text"
                       className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                       value={idConfig.logoUrl}
                       placeholder="Image URL..."
                       onChange={e => setIdConfig({...idConfig, logoUrl: e.target.value})}
                     />
                     <button className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-200 flex items-center justify-center relative cursor-pointer" title="Upload Image">
                        <ImageIcon className="h-4 w-4" />
                        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdConfig({...idConfig, logoUrl: r.result as string}); r.readAsDataURL(f); } }} />
                     </button>
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Layout Style</label>
                   <select 
                     className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                     value={idConfig.layoutStyle}
                     onChange={e => setIdConfig({...idConfig, layoutStyle: e.target.value as any})}
                   >
                     <option value="modern">Modern PVC</option>
                     <option value="classic">Classic Vertical</option>
                     <option value="minimalist">Minimalist</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Front Background Image URL</label>
                   <div className="flex gap-2">
                     <input
                       type="text"
                       className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                       value={idConfig.frontBgUrl}
                       placeholder="https://..."
                       onChange={e => setIdConfig({...idConfig, frontBgUrl: e.target.value})}
                     />
                     <button className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-200 flex items-center justify-center relative cursor-pointer" title="Upload Image">
                        <ImageIcon className="h-4 w-4" />
                        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdConfig({...idConfig, frontBgUrl: r.result as string}); r.readAsDataURL(f); } }} />
                     </button>
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Back Background Image URL</label>
                   <div className="flex gap-2">
                     <input
                       type="text"
                       className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                       value={idConfig.backBgUrl}
                       placeholder="https://..."
                       onChange={e => setIdConfig({...idConfig, backBgUrl: e.target.value})}
                     />
                     <button className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-200 flex items-center justify-center relative cursor-pointer" title="Upload Image">
                        <ImageIcon className="h-4 w-4" />
                        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdConfig({...idConfig, backBgUrl: r.result as string}); r.readAsDataURL(f); } }} />
                     </button>
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Signature Image URL</label>
                   <div className="flex gap-2">
                     <input
                       type="text"
                       className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                       value={idConfig.signatureUrl}
                       placeholder="https://..."
                       onChange={e => setIdConfig({...idConfig, signatureUrl: e.target.value})}
                     />
                     <button className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-200 flex items-center justify-center relative cursor-pointer" title="Upload Image">
                        <ImageIcon className="h-4 w-4" />
                        <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdConfig({...idConfig, signatureUrl: r.result as string}); r.readAsDataURL(f); } }} />
                     </button>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Primary Color</label>
                    <div className="flex gap-2 items-center">
                       <input type="color" className="h-8 w-8 cursor-pointer rounded bg-white p-0.5 border" value={idConfig.primaryColor} onChange={e => setIdConfig({...idConfig, primaryColor: e.target.value})} />
                       <input type="text" className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]" value={idConfig.primaryColor} onChange={e => setIdConfig({...idConfig, primaryColor: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Secondary Color</label>
                    <div className="flex gap-2 items-center">
                       <input type="color" className="h-8 w-8 cursor-pointer rounded bg-white p-0.5 border" value={idConfig.secondaryColor} onChange={e => setIdConfig({...idConfig, secondaryColor: e.target.value})} />
                       <input type="text" className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]" value={idConfig.secondaryColor} onChange={e => setIdConfig({...idConfig, secondaryColor: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Text Color</label>
                     <div className="flex gap-2 items-center">
                        <input type="color" className="h-8 w-8 cursor-pointer rounded bg-white p-0.5 border" value={idConfig.textColor} onChange={e => setIdConfig({...idConfig, textColor: e.target.value})} />
                     </div>
                   </div>
                   <div>
                     <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Font Family</label>
                     <select className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]" value={idConfig.fontFamily} onChange={e => setIdConfig({...idConfig, fontFamily: e.target.value})}>
                       <option value="Inter, sans-serif">Inter</option>
                       <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                       <option value="'Courier New', monospace">Courier New</option>
                     </select>
                   </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Global Expiry Date</label>
                  <input
                    type="date"
                    className="w-full text-xs font-mono p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                    value={idConfig.globalExpiry}
                    onChange={e => setIdConfig({...idConfig, globalExpiry: e.target.value})}
                  />
                  <p className="text-[9px] mt-1 text-gray-400">Sets the default expiry if a leader has no specific expiry.</p>
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-end gap-2 bg-white">
              <button
                type="button"
                onClick={() => setIsIdConfigOpen(false)}
                className="px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-lg shadow cursor-pointer"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Visual Print Preview and High Resolution ID Generator */}
      {previewLeader && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col my-4 max-h-[92vh] animate-scale-up border border-slate-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-slate-50 border-b border-slate-150 py-4 px-6">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-yellow-50 rounded-lg border border-yellow-200">
                  <Printer className="h-5 w-5 text-yellow-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">
                    Mabasa ID Print Preview & Creative Design Studio
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wide">
                    Live branding emulator & high-performance print production engine for <strong>{previewLeader.fullName}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewLeader(null)} 
                className="text-slate-400 font-bold text-xs hover:text-slate-800 uppercase px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <div className="flex-1 p-6 flex flex-col lg:flex-row gap-6 bg-slate-50 overflow-y-auto w-full items-stretch">
               {/* Controls & Customizers Left Panel */}
               <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 overflow-y-auto pr-1">
                  
                  {/* Presets Subsection */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex items-center gap-1.5 border-b pb-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800">Church Brand Presets</h4>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Load Preset Template</label>
                      <select 
                        className="w-full text-xs font-bold p-2.5 border border-sky-100 bg-sky-50/40 text-sky-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-300 cursor-pointer"
                        onChange={(e) => {
                          const idx = parseInt(e.target.value);
                          if (idx >= 0 && idx < CHURCH_PRESETS.length) {
                            const preset = CHURCH_PRESETS[idx];
                            setPreviewIdConfig(prev => ({
                              ...prev,
                              orgName: preset.orgName,
                              primaryColor: preset.primaryColor,
                              secondaryColor: preset.secondaryColor,
                              textColor: preset.textColor,
                              layoutStyle: preset.layoutStyle,
                              logoUrl: preset.logoUrl || prev.logoUrl,
                              frontBgUrl: preset.frontBgUrl || prev.frontBgUrl,
                              backBgUrl: preset.backBgUrl || prev.backBgUrl
                            }));
                            toast.success(`Loaded presets for "${preset.name}"!`);
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>-- Customize from regional presets --</option>
                        {CHURCH_PRESETS.map((p, idx) => (
                          <option key={idx} value={idx}>{p.name}</option>
                        ))}
                      </select>
                      <p className="text-[9px] mt-1 text-slate-400 italic">Overrides standard colors and style dynamically for the active preview card.</p>
                    </div>
                  </div>

                  {/* Manual Brand Adjustments */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-center gap-1.5 border-b pb-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800">Customize Style & Colors</h4>
                    </div>
                    
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Church / Assembly Name</label>
                      <input
                        type="text"
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-[#166534]"
                        value={previewIdConfig.orgName}
                        onChange={e => setPreviewIdConfig({ ...previewIdConfig, orgName: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Primary Theme</label>
                        <div className="flex gap-1 items-center">
                           <input 
                             type="color" 
                             className="h-8 w-8 cursor-pointer rounded-lg bg-white p-0.5 border" 
                             value={previewIdConfig.primaryColor} 
                             onChange={e => setPreviewIdConfig({ ...previewIdConfig, primaryColor: e.target.value })} 
                           />
                           <input 
                             type="text" 
                             className="w-full text-[10px] font-mono p-1 border border-slate-200 rounded" 
                             value={previewIdConfig.primaryColor} 
                             onChange={e => setPreviewIdConfig({ ...previewIdConfig, primaryColor: e.target.value })} 
                           />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Secondary Theme</label>
                        <div className="flex gap-1 items-center">
                           <input 
                             type="color" 
                             className="h-8 w-8 cursor-pointer rounded-lg bg-white p-0.5 border" 
                             value={previewIdConfig.secondaryColor} 
                             onChange={e => setPreviewIdConfig({ ...previewIdConfig, secondaryColor: e.target.value })} 
                           />
                           <input 
                             type="text" 
                             className="w-full text-[10px] font-mono p-1 border border-slate-200 rounded" 
                             value={previewIdConfig.secondaryColor} 
                             onChange={e => setPreviewIdConfig({ ...previewIdConfig, secondaryColor: e.target.value })} 
                           />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Card Layout Silhouette</label>
                      <select 
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white focus:outline-[#166534]"
                        value={previewIdConfig.layoutStyle}
                        onChange={e => setPreviewIdConfig({ ...previewIdConfig, layoutStyle: e.target.value as any })}
                      >
                        <option value="modern">Modern PVC Card</option>
                        <option value="classic">Classic Vertical ID</option>
                        <option value="minimalist">Minimalist Portrait</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Global Expiry Override</label>
                      <input
                        type="date"
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-[#166534]"
                        value={previewIdConfig.globalExpiry}
                        onChange={e => setPreviewIdConfig({ ...previewIdConfig, globalExpiry: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                        <span>Church Logo</span>
                        {previewIdConfig.logoUrl && (
                          <button 
                            type="button" 
                            onClick={() => setPreviewIdConfig({ ...previewIdConfig, logoUrl: '' })}
                            className="text-[8px] text-red-500 hover:underline normal-case font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Logo Image URL"
                          className="flex-1 text-xs font-mono p-2 border border-slate-200 rounded-lg focus:outline-[#166534]"
                          value={previewIdConfig.logoUrl || ''}
                          onChange={e => setPreviewIdConfig({ ...previewIdConfig, logoUrl: e.target.value })}
                        />
                        <button className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center relative cursor-pointer" title="Upload Logo">
                          <ImageIcon className="h-4 w-4 text-slate-600" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (!file) return;
                               const reader = new FileReader();
                               reader.onloadend = () => {
                                 setPreviewIdConfig({ ...previewIdConfig, logoUrl: reader.result as string });
                               };
                               reader.readAsDataURL(file);
                            }}
                          />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                        <span>Front Card Background</span>
                        {previewIdConfig.frontBgUrl && (
                          <button 
                            type="button" 
                            onClick={() => setPreviewIdConfig({ ...previewIdConfig, frontBgUrl: '' })}
                            className="text-[8px] text-red-500 hover:underline normal-case font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Background Image URL"
                          className="flex-1 text-xs font-mono p-2 border border-slate-200 rounded-lg focus:outline-[#166534]"
                          value={previewIdConfig.frontBgUrl || ''}
                          onChange={e => setPreviewIdConfig({ ...previewIdConfig, frontBgUrl: e.target.value })}
                        />
                        <button className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center relative cursor-pointer" title="Upload Front Background">
                          <ImageIcon className="h-4 w-4 text-slate-600" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (!file) return;
                               const reader = new FileReader();
                               reader.onloadend = () => {
                                 setPreviewIdConfig({ ...previewIdConfig, frontBgUrl: reader.result as string });
                               };
                               reader.readAsDataURL(file);
                            }}
                          />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                        <span>Back Card Background</span>
                        {previewIdConfig.backBgUrl && (
                          <button 
                            type="button" 
                            onClick={() => setPreviewIdConfig({ ...previewIdConfig, backBgUrl: '' })}
                            className="text-[8px] text-red-500 hover:underline normal-case font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Background Image URL"
                          className="flex-1 text-xs font-mono p-2 border border-slate-200 rounded-lg focus:outline-[#166534]"
                          value={previewIdConfig.backBgUrl || ''}
                          onChange={e => setPreviewIdConfig({ ...previewIdConfig, backBgUrl: e.target.value })}
                        />
                        <button className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center relative cursor-pointer" title="Upload Back Background">
                          <ImageIcon className="h-4 w-4 text-slate-600" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (!file) return;
                               const reader = new FileReader();
                               reader.onloadend = () => {
                                 setPreviewIdConfig({ ...previewIdConfig, backBgUrl: reader.result as string });
                               };
                               reader.readAsDataURL(file);
                            }}
                          />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIdConfig(previewIdConfig);
                        toast.success("Successfully saved this branded design layout as the global default workspace settings!");
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-black text-white font-bold text-[10px] rounded-xl border border-slate-800 shadow-sm transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                    >
                      💾 Save as Default Design
                    </button>
                  </div>

                  {/* Card overrides and controls */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-center gap-1.5 border-b pb-1.5">
                      <ImageIcon className="h-4 w-4 text-indigo-500" />
                      <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800">Leader Override Info</h4>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Expiration for This Card</label>
                      <input
                        type="date"
                        className="w-full text-xs font-mono p-2 border border-slate-200 rounded-lg focus:outline-[#166534]"
                        value={previewLeader.idExpiryDate || previewIdConfig.globalExpiry}
                        onChange={async (e) => {
                           const val = e.target.value;
                           const updatedLeader = { ...previewLeader, idExpiryDate: val };
                           setPreviewLeader(updatedLeader);
                           const allMembers = await getMembers();
                           const updated = allMembers.map(m => m.memberId === previewLeader.memberId ? { ...m, idExpiryDate: val } : m);
                           await saveMembers(updated);
                           setLeadership(updated.filter(m => m.isLeadership));
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Leader Photo</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Image URL"
                          className="flex-1 text-xs font-mono p-2 border border-slate-200 rounded-lg focus:outline-[#166534]"
                          value={previewLeader.pictureUrl || ''}
                          onChange={async (e) => {
                             const val = e.target.value;
                             const updatedLeader = { ...previewLeader, pictureUrl: val };
                             setPreviewLeader(updatedLeader);
                             const allMembers = await getMembers();
                             const updated = allMembers.map(m => m.memberId === previewLeader.memberId ? { ...m, pictureUrl: val } : m);
                             await saveMembers(updated);
                             setLeadership(updated.filter(m => m.isLeadership));
                          }}
                        />
                        <button className="px-2.5 bg-[#475569]/10 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center relative cursor-pointer" title="Upload Photo">
                          <ImageIcon className="h-4 w-4 text-slate-600" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={async (e) => {
                               const file = e.target.files?.[0];
                               if (!file) return;
                               const reader = new FileReader();
                               reader.onloadend = async () => {
                                 const base64 = reader.result as string;
                                 const updatedLeader = { ...previewLeader, pictureUrl: base64 };
                                 setPreviewLeader(updatedLeader);
                                 const allMembers = await getMembers();
                                 const updated = allMembers.map(m => m.memberId === previewLeader.memberId ? { ...m, pictureUrl: base64 } : m);
                                 await saveMembers(updated);
                                 setLeadership(updated.filter(m => m.isLeadership));
                               };
                               reader.readAsDataURL(file);
                            }}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Public Barcode View</label>
                      <button 
                        onClick={() => setShowPublicScan(!showPublicScan)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${showPublicScan ? 'bg-[#166534]' : 'bg-slate-200'}`}
                        title="Toggle Verification Screen View"
                      >
                        <span className={`block w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform ${showPublicScan ? 'translate-x-5.5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
               </div>

               {/* Center Preview Viewport */}
               <div className="flex-1 bg-slate-200/50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center relative min-h-[400px]">
                  <div className="absolute top-3 left-4 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-white py-1 px-2.5 rounded-full border border-slate-200/50">
                    Live WYSIWYG Print Canvas
                  </div>

                  {showPublicScan ? (
                     <div className="w-full max-w-[320px] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex flex-col transition-all duration-300">
                       <div 
                         className="p-6 text-center text-white flex flex-col items-center flex-shrink-0"
                         style={{ backgroundColor: previewLeader?.isSuspended ? '#d97706' : previewIdConfig.primaryColor }}
                       >
                          <h1 className="text-xl font-black tracking-tight mt-2 uppercase">
                            {previewLeader?.isSuspended ? 'SUSPENDED' : 
                             (((previewLeader?.idExpiryDate && new Date(previewLeader.idExpiryDate) < new Date()) || (!previewLeader?.idExpiryDate && new Date(previewIdConfig.globalExpiry) < new Date())) ? 'INVALID ID' : 
                             'VALID ID')}
                          </h1>
                          <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">{previewIdConfig.orgName || 'Church'}</p>
                       </div>
                       <div className="p-6 space-y-4 flex-1">
                         {previewLeader?.pictureUrl && (
                            <div className="flex justify-center -mt-12 relative z-10 mb-2">
                              <img src={previewLeader.pictureUrl} alt="ID" className="h-20 w-20 rounded-full border-4 border-white shadow-md object-cover bg-white" />
                            </div>
                         )}
                         <div>
                           <label className="text-[9px] font-black text-slate-450 uppercase block tracking-wider">Leader Full Name</label>
                           <p className="font-extrabold text-slate-900 border-b border-rose-50/20 pb-0.5">{previewLeader?.fullName}</p>
                         </div>
                         <div>
                           <label className="text-[9px] font-black text-slate-455 uppercase block tracking-wider">Mabasa Title</label>
                           <p className="font-semibold text-slate-800">{previewLeader?.basa || previewIdConfig.globalBasa || 'Mutungamiri'}</p>
                         </div>
                         <div>
                           <label className="text-[9px] font-black text-slate-455 uppercase block tracking-wider">Administrative Number</label>
                           <p className="font-mono text-slate-700 text-sm">{previewLeader?.memberNumber || previewLeader?.memberId.substring(0, 8).toUpperCase()}</p>
                         </div>
                         <div>
                           <label className="text-[9px] font-black text-slate-455 uppercase block tracking-wider">Expiration Date</label>
                           <p className={`font-mono text-sm ${
                             ((previewLeader?.idExpiryDate && new Date(previewLeader.idExpiryDate) < new Date()) || (!previewLeader?.idExpiryDate && new Date(previewIdConfig.globalExpiry) < new Date())) ? 'text-red-650 font-bold' : 'text-slate-800'
                           }`}>
                             {previewLeader?.idExpiryDate || previewIdConfig.globalExpiry}
                           </p>
                         </div>
                       </div>
                     </div>
                  ) : (
                     <div className="w-full overflow-x-auto selection:bg-transparent flex justify-center py-4 select-none animate-fade-in">
                       {/* Container where the HTML image node resides. We scale it nicely to fit any viewport size. */}
                       <div className="shadow-2xl rounded-[16px] bg-white border border-slate-100 overflow-hidden transform origin-center scale-[0.55] sm:scale-[0.6] md:scale-[0.7] lg:scale-[0.8] xl:scale-95 shrink-0 mx-auto transition-transform">
                          <IDCardTemplate ref={idTemplateRef} leader={{...previewLeader, basa: previewIdConfig.globalBasa || previewLeader.basa}} config={previewIdConfig} profiles={profiles} />
                       </div>
                     </div>
                  )}

                  {!showPublicScan && (
                    <div className="text-[10px] text-slate-505 font-semibold tracking-wide text-center max-w-sm mt-2">
                       💡 Render template is side-by-side (CR80 standard Front and Back). You can print both combined, or choose specific sides below.
                    </div>
                  )}
               </div>

               {/* Production Export Sidebar Right Panel */}
               <div className="w-full lg:w-64 flex flex-col gap-4 shrink-0 justify-between">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5 border-b pb-2">
                        <Printer className="h-4 w-4 text-blue-600" />
                        <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800">Production Engine</h4>
                      </div>
                      
                      <div className="space-y-3">
                         <div>
                           <label className="block text-[9.5px] uppercase font-black text-slate-450 mb-1">Print Layout Selection</label>
                           <select 
                             value={pngExportSide}
                             onChange={(e) => setPngExportSide(e.target.value)}
                             className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-slate-350 bg-white cursor-pointer"
                           >
                             <option value="both">Both Sides (Full Spread)</option>
                             <option value="front">Front Card Layout Only</option>
                             <option value="back">Back Security QR Layout Only</option>
                           </select>
                         </div>

                         <div>
                           <label className="block text-[9.5px] uppercase font-black text-slate-455 mb-1">Graphic Resolution Factor</label>
                           <select 
                             value={resolutionScale}
                             onChange={(e) => setResolutionScale(parseFloat(e.target.value))}
                             className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none bg-white cursor-pointer"
                           >
                             <option value="1.5">1.5x Pixels (Standard Web Preview - Fast)</option>
                             <option value="2.5">2.5x Pixels (DPI Printer Sharp - Optimal)</option>
                             <option value="3.5">3.5x Pixels (Archival UHD 300+ DPI - Heavy Size)</option>
                           </select>
                           <p className="text-[8.5px] mt-1 text-slate-400">High Resolution scale improves print text sharpness and logo clarity.</p>
                         </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-slate-100">
                      <button 
                        onClick={() => {
                          toast.promise(
                            executeExport('png'),
                            {
                              loading: 'Regulating graphics canvas and rendering High-Resolution PNG card...',
                              success: 'High-Resolution PNG downloaded successfully!',
                              error: 'Could not export PNG card. Ensure all images are properly served.',
                            }
                          );
                        }} 
                        className="w-full py-3 bg-[#1D4ED8] hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-md uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                      >
                        <Sparkles className="h-4 w-4" />
                        Download PNG
                      </button>

                      <button 
                        onClick={() => {
                          toast.promise(
                            executeExport('pdf'),
                            {
                              loading: 'Arranging pages and exporting standard PDF...',
                              success: 'Document PDF saved successfully!',
                              error: 'Could not generate PDF. Please try again.',
                            }
                          );
                        }} 
                        className="w-full py-3 bg-[#166534] hover:bg-green-800 text-white font-extrabold text-xs rounded-xl shadow-md uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                      >
                        <FileText className="h-4 w-4" />
                        Download PDF Booklet
                      </button>
                      
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[8.5px] text-slate-500 font-semibold leading-relaxed text-center">
                        ⚠️ <strong>Core Notice:</strong> Please wait 1-2 seconds for your custom profile photographs to initialize completely before triggering download.
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
