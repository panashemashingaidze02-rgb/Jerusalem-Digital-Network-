import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ContributionLog, MurairoType, UserProfile, JdnLevel, Member, JdnSettings } from '../types';
import {
  getContributions,
  getMurairoTypes,
  saveContributions,
  saveMurairoTypes,
  addToSyncQueue,
  getSettings,
  getMembers,
  getCurrencies,
  getPaymentMethods,
  addPlatformLog,
  getUserProfiles,
  resolveBranchName,
  addNotification
} from '../lib/storage';
import { 
  Coins, Plus, Clipboard, CheckCircle, ShieldAlert, Sparkles, 
  TrendingUp, ShieldCheck, Landmark, Edit3, Calendar, Search, 
  Filter, Check, RefreshCw, Layers, ChevronRight, UserCircle, 
  Info, AlertTriangle, FileText, ArrowUpDown, Download, SlidersHorizontal, Trophy
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';

interface ContributionsProps {
  currentUser: UserProfile;
}

export function Contributions({ currentUser }: ContributionsProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger' | 'categories' | 'memberRank'>('dashboard');

  // Core App states
  const [contributions, setContributions] = useState<ContributionLog[]>([]);
  const [types, setTypes] = useState<MurairoType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States (Ledger)
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterContributorType, setFilterContributorType] = useState<'all' | 'members' | 'guests'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPageLedger, setCurrentPageLedger] = useState(1);

  // Core Statistics Filters
  const [filterStatsTimeRange, setFilterStatsTimeRange] = useState<string>('All Time'); // 'Day' | 'Week' | 'Month' | 'Year' | 'Custom'
  const [filterStatsBranchCode, setFilterStatsBranchCode] = useState<string>(''); // specific levelCode prefix or empty
  const [branchSearchTerm, setBranchSearchTerm] = useState<string>('');

  useEffect(() => {
    setCurrentPageLedger(1);
  }, [filterCategory, filterPaymentMethod, filterStartDate, filterEndDate, filterContributorType, searchTerm]);

  // Define Category Modal (Jerusalem + National only)
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MurairoType | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [categoryCurrencies, setCategoryCurrencies] = useState<string[]>(['USD']);
  const [categoryTargetLevels, setCategoryTargetLevels] = useState<JdnLevel[]>([JdnLevel.TABHERA]);
  const [categoryIsActive, setCategoryIsActive] = useState<boolean>(true);

  // Write Contribution logger (Tabhera secretary only)
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isGuestContributor, setIsGuestContributor] = useState(false);
  const [guestNameValue, setGuestNameValue] = useState('');
  const [logMember, setLogMember] = useState('');
  const [logMurairo, setLogMurairo] = useState('');
  const [logAmount, setLogAmount] = useState('');
  const [logCurrency, setLogCurrency] = useState<string>('USD');
  const [logMethod, setLogMethod] = useState<string>('Cash');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logReceipt, setLogReceipt] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [jdnSettings, setJdnSettings] = useState<JdnSettings | null>(null);
  
  // Duplicate check dialogue
  const [duplicateWarning, setDuplicateWarning] = useState<boolean>(false);
  const [duplicateConflictPolicy, setDuplicateConflictPolicy] = useState<'timestamp' | 'server'>('timestamp');

  // Member Ranking lookup state
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Dynamic dynamic configurations list
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(['USD', 'ZWG', 'ZAR']);
  const [supportedPaymentMethods, setSupportedPaymentMethods] = useState<string[]>(['Cash', 'Electronic Transfer', 'Mobile Wallet']);

  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [lastSubmitCategoryTime, setLastSubmitCategoryTime] = useState(0);

  const [isLoggingContribution, setIsLoggingContribution] = useState(false);
  const [lastLogContributionTime, setLastLogContributionTime] = useState(0);

  const [formMemberSearch, setFormMemberSearch] = useState('');
  const [formCategorySearch, setFormCategorySearch] = useState('');

  useEffect(() => {
    loadContributionData();
  }, [currentUser]);

  const loadContributionData = async () => {
    setIsLoading(true);
    const list = await getContributions() || [];
    const tList = await getMurairoTypes() || [];
    const mList = await getMembers() || [];
    const plist = await getUserProfiles();
    const cleanPlist = currentUser.level === JdnLevel.SYSTEM ? plist : plist.filter(p => p.level !== JdnLevel.SYSTEM);
    const settings = await getSettings();
    const curr = await getCurrencies();
    const meth = await getPaymentMethods();

    // Store properties
    setJdnSettings(settings);
    setPrivacyEnabled(settings.privacyShieldDistrictEnabled);
    setTypes(tList);
    setMembers(mList);
    setProfiles(cleanPlist);
    setSupportedCurrencies(curr);
    setSupportedPaymentMethods(meth);

    // Filter list based on Hierarchy checks simulation
    let filteredLogs = list;
    if (currentUser.level !== JdnLevel.SYSTEM && currentUser.level !== JdnLevel.JERUSALEM) {
      filteredLogs = list.filter(c => 
        c.tabheraCode.startsWith(currentUser.levelCode) || 
        currentUser.levelCode.startsWith(c.tabheraCode)
      );
    }
    setContributions(filteredLogs);
    
    if (mList.length > 0 && !selectedMemberId) {
      setSelectedMemberId(mList[0].memberId);
    }
    setIsLoading(false);
  };

  // Convert mix currencies into normalized USD equivalence
  const convertToUSD = (amount: number, currency: string) => {
    if (currency === 'ZAR') return amount / 18.5; // Sim: 1 USD = 18.5 ZAR
    if (currency === 'ZWG') return amount / 25.0; // Sim: 1 USD = 25 ZWG
    return amount;
  };

  // Create / Edit Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastSubmitCategoryTime < 1500 || isSavingCategory) {
      toast.error('Submission in progress, please wait...', { id: 'rate-limit-save-cat' });
      return;
    }
    setLastSubmitCategoryTime(now);
    setIsSavingCategory(true);

    if (categoryName.trim().length < 2) {
      toast.error('Murairo contribution name must be at least 2 characters.');
      setIsSavingCategory(false);
      return;
    }

    if (categoryCurrencies.length === 0) {
      toast.error('Please select at least one supported currency.');
      setIsSavingCategory(false);
      return;
    }

    try {
      const existingTypes = await getMurairoTypes() || [];
      const isEditing = editingCategory !== null;

      let updatedList: MurairoType[] = [];
      const finalCategory: MurairoType = {
        murairoId: isEditing ? editingCategory!.murairoId : `mur-${Date.now()}`,
        name: categoryName.trim(),
        description: categoryDesc.trim(),
        currency: categoryCurrencies,
        createdByLevel: isEditing ? editingCategory!.createdByLevel : currentUser.level,
        createdByCode: isEditing ? editingCategory!.createdByCode : currentUser.levelCode,
        isActive: categoryIsActive,
        createdAt: isEditing ? editingCategory!.createdAt : new Date().toISOString(),
        targetLevels: categoryTargetLevels
      };

      if (isEditing) {
        updatedList = existingTypes.map(t => t.murairoId === editingCategory!.murairoId ? finalCategory : t);
        // Log to platform audits
        await addPlatformLog({
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorLevel: currentUser.level,
          action: 'FINANCIAL_CATEGORY_EDIT',
          details: `Modified Murairo Category rules for "${finalCategory.name}" (${finalCategory.murairoId})`,
          category: 'contribution'
        });
      } else {
        updatedList = [...existingTypes, finalCategory];
        // Log to platform audits
        await addPlatformLog({
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorLevel: currentUser.level,
          action: 'FINANCIAL_CATEGORY_CREATE',
          details: `Created new Murairo Category "${finalCategory.name}" targeting ${categoryTargetLevels.join(', ')}`,
          category: 'contribution'
        });
      }

      // Trigger Push Notification explicitly if not editing
      if (!isEditing) {
        await addNotification(
          'New Standardized Murairo Category',
          `A new contribution type "${finalCategory.name}" has been rolled out.`,
          'info',
          true
        );
      }

      await saveMurairoTypes(updatedList);
      await addToSyncQueue('code', finalCategory.murairoId, isEditing ? 'update' : 'create', finalCategory);

      setIsTypeModalOpen(false);
      setEditingCategory(null);
      setCategoryName('');
      setCategoryDesc('');
      await loadContributionData();
      toast.success(isEditing ? 'Murairo updated successfully' : 'Murairo created successfully');
      setIsSavingCategory(false);
    } catch (err) {
      toast.error('Failed to save Contribution Category definitions.');
      setIsSavingCategory(false);
    }
  };

  // Trigger modal for editing
  const openEditCategory = (cat: MurairoType) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDesc(cat.description);
    setCategoryCurrencies(cat.currency);
    setCategoryTargetLevels(cat.targetLevels || [JdnLevel.TABHERA]);
    setCategoryIsActive(cat.isActive);
    setIsTypeModalOpen(true);
  };

  // Trigger empty create modal
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDesc('');
    setCategoryCurrencies(supportedCurrencies);
    setCategoryTargetLevels([JdnLevel.TABHERA, JdnLevel.NYIKA]);
    setCategoryIsActive(true);
    setIsTypeModalOpen(true);
  };

  // Contribution logger
  const handleLogContributionSubmit = async (e: React.FormEvent, forceBypass = false) => {
    e.preventDefault();
    setValidationError(null);

    const now = Date.now();
    if (now - lastLogContributionTime < 1500 || isLoggingContribution) {
      toast.error('Logging in progress, please wait...', { id: 'rate-limit-log-contrib' });
      return;
    }
    setLastLogContributionTime(now);
    setIsLoggingContribution(true);

    if (!isGuestContributor && !logMember) {
      setValidationError('Please select a congregation member.');
      setIsLoggingContribution(false);
      return;
    }

    if (isGuestContributor && !guestNameValue.trim()) {
      setValidationError('Please enter the guest contributor\'s name.');
      setIsLoggingContribution(false);
      return;
    }

    if (!logMurairo) {
      setValidationError('Please select a contribution category.');
      setIsLoggingContribution(false);
      return;
    }

    const amountNum = parseFloat(logAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setValidationError('Contribution amount must be greater than zero.');
      setIsLoggingContribution(false);
      return;
    }

    // Duplicate Submission Guardrail
    const isDuplicate = contributions.some(c => 
      c.memberId === (isGuestContributor ? 'guest-sender' : logMember) && 
      (isGuestContributor ? c.guestName === guestNameValue.trim() : true) &&
      c.murairoId === logMurairo && 
      Math.abs(c.amount - amountNum) < 0.01 && 
      c.currency === logCurrency && 
      c.date === logDate
    );

    if (isDuplicate && !forceBypass) {
      setDuplicateWarning(true);
      setIsLoggingContribution(false);
      return;
    }

    // Build the full administrative slash-eliminated hierarchy path
    const linkedMember = isGuestContributor ? null : members.find(m => m.memberId === logMember);
    const memberNameClean = isGuestContributor ? guestNameValue.trim().replace(/\s+/g, '-') : (linkedMember ? linkedMember.fullName.replace(/\s+/g, '-') : 'Unknown');
    
    // Construct hierarchy path: SYS/JER/.../TabheraCode/memberId
    const baseHierarchyPath = [
      currentUser.parentCode || 'SYS-GLOBAL',
      currentUser.levelCode,
      isGuestContributor ? 'guest' : logMember
    ].filter(Boolean).join('/');

    // Unique reference code JDN-MUR-XXXXXX or user-provided
    const referenceCode = logReceipt.trim() ? logReceipt.trim() : `JDN-MUR-${Math.floor(100000 + Math.random() * 900000)}`;

    const newContrib: ContributionLog = {
      contributionId: `cn-${Date.now()}`,
      memberId: isGuestContributor ? 'guest-sender' : logMember,
      isGuest: isGuestContributor,
      guestName: isGuestContributor ? guestNameValue.trim() : undefined,
      murairoId: logMurairo,
      amount: amountNum,
      currency: logCurrency,
      paymentMethod: logMethod,
      date: logDate,
      loggedBy: currentUser.id,
      tabheraCode: currentUser.level === JdnLevel.TABHERA ? currentUser.levelCode : 'TAB-HRE-S-1A-1',
      syncStatus: 'pending',
      hierarchyPath: baseHierarchyPath,
      referenceCode: referenceCode,
      family: isGuestContributor ? 'Guest' : (linkedMember?.family || 'Unknown')
    };

    try {
      const activeList = await getContributions() || [];

      // Offline resolution behavior choice
      if (duplicateWarning) {
        if (duplicateConflictPolicy === 'server') {
          // Server Authority mock: discard current client entry if duplicate
          setDuplicateWarning(false);
          setIsLogOpen(false);
          setLogAmount('');
          toast('Sync Engine: Duplicate discarded. Server Authority priority has preserved existing cloud database entry.', { icon: 'ℹ️' });
          setIsLoggingContribution(false);
          return;
        }
        // Else 'timestamp priority' which appends anyway as a distinct transaction
      }

      await saveContributions([...activeList, newContrib]);

      // Add audit log entry
      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'CONTRIBUTION_RECORD',
        details: `Recorded Murairo contribution reference "${referenceCode}" size ${logCurrency} ${amountNum} for Member ${logMember}`,
        category: 'contribution'
      });

      // Synchronize queue
      await addToSyncQueue('contribution', newContrib.contributionId, 'create', newContrib);

      setDuplicateWarning(false);
      setIsLogOpen(false);
      setLogAmount('');
      setIsGuestContributor(false);
      setGuestNameValue('');
      await loadContributionData();
      
      // Dispatch alert state
      window.dispatchEvent(new Event('jdn_db_updated'));
      toast.success('Contribution logged successfully!');
      setIsLoggingContribution(false);
    } catch (err) {
      setValidationError('Failed to complete safe transaction log.');
      setIsLoggingContribution(false);
    }
  };

  const handleToggleCurrencySelection = (curr: string) => {
    if (categoryCurrencies.includes(curr)) {
      setCategoryCurrencies(prev => prev.filter(c => c !== curr));
    } else {
      setCategoryCurrencies(prev => [...prev, curr]);
    }
  };

  const handleToggleTargetLevel = (lvl: JdnLevel) => {
    if (categoryTargetLevels.includes(lvl)) {
      setCategoryTargetLevels(prev => prev.filter(l => l !== lvl));
    } else {
      setCategoryTargetLevels(prev => [...prev, lvl]);
    }
  };

  // Core Statistics Filters Solver Filter function
  const getFilteredContributionsForStats = () => {
    let result = contributions;

    // 1. Time range filter
    if (filterStatsTimeRange !== 'All Time') {
      const today = new Date();
      let limitDateStr = '';

      if (filterStatsTimeRange === 'Day') {
        limitDateStr = today.toISOString().split('T')[0];
      } else if (filterStatsTimeRange === 'Week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        limitDateStr = d.toISOString().split('T')[0];
      } else if (filterStatsTimeRange === 'Month') {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        limitDateStr = d.toISOString().split('T')[0];
      } else if (filterStatsTimeRange === 'Year') {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        limitDateStr = d.toISOString().split('T')[0];
      }

      if (filterStatsTimeRange === 'Custom') {
        if (filterStartDate) {
          result = result.filter(c => c.date >= filterStartDate);
        }
        if (filterEndDate) {
          result = result.filter(c => c.date <= filterEndDate);
        }
      } else if (limitDateStr) {
        result = result.filter(c => c.date >= limitDateStr);
      }
    }

    // 3. Branch filter
    if (filterStatsBranchCode) {
      result = result.filter(c => {
        return c.tabheraCode.startsWith(filterStatsBranchCode) || filterStatsBranchCode.startsWith(c.tabheraCode);
      });
    }

    return result;
  };

  const activeContributions = getFilteredContributionsForStats();

  // Aggregated Values & Category Performance Indices
  const getCategoryMetrics = () => {
    const metrics: Record<string, { 
      totalUSD: number; 
      contributorCount: Set<string>; 
      averageContribution: number;
      topUnit: string;
      topUnitValue: number;
      unitTallies: Record<string, number>;
      entriesCount: number;
    }> = {};

    types.forEach(t => {
      metrics[t.murairoId] = {
        totalUSD: 0,
        contributorCount: new Set<string>(),
        averageContribution: 0,
        topUnit: 'N/A',
        topUnitValue: 0,
        unitTallies: {},
        entriesCount: 0
      };
    });

    // fallback category if unknown category ID found
    const fallbackId = 'fallback-general';
    metrics[fallbackId] = {
      totalUSD: 0,
      contributorCount: new Set<string>(),
      averageContribution: 0,
      topUnit: 'N/A',
      topUnitValue: 0,
      unitTallies: {},
      entriesCount: 0
    };

    activeContributions.forEach(c => {
      const mUSD = convertToUSD(c.amount, c.currency);
      const catId = metrics[c.murairoId] ? c.murairoId : fallbackId;

      metrics[catId].totalUSD += mUSD;
      metrics[catId].contributorCount.add(c.memberId);
      metrics[catId].entriesCount += 1;

      // unit aggregation
      const unitCode = c.tabheraCode || 'General';
      metrics[catId].unitTallies[unitCode] = (metrics[catId].unitTallies[unitCode] || 0) + mUSD;
    });

    // Finalize ratios and top unit calculations
    Object.keys(metrics).forEach(catId => {
      const item = metrics[catId];
      if (item.contributorCount.size > 0) {
        item.averageContribution = item.totalUSD / item.contributorCount.size;
      }
      
      // select top unit
      let highestVal = 0;
      let highestUnit = 'N/A';
      Object.entries(item.unitTallies).forEach(([unitCode, value]) => {
        if (value > highestVal) {
          highestVal = value;
          highestUnit = unitCode;
        }
      });
      item.topUnit = highestUnit;
      item.topUnitValue = highestVal;
    });

    return metrics;
  };

  const categoryPerformance = getCategoryMetrics();

  // Ledger Filter logic
  const filteredContributions = activeContributions.filter(c => {
    const linkedMember = c.isGuest ? null : members.find(m => m.memberId === c.memberId);
    const targetType = types.find(t => t.murairoId === c.murairoId);

    // Search query matches including Guest's manual name
    const mName = c.isGuest ? c.guestName || "Guest" : (linkedMember ? linkedMember.fullName : "Unknown");
    const nameMatch = mName.toLowerCase().includes(searchTerm.toLowerCase());
    const codeMatch = c.referenceCode ? c.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const searchMatch = !searchTerm || nameMatch || codeMatch;

    // Category match
    const categoryMatch = !filterCategory || c.murairoId === filterCategory;

    // Payment method match
    const paymentMatch = !filterPaymentMethod || c.paymentMethod === filterPaymentMethod;

    // Contributor Type (All / Members / Guests)
    const contributorTypeMatch = filterContributorType === 'all'
      ? true
      : filterContributorType === 'guests'
        ? c.isGuest === true
        : c.isGuest !== true;

    // Date range matches
    const dateGte = !filterStartDate || c.date >= filterStartDate;
    const dateLte = !filterEndDate || c.date <= filterEndDate;

    return searchMatch && categoryMatch && paymentMatch && contributorTypeMatch && dateGte && dateLte;
  }).sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime());

  const LEDGER_ITEMS_PER_PAGE = 7;
  const totalLedgerPages = Math.ceil(filteredContributions.length / LEDGER_ITEMS_PER_PAGE);
  const pagedContributions = filteredContributions.slice(
    (currentPageLedger - 1) * LEDGER_ITEMS_PER_PAGE,
    currentPageLedger * LEDGER_ITEMS_PER_PAGE
  );

  // Export ledger to CSV
  const exportLedgerToCSV = () => {
    const headers = ['Member Name', 'Category', 'Amount', 'Currency', 'Payment Method', 'Date', 'Hierarchy Path', 'Reference Code', 'Sync Status'];
    const delimiter = ',';
    const rows = filteredContributions.map(log => {
      const linkedMember = log.isGuest ? null : members.find(m => m.memberId === log.memberId);
      const targetType = types.find(t => t.murairoId === log.murairoId);
      const mName = log.isGuest ? `[GUEST] ${log.guestName || 'Guest'}` : (linkedMember ? linkedMember.fullName : log.memberId);
      const mPath = (log.hierarchyPath || log.tabheraCode).split('/').map(seg => resolveBranchName(seg, profiles)).join(' › ');

      return [
        `"${mName.replace(/"/g, '""')}"`,
        `"${(targetType ? targetType.name : 'General Core').replace(/"/g, '""')}"`,
        log.amount.toFixed(2),
        log.currency,
        log.paymentMethod || 'Cash',
        log.date,
        `"${mPath.replace(/"/g, '""')}"`,
        log.referenceCode || 'N/A',
        log.syncStatus
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(delimiter), ...rows.map(r => r.join(delimiter))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JDN_Contributions_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export ledger to PDF
  const exportLedgerToPDF = () => {
    const doc = new jsPDF();
    
    // Header Letterhead with Church Branding
    const churchName = jdnSettings?.churchName || "JERUSALEM DIGITAL NETWORK (JDN)";
    const address = jdnSettings?.contactAddress || "Jerusalem Headquarters, Zimbabwe";
    const phone = jdnSettings?.contactPhone || "+263 JDN DIGITAL";
    const email = jdnSettings?.contactEmail || "info@jerusalemdigitalnetwork.org";

    // Header background bar
    doc.setFillColor(22, 101, 52); // JDN Brand Green
    doc.rect(14, 10, 182, 3, 'F');

    // Title / Church Details
    doc.setFontSize(14);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text(churchName, 14, 20);

    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(`Address: ${address} | Tel: ${phone} | Email: ${email}`, 14, 25);

    // Divider line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(11);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("OFFICIAL CONTRIBUTIONS LEDGER REPORT", 14, 35);
    
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Level Code: ${currentUser.levelCode || 'Jerusalem HQ'}`, 14, 40);

    const headers = [['Member Name', 'Category', 'Amount', 'Method', 'Date', 'Path']];
    const rows = filteredContributions.map(log => {
      const linkedMember = log.isGuest ? null : members.find(m => m.memberId === log.memberId);
      const targetType = types.find(t => t.murairoId === log.murairoId);
      const mName = log.isGuest ? `[GUEST] ${log.guestName || 'Guest'}` : (linkedMember ? linkedMember.fullName : log.memberId);
      const mPath = (log.hierarchyPath || log.tabheraCode).split('/').map(seg => resolveBranchName(seg, profiles)).join(' › ');

      return [
        mName,
        targetType ? targetType.name : 'General Core',
        `${log.amount.toFixed(2)} ${log.currency}`,
        log.paymentMethod || 'Cash',
        log.date,
        mPath
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] },
      styles: { fontSize: 7 }
    });

    doc.save(`JDN_Contributions_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Trend Charts prep using Recharts (aggregating totals by date for graph rendering)
  const getDailyContributionTrend = () => {
    const dailyMap: Record<string, number> = {};
    
    // Sort contributions by date chronological
    const sorted = [...activeContributions].sort((a,b) => a.date.localeCompare(b.date));
    
    // seed last 7 days or use available values
    sorted.forEach(c => {
      const usdEq = convertToUSD(c.amount, c.currency);
      dailyMap[c.date] = (dailyMap[c.date] || 0) + usdEq;
    });

    // transform to format Recharts accepts: { date: 'May 20', amount: 15 }
    return Object.entries(dailyMap).map(([dateLabel, usdValue]) => ({
      date: dateLabel.substring(5), // shorten "2026-05-20" into "05-20"
      amount: Math.round(usdValue)
    })).slice(-10); // get last 10 transaction days
  };

  const chartTrendData = getDailyContributionTrend();

  const getCategoryBreakdownData = () => {
    return types.map(t => {
      const perf = categoryPerformance[t.murairoId] || { totalUSD: 0 };
      return {
        name: t.name,
        USD: Math.round(perf.totalUSD)
      };
    });
  };

  const chartCategoryData = getCategoryBreakdownData();

  const getCurrencyDistributionData = () => {
    const curMap: Record<string, number> = {};
    supportedCurrencies.forEach(curr => { curMap[curr] = 0; });

    contributions.forEach(c => {
      const usdEq = convertToUSD(c.amount, c.currency);
      curMap[c.currency] = (curMap[c.currency] || 0) + usdEq;
    });

    const colors = ['#166534', '#1D4ED8', '#D97706'];

    return Object.entries(curMap).map(([currKey, amountVal], idx) => ({
      name: currKey,
      value: Math.round(amountVal),
      color: colors[idx % colors.length]
    })).filter(item => item.value > 0);
  };

  const chartCurrencyData = getCurrencyDistributionData();

  // Selected Member ranking analysis details
  const getMemberRankDetails = (mId: string) => {
    const member = members.find(m => m.memberId === mId);
    if (!member) return null;

    // Filter contributions from this member specifically
    const mContribs = contributions.filter(c => c.memberId === mId);
    
    // Calculate category breakdown tallies for this member
    const catBreakdown: Record<string, number> = {};
    types.forEach(t => { catBreakdown[t.name] = 0; });

    let lifetimeUSD = 0;
    mContribs.forEach(c => {
      const type = types.find(t => t.murairoId === c.murairoId);
      const label = type ? type.name : 'Zunde General';
      const usdEquivalent = convertToUSD(c.amount, c.currency);

      catBreakdown[label] = (catBreakdown[label] || 0) + usdEquivalent;
      lifetimeUSD += usdEquivalent;
    });

    // Compute rank inside their exact Tabhera congregation
    const sameTabheraMembers = members.filter(m => m.tabheraCode === member.tabheraCode);
    const tabheraContributionsMap = sameTabheraMembers.map(tm => {
      const total = contributions
        .filter(c => c.memberId === tm.memberId)
        .reduce((sum, current) => sum + convertToUSD(current.amount, current.currency), 0);
      return { memberId: tm.memberId, name: tm.fullName, score: total };
    }).sort((a,b) => b.score - a.score);

    const relativeRank = tabheraContributionsMap.findIndex(x => x.memberId === mId) + 1;

    return {
      profile: member,
      history: mContribs.sort((a,b) => b.date.localeCompare(a.date)),
      breakdown: Object.entries(catBreakdown),
      lifetimeUSD,
      localRank: relativeRank,
      tabheraSize: sameTabheraMembers.length
    };
  };

  const selectedMemberRankDetails = getMemberRankDetails(selectedMemberId);

  // Identify underperforming units based on average financial metrics
  const getUnderperformingUnits = () => {
    const tabheraAverages: Record<string, { totalUSD: number; membersCount: number; averageUSD: number }> = {};

    members.forEach(m => {
      if (!tabheraAverages[m.tabheraCode]) {
        tabheraAverages[m.tabheraCode] = { totalUSD: 0, membersCount: 0, averageUSD: 0 };
      }
      tabheraAverages[m.tabheraCode].membersCount += 1;
    });

    contributions.forEach(c => {
      const usd = convertToUSD(c.amount, c.currency);
      const code = c.tabheraCode || 'TAB-HRE-S-1A-1';
      if (!tabheraAverages[code]) {
        tabheraAverages[code] = { totalUSD: 0, membersCount: 1, averageUSD: 0 };
      }
      tabheraAverages[code].totalUSD += usd;
    });

    Object.keys(tabheraAverages).forEach(code => {
      const entry = tabheraAverages[code];
      entry.averageUSD = entry.totalUSD / (entry.membersCount || 1);
    });

    // Return sorted lowest first (excluding zero member ones)
    return Object.entries(tabheraAverages)
      .map(([code, values]) => ({
        unitCode: code,
        average: values.averageUSD,
        total: values.totalUSD,
        membersCount: values.membersCount
      }))
      .filter(item => item.membersCount > 0)
      .sort((a, b) => a.average - b.average)
      .slice(0, 3); // Get top 3 lowest
  };

  const underperformingUnitsList = getUnderperformingUnits();

  // Role and security validations
  const isAuthorizedCategoryEditor = currentUser.level === JdnLevel.SYSTEM || 
                                     currentUser.level === JdnLevel.JERUSALEM;
  
  const isAuthorizedContributionLogger = currentUser.level === JdnLevel.TABHERA || currentUser.level === JdnLevel.WELLNESS_CENTER;

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 animate-fade-in h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading murairo ledgers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-[#166534]" />
            <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Financial Murairo Hub</h1>
          </div>
          <p className="text-sm text-[#6B7280] mt-1">
            System Level: <span className="font-bold text-[#166534]">{currentUser.level} ({currentUser.role})</span> • Administrative Scope: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs text-gray-800">{currentUser.branchName}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isAuthorizedCategoryEditor && (
            <button
              onClick={openCreateCategory}
              className="bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-blue-700"
            >
              <Plus className="h-4 w-4" /> Define Murairo Category
            </button>
          )}

          {isAuthorizedContributionLogger && (
            <button
              onClick={() => {
                setLogMember('');
                setLogMurairo('');
                setLogAmount('');
                setLogCurrency('USD');
                setValidationError(null);
                setDuplicateWarning(false);
                setIsLogOpen(true);
              }}
              className="bg-[#166534] hover:bg-[#166534]/90 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" /> Log Member Contribution
            </button>
          )}
        </div>
      </div>

      {isAuthorizedContributionLogger && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm grace-shadow">
          <h3 className="text-xs font-black uppercase text-[#166534] tracking-widest mb-3 flex items-center gap-1.5">
            <span>✍️ Quick Record Standard Murairo</span>
          </h3>
          <form onSubmit={(e) => handleLogContributionSubmit(e, false)} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Search Congregation Member</label>
              <input
                type="text"
                placeholder="Type member name..."
                value={formMemberSearch}
                onChange={(e) => setFormMemberSearch(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
              <select
                required
                value={logMember}
                onChange={(e) => setLogMember(e.target.value)}
                className="w-full px-2 py-1.5 mt-1 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none"
              >
                <option value="">-- Choose Member --</option>
                {members
                  .filter(m => !formMemberSearch || m.fullName.toLowerCase().includes(formMemberSearch.toLowerCase()))
                  .slice(0, 100)
                  .map(m => (
                    <option key={m.memberId} value={m.memberId}>{m.fullName} ({m.groupId})</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Search Category</label>
              <input
                type="text"
                placeholder="Type category..."
                value={formCategorySearch}
                onChange={(e) => setFormCategorySearch(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
              <select
                required
                value={logMurairo}
                onChange={(e) => setLogMurairo(e.target.value)}
                className="w-full px-2 py-1.5 mt-1 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none"
              >
                <option value="">-- Choose Category --</option>
                {types
                  .filter(t => t.isActive)
                  .filter(t => !formCategorySearch || t.name.toLowerCase().includes(formCategorySearch.toLowerCase()))
                  .map(t => (
                    <option key={t.murairoId} value={t.murairoId}>{t.name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Amount & Currency</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="any"
                  required
                  value={logAmount}
                  onChange={(e) => setLogAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none"
                />
                <select
                  value={logCurrency}
                  onChange={(e) => setLogCurrency(e.target.value)}
                  className="w-16 px-1 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none"
                >
                  {supportedCurrencies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Method & Ref</label>
              <div className="flex gap-1">
                <select
                  value={logMethod}
                  onChange={(e) => setLogMethod(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none"
                >
                  {supportedPaymentMethods.map(meth => (
                    <option key={meth} value={meth}>{meth}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={logReceipt}
                  onChange={(e) => setLogReceipt(e.target.value)}
                  placeholder="Ref Override"
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-[10px] bg-gray-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex lg:col-span-1 gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Log Date</label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingContribution}
                className="bg-[#166534] hover:bg-[#115e2e] text-white font-black text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1 transition-all h-9 cursor-pointer self-end shrink-0"
              >
                Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Privacy Shield Alert - Removed as per layout update to show actual member names always */}

      {/* 3. Sub Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-1 sm:space-x-1" aria-label="Tabs">
          {[
            { id: 'dashboard', label: '📊 Performance Dashboards' },
            { id: 'ledger', label: '📜 Transactions Ledger' },
            { id: 'categories', label: '⚙️ Category Control panel' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive 
                    ? 'border-[#166534] text-[#166534] font-black' 
                    : 'border-transparent text-gray-500 hover:text-gray-750 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Global Dashboard & Ledger Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-[#166534]">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-extrabold text-[11px] uppercase tracking-wider">Dashboard & Performance Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Time scale */}
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-gray-500">Date Range / Period</label>
            <select
              value={filterStatsTimeRange}
              onChange={(e) => setFilterStatsTimeRange(e.target.value)}
              className="block w-full text-xs py-1.5 px-3 border border-gray-250 bg-gray-50 rounded-lg focus:outline-[#166534] focus:outline-none"
            >
              <option value="All Time">♾️ All Time History</option>
              <option value="Day">📅 Specific Today Only</option>
              <option value="Week">🗓️ Last 7 Days (Week)</option>
              <option value="Month">📆 Last 30 Days (Month)</option>
              <option value="Year">📊 Last 12 Months (Year)</option>
              <option value="Custom">⚙️ Custom Calendar Range</option>
            </select>
          </div>

          {/* Branch combobox */}
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-gray-500">Filter Branch / Agency</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search branches..."
                value={branchSearchTerm}
                onChange={(e) => setBranchSearchTerm(e.target.value)}
                className="block w-full text-xs pl-7 pr-3 py-1.5 border border-gray-250 bg-white rounded-t-lg focus:outline-[#166534] focus:outline-none placeholder-gray-400"
              />
            </div>
            <select
              size={3}
              value={filterStatsBranchCode}
              onChange={(e) => setFilterStatsBranchCode(e.target.value)}
              className="block w-full text-xs py-1.5 px-3 border border-gray-250 border-t-0 bg-gray-50 rounded-b-lg focus:outline-[#166534] focus:outline-none"
            >
              <option value="" className="p-1 font-bold">🏢 All System Branches</option>
              {Array.from(new Set(profiles.filter(p => p.branchName).map(p => p.levelCode)))
                .map(code => {
                  const prf = profiles.find(p => p.levelCode === code);
                  return { code, name: prf ? prf.branchName : code };
                })
                .filter(b => b.name.toLowerCase().includes(branchSearchTerm.toLowerCase()))
                .map(b => (
                  <option key={b.code} value={b.code} className="p-1 hover:bg-gray-100">{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom period start/end inputs if "Custom" selected */}
        {filterStatsTimeRange === 'Custom' && (
          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-2 bg-gray-50/50 p-2 rounded-lg animate-fade-in">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-gray-500">From Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="block w-full text-xs py-1 px-2 border border-gray-250 rounded font-mono focus:outline-[#166534]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-gray-500">To Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="block w-full text-xs py-1 px-2 border border-gray-250 rounded font-mono focus:outline-[#166534]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ====================================
                   TAB: DASHBOARD
         ==================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {supportedCurrencies.map((curr) => {
              const totalRaw = activeContributions
                .filter(c => c.currency === curr)
                .reduce((sum, current) => sum + current.amount, 0);

              return (
                <div key={curr} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Total {curr} Gathered</span>
                    <span className="text-2xl font-black text-gray-900 font-mono mt-1.5 block">
                      {curr === 'USD' ? '$' : curr === 'ZAR' ? 'R' : ''}
                      {totalRaw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {curr !== 'USD' && curr !== 'ZAR' ? ` ${curr}` : ''}
                    </span>
                  </div>
                  <div className="p-3 bg-green-50 text-[#166534] rounded-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Currency Performance & Rankings */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-500 animate-bounce" /> Currency Performance Leaderboard
                </h3>
                <p className="text-[10px] text-gray-500">Live rankings of raised revenues normalized in USD equivalent value.</p>
              </div>
              {/* Top performing currency pill */}
              {(() => {
                const ranks = supportedCurrencies.map(curr => {
                  const totalRaw = activeContributions
                    .filter(c => c.currency === curr)
                    .reduce((sum, current) => sum + current.amount, 0);
                  const usdEq = convertToUSD(totalRaw, curr);
                  return { curr, raw: totalRaw, usdEq };
                }).filter(r => r.usdEq > 0).sort((a, b) => b.usdEq - a.usdEq);

                if (ranks.length === 0) return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-400 border border-gray-200 rounded-full text-[10px] font-bold">
                    No contributions logged yet
                  </span>
                );
                const top = ranks[0];

                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-black uppercase tracking-wide">
                     🔥 Top Performer: {top.curr} (${top.usdEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} equivalent)
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
                      const ranks = supportedCurrencies.map(curr => {
                        const totalRaw = activeContributions
                          .filter(c => c.currency === curr)
                          .reduce((sum, current) => sum + current.amount, 0);
                        const usdEq = convertToUSD(totalRaw, curr);
                        return { curr, raw: totalRaw, usdEq };
                      }).sort((a, b) => b.usdEq - a.usdEq);

                      return ranks.map((item, idx) => {
                        const isTop = idx === 0 && item.usdEq > 0;
                        return (
                          <tr key={item.curr} className={isTop ? "bg-amber-50/10 font-semibold text-gray-900" : ""}>
                            <td className="py-3 px-4 text-center">
                              {idx === 0 && item.usdEq > 0 ? (
                                <span className="inline-flex items-center justify-center h-5 w-5 bg-amber-100 text-amber-700 rounded-full font-bold text-[10px] shadow-sm">🥇</span>
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
                              {item.raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

              {/* Mini visual ranking chart */}
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-150 space-y-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Contribution Revenue Share</span>
                <div className="space-y-4">
                  {(() => {
                    const ranks = supportedCurrencies.map(curr => {
                      const totalRaw = activeContributions
                        .filter(c => c.currency === curr)
                        .reduce((sum, current) => sum + current.amount, 0);
                      const usdEq = convertToUSD(totalRaw, curr);
                      return { curr, usdEq };
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

          {/* Graphical Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Category Breakdown bar chart */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4">Financial Volume per Murairo Type (USD Equiv.)</h2>
              {chartCategoryData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-gray-400">No chart data matching parameters.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartCategoryData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#6B7280" fontSize={10} />
                      <YAxis stroke="#6B7280" fontSize={10} />
                      <Tooltip formatter={(value) => [`$${value} USD`, 'Amount']} />
                      <Bar dataKey="USD" fill="#166534" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Time Series Transaction Trends */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4">Chronological Contribution Velocity</h2>
              {chartTrendData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-gray-400">Chronological trend requires logged contributions.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" stroke="#6B7280" fontSize={10} />
                      <YAxis stroke="#6B7280" fontSize={10} />
                      <Tooltip formatter={(value) => [`$${value} USD`, 'Total']} />
                      <Line type="monotone" dataKey="amount" stroke="#1D4ED8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Currency percentage split summary */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4">Unified Currency Split</h2>
              {chartCurrencyData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">No multi-currency funds logged.</div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="h-32 w-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartCurrencyData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {chartCurrencyData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 w-full mt-4 font-mono text-[10px] text-center">
                    {chartCurrencyData.map(item => (
                      <div key={item.name}>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-gray-800">{item.name}</span>
                        <div className="text-gray-400">${item.value} eq</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Performance analytics metrics table per category */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
              <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-[#166534]" /> Category Performance Analytics Check
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 uppercase font-black tracking-wider pb-1.5">
                      <th className="pb-2">Murairo Model</th>
                      <th className="pb-2">Unique Contributors</th>
                      <th className="pb-2">Avg / Contributor</th>
                      <th className="pb-2">Total Gathered</th>
                      <th className="pb-2 text-right">Top Contributing Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {types.map(t => {
                      const perf = categoryPerformance[t.murairoId] || { 
                        totalUSD: 0, 
                        contributorCount: new Set(), 
                        averageContribution: 0,
                        topUnit: 'N/A',
                        topUnitValue: 0
                      };
                      return (
                        <tr key={t.murairoId} className="hover:bg-gray-50/50">
                          <td className="py-2.5 font-bold text-gray-900">{t.name}</td>
                          <td className="py-2.5 font-mono">{perf.contributorCount.size} members</td>
                          <td className="py-2.5 font-mono">${perf.averageContribution.toFixed(2)}</td>
                          <td className="py-2.5 font-bold font-mono text-[#166534]">${perf.totalUSD.toFixed(1)} USD eq.</td>
                          <td className="py-2.5 font-mono text-right text-gray-950 font-bold">
                            {resolveBranchName(perf.topUnit, profiles)} <span className="text-gray-400 text-[10px] font-normal">(${(perf.topUnitValue || 0).toFixed(0)})</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>


        </div>
      )}

      {/* ====================================
                   TAB: LEDGER
         ==================================== */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          
          {/* Filtering Widgets Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-3">
            
            {/* Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search member name or code..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
            </div>

            {/* Contributor Class */}
            <div>
              <select
                value={filterContributorType}
                onChange={(e) => setFilterContributorType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              >
                <option value="all">All Contributor Types</option>
                <option value="members">Official Members</option>
                <option value="guests">Guests (Non-Members)</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              >
                <option value="">All Murairo Categories</option>
                {types.map(t => (
                  <option key={t.murairoId} value={t.murairoId}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Method Filter */}
            <div>
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              >
                <option value="">All Payment Methods</option>
                {supportedPaymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
            </div>

            {/* End Date */}
            <div>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
            </div>

          </div>

          {/* Ledger Table display */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Detailed transaction logs ({filteredContributions.length} records found)</h3>
                <div className="text-[10px] text-[#166534] font-bold font-mono">Offline Queue holds: {contributions.filter(c => c.syncStatus === 'pending').length} entries</div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={exportLedgerToCSV}
                  disabled={filteredContributions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#1D4ED8] hover:bg-blue-800 text-[10px] font-bold text-white rounded transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3 w-3" /> CSV
                </button>
                <button
                  onClick={exportLedgerToPDF}
                  disabled={filteredContributions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#166534] hover:bg-green-800 text-[10px] font-bold text-white rounded transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <FileText className="h-3 w-3" /> PDF
                </button>
              </div>
            </div>

            {filteredContributions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-2">
                <Coins className="h-10 w-10 mx-auto text-gray-300" />
                <h4 className="font-semibold text-gray-500">No member transactions matching criteria.</h4>
                <p className="text-[11px]">Adjust your search queries or filter constraints above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-[#6B7280] font-bold uppercase tracking-wider border-b border-gray-100">
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Transaction Payment Details</th>
                      <th className="py-3 px-4">Date / Slashed Path</th>
                      <th className="py-3 px-4">Sync status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {pagedContributions.map((log) => {
                      const linkedMember = members.find(m => m.memberId === log.memberId);
                      const targetType = types.find(t => t.murairoId === log.murairoId);
                      
                      // Always show names (no anonymization protection as per request)
                      const anonymousDisplay = false;

                      return (
                        <tr key={log.contributionId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900">
                              {log.isGuest ? (
                                <div className="flex items-center gap-1.5">
                                  <span>{log.guestName || 'Guest Contributor'}</span>
                                  <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-black uppercase tracking-wider">
                                    Guest
                                  </span>
                                </div>
                              ) : (
                                anonymousDisplay ? "🔒 Protected Congregation Associate" : (linkedMember ? linkedMember.fullName : `Loading ID: ${log.memberId}`)
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">Reference Code: {log.referenceCode || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                            {resolveBranchName(log.tabheraCode, profiles)}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                            {targetType ? targetType.name : 'General Core'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-[#166534] block">
                              {log.currency === 'USD' ? '$' : log.currency === 'ZAR' ? 'R' : ''}
                              {log.amount.toFixed(2)} {log.currency === 'ZWG' ? 'ZWG' : ''}
                            </span>
                            <span className="text-[10px] text-gray-500 font-sans block mt-0.5">Method: {log.paymentMethod || 'Cash'}</span>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="text-gray-800 font-semibold">{log.date}</div>
                            <div className="text-[10px] text-gray-500 font-bold truncate max-w-[180px]" title={log.hierarchyPath}>Path: {anonymousDisplay ? `${resolveBranchName(log.tabheraCode, profiles)}/Protected` : (log.hierarchyPath || log.tabheraCode).split('/').map(seg => resolveBranchName(seg, profiles)).join(' › ')}</div>
                          </td>
                          <td className="py-3 px-4">
                            {log.syncStatus === 'pending' ? (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                                Pending Sync
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#16A34A] border border-green-200 text-[10px] font-bold uppercase tracking-wider">
                                Uploaded
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                               onClick={async () => {
                                 if(!confirm('Delete this contribution record?')) return;
                                 const kept = contributions.filter(c => c.contributionId !== log.contributionId);
                                 setContributions(kept);
                                 await saveContributions(kept);
                                 await addToSyncQueue('contribution', log.contributionId, 'delete', null);
                               }}
                               className="p-1 px-2 hover:bg-red-50 border border-gray-200 bg-white shadow-sm rounded text-[10px] font-bold text-red-600 cursor-pointer transition inline-flex items-center"
                            >
                               Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination for ledger (exactly 10 logs per page) */}
            {totalLedgerPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50/50">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    disabled={currentPageLedger === 1}
                    onClick={() => setCurrentPageLedger(prev => Math.max(prev - 1, 1))}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPageLedger === totalLedgerPages}
                    onClick={() => setCurrentPageLedger(prev => Math.min(prev + 1, totalLedgerPages))}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] text-gray-750">
                      Showing <span className="font-semibold">{(currentPageLedger - 1) * LEDGER_ITEMS_PER_PAGE + 1}</span> to{' '}
                      <span className="font-semibold">
                        {Math.min(currentPageLedger * LEDGER_ITEMS_PER_PAGE, filteredContributions.length)}
                      </span>{' '}
                      of <span className="font-semibold">{filteredContributions.length}</span> transaction logs
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-xs bg-white border border-gray-200" aria-label="Pagination">
                      <button
                        disabled={currentPageLedger === 1}
                        onClick={() => setCurrentPageLedger(1)}
                        className="relative inline-flex items-center rounded-l-md px-2 py-1 bg-white text-[11px] font-bold text-gray-450 hover:bg-gray-50 disabled:opacity-50"
                      >
                        First
                      </button>
                      <button
                        disabled={currentPageLedger === 1}
                        onClick={() => setCurrentPageLedger(prev => Math.max(prev - 1, 1))}
                        className="relative inline-flex items-center px-2 py-1 bg-white text-[11px] font-bold text-gray-450 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalLedgerPages }, (_, i) => i + 1)
                        .filter(page => Math.abs(page - currentPageLedger) <= 2 || page === 1 || page === totalLedgerPages)
                        .map((page, idx, arr) => {
                          const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && (
                                <span className="relative inline-flex items-center px-3 py-1 text-xs text-gray-400 font-bold border-r border-gray-200 bg-gray-50">
                                  ...
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPageLedger(page)}
                                className={`relative inline-flex items-center px-3 py-1 text-[11px] font-bold ${
                                  currentPageLedger === page
                                    ? 'z-10 bg-[#166534] text-white border-none'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-200'
                                }`}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      <button
                        disabled={currentPageLedger === totalLedgerPages}
                        onClick={() => setCurrentPageLedger(prev => Math.min(prev + 1, totalLedgerPages))}
                        className="relative inline-flex items-center px-2 py-1 bg-white text-[11px] font-bold text-gray-450 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                      <button
                        disabled={currentPageLedger === totalLedgerPages}
                        onClick={() => setCurrentPageLedger(totalLedgerPages)}
                        className="relative inline-flex items-center rounded-r-md px-2 py-1 bg-white text-[11px] font-bold text-gray-450 hover:bg-gray-50 disabled:opacity-50"
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
      )}

      {/* ====================================
                   TAB: CATEGORIES
         ==================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Current Murairo Categories & Rules</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Only Jerusalem or National councils are authorized to manage these configurations.</p>
              </div>
              <Sparkles className="h-5 w-5 text-blue-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {types.map(t => {
                return (
                  <div key={t.murairoId} className={`p-4 rounded-xl border transition-all ${t.isActive ? 'bg-gray-50/50 border-gray-200' : 'bg-gray-100/50 border-dashed border-gray-300 opacity-60'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-gray-900">{t.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${t.isActive ? 'bg-green-100 text-[#166534]' : 'bg-gray-200 text-gray-500'}`}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 lines-2">{t.description || "No description set value."}</p>
                      </div>
                      
                      {isAuthorizedCategoryEditor && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditCategory(t)}
                            className="p-1 px-2 hover:bg-gray-250 border border-gray-200 bg-white shadow-sm rounded flex items-center gap-1 text-[10px] font-bold text-blue-700 cursor-pointer transition"
                          >
                            <Edit3 className="h-3 w-3" /> Edit Rules
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete category ${t.name}?`)) return;
                              const kept = types.filter(type => type.murairoId !== t.murairoId);
                              setTypes(kept);
                              await saveMurairoTypes(kept);
                              await addToSyncQueue('code', t.murairoId, 'delete', null);
                            }}
                            className="p-1 px-2 hover:bg-red-50 border border-gray-200 bg-white shadow-sm rounded flex items-center gap-1 text-[10px] font-bold text-red-600 cursor-pointer transition"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] border-t border-gray-100 pt-3">
                      <div>
                        <span className="text-gray-400 block uppercase font-bold tracking-wider">Currencies Supported:</span>
                        <span className="font-semibold text-gray-800">{t.currency.join(', ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-bold tracking-wider">Target Levels:</span>
                        <span className="font-semibold text-gray-850">{(t.targetLevels || [JdnLevel.TABHERA]).join(', ')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================
                   TAB: MEMBER REPORT RANK
         ==================================== */}
      {activeTab === 'memberRank' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm grace-shadow">
            <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Lookup Member Hierarchy & Spiritual Giving Records</h3>
            
            <div className="max-w-md">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Choose Congregation Member</label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs font-sans focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="">-- Select Member --</option>
                {members.map(m => (
                  <option key={m.memberId} value={m.memberId}>{m.fullName} ({resolveBranchName(m.tabheraCode, profiles)})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedMemberRankDetails ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Profile Card & Local Rank Info */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#166534]/10 text-[#166534] flex items-center justify-center font-bold">
                    <UserCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-950 leading-snug">{selectedMemberRankDetails.profile.fullName}</h3>
                    <span className="text-[10px] text-gray-500 block uppercase font-mono">{selectedMemberRankDetails.profile.groupId} • Join: {selectedMemberRankDetails.profile.joinDate}</span>
                  </div>
                </div>

                <div className="p-4 bg-[#166534]/5 border border-[#166534]/10 text-[#166534] rounded-xl text-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest block">Intra-Tabhera Giving Rank</span>
                  <span className="text-3xl font-black font-mono block mt-1">🥇 #{selectedMemberRankDetails.localRank}</span>
                  <span className="text-[9px] text-gray-500 block mt-1">out of {selectedMemberRankDetails.tabheraSize} members inside {resolveBranchName(selectedMemberRankDetails.profile.tabheraCode, profiles)}</span>
                </div>

                <div className="space-y-2 text-xs font-sans">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block border-b border-gray-100 pb-1">Spiritual Giving Summary</span>
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-500">Total USD Eq.</span>
                    <span className="font-bold text-gray-950">${selectedMemberRankDetails.lifetimeUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-gray-500">Payments Recorded</span>
                    <span className="font-bold text-blue-700">{selectedMemberRankDetails.history.length} times</span>
                  </div>
                </div>
              </div>

              {/* Tally Categories breakdown */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">Category Split</h3>
                <div className="space-y-3 pt-1">
                  {selectedMemberRankDetails.breakdown.map(([catName, amountVal]) => {
                    return (
                      <div key={catName} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-800">{catName}</span>
                          <span className="font-mono font-bold text-gray-950">${amountVal.toFixed(1)} USD</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#166534] h-full" 
                            style={{ width: `${selectedMemberRankDetails.lifetimeUSD > 0 ? (amountVal / selectedMemberRankDetails.lifetimeUSD) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* timeline history */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">Contribution history timeline</h3>
                {selectedMemberRankDetails.history.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400 italic">No contribution payments reported yet.</div>
                ) : (
                  <div className="space-y-3 pt-1 max-h-56 overflow-y-auto">
                    {selectedMemberRankDetails.history.map(item => {
                      const type = types.find(t => t.murairoId === item.murairoId);
                      return (
                        <div key={item.contributionId} className="flex justify-between items-start text-xs border-b border-gray-100 pb-2 last:border-0 hover:bg-gray-50/20 p-1 rounded">
                          <div>
                            <span className="font-bold text-gray-900 block">{type ? type.name : 'Zunde Core'}</span>
                            <span className="text-[10px] text-gray-400">{item.date} • {item.paymentMethod || 'Cash'}</span>
                          </div>
                          <span className="font-mono font-black text-[#166534]">{item.currency === 'USD' ? '$' : item.currency === 'ZAR' ? 'R' : ''}{item.amount} {item.currency === 'ZWG' ? 'ZWG' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 text-center text-xs text-gray-400">Loading hierarchy detail logs...</div>
          )}
        </div>
      )}

      {/* ========================================================
                         MODAL: CREATE/EDIT CATEGORY
          ======================================================== */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-200 animate-fade-in" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingCategory ? 'Edit Murairo Category Rules' : 'Define Murairo Category'}</h3>
              <button
                onClick={() => setIsTypeModalOpen(false)}
                className="text-gray-450 hover:text-black font-extrabold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 pt-4 text-xs font-sans text-gray-700">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Category Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Ruwadzano Guild Fund"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Description / Logistical Intention</label>
                <textarea
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  placeholder="Theological purpose, regional distribution notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Permitted Currencies</label>
                <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                  {supportedCurrencies.map((curr) => {
                    const isChecked = categoryCurrencies.includes(curr);
                    return (
                      <button
                        type="button"
                        key={curr}
                        onClick={() => handleToggleCurrencySelection(curr)}
                        className={`py-1.5 px-3 rounded font-black text-[10px] border text-center transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-sm font-bold' 
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {curr}
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-1 border border-gray-200 rounded p-1">
                    <input 
                      type="text" 
                      placeholder="Add New..." 
                      className="text-[10px] px-2 py-0.5 w-20 outline-none uppercase bg-transparent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim().toUpperCase();
                          if (val && !supportedCurrencies.includes(val)) {
                            setSupportedCurrencies(prev => [...prev, val]);
                            setCategoryCurrencies(prev => [...prev, val]);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Target Structural Hierarchy Levels</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {Object.values(JdnLevel).map((lvl) => {
                    if (lvl === JdnLevel.SYSTEM) return null; // System not a church level target for contributions
                    const isChecked = categoryTargetLevels.includes(lvl);
                    return (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => handleToggleTargetLevel(lvl)}
                        className={`py-1 px-2.5 rounded font-bold text-[9px] border text-center transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-[#166534] border-[#166534] text-white shadow-sm' 
                            : 'bg-gray-50 border-gray-250 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  id="categoryActive"
                  checked={categoryIsActive}
                  onChange={(e) => setCategoryIsActive(e.target.checked)}
                  className="rounded text-[#1D4ED8] focus:ring-[#1D4ED8] h-4 w-4"
                />
                <label htmlFor="categoryActive" className="text-xs font-bold text-gray-700 cursor-pointer">Active and open for congregation payments</label>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 text-xs font-sans">
                <button
                  type="button"
                  onClick={() => setIsTypeModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className={`px-4 py-2 text-white font-bold rounded-lg cursor-pointer transition-all active:scale-95 duration-100 ${
                    isSavingCategory
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-[#1D4ED8] hover:bg-[#1e40af] active:bg-[#1d3557]'
                  }`}
                >
                  {isSavingCategory ? 'Initializing...' : (editingCategory ? 'Modify Details' : 'Initialize Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
                         MODAL: LOG MEMBER CONTRIBUTION
          ======================================================== */}
      {isLogOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-200 animate-fade-in" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#111827]">Log Member Contribution</h3>
              <button
                onClick={() => setIsLogOpen(false)}
                className="text-gray-400 hover:text-black font-semibold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-red-50 text-[#DC2626] border border-red-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 mt-2">
                <ShieldAlert className="h-4 w-4" />
                <span>{validationError}</span>
              </div>
            )}

            {duplicateWarning ? (
              <div className="p-4 bg-orange-50 border border-orange-200 text-orange-855 rounded-xl space-y-3 text-xs mt-2 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" /> Dual-Transaction Safeguard System Detected
                </p>
                <p>
                  A payment transaction of exactly <strong>{logCurrency} {logAmount}</strong> was already saved on this date for the selected member under this Murairo category.
                </p>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Sync Resolution Protocol Override:</label>
                  <select
                    value={duplicateConflictPolicy}
                    onChange={(e) => setDuplicateConflictPolicy(e.target.value as any)}
                    className="w-full bg-white border border-gray-250 p-1.5 rounded font-sans text-[11px]"
                  >
                    <option value="timestamp">Timestamp priority: Save as distinct secondary payment</option>
                    <option value="server">Server authority wins: Reject duplicate and discard</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(false)}
                    className="px-3 py-1.5 text-gray-700 bg-white border border-gray-200 rounded font-semibold text-[11px] cursor-pointer"
                  >
                    Modify Fields
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleLogContributionSubmit(e, true)}
                    className="px-3 py-1.5 text-white bg-[#166534] rounded font-bold text-[11px] cursor-pointer"
                  >
                    Bypass Safeguard and Continue
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => handleLogContributionSubmit(e, false)} className="space-y-4 pt-2 text-xs font-sans text-gray-700">
                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    id="logIsGuest"
                    checked={isGuestContributor}
                    onChange={(e) => {
                      setIsGuestContributor(e.target.checked);
                      if (e.target.checked) {
                        setLogMember('guest-sender');
                      } else {
                        setLogMember('');
                      }
                    }}
                    className="h-4 w-4 rounded text-[#166534] focus:ring-[#166534] border-gray-350"
                  />
                  <label htmlFor="logIsGuest" className="text-xs font-extrabold uppercase text-gray-700 cursor-pointer flex items-center gap-1">
                    🎖️ Guest Contributor (Non-Member)
                  </label>
                </div>

                {isGuestContributor ? (
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Guest Person Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Enter guest's full name"
                      value={guestNameValue}
                      onChange={(e) => setGuestNameValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Search Congregation Member</label>
                    <input
                      type="text"
                      placeholder="Type name to filter..."
                      value={formMemberSearch}
                      onChange={(e) => setFormMemberSearch(e.target.value)}
                      className="w-full mb-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
                    />
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Select Congregation Member <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={logMember}
                      onChange={(e) => setLogMember(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    >
                      <option value="">-- Choose Member --</option>
                      {members
                        .filter(m => !formMemberSearch || m.fullName.toLowerCase().includes(formMemberSearch.toLowerCase()))
                        .slice(0, 50)
                        .map(m => (
                          <option key={m.memberId} value={m.memberId}>{m.fullName} ({m.groupId})</option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Search Category</label>
                  <input
                    type="text"
                    placeholder="Type category name to filter..."
                    value={formCategorySearch}
                    onChange={(e) => setFormCategorySearch(e.target.value)}
                    className="w-full mb-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
                  />
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Contribution Category <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={logMurairo}
                    onChange={(e) => setLogMurairo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  >
                    <option value="">-- Choose Category --</option>
                    {types
                      .filter(t => t.isActive)
                      .filter(t => !formCategorySearch || t.name.toLowerCase().includes(formCategorySearch.toLowerCase()))
                      .map(t => (
                        <option key={t.murairoId} value={t.murairoId}>{t.name} (Supports: {t.currency.join(', ')})</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Amount <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={logAmount}
                      onChange={(e) => setLogAmount(e.target.value)}
                      placeholder="e.g. 15.00"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Currency <span className="text-red-500">*</span></label>
                    <select
                      value={logCurrency}
                      onChange={(e) => setLogCurrency(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    >
                      {supportedCurrencies.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Payment Method</label>
                  <select
                    value={logMethod}
                    onChange={(e) => setLogMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  >
                    {supportedPaymentMethods.map(meth => (
                      <option key={meth} value={meth}>{meth}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Receipt / Reference number (receipt code)</label>
                  <input
                    type="text"
                    value={logReceipt}
                    onChange={(e) => setLogReceipt(e.target.value)}
                    placeholder="e.g. REC-12345"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Transaction Log Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 text-xs font-sans">
                  <button
                    type="button"
                    onClick={() => setIsLogOpen(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg font-bold hover:bg-gray-50 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingContribution}
                    className={`px-4 py-2 text-white font-bold rounded-lg cursor-pointer transition-all active:scale-95 duration-100 ${
                      isLoggingContribution
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-[#166534] hover:bg-[#115e2e] active:bg-[#0f4d25]'
                    }`}
                  >
                    {isLoggingContribution ? 'Recording transaction...' : 'Verify & Record'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
