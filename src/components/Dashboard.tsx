import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserProfile, JdnLevel, Member, MemberGroup } from '../types';
import { getMembers, getSyncQueue, getNetworkStatus, getUserProfiles, resolveBranchName, getGlobalMaintenanceMode, saveGlobalMaintenanceMode, isCodeInScope, addPlatformLog, getImpersonatorRoot, setImpersonatorRoot, setCurrentUser } from '../lib/storage';
import { LayoutDashboard, Users, Clock, AlertCircle, FileSpreadsheet, CheckCircle2, ChevronRight, BookOpen, GraduationCap, Coins, Milestone, Sparkles, FileText, Server, HardDrive, ShieldAlert, Terminal, Activity, Wrench, Database, Sprout, Leaf, Flower2, GitFork, TreePine, Crown, ChevronUp, ChevronDown, CheckCircle, FolderSearch, Trash, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  const parts = text.split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === search.toLowerCase() 
          ? <span key={i} className="bg-yellow-200 font-extrabold text-[#111] px-0.5 rounded border border-yellow-350">{part}</span> 
          : part
      )}
    </>
  );
}

interface DashboardProps {
  currentUser: UserProfile;
  onChangeTab: (tabName: string) => void;
}

export function Dashboard({ currentUser, onChangeTab }: DashboardProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isMaintActive, setIsMaintActive] = useState(false);
  const [childUnits, setChildUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States and selectors for the organic church linkage tree (Jerusalem Trunk, System Roots)
  const [treeSearch, setTreeSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Developer dashboard tools states
  const [selectedCollection, setSelectedCollection] = useState<string>('jdn_members');
  const [collectionCount, setCollectionCount] = useState<number>(0);
  const [collectionSample, setCollectionSample] = useState<any[]>([]);
  const [impersonationTarget, setImpersonationTarget] = useState<string>('');
  const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(null);

  const loadCollectionInfo = async (colName: string) => {
    try {
      const localforage = (await import('localforage')).default;
      const data = await localforage.getItem<any[]>(colName);
      if (Array.isArray(data)) {
        setCollectionCount(data.length);
        setCollectionSample(data.slice(0, 5));
      } else if (data) {
        setCollectionCount(1);
        setCollectionSample([data]);
      } else {
        setCollectionCount(0);
        setCollectionSample([]);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    const loadImpersonationStatus = async () => {
      const activeRoot = await getImpersonatorRoot();
      if (activeRoot) {
        setImpersonatedUser(currentUser);
        setImpersonationTarget(currentUser.id);
      }
    };
    if (currentUser.level === JdnLevel.SYSTEM) {
      loadImpersonationStatus();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser.level === JdnLevel.SYSTEM) {
      loadCollectionInfo(selectedCollection);
    }
  }, [selectedCollection, members, allUsers, currentUser]);

  const handleForceSyncAll = async () => {
    try {
      const { processSyncQueue } = await import('../lib/storage');
      await processSyncQueue();
      toast.success('Pushed all synchronized records successfully.');
      loadDashboardData();
    } catch (e: any) {
      toast.error('Sync failed: ' + e.message);
    }
  };



  const handleImpersonate = async (targetId: string) => {
    try {
      if (!targetId) {
        // Exit impersonated session
        const root = await getImpersonatorRoot();
        if (root) {
          await setCurrentUser(root);
          await setImpersonatorRoot(null);
          toast.success('Exiting impersonation session...');
          setTimeout(() => window.location.reload(), 1000);
        }
        return;
      }

      const targetUser = allUsers.find(u => u.id === targetId);
      if (targetUser) {
        // Prepare impersonator roots session
        const currentRoot = await getImpersonatorRoot();
        if (!currentRoot) {
          await setImpersonatorRoot(currentUser);
        }
        await setCurrentUser(targetUser);
        toast.success(`Successfully assumed context for: ${targetUser.fullName}`);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err: any) {
      toast.error('Impersonation failed: ' + err.message);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const handleRefresh = () => {
      loadDashboardData();
    };
    window.addEventListener('jdn_db_updated', handleRefresh);
    window.addEventListener('jdn_sync_queue_updated', handleRefresh);
    return () => {
      window.removeEventListener('jdn_db_updated', handleRefresh);
      window.removeEventListener('jdn_sync_queue_updated', handleRefresh);
    };
  }, [currentUser]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    const list = await getMembers();
    const qList = await getSyncQueue();
    setQueueSize(qList.length);

    const u = await getUserProfiles();
    setAllUsers(u);

    const mActive = await getGlobalMaintenanceMode();
    setIsMaintActive(mActive);

    // Compute child units from real users
    if (u && currentUser) {
       let children = u.filter(user => user.parentCode === currentUser.levelCode);
       
       if (children.length === 0) {
         if (currentUser.level === JdnLevel.JERUSALEM) {
           children = u.filter(user => user.level === JdnLevel.NATIONAL);
         } else if (currentUser.level === JdnLevel.NATIONAL) {
           children = u.filter(user => user.level === JdnLevel.PROVINCIAL && user.levelCode.startsWith(currentUser.levelCode));
         } else if (currentUser.level === JdnLevel.PROVINCIAL) {
           children = u.filter(user => user.level === JdnLevel.DISTRICT && user.levelCode.startsWith(currentUser.levelCode));
         } else if (currentUser.level === JdnLevel.DISTRICT) {
           children = u.filter(user => user.level === JdnLevel.NYIKA && user.levelCode.startsWith(currentUser.levelCode));
         } else if (currentUser.level === JdnLevel.NYIKA) {
           children = u.filter(user => user.level === JdnLevel.TABHERA && user.levelCode.startsWith(currentUser.levelCode));
         }
       }

       const computedChildren = children.map(child => {
         const getFullCode = (tabCode: string, profilesList: UserProfile[]) => {
           if (!tabCode) return '';
           if (tabCode.includes('/')) return tabCode;
           const match = profilesList.find(p => 
             p.level === JdnLevel.TABHERA && 
             (p.levelCode === tabCode || p.levelCode.endsWith('/' + tabCode) || p.levelCode.split('/').pop() === tabCode)
           );
           if (match) return match.levelCode;
           const matchAny = profilesList.find(p => 
             p.levelCode === tabCode || p.levelCode.endsWith('/' + tabCode) || p.levelCode.split('/').pop() === tabCode
           );
           if (matchAny) return matchAny.levelCode;
           return tabCode;
         };
         const childMembers = list.filter(m => {
           const fullCode = getFullCode(m.tabheraCode, u);
           return isCodeInScope(m.tabheraCode, child.levelCode, u);
         });
         let lastSync = child.createdAt || new Date().toISOString();
         if (childMembers.length > 0) {
            const sorted = [...childMembers].sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            if (sorted[0] && sorted[0].createdAt) {
               lastSync = sorted[0].createdAt;
            }
         }
         
         const hoursAgo = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);

         return {
           name: child.branchName || child.fullName,
           lastSync: lastSync,
           pending: 0,
           failed: 0,
           hoursAgo: hoursAgo
         };
       });
       setChildUnits(computedChildren);
    }

    // Filter members base on branch
    let filtered = list;
    if (currentUser.level !== JdnLevel.SYSTEM && currentUser.level !== JdnLevel.JERUSALEM) {
      filtered = list.filter(m => isCodeInScope(m.tabheraCode, currentUser.levelCode, u));
    }
    setMembers(filtered);

    // Read tutorial dismiss setting from localStorage
    const tutorialDismissed = localStorage.getItem(`jdn_dismiss_tutorial_${currentUser.id}`);
    if (tutorialDismissed === 'true') {
      setShowTutorial(false);
    }
    setIsLoading(false);
  };

  const handleDismissTutorial = () => {
    localStorage.setItem(`jdn_dismiss_tutorial_${currentUser.id}`, 'true');
    setShowTutorial(false);
  };

  const totalMembersCount = members.length;
  const activeJorodhaniCount = members.filter(m => m.isJorodhani).length;

  // Group all user profiles as unique branch nodes
  const branchNodesList = React.useMemo(() => {
    const nodesMap = new Map<string, {
      levelCode: string;
      branchName: string;
      level: JdnLevel;
      parentCode: string | null;
      admins: UserProfile[];
      memberCount: number;
      jorodhaniCount: number;
    }>();

    if (allUsers.length === 0) return [];

    allUsers.forEach(u => {
      const code = u.levelCode || 'SYS-GLOBAL';
      if (!nodesMap.has(code)) {
        // Calculate scoped members
        const branchMembers = members.filter(m => isCodeInScope(m.tabheraCode, code, allUsers));
        const branchJorodhany = branchMembers.filter(m => m.isJorodhani);

        nodesMap.set(code, {
          levelCode: code,
          branchName: u.branchName || u.fullName || 'Administrative Unit',
          level: u.level,
          parentCode: u.parentCode || (u.level === JdnLevel.SYSTEM ? null : 'SYS-GLOBAL'),
          admins: [u],
          memberCount: branchMembers.length,
          jorodhaniCount: branchJorodhany.length
        });
      } else {
        nodesMap.get(code)!.admins.push(u);
      }
    });

    // Secure the core system roots
    if (!nodesMap.has('SYS-GLOBAL')) {
      nodesMap.set('SYS-GLOBAL', {
        levelCode: 'SYS-GLOBAL',
        branchName: 'Sovereign Core System',
        level: JdnLevel.SYSTEM,
        parentCode: null,
        admins: allUsers.filter(u => u.level === JdnLevel.SYSTEM),
        memberCount: 0,
        jorodhaniCount: 0
      });
    }

    // Secure the Jerusalem trunk
    if (allUsers.some(u => u.level === JdnLevel.JERUSALEM)) {
      const jerUsers = allUsers.filter(u => u.level === JdnLevel.JERUSALEM);
      const codeValue = jerUsers[0]?.levelCode || 'JERUSA';
      if (!nodesMap.has(codeValue)) {
        nodesMap.set(codeValue, {
          levelCode: codeValue,
          branchName: jerUsers[0]?.branchName || 'Jerusalem Headquarters',
          level: JdnLevel.JERUSALEM,
          parentCode: 'SYS-GLOBAL', // Connect directly to system roots
          admins: jerUsers,
          memberCount: members.length, // Jerusalem has total site scope
          jorodhaniCount: members.filter(m => m.isJorodhani).length
        });
      }
    }

    return Array.from(nodesMap.values());
  }, [allUsers, members]);

  // Find linked node codes for current selection
  const linkedNodeCodes = React.useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const activeSet = new Set<string>();
    
    // Parent components
    const parts = selectedNodeId.split('/');
    let cumulative = '';
    parts.forEach(p => {
      if (cumulative) cumulative += '/' + p;
      else cumulative = p;
      activeSet.add(cumulative);
    });

    // Special global links
    if (selectedNodeId !== 'SYS-GLOBAL') {
      activeSet.add('SYS-GLOBAL');
    }

    // Child descendants
    allUsers.forEach(u => {
      if (u.levelCode && u.levelCode.startsWith(selectedNodeId)) {
        activeSet.add(u.levelCode);
      }
    });

    return activeSet;
  }, [selectedNodeId, allUsers]);
  
  // Set default selected unit
  useEffect(() => {
    if (currentUser && !selectedNodeId) {
      setSelectedNodeId(currentUser.levelCode || 'SYS-GLOBAL');
    }
  }, [currentUser, selectedNodeId]);

  const branchesByLevel = React.useMemo(() => {
    const levelsOrder = [
      { id: JdnLevel.WELLNESS_CENTER, label: 'Therapeutic Blossoms', sub: 'Wellness & healing centers', colorClass: 'text-[#9F1239] bg-rose-50 border-rose-200 ring-rose-100', iconColor: 'text-[#E11D48] font-bold', icon: Flower2 },
      { id: JdnLevel.TABHERA, label: 'Canopy Leaves', sub: 'Local tabhera worshipping assemblies', colorClass: 'text-[#166534] bg-emerald-50 border-emerald-200 ring-emerald-150', iconColor: 'text-[#22C55E] font-bold', icon: Leaf },
      { id: JdnLevel.NYIKA, label: 'Sovereign Twigs', sub: 'Nyika sector units', colorClass: 'text-emerald-800 bg-emerald-50/50 border-emerald-100 ring-emerald-50', iconColor: 'text-emerald-500 font-bold', icon: Sprout },
      { id: JdnLevel.DISTRICT, label: 'Secondary Limbs', sub: 'District administrative structures', colorClass: 'text-indigo-800 bg-indigo-50 border-indigo-200 ring-indigo-100', iconColor: 'text-indigo-500 font-bold', icon: GitFork },
      { id: JdnLevel.PROVINCIAL, label: 'Primary Limbs', sub: 'Provincial administration offices', colorClass: 'text-purple-800 bg-purple-50 border-purple-200 ring-purple-100', iconColor: 'text-purple-500 font-bold', icon: GitFork },
      { id: JdnLevel.NATIONAL, label: 'Major Branches', sub: 'National command councils', colorClass: 'text-teal-950 bg-teal-50 border-teal-200 ring-teal-100', iconColor: 'text-teal-500 font-bold', icon: GitFork },
      { id: JdnLevel.JERUSALEM, label: 'The Central Trunk', sub: 'Sacred Headquarters of the church', colorClass: 'text-amber-950 bg-amber-100 border-amber-300 ring-amber-100 font-bold', iconColor: 'text-amber-600 font-bold', icon: TreePine },
      { id: JdnLevel.SYSTEM, label: 'Foundational Soil & Roots', sub: 'Global control core and offline database server configuration keys', colorClass: 'text-stone-300 bg-stone-900 border-stone-800 ring-stone-950 font-mono', iconColor: 'text-stone-500 font-bold', icon: Database }
    ];

    return levelsOrder.map(lvl => {
      const nodes = branchNodesList.filter(n => n.level === lvl.id);
      return {
        ...lvl,
        nodes: nodes
      };
    });
  }, [branchNodesList]);

  const selectedNodeDetails = React.useMemo(() => {
    if (!selectedNodeId) return null;
    return branchNodesList.find(n => n.levelCode === selectedNodeId);
  }, [selectedNodeId, branchNodesList]);

  const resolvedPathBreadcrumbs = React.useMemo(() => {
    if (!selectedNodeId) return [];
    if (selectedNodeId === 'SYS-GLOBAL') {
      return [{ name: 'Sovereign Core System', level: JdnLevel.SYSTEM, code: 'SYS-GLOBAL' }];
    }
    const parts = selectedNodeId.split('/');
    let cumulative = '';
    const crumbs: { name: string; level: JdnLevel; code: string }[] = [];
    parts.forEach(p => {
      if (cumulative) cumulative += '/' + p;
      else cumulative = p;

      const match = branchNodesList.find(b => b.levelCode === cumulative);
      if (match) {
        crumbs.push({
          name: match.branchName,
          level: match.level,
          code: match.levelCode
        });
      } else {
        crumbs.push({
          name: p,
          level: JdnLevel.SYSTEM,
          code: cumulative
        });
      }
    });
    return crumbs;
  }, [selectedNodeId, branchNodesList]);

  const isBranchInScope = (branchCode: string) => {
    if (currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM || currentUser.level === JdnLevel.WELLNESS_CENTER) {
      return true;
    }
    return branchCode.startsWith(currentUser.levelCode) || currentUser.levelCode.startsWith(branchCode);
  };

  const getUniqueCountByLevel = (level: JdnLevel) => {
    const list = allUsers.filter(u => u.level === level && isBranchInScope(u.levelCode));
    const uniqueCodes = new Set(list.filter(u => !!u.levelCode).map(u => u.levelCode));
    return uniqueCodes.size;
  };

  const totalNationals = getUniqueCountByLevel(JdnLevel.NATIONAL);
  const totalProvinces = getUniqueCountByLevel(JdnLevel.PROVINCIAL);
  const totalDistricts = getUniqueCountByLevel(JdnLevel.DISTRICT);
  const totalNyikas = getUniqueCountByLevel(JdnLevel.NYIKA);
  const totalTabheras = getUniqueCountByLevel(JdnLevel.TABHERA);
  const totalWellnessCenters = getUniqueCountByLevel(JdnLevel.WELLNESS_CENTER);

  const handleToggleMaintenance = async () => {
    const nextVal = !isMaintActive;
    await saveGlobalMaintenanceMode(nextVal);
    setIsMaintActive(nextVal);
    window.dispatchEvent(new Event('jdn_maintenance_changed'));
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 animate-fade-in h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading dashboard data...</p>
      </div>
    );
  }

  const renderLinkageTree = () => {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 animate-fade-in" id="dashboard-organic-linkage-tree">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-gray-900 tracking-wider">
              <Sprout className="h-4.5 w-4.5 text-[#166534]" /> Church Linkage & Growth Tree
            </div>
            <p className="text-[10px] text-gray-500 mt-1 leading-normal max-w-xl">
              Unified church hierarchy modeled organically. The <strong>System Foundations</strong> anchor the roots, converging upward into the stalwart <strong>Jerusalem HQ Trunk</strong>, which branches into your <strong>National, Provincial, District, Nyika</strong> units, crowned with local assembly <strong>Tabheras & healing blossoms</strong>.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 w-full md:w-auto shrink-0">
            {/* Search filter input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search branches or level codes..."
                value={treeSearch}
                onChange={e => setTreeSearch(e.target.value)}
                className="w-full sm:w-60 text-xs px-3 py-2 border border-[#166534]/30 rounded-lg focus:outline-[#166534] bg-gray-50/50"
              />
              {treeSearch && (
                <button
                  onClick={() => setTreeSearch('')}
                  className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Fields list indicator */}
            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-sans mt-0.5 flex-wrap">
              <span className="font-bold uppercase tracking-wider text-gray-400">Searching:</span>
              <span className={`px-1.5 py-0.2 rounded font-semibold transition-all ${treeSearch && allUsers.some(u => u.branchName?.toLowerCase().includes(treeSearch.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-bold' : 'bg-gray-100'}`}>Branch / Account Name</span>
              <span className={`px-1.5 py-0.2 rounded font-semibold transition-all ${treeSearch && allUsers.some(u => u.levelCode?.toLowerCase().includes(treeSearch.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-bold' : 'bg-gray-100'}`}>Level / Tier Code Path</span>
            </div>
          </div>
        </div>

        {/* Tree and Details grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Visual Organic Tree Display Column */}
          <div className="lg:col-span-8 bg-gray-50/40 p-4 rounded-2xl border border-gray-100 relative overflow-hidden flex flex-col gap-1 select-none">
            
            {/* Central Vertical Wooden Trunk backdrop line */}
            <div className="absolute top-10 bottom-24 left-1/2 -ml-1 w-2 bg-gradient-to-r from-amber-800 to-amber-700/65 opacity-25 rounded-full z-0 hidden sm:block"></div>

            <div className="relative z-10 flex flex-col divide-y divide-gray-100/50">
              {branchesByLevel.map((level) => {
                const isTrunk = level.id === JdnLevel.JERUSALEM;
                const isRoots = level.id === JdnLevel.SYSTEM;
                const Icon = level.icon;

                return (
                  <div key={level.id} className={`py-4 ${isRoots ? 'bg-[#27251F]/5 p-4 rounded-xl shadow-inner border border-stone-200/50 mt-4' : ''}`}>
                    <div className="flex items-center gap-1.5 mb-2.5 justify-center">
                      <Icon className={`h-4 w-4 ${level.iconColor}`} />
                      <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">{level.label}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold font-mono">
                        {level.nodes.length}
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
                      {level.nodes.length === 0 ? (
                        <div className="text-[10px] text-gray-400 font-medium font-sans">
                          No active {level.id} registered branches in database
                        </div>
                      ) : (
                        level.nodes.map(node => {
                          const isSelected = selectedNodeId === node.levelCode;
                          const isLinked = linkedNodeCodes.has(node.levelCode);
                          const isSearchMatch = treeSearch && (
                            node.branchName.toLowerCase().includes(treeSearch.toLowerCase()) ||
                            node.levelCode.toLowerCase().includes(treeSearch.toLowerCase())
                          );

                          // Style dynamically based on states
                          let activeStyle = "border-gray-200 bg-white text-gray-800 hover:border-gray-400";
                          if (isSelected) {
                            activeStyle = "ring-4 ring-emerald-600 border-emerald-600 bg-[#E8F5E9] text-emerald-950 font-bold scale-[1.03] shadow-md z-30";
                          } else if (isSearchMatch) {
                            activeStyle = "ring-4 ring-amber-600 border-amber-600 bg-amber-50 animate-pulse text-amber-950 font-bold";
                          } else if (isLinked) {
                            activeStyle = "border-emerald-500 bg-[#F0FDF4] text-emerald-900 ring-2 ring-emerald-100 z-20";
                          } else if (selectedNodeId) {
                            activeStyle = "border-gray-100 bg-white/70 text-gray-400 opacity-55 scale-[0.98]";
                          }

                          return (
                            <button
                              key={node.levelCode}
                              onClick={() => setSelectedNodeId(node.levelCode)}
                              className={`transition-all duration-300 px-3.5 py-1.5 rounded-xl border text-xs text-left cursor-pointer flex items-center gap-2 max-w-xs shadow-xs min-w-[124px] ${activeStyle}`}
                            >
                              <div className={`p-1.5 rounded-lg ${isRoots ? 'bg-stone-800' : isTrunk ? 'bg-amber-100' : 'bg-gray-100'} shrink-0`}>
                                <Icon className={`h-3 w-3 ${level.iconColor}`} />
                              </div>
                              <div className="truncate flex-1">
                                <span className="font-extrabold block truncate text-[10px] leading-tight">
                                  <HighlightText text={node.branchName} search={treeSearch} />
                                </span>
                                <span className="text-[9px] opacity-75 font-mono block tracking-wider truncate">
                                  <HighlightText text={node.levelCode.split('/').pop() || ''} search={treeSearch} />
                                </span>
                                <span className="text-[8px] opacity-70 font-semibold block tracking-wider text-gray-500">
                                  {node.memberCount} MBRS
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Roots Soil Bottom Visual Base */}
            <div className="w-full flex justify-center items-center py-2.5 border-t border-[#27251F]/10 mt-1">
              <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1 select-none">
                🌱 Unified System Roots Soil Line • Jerusalem Digital Network
              </span>
            </div>
          </div>

          {/* Selective Details and Breadcrumb Navigation Column */}
          <div className="lg:col-span-4 space-y-4">
            {selectedNodeDetails ? (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col transition-all">
                {/* Dynamically styled header bar */}
                <div className={`p-4 ${
                  selectedNodeDetails.level === JdnLevel.SYSTEM 
                    ? 'bg-stone-905 text-stone-200 bg-stone-900 border-stone-850' 
                    : selectedNodeDetails.level === JdnLevel.JERUSALEM
                      ? 'bg-[#FEF3C7] border-[#F59E0B] text-amber-950'
                      : 'bg-gradient-to-r from-[#166534] to-emerald-700 text-white'
                } flex items-center gap-2.5`}>
                  <div className="p-2 bg-white/10 rounded-xl">
                    {(() => {
                      const foundLvl = branchesByLevel.find(b => b.id === selectedNodeDetails.level);
                      const Icon = foundLvl?.icon || Sprout;
                      return <Icon className="h-4.5 w-4.5" />;
                    })()}
                  </div>
                  <div className="truncate">
                    <span className="text-[8px] uppercase tracking-widest font-black block leading-none opacity-85">
                      {selectedNodeDetails.level} Level
                    </span>
                    <h4 className="text-xs font-black truncate mt-1 leading-normal">
                      {selectedNodeDetails.branchName}
                    </h4>
                  </div>
                </div>

                <div className="p-4 space-y-4 text-xs font-sans">
                  {/* Unit Path Breadcrumbs */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">
                      Hierarchical Integration Trail
                    </span>
                    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50/70 border border-gray-100 rounded-lg">
                      {resolvedPathBreadcrumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.code}>
                          {index > 0 && <span className="text-gray-300 text-[10px]">/</span>}
                          <span 
                            onClick={() => setSelectedNodeId(crumb.code)}
                            className="text-[9px] font-bold text-emerald-805 hover:text-emerald-700 cursor-pointer hover:underline truncate max-w-[100px] block"
                            title={`${crumb.name} (${crumb.level})`}
                          >
                            {crumb.name}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Branch Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-emerald-50/50 p-2.5 border border-emerald-100/50 rounded-xl text-center">
                      <span className="text-[8px] uppercase font-bold text-emerald-800 tracking-wider block">
                        Total Congregation
                      </span>
                      <span className="text-sm font-mono font-extrabold text-neutral-800 mt-0.5 block">
                        {selectedNodeDetails.memberCount} Souls
                      </span>
                    </div>

                    <div className="bg-rose-50/40 p-2.5 border border-rose-100/50 rounded-xl text-center">
                      <span className="text-[8px] uppercase font-bold text-rose-800 tracking-wider block">
                        Jorodhani ratio
                      </span>
                      <span className="text-sm font-mono font-extrabold text-[#9F1239] mt-0.5 block">
                        {selectedNodeDetails.jorodhaniCount} New Converts
                      </span>
                    </div>
                  </div>

                  {/* Staff registry */}
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">
                      Assigned Administration Staff
                    </span>
                    {selectedNodeDetails.admins.length === 0 ? (
                      <div className="p-3 text-center text-[10px] text-gray-400 italic bg-gray-50 border border-gray-100 rounded-xl">
                        No active administrative profile registered here
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {selectedNodeDetails.admins.map(adm => (
                          <div key={adm.id} className="p-2 border border-gray-100 rounded-xl bg-gray-50/60 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2">
                            <div className="truncate">
                              <span className="font-extrabold text-[10px] block text-gray-800 leading-tight">
                                {adm.fullName}
                              </span>
                              <span className="text-[9px] text-[#166534] font-medium block">
                                {adm.role}
                              </span>
                              <span className="text-[8px] text-gray-400 font-mono block">
                                {adm.email}
                              </span>
                            </div>
                            {adm.isActive ? (
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 font-extrabold shrink-0">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold shrink-0">
                                OFFLINE
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Operational Level Code details */}
                  <div className="pt-2 border-t border-gray-100 flex flex-col gap-1 text-[9px] text-gray-500 leading-normal">
                    <div>
                      <span className="font-bold text-gray-700">Level Code scope:</span> <span className="font-mono text-emerald-850 bg-emerald-50 px-1 py-0.2 ml-0.5 rounded font-bold">{selectedNodeDetails.levelCode}</span>
                    </div>
                    {selectedNodeDetails.parentCode && (
                      <div>
                        <span className="font-bold text-gray-700 font-sans">Immediate parent:</span> <span className="font-mono text-zinc-650 bg-zinc-50 px-1 py-0.2 ml-0.5 rounded">{selectedNodeDetails.parentCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 p-8 rounded-2xl text-center text-xs text-gray-400 italic">
                Select any branch in the universal church tree to view live administration details and highlight its connections.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (currentUser.level === JdnLevel.SYSTEM) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] tracking-tight">System Control & Operations Center</h1>
            <p className="text-sm text-[#6B7280]">
              Global Super Administrator Live Console • Active Session: <span className="font-semibold text-[#166534]">{currentUser.fullName}</span>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleToggleMaintenance}
              className={`font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all border cursor-pointer ${
                isMaintActive 
                  ? 'bg-red-600 text-white hover:bg-red-700 border-red-700' 
                  : 'bg-[#166534] text-white hover:bg-[#166534]/90 border-[#166534]'
              }`}
            >
              <Wrench className="h-4 w-4" />
              {isMaintActive ? 'Maintenance Status: Active Lock (Click to Disable)' : 'Activate App Maintenance Mode'}
            </button>
          </div>
        </div>

        {/* Global Maintenance Alert */}
        {isMaintActive && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-pulse">
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs text-red-800 uppercase tracking-wider">SYSTEM UNDER MAINTENANCE ACTIVE</h4>
              <p className="text-[11px] text-red-700 mt-1 leading-normal font-sans">
                The global application lock is currently engaged. Non-super-administrative accounts (everyone whose level is not Super Admin) will be blocked from accessing the JDN applet upon loading or attempting login.
              </p>
            </div>
          </div>
        )}

        {/* Real Development-Grade Super Admin Features Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Column 1: Context & Node Impersonator */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Crown className="h-4.5 w-4.5 text-[#166534]" /> Context & Node Impersonator
              </h3>
              <p className="text-xs text-gray-500 leading-normal">
                Impersonate administrative roles of downstream nodes to preview distinct tab overlays, features, and permissions.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Target Account</label>
                  <select
                    value={impersonationTarget}
                    onChange={(e) => handleImpersonate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-250 rounded-lg p-2.5 text-xs font-semibold text-gray-800 focus:outline-[#166534] cursor-pointer"
                  >
                    <option value="">-- No Active Impersonation --</option>
                    {allUsers.filter(u => u.id !== currentUser.id).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.level} - {u.branchName || 'No Branch'})
                      </option>
                    ))}
                  </select>
                </div>

                {impersonatedUser ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Active Impersonation</span>
                      <button
                        onClick={() => handleImpersonate('')}
                        className="text-[10px] text-amber-900 font-extrabold hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="text-xs text-left">
                      <p className="font-extrabold text-gray-900">{impersonatedUser.fullName}</p>
                      <p className="text-gray-500 text-[10px] font-mono leading-tight mt-0.5">
                        Tier Path: {impersonatedUser.levelCode}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl text-center text-[10px] text-gray-500 font-medium">
                    Operating under Root credentials. You have full system operations access.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 text-[10.5px] text-gray-400 font-sans leading-relaxed">
              Session impersonations write backup variables. Exit instantly inside the top orange notification banner.
            </div>
          </div>

          {/* Column 2: Live System Operations & Diagnostics */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Terminal className="h-4.5 w-4.5 text-[#166534]" /> Live System Operations & Diagnostics
              </h3>
              <p className="text-xs text-gray-500 leading-normal">
                Manage active systems, trigger manual records synchronization, and access the application audit trails.
              </p>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-150">
                  <span className="font-bold text-gray-700">Simulated PWA Offline Sync Queue</span>
                  <span className="font-mono bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded text-[10px]">
                    {queueSize} Operations Pending
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-150">
                  <span className="font-bold text-gray-700">Audit Log Buffer Capacity</span>
                  <span className="font-mono text-gray-600 font-semibold">Ready / Continuous Logs</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-150">
                  <span className="font-bold text-gray-700">Super Admin Active Credentials</span>
                  <span className="font-mono text-indigo-700 font-bold block truncate max-w-[150px]" title={currentUser.email}>
                    {currentUser.email}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              <button
                onClick={handleForceSyncAll}
                className="w-full bg-[#166534] hover:bg-[#155e2f] text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 shrink-0" /> Manual Sync & Flush Record Queue ({queueSize})
              </button>
              <button
                onClick={() => onChangeTab('Audit Logs')}
                className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-700 font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Terminal className="h-4 w-4 text-gray-500 shrink-0" /> View Application Audit Center
              </button>
            </div>
          </div>

        </div>

        {/* Database Collection Sandbox Explorer Section */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-150 pb-3">
            <div>
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <FolderSearch className="h-4.5 w-4.5 text-[#166534]" /> Interactive Database Collection Explorer
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Inspect local persistent Forage databases, read active counts, and browse document schemas live.
              </p>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="bg-gray-50 border border-gray-250 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 cursor-pointer"
              >
                <option value="jdn_members">Members (jdn_members)</option>
                <option value="jdn_user_profiles">Users (jdn_user_profiles)</option>
                <option value="jdn_contributions">Contributions (jdn_contributions)</option>
                <option value="jdn_updates">Board Posts (jdn_updates)</option>
                <option value="jdn_platform_logs">Platform Audit Logs (jdn_platform_logs)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Active Document Count</span>
                <span className="text-3xl font-mono font-black text-gray-950 mt-1 block">{collectionCount}</span>
                <span className="text-[10px] text-gray-500 block mt-2 leading-snug">
                  Key path: <code className="bg-gray-200 px-1 py-0.5 rounded font-mono font-bold text-[#166534]">{selectedCollection}</code>
                </span>
              </div>
              <button
                onClick={() => loadCollectionInfo(selectedCollection)}
                className="mt-4 w-full bg-white hover:bg-gray-150 border border-gray-200 text-gray-700 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Refresh Count
              </button>
            </div>

            <div className="lg:col-span-3 space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Document Schema Inspection (First 5 records)</span>
              {collectionSample.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-xs text-gray-550 italic">
                  No records exist in the <code className="bg-gray-200 px-1 rounded">{selectedCollection}</code> database entity.
                </div>
              ) : (
                <div className="bg-[#1e1e1e] rounded-xl p-4 overflow-x-auto border border-gray-805 text-left">
                  <pre className="text-[10px] text-emerald-400 font-mono leading-normal whitespace-pre">
                    {JSON.stringify(collectionSample, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global organic church hierarchy linkage tree */}
        {renderLinkageTree()}
      </div>
    );
  }

  // Removed empty state per user request
  // STANDARD DASHBOARD VIEW (when data is populated)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Rugare, {currentUser.fullName} ({currentUser.branchName || currentUser.level})</h1>
        <p className="text-sm text-[#6B7280]">
          Active Session Role: <span className="font-semibold text-gray-900">{currentUser.role}</span> • Scope: <span className="font-semibold text-gray-900">{currentUser.branchName}</span>
        </p>
      </div>

      {/* Scoped Statistics Grid Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Total Members */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] font-extrabold uppercase text-emerald-800 tracking-wider">Total Members</span>
          <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{totalMembersCount}</span>
          <span className="text-[8px] text-gray-400 block mt-0.5">In scope</span>
        </div>
        {/* Nationals */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] font-extrabold uppercase text-blue-800 tracking-wider">Nationals</span>
          <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{totalNationals}</span>
          <span className="text-[8px] text-gray-400 block mt-0.5">National units</span>
        </div>
        {/* Provinces */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] font-extrabold uppercase text-purple-800 tracking-wider">Provinces</span>
          <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{totalProvinces}</span>
          <span className="text-[8px] text-gray-400 block mt-0.5">Provinces units</span>
        </div>
        {/* Districts */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] font-extrabold uppercase text-indigo-850 tracking-wider">Districts</span>
          <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{totalDistricts}</span>
          <span className="text-[8px] text-gray-400 block mt-0.5">Districts active</span>
        </div>
        {/* Nyikas */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] font-extrabold uppercase text-amber-800 tracking-wider">Nyikas</span>
          <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{totalNyikas}</span>
          <span className="text-[8px] text-gray-400 block mt-0.5">Sectors tracked</span>
        </div>
        {/* Tabheras */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] font-extrabold uppercase text-pink-850 tracking-wider">Tabheras</span>
          <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{totalTabheras}</span>
          <span className="text-[8px] text-gray-400 block mt-0.5">Local tabheras</span>
        </div>
        {/* Wellness Centers */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] font-extrabold uppercase text-teal-800 tracking-wider">Wellness Centers</span>
          <span className="text-xl font-mono font-bold text-gray-900 mt-1 block">{totalWellnessCenters}</span>
          <span className="text-[8px] text-gray-400 block mt-0.5">Health care centers</span>
        </div>
      </div>

      {/* Dynamic Visual Organic Church Linkage Tree (Jerusalem Trunk, System Roots) */}
      {renderLinkageTree()}
    </div>
  );
}
