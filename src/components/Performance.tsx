import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  UserProfile,
  JdnLevel,
  Member,
  ContributionLog,
  UnganoPayment,
  MurairoType,
  UnganoCategory,
  ContributionTarget
} from '../types';
import {
  getMembers,
  getContributions,
  getUnganoPayments,
  getMurairoTypes,
  getUnganoCategories,
  getContributionTargets,
  saveContributionTargets,
  getUserProfiles,
  addPlatformLog,
  resolveBranchName,
  getSettings,
  getCurrencies
} from '../lib/storage';
import { JdnSettings } from '../types';
import * as XLSX from 'xlsx';
import {
  Trophy,
  Target,
  Search,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Award,
  Plus,
  Coins,
  ShieldCheck,
  Building2,
  Users,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  BarChart2,
  AlertCircle,
  Download,
  FileText,
  ArrowUpDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PerformanceProps {
  currentUser: UserProfile;
}

type EntityTier = 'Member' | 'Family' | 'Tabhera' | 'District' | 'Province' | 'Wellness Center' | 'Nation' | 'Nyika';

export function Performance({ currentUser }: PerformanceProps) {
  // Database States
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<ContributionLog[]>([]);
  const [unganoPayments, setUnganoPayments] = useState<UnganoPayment[]>([]);
  const [murairoTypes, setMurairoTypes] = useState<MurairoType[]>([]);
  const [unganoCategories, setUnganoCategories] = useState<UnganoCategory[]>([]);
  const [targets, setTargets] = useState<ContributionTarget[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<JdnSettings | null>(null);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(['USD', 'ZWG', 'ZAR']);
  const [isLoading, setIsLoading] = useState(true);

  // Active View States
  const [activeTier, setActiveTier] = useState<EntityTier>('Member');
  const [selectedContributionType, setSelectedContributionType] = useState<string>('all'); // 'all', 'std-ID', 'spe-ID'
  const [searchFilter, setSearchFilter] = useState('');
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterContributorType, setFilterContributorType] = useState<'all' | 'members' | 'guests'>('all');
  const [rankMetric, setRankMetric] = useState<'finance' | 'jorodhani'>('finance');
  const [subTab, setSubTab] = useState<'rankings' | 'murairo_stats' | 'currency_rankings'>('rankings');
  const [murairoSearch, setMurairoSearch] = useState('');

  const getAllowedTiers = (): EntityTier[] => {
    const lvl = currentUser.level;
    if (lvl === JdnLevel.SYSTEM || lvl === JdnLevel.JERUSALEM) {
      return ['Member', 'Family', 'Tabhera', 'Wellness Center', 'Nyika', 'District', 'Province', 'Nation'];
    }
    if (lvl === JdnLevel.NATIONAL) {
      return ['Member', 'Family', 'Tabhera', 'Wellness Center', 'Nyika', 'District', 'Province', 'Nation'];
    }
    if (lvl === JdnLevel.PROVINCIAL) {
      return ['Member', 'Family', 'Tabhera', 'Wellness Center', 'Nyika', 'District', 'Province'];
    }
    if (lvl === JdnLevel.DISTRICT) {
      return ['Member', 'Family', 'Tabhera', 'Wellness Center', 'Nyika', 'District'];
    }
    if (lvl === JdnLevel.NYIKA) {
      return ['Member', 'Family', 'Tabhera', 'Wellness Center', 'Nyika'];
    }
    if (lvl === JdnLevel.TABHERA) {
      return ['Member', 'Family', 'Tabhera'];
    }
    // Default fallback
    return ['Member', 'Family', 'Wellness Center'];
  };

  const isSetTargetEnabled = currentUser.level === JdnLevel.JERUSALEM || currentUser.level === JdnLevel.TABHERA || currentUser.level === JdnLevel.SYSTEM;

  const getSelectableTargetTiers = (): { value: EntityTier; label: string }[] => {
    if (currentUser.level === JdnLevel.TABHERA) {
      return [
        { value: 'Member', label: 'Member (Individual)' },
        { value: 'Family', label: 'Family' }
      ];
    }
    return [
      { value: 'Member', label: 'Member (Individual)' },
      { value: 'Family', label: 'Family' },
      { value: 'Tabhera', label: 'Tabhera Branch' },
      { value: 'Wellness Center', label: 'Wellness Center' },
      { value: 'Nyika', label: 'Nyika' },
      { value: 'District', label: 'District' },
      { value: 'Province', label: 'Province' },
      { value: 'Nation', label: 'Nation' }
    ];
  };

  // Form states to set target
  const [targetEntityType, setTargetEntityType] = useState<EntityTier>('Member');
  const [targetEntityId, setTargetEntityId] = useState('');
  const [targetContributionId, setTargetContributionId] = useState('all');
  const [targetAmount, setTargetAmount] = useState('');
  const [entitySearch, setEntitySearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  useEffect(() => {
    loadAllRecords();
  }, [currentUser]);

  const loadAllRecords = async () => {
    // Only show loading if empty
    if (members.length === 0 && contributions.length === 0) {
      setIsLoading(true);
    }
    try {
      const allMems = await getMembers();
      const allContrs = await getContributions();
      const allPays = await getUnganoPayments();
      const mTypes = await getMurairoTypes();
      const uCats = await getUnganoCategories();
      const allTargs = await getContributionTargets();
      const allUsers = await getUserProfiles();
      const sets = await getSettings();
      const currValues = await getCurrencies();

      const isSysAdm = currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM;

      // Filter logic: Current user can only see records belonging strictly to their code or branches under them.
      const mems = isSysAdm ? allMems : allMems.filter(m => m.tabheraCode === currentUser.levelCode || m.tabheraCode.startsWith(currentUser.levelCode + '/'));
      
      const contrs = isSysAdm ? allContrs : allContrs.filter(c => {
         // Either the payload comes from a member in our scope, or from an admin in our scope
         const memInfo = allMems.find(m => m.memberId === c.memberId);
         if (memInfo) {
           return memInfo.tabheraCode === currentUser.levelCode || memInfo.tabheraCode.startsWith(currentUser.levelCode + '/');
         }
         return false; // Assuming all logs correspond to a member for now
      });

      const pays = isSysAdm ? allPays : allPays.filter(p => (p as any).submittedByCode === currentUser.levelCode || (p as any).submittedByCode?.startsWith(currentUser.levelCode + '/'));
      
      const uCodes = new Set(allUsers.filter(u => u.levelCode === currentUser.levelCode || u.levelCode.startsWith(currentUser.levelCode + '/')).map(u => u.levelCode));
      const users = isSysAdm ? allUsers : allUsers.filter(u => uCodes.has(u.levelCode));

      const targs = isSysAdm ? allTargs : allTargs.filter(t => uCodes.has(t.entityId) || t.entityType === 'Member'); // Members filtering will happen downstream

      setMembers(mems);
      setContributions(contrs);
      setUnganoPayments(pays);
      setMurairoTypes(mTypes);
      setUnganoCategories(uCats);
      setTargets(targs);
      setProfiles(users);
      setSettings(sets);
      setSupportedCurrencies(currValues);

    } catch (e) {
      toast.error('Failed to load performance datasets.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Currency parser standard to USD conversion
  const convertToUSD = (amount: number, curr: string): number => {
    if (!curr || curr === 'USD') return amount;
    if (curr === 'ZAR') return amount / 18.5;
    if (curr === 'ZWG') return amount / 25.0;
    return amount;
  };

  // Helper: Find exact name of any code at any level
  const findEntityFriendlyName = (entityId: string, type: EntityTier): string => {
    if (type === 'Member') {
      const match = members.find(m => m.memberId === entityId);
      return match ? match.fullName : entityId;
    }
    if (type === 'Family') {
      return entityId.replace('family-', '');
    }
    if (type === 'Nyika') {
      const match = profiles.find(p => p.levelCode === entityId);
      if (match) return match.branchName;
      return resolveBranchName(entityId, profiles);
    }
    // Search in user profiles for administrative branch name
    const match = profiles.find(p => p.levelCode === entityId);
    if (match) return match.branchName;
    return resolveBranchName(entityId, profiles);
  };

  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Helper Parser: Splits hierarchical path to associate log entries with organizational tiers
  const getEntityCodeForPath = (path: string, type: EntityTier, memberTabheraCode?: string): string => {
    const rawCode = path || memberTabheraCode || '';
    if (!rawCode) return 'SYS-GLOBAL';

    const parts = rawCode.split('/');
    let res = '';
    
    if (type === 'Nation') {
      const p = parts.find(item => item.startsWith('NAT-'));
      if (p) {
        const idx = parts.indexOf(p);
        res = parts.slice(0, idx + 1).join('/');
      }
    } else if (type === 'Province') {
      const p = parts.find(item => item.startsWith('PROV-'));
      if (p) {
        const idx = parts.indexOf(p);
        res = parts.slice(0, idx + 1).join('/');
      }
    } else if (type === 'District') {
      const p = parts.find(item => item.startsWith('DIS-') || item.startsWith('DIST-'));
      if (p) {
        const idx = parts.indexOf(p);
        res = parts.slice(0, idx + 1).join('/');
      }
    } else if (type === 'Nyika') {
      const p = parts.find(item => item.startsWith('NYI-') || item.startsWith('NYIKA-'));
      if (p) {
        const idx = parts.indexOf(p);
        res = parts.slice(0, idx + 1).join('/');
      }
    } else if (type === 'Wellness Center') {
      const p = parts.find(item => item.startsWith('WLC-'));
      if (p) {
        const idx = parts.indexOf(p);
        res = parts.slice(0, idx + 1).join('/');
      }
    } else if (type === 'Tabhera') {
      const p = parts.find(item => item.startsWith('TAB-'));
      if (p) {
        const idx = parts.indexOf(p);
        res = parts.slice(0, idx + 1).join('/');
      } else {
        // Fallback for wellness centers which operate as tabheras in payments sometimes
        const isWlc = parts.some(item => item.startsWith('WLC-'));
        if (isWlc) {
          const wP = parts.find(item => item.startsWith('WLC-'));
          if (wP) {
            const idx = parts.indexOf(wP);
            res = parts.slice(0, idx + 1).join('/');
          }
        }
      }
    }
    return res || (parts[parts.length - 1] ? parts.join('/') : 'SYS-GLOBAL');
  };

  // Process and compile full performance grid
  const compileRankings = () => {
    // Collect all elements belonging to current Tier
    let uniqueEntities: { id: string; name: string; subtables: string }[] = [];

    if (activeTier === 'Member') {
      if (filterContributorType === 'guests') {
        const guestContributions = contributions.filter(c => c.isGuest && c.guestName);
        const uniqueGuestNames = Array.from(new Set(guestContributions.map(c => c.guestName?.trim())));
        uniqueEntities = uniqueGuestNames.map((gName: any) => ({
          id: `guest-${gName}`,
          name: `[GUEST] ${gName}`,
          subtables: 'Guest Contributor'
        }));
      } else {
        uniqueEntities = members.map(m => ({
          id: m.memberId,
          name: m.fullName,
          subtables: resolveBranchName(m.tabheraCode, profiles)
        }));
      }
    } else if (activeTier === 'Family') {
      const familyNames = Array.from(new Set(members.map(m => m.family).filter(Boolean))) as string[];
      uniqueEntities = familyNames.map(fName => ({
        id: `family-${fName}`,
        name: `${fName} Family`,
        subtables: 'Family Circle'
      }));
    } else if (activeTier === 'Tabhera') {
      // Find all unique Tabhera levelCodes in members and profiles
      const codesSet = new Set<string>();
      members.forEach(m => {
        const tabCode = getEntityCodeForPath(m.tabheraCode, 'Tabhera');
        if (tabCode) codesSet.add(tabCode);
      });
      profiles.filter(p => p.level === JdnLevel.TABHERA).forEach(p => {
        codesSet.add(p.levelCode);
      });
      uniqueEntities = Array.from(codesSet).map(code => ({
        id: code,
        name: findEntityFriendlyName(code, 'Tabhera'),
        subtables: 'Tabhera Unit'
      }));
    } else if (activeTier === 'Wellness Center') {
      const codesSet = new Set<string>();
      profiles.filter(p => p.level === JdnLevel.WELLNESS_CENTER).forEach(p => {
        codesSet.add(p.levelCode);
      });
      // also check in members with WLC tabheracode
      members.forEach(m => {
        if (m.tabheraCode.includes('/WLC-')) {
          const wlcCode = getEntityCodeForPath(m.tabheraCode, 'Wellness Center');
          if (wlcCode) codesSet.add(wlcCode);
        }
      });
      uniqueEntities = Array.from(codesSet).map(code => ({
        id: code,
        name: findEntityFriendlyName(code, 'Wellness Center'),
        subtables: 'Wellness Center Site'
      }));
    } else if (activeTier === 'Nyika') {
      const codesSet = new Set<string>();
      members.forEach(m => {
        const nyiCode = getEntityCodeForPath(m.tabheraCode, 'Nyika');
        if (nyiCode && (nyiCode.includes('NYI-') || nyiCode.includes('NYIKA-'))) codesSet.add(nyiCode);
      });
      profiles.filter(p => p.level === JdnLevel.NYIKA).forEach(p => {
        codesSet.add(p.levelCode);
      });
      uniqueEntities = Array.from(codesSet).map(code => ({
        id: code,
        name: findEntityFriendlyName(code, 'Nyika'),
        subtables: 'Nyika Branch'
      }));
    } else if (activeTier === 'District') {
      const codesSet = new Set<string>();
      members.forEach(m => {
        const distCode = getEntityCodeForPath(m.tabheraCode, 'District');
        if (distCode && distCode.includes('DIS-')) codesSet.add(distCode);
      });
      profiles.filter(p => p.level === JdnLevel.DISTRICT).forEach(p => {
        codesSet.add(p.levelCode);
      });
      uniqueEntities = Array.from(codesSet).map(code => ({
        id: code,
        name: findEntityFriendlyName(code, 'District'),
        subtables: 'District HQ'
      }));
    } else if (activeTier === 'Province') {
      const codesSet = new Set<string>();
      members.forEach(m => {
        const provCode = getEntityCodeForPath(m.tabheraCode, 'Province');
        if (provCode && provCode.includes('PROV-')) codesSet.add(provCode);
      });
      profiles.filter(p => p.level === JdnLevel.PROVINCIAL).forEach(p => {
        codesSet.add(p.levelCode);
      });
      uniqueEntities = Array.from(codesSet).map(code => ({
        id: code,
        name: findEntityFriendlyName(code, 'Province'),
        subtables: 'Provincial Area'
      }));
    } else if (activeTier === 'Nation') {
      const codesSet = new Set<string>();
      members.forEach(m => {
        const natCode = getEntityCodeForPath(m.tabheraCode, 'Nation');
        if (natCode && natCode.includes('NAT-')) codesSet.add(natCode);
      });
      profiles.filter(p => p.level === JdnLevel.NATIONAL).forEach(p => {
        codesSet.add(p.levelCode);
      });
      uniqueEntities = Array.from(codesSet).map(code => ({
        id: code,
        name: findEntityFriendlyName(code, 'Nation'),
        subtables: 'National HQ'
      }));
    }

    // Now compile performance amounts for each uniqueEntity based on selected contribution filter
    const compiled = uniqueEntities.map(entity => {
      let raisedUSD = 0;

      // Filter contributions and unganoPayments by contributor class
      const activeContributions = contributions.filter(c => {
        if (filterContributorType === 'guests') return c.isGuest === true;
        if (filterContributorType === 'members') return c.isGuest !== true;
        return true;
      });

      const activeUnganoPayments = unganoPayments.filter(p => {
        if (filterContributorType === 'guests') return p.typeClass === 'special-guest'; // or custom guest ungano category
        if (filterContributorType === 'members') return true;
        return true;
      });

      // Classify filter
      const isFilterAll = selectedContributionType === 'all';
      const isFilterStd = selectedContributionType.startsWith('std-');
      const isFilterSpe = selectedContributionType.startsWith('spe-');
      const filterId = selectedContributionType.substring(4); // trim std- or spe- prefix

      // Sum standard contributions
      if (isFilterAll || isFilterStd) {
        let matchingConts = activeContributions;
        if (isFilterStd) {
          matchingConts = activeContributions.filter(c => c.murairoId === filterId);
        }

        // Apply entity scopes
        if (activeTier === 'Member') {
          matchingConts = matchingConts.filter(c => c.memberId === entity.id);
        } else if (activeTier === 'Family') {
          const famName = entity.id.replace('family-', '');
          matchingConts = matchingConts.filter(c => {
            const m = members.find(x => x.memberId === c.memberId);
            return m?.family === famName;
          });
        } else {
          matchingConts = matchingConts.filter(c => {
            const entCode = getEntityCodeForPath(c.hierarchyPath || c.tabheraCode, activeTier);
            return entCode === entity.id;
          });
        }

        raisedUSD += matchingConts.reduce((sum, c) => sum + convertToUSD(c.amount, c.currency), 0);
      }

      // Sum special ungano log payments
      if (isFilterAll || isFilterSpe) {
        let matchingPays = activeUnganoPayments;
        if (isFilterSpe) {
          matchingPays = activeUnganoPayments.filter(p => p.categoryId === filterId);
        }

        // Apply entity scopes
        if (activeTier === 'Member') {
          matchingPays = matchingPays.filter(p => p.memberId === entity.id);
        } else if (activeTier === 'Family') {
          const famName = entity.id.replace('family-', '');
          matchingPays = matchingPays.filter(p => {
            const m = members.find(x => x.memberId === p.memberId);
            return m?.family === famName;
          });
        } else {
          matchingPays = matchingPays.filter(p => {
            const entCode = getEntityCodeForPath(p.hierarchyPath, activeTier);
            return entCode === entity.id;
          });
        }

        raisedUSD += matchingPays.reduce((sum, p) => sum + convertToUSD(p.amountPaid, p.currency), 0);
      }

      // Lookup target
      const matchTarget = targets.find(t => 
        t.entityId === entity.id && 
        t.entityType === activeTier && 
        t.typeId === selectedContributionType
      );
      const targetAmount = matchTarget ? matchTarget.targetAmount : 0;
      
      const completionPct = targetAmount > 0 ? (raisedUSD / targetAmount) * 100 : 0;
      const variance = raisedUSD - targetAmount;

      // Calculate extra metrics: Newcomers (Jorodhani Status)
      let jorodhaniCount = 0;

      if (activeTier === 'Member') {
        if (entity.id.startsWith('guest-')) {
          jorodhaniCount = 0;
        } else {
          const m = members.find(x => x.memberId === entity.id);
          if (m) {
            jorodhaniCount = m.isJorodhani ? 1 : 0;
          }
        }
      } else if (activeTier === 'Family') {
        const famName = entity.id.replace('family-', '');
        const unitMembers = members.filter(m => m.family === famName);
        jorodhaniCount = unitMembers.filter(m => m.isJorodhani).length;
      } else {
        const unitMembers = members.filter(m => {
          const entCode = getEntityCodeForPath(m.tabheraCode, activeTier);
          return entCode === entity.id;
        });

        jorodhaniCount = unitMembers.filter(m => m.isJorodhani).length;
      }

      return {
        id: entity.id,
        name: entity.name,
        subname: entity.subtables,
        raised: raisedUSD,
        target: targetAmount,
        pct: completionPct,
        variance: variance,
        jorodhaniCount: jorodhaniCount
      };
    });

    if (rankMetric === 'jorodhani') {
      if (sortOrder === 'asc') {
        return compiled.sort((a, b) => a.jorodhaniCount - b.jorodhaniCount);
      }
      return compiled.sort((a, b) => b.jorodhaniCount - a.jorodhaniCount);
    } else {
      if (sortOrder === 'asc') {
        return compiled.sort((a, b) => a.raised - b.raised);
      }
      return compiled.sort((a, b) => b.raised - a.raised);
    }
  };

  const currentRankings = compileRankings();

  const exportPDF = () => {
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
    doc.text(`OFFICIAL PERFORMANCE RANKINGS REPORT (${activeTier.toUpperCase()} TIER)`, 14, 35);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Active Level: ${currentUser.levelCode || 'Jerusalem HQ'}`, 14, 40);

    const tableCols = ["Rank", "Identity", "Branch/Type", "Raised (USD)", "Target", "Variance", "Newcomers (Jorodhani)"];
    const tableRows = currentRankings.map((r, i) => [
      `#${i + 1}`,
      r.name,
      r.subname || activeTier,
      `$${r.raised.toFixed(2)}`,
      r.target > 0 ? `$${r.target.toFixed(2)}` : 'N/A',
      r.variance >= 0 ? `+$${r.variance.toFixed(2)}` : `-$${Math.abs(r.variance).toFixed(2)}`,
      r.jorodhaniCount.toString()
    ]);

    autoTable(doc, {
      head: [tableCols],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] }, // JDN Green
      styles: { fontSize: 7 }
    });

    doc.save(`Performance_Report_${activeTier}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportExcel = () => {
    // Generate detailed export
    const rows = currentRankings.map((r, i) => ({
      Rank: i + 1,
      Identity: r.name,
      Branch: r.subname || activeTier,
      'Total Raised (USD)': parseFloat(r.raised.toFixed(2)),
      'Target (USD)': r.target > 0 ? parseFloat(r.target.toFixed(2)) : 'N/A',
      Variance: parseFloat(r.variance.toFixed(2)),
      'Newcomers (Jorodhani)': r.jorodhaniCount
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Performance Report");
    XLSX.writeFile(workbook, `Performance_Report_${activeTier}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Handle setting a custom target
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetEntityId) {
      toast.error('Please select or specify a valid entity target.');
      return;
    }

    const amt = parseFloat(targetAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid target contribution amount in USD.');
      return;
    }

    try {
      const allTargets = await getContributionTargets();
      const targetId = `targ-${Date.now()}`;

      // Calculate localized display name of entity
      const entityName = findEntityFriendlyName(targetEntityId, targetEntityType);

      const newTarget: ContributionTarget = {
        id: targetId,
        entityId: targetEntityId,
        entityType: targetEntityType,
        entityName,
        typeId: targetContributionId,
        typeClass: targetContributionId.startsWith('std-') ? 'standard' : 'special',
        targetAmount: amt,
        currency: 'USD',
        createdAt: new Date().toISOString()
      };

      // Exclude pre-existing targets matching entity & type to allow perfect overrides
      const filtered = allTargets.filter(t => 
        !(t.entityId === targetEntityId && 
          t.entityType === targetEntityType && 
          t.typeId === targetContributionId)
      );

      const updated = [...filtered, newTarget];
      await saveContributionTargets(updated);

      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'CONTRIBUTION_TARGET_SET',
        details: `Configured campaign target of $${amt} USD for ${targetEntityType} "${entityName}".`,
        category: 'system'
      });

      toast.success(`Target of $${amt} successfully saved for ${entityName}!`);
      setTargetAmount('');
      setIsConfigureOpen(false);

      // Reload
      await loadAllRecords();
    } catch (e) {
      toast.error('Could not save contribution target.');
    }
  };

  // Generate dynamic options for setting active targets dropdown
  const getEntityOptions = (typeOverride?: EntityTier): { id: string; name: string }[] => {
    const activeType = typeOverride || targetEntityType;
    if (activeType === 'Member') {
      return members.map(m => ({ id: m.memberId, name: `${m.fullName} (${getTabheraShortName(m.tabheraCode)})` }));
    }
    if (activeType === 'Family') {
      const familyNames = Array.from(new Set(members.map(m => m.family).filter(Boolean))) as string[];
      return familyNames.map(fName => ({ id: `family-${fName}`, name: `${fName} Family` }));
    }
    if (activeType === 'Tabhera') {
      const tabheras = new Set<string>();
      members.forEach(m => {
        const tabCode = getEntityCodeForPath(m.tabheraCode, 'Tabhera');
        if (tabCode) tabheras.add(tabCode);
      });
      profiles.filter(p => p.level === JdnLevel.TABHERA).forEach(p => tabheras.add(p.levelCode));
      return Array.from(tabheras).map(code => ({ id: code, name: findEntityFriendlyName(code, 'Tabhera') }));
    }
    if (activeType === 'Wellness Center') {
      const wlcs = profiles.filter(p => p.level === JdnLevel.WELLNESS_CENTER).map(p => ({ id: p.levelCode, name: p.branchName }));
      return wlcs;
    }
    if (activeType === 'District') {
      const dists = new Set<string>();
      members.forEach(m => {
        const code = getEntityCodeForPath(m.tabheraCode, 'District');
        if (code && code.includes('DIS-')) dists.add(code);
      });
      profiles.filter(p => p.level === JdnLevel.DISTRICT).forEach(p => dists.add(p.levelCode));
      return Array.from(dists).map(code => ({ id: code, name: findEntityFriendlyName(code, 'District') }));
    }
    if (activeType === 'Province') {
      const provs = new Set<string>();
      members.forEach(m => {
        const code = getEntityCodeForPath(m.tabheraCode, 'Province');
        if (code && code.includes('PROV-')) provs.add(code);
      });
      profiles.filter(p => p.level === JdnLevel.PROVINCIAL).forEach(p => provs.add(p.levelCode));
      return Array.from(provs).map(code => ({ id: code, name: findEntityFriendlyName(code, 'Province') }));
    }
    if (activeType === 'Nation') {
      const nats = new Set<string>();
      members.forEach(m => {
        const code = getEntityCodeForPath(m.tabheraCode, 'Nation');
        if (code && code.includes('NAT-')) nats.add(code);
      });
      profiles.filter(p => p.level === JdnLevel.NATIONAL).forEach(p => nats.add(p.levelCode));
      return Array.from(nats).map(code => ({ id: code, name: findEntityFriendlyName(code, 'Nation') }));
    }
    return [];
  };

  const getTabheraShortName = (tabPath: string): string => {
    if (!tabPath) return 'HQ';
    return tabPath.split('/').pop()?.replace(/^(TAB-)/g, '').replace(/-/g, ' ') || tabPath;
  };

  const filteredRankings = currentRankings.filter(r =>
    r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const getActiveContributionLabel = () => {
    if (selectedContributionType === 'all') return 'All Contribution Types Summed';
    if (selectedContributionType.startsWith('std-')) {
      const id = selectedContributionType.substring(4);
      const match = murairoTypes.find(m => m.murairoId === id);
      return match ? `Standard: ${match.name}` : 'Standard Murairo Type';
    }
    if (selectedContributionType.startsWith('spe-')) {
      const id = selectedContributionType.substring(4);
      const match = unganoCategories.find(c => c.id === id);
      return match ? `Special: ${match.name}` : 'Special Murairo Type';
    }
    return 'Contribution Type';
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Compiling Mabatiro eVatendi and campaign targets...</p>
      </div>
    );
  }

  // Top Placement Podiums (First 3)
  const podiumWinners = filteredRankings.slice(0, 3);
  const coreRankingsList = filteredRankings.slice(3);

  const medals = ['🥇', '🥈', '🥉'];
  const podiumColors = [
    'border-amber-400 bg-amber-50/10 text-amber-950', // 1st
    'border-slate-300 bg-slate-50/10 text-slate-800',  // 2nd
    'border-amber-700 bg-amber-50/5 text-amber-900'   // 3rd
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="performance-redesign-page">
      {/* Tab Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-[#166534]" />
            Mabatiro eVatendi
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Track, rank, and audit contribution rankings across members and descending administrative structures in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAnalyticsOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors duration-150 cursor-pointer shadow-sm"
          >
            <BarChart2 className="h-4 w-4" /> Target Analytics
          </button>
          {isSetTargetEnabled && (
            <button
              onClick={() => {
                // Determine first allowed tier dynamically
                const options = getSelectableTargetTiers();
                const defaultTier = options.length > 0 ? options[0].value : 'Member';
                setTargetEntityType(defaultTier);

                // Default first entity selection based on current options
                const opt = getEntityOptions(defaultTier);
                if (opt.length > 0) setTargetEntityId(opt[0].id);
                setTargetContributionId(selectedContributionType);
                setIsConfigureOpen(true);
              }}
              className="bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors duration-150 cursor-pointer shadow-sm"
            >
              <Target className="h-4 w-4" /> Set Contribution Target
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex border-b border-gray-200 gap-1.5 pt-1">
        <button
          onClick={() => setSubTab('rankings')}
          className={`py-2.5 px-4 text-xs font-black uppercase border-b-2 transition-all cursor-pointer ${
            subTab === 'rankings'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🏆 Administrative Rankings
        </button>
        <button
          onClick={() => setSubTab('murairo_stats')}
          className={`py-2.5 px-4 text-xs font-black uppercase border-b-2 transition-all cursor-pointer ${
            subTab === 'murairo_stats'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 Murairo Statistics
        </button>
        <button
          onClick={() => setSubTab('currency_rankings')}
          className={`py-2.5 px-4 text-xs font-black uppercase border-b-2 transition-all cursor-pointer ${
            subTab === 'currency_rankings'
              ? 'border-[#166534] text-[#166534]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🪙 Currency Rankings
        </button>
      </div>

      {subTab === 'rankings' ? (
        <>
          {/* Tier Filtration bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-2.5">
        <div className="flex flex-wrap gap-1">
          {getAllowedTiers().map((tier) => (
            <button
              key={tier}
              onClick={() => {
                setActiveTier(tier);
              }}
              className={`py-2 px-3 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${
                activeTier === tier 
                  ? 'bg-[#166534] text-white' 
                  : 'text-gray-600 hover:text-gray-900 bg-gray-50'
              }`}
            >
              {tier === 'Member' ? 'Members' : (tier === 'Family' ? 'Families' : (tier === 'Tabhera' ? 'Tabheras' : (tier === 'Wellness Center' ? 'Wellness Centers' : (tier === 'Nyika' ? 'Nyikas' : `${tier}s`))))}
            </button>
          ))}
        </div>

        {/* Contribution Type Filter Selector */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <select
              value={selectedContributionType}
              onChange={(e) => setSelectedContributionType(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-[#166534] w-full sm:w-56"
            >
              <option value="all">🏆 All Contributions Summed</option>
              <optgroup label="Standard Murairo Types">
                {murairoTypes.map(m => (
                  <option key={m.murairoId} value={`std-${m.murairoId}`}>💰 {m.name}</option>
                ))}
              </optgroup>
              <optgroup label="Special Murairo Types (Ungano)">
                {unganoCategories.map(c => (
                  <option key={c.id} value={`spe-${c.id}`}>🌟 {c.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Rank By Metric Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500">Rank By:</span>
            <select
              value={rankMetric}
              onChange={(e) => setRankMetric(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-[#166534] w-full sm:w-44"
            >
              <option value="finance">💰 Financial Contributions</option>
              <option value="jorodhani">🌱 Newcomers (Jorodhani Status)</option>
            </select>
          </div>

          {/* Guest filtering */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500">Group:</span>
            <select
              value={filterContributorType}
              onChange={(e) => setFilterContributorType(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-[#166534] w-full sm:w-40"
            >
              <option value="all">All Contributors</option>
              <option value="members">Official Members</option>
              <option value="guests">Guests Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Podium Displays (Only if search target filter is clean) */}
      {!searchFilter && podiumWinners.length > 0 && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {podiumWinners.map((winner, index) => (
             <div
               key={winner.id}
               className={`border p-4 rounded-xl shadow-xs flex flex-col justify-between space-y-3 transition-colors ${podiumColors[index]}`}
             >
               <div className="flex justify-between items-start">
                 <div className="space-y-0.5">
                   <div className="flex items-center gap-1.5">
                     <span className="text-xl">{medals[index]}</span>
                     <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">Position #{index + 1}</span>
                   </div>
                   <h4 className="font-extrabold text-[#111827] text-base leading-snug line-clamp-1">{winner.name}</h4>
                   <span className="text-[9px] uppercase font-bold text-gray-550 block font-mono bg-gray-100 rounded px-1.5 py-0.5 inline-block mt-1">
                     {winner.subname || activeTier}
                   </span>
                 </div>
               </div>

               <div className="pt-2 border-t border-gray-200/40 grid grid-cols-2 gap-2 text-xs">
                 <div>
                   <span className="block text-[8px] font-black uppercase text-gray-400 font-sans">USD Raised</span>
                   <span className="font-mono font-black text-[#166534] text-sm">${winner.raised.toFixed(2)}</span>
                 </div>
                 <div>
                   <span className="block text-[8px] font-black uppercase text-gray-400 font-sans">Target Goal</span>
                   <span className="font-mono font-bold text-gray-700 text-sm">
                     {winner.target > 0 ? `$${winner.target.toFixed(0)}` : 'N/A'}
                   </span>
                 </div>
               </div>

               {winner.target > 0 && (
                 <div className="space-y-1 pt-1.5">
                   <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                     <span className="text-gray-500">Goal Cover</span>
                     <span className={`${winner.raised >= winner.target ? 'text-green-700' : 'text-amber-700'}`}>
                       {winner.pct.toFixed(0)}%
                     </span>
                   </div>
                   <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden border border-gray-100">
                     <div 
                       className={`h-full rounded-full transition-all ${winner.raised >= winner.target ? 'bg-green-600' : 'bg-amber-500'}`}
                       style={{ width: `${Math.min(100, winner.pct)}%` }}
                     />
                   </div>
                 </div>
               )}
             </div>
           ))}
         </div>
      )}

      {/* Main Registry list of performance ranks */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
        
        {/* Sub filter bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTier.toLowerCase()} rankings...`}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 focus:bg-white focus:outline-none placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5" /> {sortOrder === 'desc' ? 'Top Ranked' : 'Least Performing'}
            </button>
            <button
              onClick={exportPDF}
              className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" /> PDF Report
            </button>
            <button
              onClick={exportExcel}
              className="bg-green-700 hover:bg-green-600 text-white text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel Report
            </button>
            <div className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-1.5 flex items-center gap-1.5 shadow-xs whitespace-nowrap">
              <Coins className="h-4 w-4" /> Active: {getActiveContributionLabel()}
            </div>
          </div>
        </div>

        {/* Dynamic Registry list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-200 tracking-wider">
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Entity Identity</th>
                <th className="py-3 px-4 text-[#166534]">USD Raised</th>
                <th className="py-3 px-4 text-gray-700">Target Expectation</th>
                <th className="py-3 px-4">Variance Balance</th>
                <th className="py-3 px-4 text-center">Newcomers (Jorodhani Status)</th>
                <th className="py-3 px-4 text-right">Goal Fulfillment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {filteredRankings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 font-sans text-gray-450 italic">
                    No matching performance statistics found under this scoping filter.
                  </td>
                </tr>
              ) : (
                filteredRankings.map((r, index) => {
                  const varianceColor = r.variance >= 0 ? 'text-green-700' : 'text-rose-600';
                  const varianceSign = r.variance >= 0 ? '+$' : '-$';
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-sans text-center">
                        <span className="font-extrabold text-gray-900 text-sm">#{index + 1}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-sans font-extrabold text-[#111827] text-sm truncate max-w-sm">{r.name}</div>
                        <div className="text-[10px] text-gray-450 mt-0.5 tracking-wide uppercase font-sans flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {r.subname || activeTier}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#166534] font-black text-sm">
                        ${r.raised.toFixed(2)} USD
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-bold">
                        {r.target > 0 ? `$${r.target.toFixed(2)}` : <span className="text-gray-400 font-normal">No Target Mapped</span>}
                      </td>
                      <td className={`py-3 px-4 font-black ${varianceColor}`}>
                        {varianceSign}{Math.abs(r.variance).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-teal-750">
                        {r.jorodhaniCount}
                      </td>
                      <td className="py-3 px-4 text-right pr-4 font-sans justify-end">
                        {r.target > 0 ? (
                          <div className="flex items-center justify-end gap-2.5">
                            <span className={`text-[10px] font-mono font-bold ${r.raised >= r.target ? 'text-green-700 font-extrabold' : 'text-amber-700'}`}>
                              {r.pct.toFixed(0)}%
                            </span>
                            <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden border border-gray-100">
                              <div 
                                className={`h-full rounded-full transition-all ${r.raised >= r.target ? 'bg-green-600' : 'bg-amber-500'}`} 
                                style={{ width: `${Math.min(100, r.pct)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 italic text-[11px] font-sans">Not set</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : subTab === 'murairo_stats' ? (
        <div className="space-y-6">
          {/* Card KPI Summaries */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2 relative overflow-hidden">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">Total Types Tracked</span>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-black text-gray-900">{murairoTypes.length + unganoCategories.length}</span>
                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                  {murairoTypes.length} Std / {unganoCategories.length} Spe
                </span>
              </div>
              <p className="text-[10px] text-gray-500">Active campaigns in database schema</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">Overall Raised (USD)</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-[#166534]">
                  ${(() => {
                    const stdSum = contributions.reduce((sum, c) => sum + convertToUSD(c.amount, c.currency), 0);
                    const speSum = unganoPayments.reduce((sum, p) => sum + convertToUSD(p.amountPaid, p.currency), 0);
                    return (stdSum + speSum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">Converted aggregate from ZWG, ZAR & USD</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#166534]/20 shadow-xs space-y-2 bg-[#166534]/5">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-700">Top Collection Theme</span>
              <div className="flex justify-between items-baseline gap-1.5">
                <span className="text-sm font-black text-gray-900 truncate block max-w-[155px]">
                  {(() => {
                    const stats = [
                      ...murairoTypes.map(m => ({
                        name: m.name,
                        raised: contributions.filter(c => c.murairoId === m.murairoId).reduce((sum, c) => sum + convertToUSD(c.amount, c.currency), 0)
                      })),
                      ...unganoCategories.map(c => ({
                        name: c.name,
                        raised: unganoPayments.filter(p => p.categoryId === c.id).reduce((sum, p) => sum + convertToUSD(p.amountPaid, p.currency), 0)
                      }))
                    ].sort((a, b) => b.raised - a.raised);
                    return stats[0]?.name || 'N/A';
                  })()}
                </span>
              </div>
              <p className="text-[10px] text-[#166534] font-semibold">Highest overall campaign support</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">Total Contributions</span>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-black text-gray-900">
                  {contributions.length + unganoPayments.length}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">Successful entries indexed cleanly</p>
            </div>
          </div>

          {/* Table list with search bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search collections..."
                  value={murairoSearch}
                  onChange={(e) => setMurairoSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 focus:bg-white focus:outline-none placeholder-gray-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const stats = [
                      ...murairoTypes.map(m => {
                        const logs = contributions.filter(c => c.murairoId === m.murairoId);
                        const raised = logs.reduce((sum, c) => sum + convertToUSD(c.amount, c.currency), 0);
                        const uniqueDonors = new Set(logs.map(c => c.memberId || (c.isGuest ? c.guestName : 'anon'))).size;
                        return { name: m.name, classType: 'Standard Murairo', transactions: logs.length, donors: uniqueDonors, raised };
                      }),
                      ...unganoCategories.map(c => {
                        const pays = unganoPayments.filter(p => p.categoryId === c.id);
                        const raised = pays.reduce((sum, p) => sum + convertToUSD(p.amountPaid, p.currency), 0);
                        const uniqueDonors = new Set(pays.map(p => p.memberId)).size;
                        return { name: c.name, classType: 'Special Murairo (Ungano)', transactions: pays.length, donors: uniqueDonors, raised };
                      })
                    ].sort((a, b) => b.raised - a.raised);

                    const filteredStats = stats.filter(x => 
                      x.name.toLowerCase().includes(murairoSearch.toLowerCase()) || 
                      x.classType.toLowerCase().includes(murairoSearch.toLowerCase())
                    );

                    const doc = new jsPDF();
                    const churchName = settings?.churchName || "JERUSALEM DIGITAL NETWORK (JDN)";
                    
                    doc.setFillColor(22, 101, 52); 
                    doc.rect(14, 10, 182, 3, 'F');

                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(22, 101, 52);
                    doc.text(churchName, 14, 20);

                    doc.setFontSize(10);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(50, 50, 50);
                    doc.text("Official Campaigns & Murairo Performance statistics", 14, 26);

                    doc.setFontSize(8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(140, 140, 140);
                    doc.text(`Generated: ${new Date().toLocaleDateString()} | Active Level: ${currentUser.levelCode || 'Jerusalem HQ'}`, 14, 32);

                    const cols = ["Rank", "Murairo Campaign Name", "Classification Type", "Transactions", "Unique Donors", "Average contribution", "Total Raised (USD)"];
                    const rowsData = filteredStats.map((r, i) => [
                      `#${i + 1}`,
                      r.name,
                      r.classType,
                      r.transactions.toString(),
                      r.donors.toString(),
                      `$${r.transactions > 0 ? (r.raised / r.transactions).toFixed(2) : '0.00'}`,
                      `$${r.raised.toFixed(2)}`
                    ]);

                    autoTable(doc, {
                      head: [cols],
                      body: rowsData,
                      startY: 37,
                      theme: 'grid',
                      headStyles: { fillColor: [22, 101, 52] },
                      styles: { fontSize: 8 }
                    });

                    doc.save(`Murairo_Statistics_${new Date().toISOString().split('T')[0]}.pdf`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" /> PDF Summary
                </button>
                <button
                  onClick={() => {
                    const stats = [
                      ...murairoTypes.map(m => {
                        const logs = contributions.filter(c => c.murairoId === m.murairoId);
                        const raised = logs.reduce((sum, c) => sum + convertToUSD(c.amount, c.currency), 0);
                        const uniqueDonors = new Set(logs.map(c => c.memberId || (c.isGuest ? c.guestName : 'anon'))).size;
                        return { name: m.name, classType: 'Standard Murairo', transactions: logs.length, donors: uniqueDonors, raised };
                      }),
                      ...unganoCategories.map(c => {
                        const pays = unganoPayments.filter(p => p.categoryId === c.id);
                        const raised = pays.reduce((sum, p) => sum + convertToUSD(p.amountPaid, p.currency), 0);
                        const uniqueDonors = new Set(pays.map(p => p.memberId)).size;
                        return { name: c.name, classType: 'Special (Ungano)', transactions: pays.length, donors: uniqueDonors, raised };
                      })
                    ].sort((a, b) => b.raised - a.raised);

                    const filteredStats = stats.filter(x => 
                      x.name.toLowerCase().includes(murairoSearch.toLowerCase()) || 
                      x.classType.toLowerCase().includes(murairoSearch.toLowerCase())
                    );

                    const rows = filteredStats.map((r, i) => ({
                      Rank: i + 1,
                      'Murairo Campaign Name': r.name,
                      Classification: r.classType,
                      Transactions: r.transactions,
                      'Unique Donors': r.donors,
                      'Average contribution (USD)': parseFloat((r.transactions > 0 ? r.raised / r.transactions : 0).toFixed(2)),
                      'Total Raised (USD)': parseFloat(r.raised.toFixed(2))
                    }));

                    const worksheet = XLSX.utils.json_to_sheet(rows);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Murairo Stat Ledger");
                    XLSX.writeFile(workbook, `Murairo_Statistics_${new Date().toISOString().split('T')[0]}.xlsx`);
                  }}
                  className="bg-[#166534] hover:bg-[#14532D] text-white text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel Sheet
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-200 tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Murairo Campaign Type</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4 text-center">Transactions</th>
                    <th className="py-3 px-4 text-center">Unique Contributors</th>
                    <th className="py-3 px-4">Average Log Amount</th>
                    <th className="py-3 px-4 text-right text-[#166534]">Total Amount Contributed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {(() => {
                    const stats = [
                      ...murairoTypes.map(m => {
                        const logs = contributions.filter(c => c.murairoId === m.murairoId);
                        const raised = logs.reduce((sum, c) => sum + convertToUSD(c.amount, c.currency), 0);
                        const uniqueDonors = new Set(logs.map(c => c.memberId || (c.isGuest ? c.guestName : 'anon'))).size;
                        return { id: `std-${m.murairoId}`, name: m.name, classType: 'Standard Murairo', transactions: logs.length, donors: uniqueDonors, raised };
                      }),
                      ...unganoCategories.map(c => {
                        const pays = unganoPayments.filter(p => p.categoryId === c.id);
                        const raised = pays.reduce((sum, p) => sum + convertToUSD(p.amountPaid, p.currency), 0);
                        const uniqueDonors = new Set(pays.map(p => p.memberId)).size;
                        return { id: `spe-${c.id}`, name: c.name, classType: 'Special Murairo (Ungano)', transactions: pays.length, donors: uniqueDonors, raised };
                      })
                    ].sort((a, b) => b.raised - a.raised);

                    const filteredStats = stats.filter(x => 
                      x.name.toLowerCase().includes(murairoSearch.toLowerCase()) || 
                      x.classType.toLowerCase().includes(murairoSearch.toLowerCase())
                    );

                    if (filteredStats.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="text-center py-10 font-sans text-gray-450 italic">
                            No campaign records found matching your query.
                          </td>
                        </tr>
                      );
                    }

                    return filteredStats.map((r, i) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-sans text-center">
                          <span className="font-extrabold text-gray-900 text-sm">#{i + 1}</span>
                        </td>
                        <td className="py-3 px-4 font-sans font-bold text-gray-950">
                          {r.name}
                        </td>
                        <td className="py-3 px-4 text-xs font-bold">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            r.classType.startsWith('Standard')
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                              : 'bg-indigo-50 text-indigo-800 border border-indigo-100'
                          }`}>
                            {r.classType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-gray-800">
                          {r.transactions}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-gray-800">
                          {r.donors}
                        </td>
                        <td className="py-3 px-4 text-gray-650">
                          ${r.transactions > 0 ? (r.raised / r.transactions).toFixed(2) : '0.00'} USD
                        </td>
                        <td className="py-3 px-4 text-right pr-4 font-black text-[#166534] text-sm font-mono">
                          ${r.raised.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Headline Scoreboards */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div>
                <h3 className="font-extrabold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="h-4.5 w-4.5 text-[#166534] " /> Church-wide Currency Leaderboard
                </h3>
                <p className="text-[10px] text-gray-400 font-sans">
                  Comprehensive performance audit and ranking reports of all cash flow and electronic remittance currencies utilized across Standard and Special campaigns.
                </p>
             </div>
             {(() => {
                const results = supportedCurrencies.map(curr => {
                  const stdRaw = contributions.filter(c => c.currency === curr).reduce((s, x) => s + x.amount, 0);
                  const speRaw = unganoPayments.filter(p => p.currency === curr).reduce((s, x) => s + x.amountPaid, 0);
                  const stdUSD = convertToUSD(stdRaw, curr);
                  const speUSD = convertToUSD(speRaw, curr);
                  const totalUSD = stdUSD + speUSD;

                  return { curr, stdRaw, speRaw, totalUSD };
                }).filter(r => r.totalUSD > 0).sort((a,b) => b.totalUSD - a.totalUSD);

                if (results.length === 0) return (
                  <span className="text-gray-400 text-xs italic">No contributions found in local catalogs</span>
                );

                const top = results[0];
                return (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2 rounded-xl flex items-center gap-2">
                     <Trophy className="h-5 w-5 text-amber-500 animate-bounce" />
                     <div className="text-left">
                       <span className="text-[9px] uppercase tracking-wider font-extrabold block text-amber-600">Top Yielding General Currency</span>
                       <span className="font-bold font-mono text-sm uppercase">{top.curr} (${top.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} equivalent)</span>
                     </div>
                  </div>
                );
             })()}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-green-50 text-[#166534] rounded-xl">
                 <Coins className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-gray-900 font-mono">
                  ${contributions.reduce((s, c) => s + convertToUSD(c.amount, c.currency), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">Standard Murairo Volume (USD Eq)</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
                 <Target className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-gray-900 font-mono">
                  ${unganoPayments.reduce((s, p) => s + convertToUSD(p.amountPaid, p.currency), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">Special Murairo Offering (USD Eq)</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
                 <Trophy className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-gray-900 font-mono">
                  ${(
                    contributions.reduce((s, c) => s + convertToUSD(c.amount, c.currency), 0) + 
                    unganoPayments.reduce((s, p) => s + convertToUSD(p.amountPaid, p.currency), 0)
                  ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">Combined Yield Volume (USD Eq)</span>
              </div>
            </div>
          </div>

          {/* Rankings Table and Shares Grid  */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h4 className="font-extrabold text-gray-900 text-sm uppercase tracking-wide">Currency Performance Ranking Table</h4>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">Ordered By Cumulative Yield</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-150 text-[10px] uppercase font-bold text-gray-400">
                          <th className="py-3 px-4 text-center w-12">Rank</th>
                          <th className="py-3 px-4">Currency</th>
                          <th className="py-3 px-4 text-right">Standard Murairo</th>
                          <th className="py-3 px-4 text-right">Special (Ungano)</th>
                          <th className="py-3 px-4 text-right pr-5">Combined USD Equivalent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 text-xs text-gray-700">
                         {(() => {
                           const rowDatas = supportedCurrencies.map(curr => {
                             const stdRaw = contributions.filter(c => c.currency === curr).reduce((s, x) => s + x.amount, 0);
                             const speRaw = unganoPayments.filter(p => p.currency === curr).reduce((s, x) => s + x.amountPaid, 0);
                             const stdUSD = convertToUSD(stdRaw, curr);
                             const speUSD = convertToUSD(speRaw, curr);
                             const totalUSD = stdUSD + speUSD;

                             return { curr, stdRaw, speRaw, totalUSD };
                           }).sort((a,b) => b.totalUSD - a.totalUSD);

                           return rowDatas.map((item, i) => {
                             const isTop = i === 0 && item.totalUSD > 0;
                             return (
                               <tr key={item.curr} className={isTop ? "bg-amber-50/10 font-semibold text-gray-950" : "hover:bg-gray-50/30 transition-colors"}>
                                 <td className="py-3 px-4 text-center">
                                   {i === 0 && item.totalUSD > 0 ? (
                                     <span className="inline-flex h-5 w-5 rounded-full bg-amber-100 text-amber-700 justify-center items-center font-bold text-[10px] shadow-sm">🥇</span>
                                   ) : i === 1 && item.totalUSD > 0 ? (
                                     <span className="inline-flex h-5 w-5 rounded-full bg-slate-150 text-slate-700 justify-center items-center font-bold text-[10px] shadow-sm">🥈</span>
                                   ) : i === 2 && item.totalUSD > 0 ? (
                                     <span className="inline-flex h-5 w-5 rounded-full bg-orange-100 text-orange-700 justify-center items-center font-bold text-[10px] shadow-sm">🥉</span>
                                   ) : (
                                     <span className="font-bold text-gray-400 font-mono font-bold">#{i + 1}</span>
                                   )}
                                 </td>
                                 <td className="py-3 px-4 font-mono font-black text-gray-800 uppercase tracking-widest">{item.curr}</td>
                                 <td className="py-3 px-4 text-right font-mono text-gray-700">
                                   {item.stdRaw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.curr}
                                 </td>
                                 <td className="py-3 px-4 text-right font-mono text-gray-700">
                                   {item.speRaw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.curr}
                                 </td>
                                 <td className="py-3 px-4 text-right font-mono font-black pr-5 text-[#166534]">
                                   ${item.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 </td>
                               </tr>
                             );
                           });
                         })()}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>

             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 flex flex-col justify-center">
                <div>
                   <h4 className="font-extrabold text-gray-900 text-sm uppercase tracking-wide">Revenue Split Shares</h4>
                   <p className="text-[10px] text-gray-400 mt-1 font-sans">Visual representation of each currency's contribution weight to the overall treasury.</p>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const rowDatas = supportedCurrencies.map(curr => {
                      const stdRaw = contributions.filter(c => c.currency === curr).reduce((s, x) => s + x.amount, 0);
                      const speRaw = unganoPayments.filter(p => p.currency === curr).reduce((s, x) => s + x.amountPaid, 0);
                      const stdUSD = convertToUSD(stdRaw, curr);
                      const speUSD = convertToUSD(speRaw, curr);
                      const totalUSD = stdUSD + speUSD;

                      return { curr, totalUSD };
                    }).sort((a,b) => b.totalUSD - a.totalUSD);

                    const grandCombinedUSD = rowDatas.reduce((sum, r) => sum + r.totalUSD, 0) || 1;

                    return rowDatas.map((item, i) => {
                      const pct = Math.min(100, Math.round((item.totalUSD / grandCombinedUSD) * 100));
                      const colors = ['bg-[#166534]', 'bg-indigo-600', 'bg-[#D97706]', 'bg-slate-400'];
                      const barColCurrent = colors[i % colors.length];

                      return (
                         <div key={item.curr} className="space-y-2">
                           <div className="flex justify-between items-baseline text-[11px] font-mono">
                             <span className="font-bold text-gray-700">{item.curr}</span>
                             <span className="text-gray-500 font-medium">{pct}% (${item.totalUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })} eq)</span>
                           </div>
                           <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden border border-gray-100 shadow-inner">
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
      )}

      {/* MODAL: Configure Contribution Target Goal */}
      {isConfigureOpen && isSetTargetEnabled && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-extrabold text-[#111827] text-sm uppercase tracking-wide">
                Set Contribution Target
              </h3>
              <button
                onClick={() => setIsConfigureOpen(false)}
                className="text-gray-400 hover:text-gray-900 font-bold p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="p-6 space-y-4">
              
              {/* Select Tier level */}
              <div className="space-y-1 flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">1. Select Target Tier level</label>
                <select
                  value={targetEntityType}
                  onChange={(e) => {
                    const newType = e.target.value as EntityTier;
                    setTargetEntityType(newType);
                    // trigger refresh of options using helper parameter to avoid state lag
                    setTimeout(() => {
                      const opt = getEntityOptions(newType);
                      if (opt.length > 0) setTargetEntityId(opt[0].id);
                    }, 50);
                  }}
                  className="p-2.5 border border-gray-205 rounded-lg bg-white"
                >
                  {getSelectableTargetTiers().map(tier => (
                    <option key={tier.value} value={tier.value}>{tier.label}</option>
                  ))}
                </select>
              </div>

              {/* Select Specific Entity */}
              <div className="space-y-1 flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">2. Search & Select Mapped Entity</label>
                <div className="relative">
                   <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-gray-400" />
                   <input
                     type="text"
                     placeholder={`Search ${targetEntityType} name...`}
                     value={entitySearch}
                     onChange={(e) => setEntitySearch(e.target.value)}
                     className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-905 focus:outline-[#166534] mb-2"
                   />
                </div>
                <select
                  size={4}
                  value={targetEntityId}
                  onChange={(e) => setTargetEntityId(e.target.value)}
                  className="p-2 border border-gray-205 rounded-lg bg-white text-xs"
                >
                  {getEntityOptions().filter(opt => opt.name.toLowerCase().includes(entitySearch.toLowerCase())).map(opt => (
                    <option key={opt.id} value={opt.id} className="p-1.5 hover:bg-gray-50 cursor-pointer">{opt.name}</option>
                  ))}
                </select>
                {getEntityOptions().length === 0 && (
                  <span className="text-[10px] text-red-500">No registered entities found for this tier level.</span>
                )}
              </div>

              {/* Select Murairo / Campaign category */}
              <div className="space-y-1 flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">3. Search & Select Contribution campaign</label>
                <div className="relative">
                   <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-gray-400" />
                   <input
                     type="text"
                     placeholder="Search campaign..."
                     value={categorySearch}
                     onChange={(e) => setCategorySearch(e.target.value)}
                     className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-905 focus:outline-[#166534] mb-2"
                   />
                </div>
                <select
                  size={4}
                  value={targetContributionId}
                  onChange={(e) => setTargetContributionId(e.target.value)}
                  className="p-2 border border-gray-205 rounded-lg bg-white text-xs"
                >
                  <option value="all" className="p-1.5 hover:bg-gray-50 cursor-pointer font-bold">🏆 All Contributions Summed</option>
                  <optgroup label="Standard Murairo Types">
                    {murairoTypes.filter(m => m.name.toLowerCase().includes(categorySearch.toLowerCase())).map(m => (
                      <option key={m.murairoId} value={`std-${m.murairoId}`} className="p-1.5 hover:bg-gray-50 cursor-pointer">💰 Standard: {m.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Special Murairo Types (Ungano)">
                    {unganoCategories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                      <option key={c.id} value={`spe-${c.id}`} className="p-1.5 hover:bg-gray-50 cursor-pointer">🌟 Special: {c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Target Goal Amount (USD value) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">4. Target Goal Amount (in USD)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-gray-400 font-extrabold font-mono text-xs">$</span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    placeholder="e.g. 500"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-xs border border-gray-200 rounded-lg text-gray-905 focus:outline-[#166534]"
                  />
                </div>
              </div>

              <div className="pt-2.5 flex justify-end gap-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsConfigureOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={getEntityOptions().length === 0}
                  className="px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
                >
                  Apply Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Target Analytics Modal */}
      {isAnalyticsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-extrabold text-[#111827] text-sm uppercase tracking-wide flex flex-row items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" /> Target Analytics ({activeTier})
              </h3>
              <button onClick={() => setIsAnalyticsOpen(false)} className="text-gray-400 hover:text-gray-900 font-bold p-1 rounded-md">✕</button>
            </div>
            <div className="p-6 bg-gray-50 flex gap-4 overflow-x-auto">
               <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1 shadow-sm flex flex-col justify-center items-center text-center">
                 <div className="text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-widest">Total Monitored</div>
                 <div className="text-3xl font-black text-gray-900">{currentRankings.filter(r => r.target > 0).length}</div>
                 <div className="text-xs font-medium text-gray-400 mt-1">{activeTier} targets set</div>
               </div>
               <div className="bg-white border border-[#166534]/30 rounded-xl p-4 flex-1 shadow-sm flex flex-col justify-center items-center text-center">
                 <div className="text-[10px] uppercase font-bold text-green-700 mb-1 tracking-widest">Met Targets</div>
                 <div className="text-3xl font-black text-[#166534]">{currentRankings.filter(r => r.target > 0 && r.pct >= 100).length}</div>
                 <div className="text-xs font-medium text-green-700/60 mt-1">100%+ completion</div>
               </div>
               <div className="bg-white border border-red-200 rounded-xl p-4 flex-1 shadow-sm flex flex-col justify-center items-center text-center">
                 <div className="text-[10px] uppercase font-bold text-red-600 mb-1 tracking-widest">Off-Track</div>
                 <div className="text-3xl font-black text-red-600">{currentRankings.filter(r => r.target > 0 && r.pct < 100).length}</div>
                 <div className="text-xs font-medium text-red-600/60 mt-1">Below target goal</div>
               </div>
            </div>
            
            <div className="p-6 border-t border-gray-100">
               <h4 className="font-bold text-sm tracking-wide mb-3 flex items-center gap-2">
                 <TrendingUp className="w-4 h-4 text-red-500" /> Bottom 5 {activeTier}s (Furthest from Target)
               </h4>
               <div className="grid grid-cols-1 gap-2">
                 {currentRankings.filter(r => r.target > 0).sort((a,b) => a.pct - b.pct).slice(0, 5).map((t, idx) => (
                   <div key={t.id} className="bg-white border border-gray-200 p-3 rounded-lg flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                         <div className="w-6 h-6 rounded bg-gray-100 text-gray-500 font-bold text-xs flex items-center justify-center">{idx+1}</div>
                         <div>
                           <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                           <div className="text-[10px] text-gray-500 font-mono">Raised: ${t.raised.toLocaleString()} / Target: ${t.target.toLocaleString()}</div>
                         </div>
                      </div>
                      <div className={`font-bold px-2 py-1 rounded text-xs ${t.pct >= 100 ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
                         {t.pct.toFixed(1)}%
                      </div>
                   </div>
                 ))}
                 {currentRankings.filter(r => r.target > 0).length === 0 && (
                   <p className="text-center text-sm text-gray-400 py-4 font-medium italic">No targeted metrics found for this scope.</p>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
