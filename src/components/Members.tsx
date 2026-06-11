import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Member, MemberGroup, UserProfile, JdnLevel, Gender } from '../types';
import { getMembers, saveMembers, addToSyncQueue, getUserProfiles, resolveBranchName, resolveLevelNameForCode, getAttendanceRecords } from '../lib/storage';
import { UserPlus, Search, Filter, History, Calendar, Award, UserCheck, ShieldAlert, Sparkles, Download, FileSpreadsheet, FileText, Home, Users, MoreVertical } from 'lucide-react';
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

interface MembersProps {
  currentUser: UserProfile;
}

export function Members({ currentUser }: MembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Create Member Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('Female');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [groupId, setGroupId] = useState<MemberGroup>(MemberGroup.SUNDAY_SCHOOL);
  const [isJorodhani, setIsJorodhani] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);
  const [basa, setBasa] = useState('');
  const [family, setFamily] = useState('');
  const [pictureUrl, setPictureUrl] = useState('');
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyLinkMode, setNewFamilyLinkMode] = useState<'placeholder' | 'existing' | 'new'>('placeholder');
  const [selectedMemberIdToLink, setSelectedMemberIdToLink] = useState('');
  const [newFamilyMemName, setNewFamilyMemName] = useState('');
  const [newFamilyMemGender, setNewFamilyMemGender] = useState<Gender>('Male');
  const [newFamilyMemDOB, setNewFamilyMemDOB] = useState('2000-01-01');
  const [newFamilyMemMarital, setNewFamilyMemMarital] = useState('Married');
  const [newFamilyMemGroup, setNewFamilyMemGroup] = useState<MemberGroup>(MemberGroup.SUNGANO);
  const [subTab, setSubTab] = useState<'members' | 'families'>('members');
  const [targetTabheraCode, setTargetTabheraCode] = useState('');
  const [showFullHierarchyPath, setShowFullHierarchyPath] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Promotion / Transfer state
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [targetGroup, setTargetGroup] = useState<MemberGroup>(MemberGroup.MASOWANI);
  const [isLoading, setIsLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleEditClick = (member: Member) => {
    setEditingMemberId(member.memberId);
    setFullName(member.fullName);
    setDob(member.dateOfBirth);
    setGender(member.gender);
    setMaritalStatus(member.maritalStatus);
    setGroupId(member.groupId);
    setIsJorodhani(member.isJorodhani);
    setIsLeadership(!!member.isLeadership);
    setBasa(member.basa || '');
    setFamily(member.family || '');
    setPictureUrl(member.pictureUrl || '');
    setTargetTabheraCode(member.tabheraCode || '');
    setIsEditMode(true);
    setIsOpen(true);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (window.confirm("Are you sure you want to delete this member?")) {
      try {
        const list = await getMembers();
        const updatedList = list.filter(m => m.memberId !== memberId);
        await saveMembers(updatedList);
        await addToSyncQueue('member', memberId, 'delete', { memberId });
        setMembers(updatedList);
        window.dispatchEvent(new Event('jdn_db_updated'));
      } catch (err) {
        console.error("Failed to delete member", err);
      }
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, groupFilter]);

  useEffect(() => {
    loadMembersData();
  }, [currentUser]);

  const loadMembersData = async () => {
    setIsLoading(true);
    const list = await getMembers();
    const pList = await getUserProfiles();
    const records = await getAttendanceRecords();
    
    // Calculate attendance counts per member
    const counts: Record<string, number> = {};
    records.forEach(r => {
      if (r.status === 'Present') {
        counts[r.memberId] = (counts[r.memberId] || 0) + 1;
      }
    });

    const cleanPList = currentUser.level === JdnLevel.SYSTEM ? pList : pList.filter(p => p.level !== JdnLevel.SYSTEM);
    setProfiles(cleanPList);

    // Filter down based on hierarchy RLS simulation
    // A user at level N can only see/manage data within their own branch (their code and all child codes beneath it)
    let filtered = list;
    if (currentUser.level !== JdnLevel.SYSTEM && currentUser.level !== JdnLevel.JERUSALEM && currentUser.level !== JdnLevel.WELLNESS_CENTER) {
      filtered = list.filter(m => m.tabheraCode.startsWith(currentUser.levelCode) || currentUser.levelCode.startsWith(m.tabheraCode));
    }
    
    // Auto-confirm members with >= 3 attendances
    const finalizedMembers = filtered.map(m => {
      if (m.isJorodhani && counts[m.memberId] >= 3) {
        return { ...m, isJorodhani: false };
      }
      return m;
    });

    setMembers(finalizedMembers);
    setIsLoading(false);
  };

  // Check gender validation matching group requirements
  const checkGroupGenderSuitability = (group: MemberGroup, memberGender: Gender): boolean => {
    if (group === MemberGroup.RUWADZANO && memberGender !== 'Female') return false;
    if (group === MemberGroup.SUNGANO && memberGender !== 'Male') return false;
    return true;
  };

  const [isSaving, setIsSaving] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Rate Limit: Prevent double fire within 1500ms or if already isSaving
    const now = Date.now();
    if (now - lastSubmitTime < 1500 || isSaving) {
      toast.error('Submission in progress, please wait...', { id: 'rate-limit-save' });
      return;
    }
    setLastSubmitTime(now);
    setIsSaving(true);

    const today = new Date('2026-05-27');

    const runValidation = () => {
      // Form Validation rules
      if (fullName.trim().length < 3) {
        return 'Member name must be at least 3 characters long.';
      }

      if (!dob) {
        return 'Date of birth is required.';
      }

      // Gender vs Group Integrity Check
      if (!checkGroupGenderSuitability(groupId, gender)) {
        const targetSex = groupId === MemberGroup.RUWADZANO ? 'Female' : 'Male';
        return `Demographic limit check: ${groupId} is restricted to ${targetSex} members only.`;
      }

      // Sunday School Age limit check (< 14 years old)
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (groupId === MemberGroup.SUNDAY_SCHOOL && age >= 14) {
        return 'Members aged 14 and above cannot register under Sunday School. Please select Masowani, Ruwadzano or Sungano.';
      }

      if (groupId !== MemberGroup.SUNDAY_SCHOOL && age < 14) {
        return 'Children under 14 years old must be registered in Sunday School first.';
      }
      
      // Additional rules
      if (age < 18 && maritalStatus === 'Married') {
        return 'A member cannot be under 18 and Married.';
      }
      
      if (groupId === MemberGroup.MASOWANI && maritalStatus === 'Married') {
        return 'Masowani members cannot be Married.';
      }

      if (groupId === MemberGroup.RUWADZANO && maritalStatus !== 'Married') {
        return 'Ruwadzano members must be Married.';
      }

      if (groupId === MemberGroup.SUNGANO && maritalStatus !== 'Married') {
        return 'Sungano members must be Married.';
      }
      return null;
    };

    const validationError = runValidation();
    if (validationError) {
      setError(validationError);
      setIsSaving(false);
      return;
    }

    // Save or Update
    try {
      const list = await getMembers();

      if (isEditMode && editingMemberId) {
        const existingIndex = list.findIndex(m => m.memberId === editingMemberId);
        if (existingIndex > -1) {
          const updatedMember = {
            ...list[existingIndex],
            fullName: fullName.trim(),
            dateOfBirth: dob,
            gender,
            maritalStatus,
            groupId,
            isJorodhani: currentUser.level === JdnLevel.WELLNESS_CENTER ? true : isJorodhani,
            isLeadership,
            basa: isLeadership ? basa.trim() : '',
            family: family.trim(),
            pictureUrl: isLeadership ? pictureUrl : '',
            tabheraCode: currentUser.level === JdnLevel.WELLNESS_CENTER ? targetTabheraCode : list[existingIndex].tabheraCode,
            // updated sync status
            syncStatus: 'pending' as const
          };

          const changedList = [...list];
          changedList[existingIndex] = updatedMember;
          await saveMembers(changedList);
          await addToSyncQueue('member', updatedMember.memberId, 'update', updatedMember);
        }
      } else {
        const todayStr = today.toISOString().split('T')[0];
        const assignedTabCode = currentUser.level === JdnLevel.WELLNESS_CENTER 
          ? targetTabheraCode 
          : (currentUser.level === JdnLevel.TABHERA ? currentUser.levelCode : 'TAB-HRE-S-1A-1');

        const finalIsJorodhani = currentUser.level === JdnLevel.WELLNESS_CENTER ? true : isJorodhani;

        const newMemberNumber = `JDN-${String(list.length + 1).padStart(2, '0')}`;
        const newMember: Member = {
          memberId: `mem-${Date.now()}`,
          memberNumber: newMemberNumber,
          fullName: fullName.trim(),
          dateOfBirth: dob,
          gender,
          maritalStatus,
          groupId,
          joinDate: todayStr,
          tabheraCode: assignedTabCode,
          isJorodhani: finalIsJorodhani,
          isLeadership,
          basa: isLeadership ? basa.trim() : '',
          family: family.trim(),
          pictureUrl: isLeadership ? pictureUrl : '',
          jorodhaniDate: finalIsJorodhani ? todayStr : null,
          promotionHistory: [],
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          syncStatus: 'pending' // saved locally, queued for upload
        };

        await saveMembers([...list, newMember]);
        await addToSyncQueue('member', newMember.memberId, 'create', newMember);
      }
      
      // Reset & Reload
      setFullName('');
      setDob('');
      setFamily('');
      setBasa('');
      setPictureUrl('');
      setTargetTabheraCode('');
      setIsOpen(false);
      setIsEditMode(false);
      setEditingMemberId(null);
      await loadMembersData();
      
      // Dispatch refresh events
      window.dispatchEvent(new Event('jdn_db_updated'));
      toast.success(isEditMode ? 'Member updated successfully' : 'Member created successfully');
      setIsSaving(false);
    } catch (err: any) {
      setError('Error saving member: ' + err.message);
      setIsSaving(false);
    }
  };

  const promoteMemberManually = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    if (!checkGroupGenderSuitability(targetGroup, selectedMember.gender)) {
      toast.error(`Cannot promote: Selected group "${targetGroup}" restricts members to "${selectedMember.gender === 'Male' ? 'Female' : 'Male'}".`);
      return;
    }

    const todayStr = new Date('2026-05-27').toISOString().split('T')[0];
    const updatedHistory = [
      ...selectedMember.promotionHistory,
      {
        fromGroup: selectedMember.groupId,
        toGroup: targetGroup,
        date: todayStr,
        promotedBy: currentUser.id
      }
    ];

    const updated: Member = {
      ...selectedMember,
      groupId: targetGroup,
      promotionHistory: updatedHistory,
      syncStatus: 'pending'
    };

    const list = await getMembers();
    const refreshed = list.map(m => m.memberId === selectedMember.memberId ? updated : m);
    await saveMembers(refreshed);

    await addToSyncQueue('member', updated.memberId, 'update', updated);
    setIsPromoOpen(false);
    setSelectedMember(null);
    await loadMembersData();
    window.dispatchEvent(new Event('jdn_db_updated'));
  };

  const resolveSegmentBranchName = (tabheraCode: string, level: JdnLevel, branchProfiles: any[]) => {
    return resolveLevelNameForCode(tabheraCode, level, branchProfiles);
  };

  const getMembershipDisplayText = (member: Member, userLevel: JdnLevel, branchProfiles: any[]) => {
    if (userLevel === JdnLevel.TABHERA && !showFullHierarchyPath) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
          Family: {member.family || 'None'}
        </span>
      );
    }

    const nationName = resolveLevelNameForCode(member.tabheraCode, JdnLevel.NATIONAL, branchProfiles);
    const provinceName = resolveLevelNameForCode(member.tabheraCode, JdnLevel.PROVINCIAL, branchProfiles);
    const districtName = resolveLevelNameForCode(member.tabheraCode, JdnLevel.DISTRICT, branchProfiles);
    const nyikaName = resolveLevelNameForCode(member.tabheraCode, JdnLevel.NYIKA, branchProfiles);
    const tabheraName = resolveLevelNameForCode(member.tabheraCode, JdnLevel.TABHERA, branchProfiles);

    if (showFullHierarchyPath) {
      return (
        <div className="flex flex-col gap-1 py-1">
          <div className="flex flex-wrap gap-1 max-w-[320px]">
            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-750 font-bold rounded text-[9px] uppercase tracking-wider border border-rose-100" title="Nation">Nat: {nationName}</span>
            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-750 font-bold rounded text-[9px] uppercase tracking-wider border border-orange-100" title="Province">Prov: {provinceName}</span>
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-755 font-bold rounded text-[9px] uppercase tracking-wider border border-amber-100" title="District">Dist: {districtName}</span>
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-755 font-bold rounded text-[9px] uppercase tracking-wider border border-blue-100" title="Nyika">Nyika: {nyikaName}</span>
            <span className="px-1.5 py-0.5 bg-emerald-50 text-[#15803D] font-bold rounded text-[9px] uppercase tracking-wider border border-green-200" title="Tabhera">Tabhera: {tabheraName}</span>
          </div>
        </div>
      );
    }

    let label = 'Tabhera';
    let name = tabheraName;
    let colorClass = 'bg-emerald-50 text-[#15803D] border-green-200';

    if (userLevel === JdnLevel.SYSTEM || userLevel === JdnLevel.JERUSALEM || userLevel === JdnLevel.WELLNESS_CENTER) {
      label = 'Nat';
      name = nationName;
      colorClass = 'bg-rose-50 text-rose-750 border-rose-100';
    } else if (userLevel === JdnLevel.NATIONAL) {
      label = 'Prov';
      name = provinceName;
      colorClass = 'bg-orange-50 text-orange-750 border-orange-100';
    } else if (userLevel === JdnLevel.PROVINCIAL) {
      label = 'Dist';
      name = districtName;
      colorClass = 'bg-amber-50 text-amber-755 border-amber-100';
    } else if (userLevel === JdnLevel.DISTRICT) {
      label = 'Nyika';
      name = nyikaName;
      colorClass = 'bg-blue-50 text-blue-755 border-blue-100';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${colorClass} border`}>
        {label}: {name}
      </span>
    );
  };

  // Filter members on screen (starting with the most recent data)
  const searchedMembers = members
    .filter(m => {
      const matchesSearch = m.fullName.toLowerCase().includes(search.toLowerCase()) || 
                            m.tabheraCode.toLowerCase().includes(search.toLowerCase()) ||
                            (m.family && m.family.toLowerCase().includes(search.toLowerCase()));
      const matchesGroup = groupFilter === 'All' || m.groupId === groupFilter;
      return matchesSearch && matchesGroup;
    })
    .sort((a, b) => new Date(b.createdAt || b.joinDate).getTime() - new Date(a.createdAt || a.joinDate).getTime());

  // Get all unique family names
  const allFamilies = Array.from(new Set(members.map(m => m.family).filter(Boolean))) as string[];
  
  const getFamilyLatestDate = (familyName: string) => {
    const familyMembersRemaining = members.filter(m => m.family === familyName);
    if (familyMembersRemaining.length === 0) return 0;
    return Math.max(...familyMembersRemaining.map(m => new Date(m.createdAt || m.joinDate).getTime()));
  };

  const searchedFamilies = allFamilies
    .filter(f => f.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => getFamilyLatestDate(b) - getFamilyLatestDate(a));

  const FAMILIES_ITEMS_PER_PAGE = 7;
  const paginatedFamilies = searchedFamilies.slice((currentPage - 1) * FAMILIES_ITEMS_PER_PAGE, currentPage * FAMILIES_ITEMS_PER_PAGE);
  const totalFamiliesPages = Math.max(1, Math.ceil(searchedFamilies.length / FAMILIES_ITEMS_PER_PAGE));

  const handleExportCSV = () => {
    const headers = ['Full Name', 'Group', 'Gender', 'Marital Status', 'Tabhera Branch'];
    const rows = searchedMembers.map(m => {
      const branchText = showFullHierarchyPath 
        ? `${resolveLevelNameForCode(m.tabheraCode, JdnLevel.NATIONAL, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.PROVINCIAL, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.DISTRICT, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.NYIKA, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.TABHERA, profiles)}`
        : resolveBranchName(m.tabheraCode, profiles);
      return [
        `"${m.fullName.replace(/"/g, '""')}"`,
        `"${m.groupId.replace(/"/g, '""')}"`,
        m.gender || '',
        m.maritalStatus || '',
        `"${branchText.replace(/"/g, '""')}"`
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JDN_Members_${groupFilter !== 'All' ? groupFilter : 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`JDN Members Report - ${groupFilter !== 'All' ? groupFilter : 'All Groups'}`, 14, 15);
    
    const rows = searchedMembers.map(m => {
      const branchText = showFullHierarchyPath 
        ? `${resolveLevelNameForCode(m.tabheraCode, JdnLevel.NATIONAL, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.PROVINCIAL, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.DISTRICT, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.NYIKA, profiles)} -> ${resolveLevelNameForCode(m.tabheraCode, JdnLevel.TABHERA, profiles)}`
        : resolveBranchName(m.tabheraCode, profiles);
      return [m.fullName, m.groupId, m.gender || '', m.maritalStatus || '', branchText];
    });

    autoTable(doc, {
      startY: 20,
      head: [['Full Name', 'Group', 'Gender', 'Marital Status', 'Tabhera Branch']],
      body: rows,
      styles: { fontSize: 8 },
      columnStyles: { 4: { cellWidth: 80 } }
    });
    
    doc.save(`JDN_Members_${groupFilter !== 'All' ? groupFilter : 'All'}.pdf`);
  };

  const MEMBERS_ITEMS_PER_PAGE = 7;
  const paginatedMembers = searchedMembers.slice((currentPage - 1) * MEMBERS_ITEMS_PER_PAGE, currentPage * MEMBERS_ITEMS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(searchedMembers.length / MEMBERS_ITEMS_PER_PAGE));

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 animate-fade-in h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading members registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Congregation Members</h1>
          <p className="text-sm text-[#6B7280]">
            Log, filter, and track church member lifecycle groups, promotions, and Jorodhani statuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
             onClick={handleExportCSV}
             className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          >
             <FileSpreadsheet className="h-4 w-4 text-[#166534]" /> Excel / CSV
          </button>
          
          <button
             onClick={handleExportPDF}
             className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          >
             <FileText className="h-4 w-4 text-red-600" /> Export PDF
          </button>

        {/* Create Member Button (Only Tabhera level user and Wellness Center should write records) */}
          {currentUser.level === JdnLevel.TABHERA || currentUser.level === JdnLevel.WELLNESS_CENTER ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsFamilyModalOpen(true);
                }}
                className="bg-[#166534] hover:bg-[#166534]/90 text-white font-semibold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Home className="h-4 w-4" /> Register New Family
              </button>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setEditingMemberId(null);
                  setFullName('');
                  setDob('');
                  setGender('Female');
                  setMaritalStatus('Single');
                  setGroupId(MemberGroup.SUNDAY_SCHOOL);
                  setIsJorodhani(true);
                  setIsLeadership(false);
                  setBasa('');
                  setFamily('');
                  setPictureUrl('');
                  setTargetTabheraCode(profiles.find(p => p.level === JdnLevel.TABHERA)?.levelCode || '');
                  setIsOpen(true);
                }}
                className="bg-[#166534] hover:bg-[#166534]/90 text-white font-semibold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> Add {currentUser.level === JdnLevel.WELLNESS_CENTER ? 'Jorodhani' : 'Tabhera'} Member
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Sub-tabs switching between Members and Families directory */}
      <div className="flex border-b border-gray-250 bg-white p-1 rounded-xl shadow-xs gap-1">
        <button
          onClick={() => { setSubTab('members'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            subTab === 'members' 
              ? 'bg-[#166534] text-white shadow-xs' 
              : 'text-gray-500 hover:text-gray-850 hover:bg-gray-100'
          }`}
        >
          <Users className="h-4 w-4" /> Members Registry ({searchedMembers.length})
        </button>
        <button
          onClick={() => { setSubTab('families'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            subTab === 'families' 
              ? 'bg-[#166534] text-white shadow-xs' 
              : 'text-gray-500 hover:text-gray-850 hover:bg-gray-100'
          }`}
        >
          <Home className="h-4.5 w-4.5" /> Families Directory ({searchedFamilies.length})
        </button>
      </div>

      {/* Universal Search bar for both views */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#6B7280]">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={subTab === 'members' ? "Search members by name, tabhera, or family surname..." : "Search families directory by surname..."}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-all"
          />
        </div>

        {/* Dynamic Fields List being actively searched */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-700 uppercase tracking-widest text-[9px]">Fields being searched:</span>
            {subTab === 'members' ? (
              <>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${search && searchedMembers.some(m => m.fullName.toLowerCase().includes(search.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-extrabold ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-600'}`}>
                  Full Name
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${search && searchedMembers.some(m => m.tabheraCode.toLowerCase().includes(search.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-extrabold ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-600'}`}>
                  Tabhera Code path
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${search && searchedMembers.some(m => m.family && m.family.toLowerCase().includes(search.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-extrabold ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-600'}`}>
                  Family Surname
                </span>
              </>
            ) : (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${search && searchedFamilies.some(f => f.toLowerCase().includes(search.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-extrabold ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-600'}`}>
                Family Surname
              </span>
            )}
          </div>
          {search && (
            <div className="text-[10px] font-bold text-gray-500 font-mono">
              Displaying {subTab === 'members' ? searchedMembers.length : searchedFamilies.length} active matching results
            </div>
          )}
        </div>
      </div>

      {subTab === 'members' && (
        <>
          {/* Category Filters */}
          <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex flex-col lmd:flex-row lmd:items-center justify-between gap-4 overflow-x-auto">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Filter className="h-3.5 w-3.5" /> Group:
              </span>
              <div className="flex gap-2">
                {['All', MemberGroup.SUNDAY_SCHOOL, MemberGroup.MASOWANI, MemberGroup.RUWADZANO, MemberGroup.SUNGANO].map((group) => (
                  <button
                    key={group}
                    onClick={() => { setGroupFilter(group); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer shrink-0 ${groupFilter === group ? 'bg-[#166534] border-[#166534] text-white' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'}`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* Hierarchy Option Toggle */}
            <div className="flex items-center gap-2 shrink-0 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-250 self-start lmd:self-center">
              <input
                type="checkbox"
                id="hierarchyToggle"
                checked={showFullHierarchyPath}
                onChange={(e) => setShowFullHierarchyPath(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#166534] focus:ring-[#166534] cursor-pointer text-[#166534]"
              />
              <label htmlFor="hierarchyToggle" className="text-xs font-semibold text-gray-700 select-none cursor-pointer">
                Show Full 5-Level Geographical Hierarchy (Names, not Codes)
              </label>
            </div>
          </div>

          {/* Main Members Grid/Table */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            {searchedMembers.length > 0 && (
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4 overflow-x-auto">
                {groupFilter !== 'All' ? (
                  <>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-500">{groupFilter} Male</span>
                      <span className="text-lg font-mono font-black text-gray-900">{searchedMembers.filter(m => m.gender === 'Male').length}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-500">{groupFilter} Female</span>
                      <span className="text-lg font-mono font-black text-gray-900">{searchedMembers.filter(m => m.gender === 'Female').length}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Total {groupFilter}</span>
                      <span className="text-lg font-mono font-black text-[#166534]">{searchedMembers.length}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Total Members</span>
                      <span className="text-lg font-mono font-black text-[#166534]">{searchedMembers.length}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Total Sunday School</span>
                      <span className="text-lg font-mono font-black text-[#166534]">{searchedMembers.filter(m => m.groupId === MemberGroup.SUNDAY_SCHOOL).length}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Total Masvowani</span>
                      <span className="text-lg font-mono font-black text-[#166534]">{searchedMembers.filter(m => m.groupId === MemberGroup.MASOWANI).length}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Total Ruwadzano</span>
                      <span className="text-lg font-mono font-black text-[#166534]">{searchedMembers.filter(m => m.groupId === MemberGroup.RUWADZANO).length}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Total Sungano</span>
                      <span className="text-lg font-mono font-black text-[#166534]">{searchedMembers.filter(m => m.groupId === MemberGroup.SUNGANO).length}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-4">
                      <span className="text-[10px] uppercase font-bold text-gray-500">Total Jorodhani</span>
                      <span className="text-lg font-mono font-black text-[#166534]">{searchedMembers.filter(m => m.isJorodhani).length}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {searchedMembers.length === 0 ? (
              <div className="p-12 text-center text-gray-400 space-y-3">
                <ShieldAlert className="h-10 w-10 mx-auto text-[#6B7280]" />
                <h3 className="font-semibold text-gray-700">No members match your current filters.</h3>
                <p className="text-xs text-gray-400">Try adjusting your filters or search options.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-[#6B7280] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Demographics</th>
                      <th className="py-3 px-4">Current Group</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">
                        {currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM || currentUser.level === JdnLevel.WELLNESS_CENTER
                          ? "National Unit"
                          : currentUser.level === JdnLevel.NATIONAL
                          ? "Province"
                          : currentUser.level === JdnLevel.PROVINCIAL
                          ? "District"
                          : currentUser.level === JdnLevel.DISTRICT
                          ? "Nyika"
                          : currentUser.level === JdnLevel.NYIKA
                          ? "Tabhera"
                          : "Family Name"}
                      </th>
                      <th className="py-3 px-4">Sync</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {paginatedMembers.map((member) => (
                      <tr key={member.memberId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">
                            <HighlightText text={member.fullName} search={search} />
                            {member.isLeadership && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#166534] text-white text-[9px] font-bold tracking-wide uppercase">
                                Basa: {member.basa || 'Leadership'}
                              </span>
                            )}
                          </div>
                          
                          {/* Rich Matched-by Fields indicator lists */}
                          {search && (
                            <div className="flex gap-1.5 mt-1 flex-wrap">
                              {member.fullName.toLowerCase().includes(search.toLowerCase()) && (
                                <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-amber-50/70 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                                  Matched: Name
                                </span>
                              )}
                              {member.tabheraCode.toLowerCase().includes(search.toLowerCase()) && (
                                <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-[#3730a3] px-1.5 py-0.5 rounded border border-indigo-200">
                                  Matched: Tabhera Code ( {member.tabheraCode.split('/').pop()} )
                                </span>
                              )}
                              {member.family && member.family.toLowerCase().includes(search.toLowerCase()) && (
                                <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-indigo-900 px-1.5 py-0.5 rounded border border-purple-200">
                                  Matched: Family ( {member.family} )
                                </span>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-gray-500 font-mono mt-0.5">Number: {member.memberNumber || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs space-y-0.5">
                          <div>Born: {member.dateOfBirth}</div>
                          <div>Gender: <span className="font-semibold">{member.gender}</span> • Marital: {member.maritalStatus}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${member.groupId === MemberGroup.SUNDAY_SCHOOL ? 'bg-amber-50 text-amber-700 border border-amber-200' : member.groupId === MemberGroup.MASOWANI ? 'bg-blue-50 text-blue-700 border border-blue-200' : member.groupId === MemberGroup.RUWADZANO ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-emerald-50 text-[#166534] border border-green-200'}`}>
                            {member.groupId}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {member.isJorodhani ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-[#D97706] text-xs font-bold uppercase tracking-wide border border-yellow-200">
                              <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Jorodhani
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                              <UserCheck className="h-4 w-4" /> Confirmed
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-sans text-gray-700 font-bold">
                          {getMembershipDisplayText(member, currentUser.level, profiles)}
                        </td>
                        <td className="py-3.5 px-4">
                          {member.syncStatus === 'pending' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                              Pending Sync
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-[#16A34A] border border-green-200 text-xs">
                              Synced
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === member.memberId ? null : member.memberId)}
                              className="p-1 px-2 rounded-full hover:bg-gray-100 text-gray-500 focus:outline-none cursor-pointer"
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>
                            
                            {openMenuId === member.memberId && (
                              <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden text-left">
                                <div className="py-1">
                                  {member.promotionHistory.length > 0 && (
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        alert(`Promotion Trail:\n` + member.promotionHistory.map((h, i) => `${i+1}. From: ${h.fromGroup} → To: ${h.toGroup} (${h.date}) by Admin: ${h.promotedBy}`).join('\n'));
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                    >
                                      History Log
                                    </button>
                                  )}
                                  
                                  {(currentUser.level === JdnLevel.TABHERA || currentUser.level === JdnLevel.WELLNESS_CENTER) && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          handleEditClick(member);
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          handleDeleteMember(member.memberId);
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}

                                  {currentUser.level !== JdnLevel.TABHERA && currentUser.level !== JdnLevel.NYIKA && (
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setSelectedMember(member);
                                        setTargetGroup(member.groupId);
                                        setIsPromoOpen(true);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-[#1D4ED8] hover:bg-blue-50 cursor-pointer"
                                    >
                                      Promote Member
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-white sm:px-6">
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-bold">{searchedMembers.length === 0 ? 0 : (currentPage - 1) * MEMBERS_ITEMS_PER_PAGE + 1}</span> to <span className="font-bold">{Math.min(currentPage * MEMBERS_ITEMS_PER_PAGE, searchedMembers.length)}</span> of <span className="font-bold">{searchedMembers.length}</span> members
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-l-md"
                        >
                          Previous Page
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-r-md"
                        >
                          Next Page
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Families Directory tab (showing all families in the members account starting with the most recent) */}
      {subTab === 'families' && (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          {searchedFamilies.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-3">
              <Users className="h-10 w-10 mx-auto text-[#6B7280]" />
              <h3 className="font-semibold text-gray-700">No families match your active search terms.</h3>
              <p className="text-xs text-[#6B7280]">Try typing another spelling or register a member with this family surname.</p>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-[#6B7280] font-bold uppercase tracking-wider font-sans">
                      <th className="py-3 px-4">Family / House Surname</th>
                      <th className="py-3 px-4">Constituent Members</th>
                      <th className="py-3 px-4">Associated Tabheras</th>
                      <th className="py-3 px-4">Total Registers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {paginatedFamilies.map((familyName) => {
                      const familyMembers = members.filter(m => m.family === familyName);
                      const distinctTabheras = Array.from(new Set(familyMembers.map(m => resolveBranchName(m.tabheraCode, profiles))));
                      return (
                        <tr key={familyName} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">
                              <HighlightText text={familyName} search={search} />
                            </div>
                            {search && (
                              <div className="mt-1 flex gap-1">
                                <span className="inline-flex text-[9px] bg-purple-50 text-indigo-900 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-purple-200">
                                  Matched Surname
                                </span>
                              </div>
                            )}
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5">Synced House Registry</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-gray-750">
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {familyMembers.map(fm => (
                                <span key={fm.memberId} className="px-2 py-0.5 bg-gray-100 text-gray-850 rounded border border-gray-200">
                                  {fm.fullName} ({fm.groupId})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold text-gray-600">
                            {distinctTabheras.join(', ')}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#166534]">
                            {familyMembers.length} members
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Families Pagination Controls */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-white sm:px-6">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-bold">{(currentPage - 1) * FAMILIES_ITEMS_PER_PAGE + 1}</span> to <span className="font-bold">{Math.min(currentPage * FAMILIES_ITEMS_PER_PAGE, searchedFamilies.length)}</span> of <span className="font-bold">{searchedFamilies.length}</span> families
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-l-md"
                      >
                        Previous Page
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-750 font-semibold">
                        Page {currentPage} of {totalFamiliesPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalFamiliesPages))}
                        disabled={currentPage === totalFamiliesPages}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-r-md"
                      >
                        Next Page
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Family Dialog */}
      {isFamilyModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-200 space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">Register New Family</h3>
            
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Family Surname / House Name</label>
              <input
                type="text"
                required
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="e.g. Moyo Family"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase text-gray-500">Family Registration Type</label>
              <div className="flex bg-gray-100 p-0.5 rounded-lg border text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setNewFamilyLinkMode('placeholder')} 
                  className={`flex-1 py-1.5 rounded-md transition-all ${newFamilyLinkMode === 'placeholder' ? 'bg-white shadow text-[#166534]' : 'text-gray-500'}`}
                >
                  Placeholder
                </button>
                <button 
                  type="button" 
                  onClick={() => setNewFamilyLinkMode('existing')} 
                  className={`flex-1 py-1.5 rounded-md transition-all ${newFamilyLinkMode === 'existing' ? 'bg-white shadow text-[#166534]' : 'text-gray-500'}`}
                >
                  Link Existing
                </button>
                <button 
                  type="button" 
                  onClick={() => setNewFamilyLinkMode('new')} 
                  className={`flex-1 py-1.5 rounded-md transition-all ${newFamilyLinkMode === 'new' ? 'bg-white shadow text-[#166534]' : 'text-gray-500'}`}
                >
                  Register & Link New
                </button>
              </div>
            </div>

            {newFamilyLinkMode === 'existing' && (
              <div className="space-y-2 animate-fade-in">
                <label className="block text-xs font-bold uppercase text-gray-500">Select Member to Link as Family Representative</label>
                <select
                  value={selectedMemberIdToLink}
                  onChange={(e) => setSelectedMemberIdToLink(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none"
                >
                  <option value="">-- Choose Member --</option>
                  {members
                    .filter(m => !m.fullName.includes('[Placeholder]'))
                    .map(m => (
                      <option key={m.memberId} value={m.memberId}>
                        {m.fullName} {m.family ? `(Current family: ${m.family})` : '(No family)'}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-gray-400">Selecting an existing member will change their family surname/household connection to this new family.</p>
              </div>
            )}

            {newFamilyLinkMode === 'new' && (
              <div className="space-y-3 p-3 bg-gray-50 border rounded-xl animate-fade-in">
                <h4 className="font-bold text-xs uppercase text-gray-700">New Member Registration Form</h4>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5">Full Name</label>
                  <input
                    type="text"
                    value={newFamilyMemName}
                    onChange={(e) => setNewFamilyMemName(e.target.value)}
                    placeholder="E.g. Petros Moyo"
                    className="w-full px-2.5 py-1.5 border rounded text-xs bg-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5">Gender</label>
                    <select
                      value={newFamilyMemGender}
                      onChange={(e) => {
                        const g = e.target.value as Gender;
                        setNewFamilyMemGender(g);
                        if (g === 'Female') setNewFamilyMemGroup(MemberGroup.RUWADZANO);
                        else setNewFamilyMemGroup(MemberGroup.SUNGANO);
                      }}
                      className="w-full px-2.5 py-1.5 border rounded text-xs bg-white focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5">Date of Birth</label>
                    <input
                      type="date"
                      value={newFamilyMemDOB}
                      onChange={(e) => setNewFamilyMemDOB(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded text-xs bg-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5">Marital Status</label>
                    <select
                      value={newFamilyMemMarital}
                      onChange={(e) => setNewFamilyMemMarital(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded text-xs bg-white focus:outline-none"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5">Church Group</label>
                    <select
                      value={newFamilyMemGroup}
                      onChange={(e) => setNewFamilyMemGroup(e.target.value as MemberGroup)}
                      className="w-full px-2.5 py-1.5 border rounded text-xs bg-white focus:outline-none"
                    >
                      <option value={MemberGroup.SUNDAY_SCHOOL}>Sunday School</option>
                      <option value={MemberGroup.MASOWANI}>Masowani</option>
                      <option value={MemberGroup.RUWADZANO}>Ruwadzano</option>
                      <option value={MemberGroup.SUNGANO}>Sungano</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t">
              <button 
                onClick={() => {
                  setIsFamilyModalOpen(false);
                  setNewFamilyName('');
                  setSelectedMemberIdToLink('');
                  setNewFamilyMemName('');
                }} 
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const famName = newFamilyName.trim();
                  if (!famName) {
                    toast.error('Please enter a family surname');
                    return;
                  }
                  
                  const targetTabhera = currentUser.level === JdnLevel.WELLNESS_CENTER ? profiles.find(p => p.level === JdnLevel.TABHERA)?.levelCode || '' : (currentUser.level === JdnLevel.TABHERA ? currentUser.levelCode : 'TAB-HRE-S-1A-1');

                  if (newFamilyLinkMode === 'placeholder') {
                    const newMember: Member = {
                      memberId: `fam-placeholder-${Date.now()}`,
                      fullName: `[Placeholder] Family Head`,
                      dateOfBirth: '2000-01-01',
                      gender: 'Male',
                      maritalStatus: 'Married',
                      groupId: MemberGroup.SUNGANO,
                      joinDate: new Date().toISOString().split('T')[0],
                      tabheraCode: targetTabhera,
                      isJorodhani: false,
                      jorodhaniDate: null,
                      isLeadership: false,
                      family: famName,
                      promotionHistory: [],
                      createdBy: currentUser.id,
                      createdAt: new Date().toISOString(),
                      syncStatus: 'pending'
                    };
                    await saveMembers([...members, newMember]);
                    await addToSyncQueue('member', newMember.memberId, 'create', newMember);
                  } else if (newFamilyLinkMode === 'existing') {
                    if (!selectedMemberIdToLink) {
                      toast.error('Please choose a member from the list');
                      return;
                    }
                    const updated = members.map(m => m.memberId === selectedMemberIdToLink ? { ...m, family: famName, syncStatus: 'pending' as const } : m);
                    await saveMembers(updated);
                    const changedMember = updated.find(m => m.memberId === selectedMemberIdToLink);
                    if (changedMember) {
                      await addToSyncQueue('member', changedMember.memberId, 'update', changedMember);
                    }
                  } else {
                    // Register new member under this family
                    if (!newFamilyMemName.trim()) {
                      toast.error('Please enter the name of the new member');
                      return;
                    }
                    const newId = `mem-${Date.now()}`;
                    const newMember: Member = {
                      memberId: newId,
                      fullName: newFamilyMemName.trim(),
                      dateOfBirth: newFamilyMemDOB,
                      gender: newFamilyMemGender,
                      maritalStatus: newFamilyMemMarital,
                      groupId: newFamilyMemGroup,
                      joinDate: new Date().toISOString().split('T')[0],
                      tabheraCode: targetTabhera,
                      isJorodhani: false,
                      jorodhaniDate: null,
                      isLeadership: false,
                      family: famName,
                      promotionHistory: [],
                      createdBy: currentUser.id,
                      createdAt: new Date().toISOString(),
                      syncStatus: 'pending'
                    };
                    await saveMembers([...members, newMember]);
                    await addToSyncQueue('member', newMember.memberId, 'create', newMember);
                  }

                  setNewFamilyName('');
                  setSelectedMemberIdToLink('');
                  setNewFamilyMemName('');
                  setIsFamilyModalOpen(false);
                  await loadMembersData();
                  window.dispatchEvent(new Event('jdn_db_updated'));
                  toast.success('Family registered successfully');
                }}
                className="bg-[#166534] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#166534]/90 transition"
              >
                Register Family
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Member Custom Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl border border-gray-200 flex flex-col max-h-[90vh] overflow-y-auto animate-fade-in" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#111827]">{isEditMode ? 'Edit Member Config' : 'Insert New Member'}</h3>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  setIsEditMode(false);
                  setEditingMemberId(null);
                }} 
                className="text-gray-400 hover:text-black text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-[#DC2626] border border-red-100 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Full Member Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Panashe Mashingaidze"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Marital Status</label>
                  <select
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Divorced">Divorced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Target Group</label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value as MemberGroup)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  >
                    <option value={MemberGroup.SUNDAY_SCHOOL}>Sunday School (Under 14)</option>
                    <option value={MemberGroup.MASOWANI}>Masowani (Youth 14+ unmarried)</option>
                    <option value={MemberGroup.RUWADZANO}>Ruwadzano (Married Women)</option>
                    <option value={MemberGroup.SUNGANO}>Sungano (Married Men)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Family / Household Name</label>
                <input
                  type="text"
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                  placeholder="e.g. Makoni Family, Moyo Household"
                  list="families-list"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
                <datalist id="families-list">
                  {allFamilies.map(f => <option key={f} value={f} />)}
                </datalist>
              </div>

              {currentUser.level === JdnLevel.WELLNESS_CENTER && (
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Assign to Branch <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={targetTabheraCode}
                    onChange={(e) => setTargetTabheraCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  >
                    <option value="">-- Choose Branch --</option>
                    {profiles.filter(p => p.level === JdnLevel.TABHERA).map(p => (
                      <option key={p.levelCode} value={p.levelCode}>{p.branchName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="jorCheck"
                    checked={currentUser.level === JdnLevel.WELLNESS_CENTER ? true : isJorodhani}
                    disabled={currentUser.level === JdnLevel.WELLNESS_CENTER}
                    onChange={(e) => setIsJorodhani(e.target.checked)}
                    className="rounded border-gray-300 text-[#166534] focus:ring-[#166534]"
                  />
                  <label htmlFor="jorCheck" className="text-xs text-gray-600 font-semibold select-none cursor-pointer">
                    Flag as newcomer (&quot;Jorodhani&quot; status requiring verification) {currentUser.level === JdnLevel.WELLNESS_CENTER && ' (Forced for Wellness Centers)'}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="leadCheck"
                    checked={isLeadership}
                    onChange={(e) => setIsLeadership(e.target.checked)}
                    className="rounded border-gray-300 text-[#166534] focus:ring-[#166534]"
                  />
                  <label htmlFor="leadCheck" className="text-xs text-gray-600 font-bold select-none cursor-pointer">
                    Mark as Leadership
                  </label>
                </div>
                {isLeadership && (
                  <div className="flex flex-col gap-1 mt-1 animate-fade-in pl-6">
                    <label htmlFor="basaInput" className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                      Basa (Leadership Title)
                    </label>
                    <input
                      type="text"
                      id="basaInput"
                      placeholder="e.g. Secretary, Treasurer, Overseer, Mutongi"
                      value={basa}
                      onChange={(e) => setBasa(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-250 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
                    />
                    <label htmlFor="picUpload" className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mt-2">
                      Leadership Picture (Optional)
                    </label>
                    <input
                      type="file"
                      id="picUpload"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPictureUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-gray-500 file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-emerald-50 file:text-[#166534] hover:file:bg-emerald-100"
                    />
                    {pictureUrl && (
                      <div className="mt-2">
                        <img src={pictureUrl} alt="Preview" className="h-12 w-12 rounded-full object-cover border-2 border-green-200" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsEditMode(false);
                    setEditingMemberId(null);
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-4 py-2 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition-all active:scale-95 duration-100 ${
                    isSaving 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-[#166534] hover:bg-[#115e2e] active:bg-[#0f4d25]'
                  }`}
                >
                  {isSaving ? 'Processing Secure Save...' : (isEditMode ? 'Confirm Update' : 'Confirm and Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promote Member Manual Dialog */}
      {isPromoOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl border border-gray-200 animate-fade-in" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Manual Demographics Promotion</h3>
              <button onClick={() => { setIsPromoOpen(false); setSelectedMember(null); }} className="text-gray-400 hover:text-black font-semibold text-xl cursor-pointer">&times;</button>
            </div>

            <div className="bg-[#1D4ED8]/5 p-3 rounded-lg border border-[#1D4ED8]/10 text-xs text-[#1D4ED8]">
              Promoting <strong>{selectedMember.fullName}</strong> ({selectedMember.gender}, dob: {selectedMember.dateOfBirth}). Access level check: Verified as District Leader+.
            </div>

            <form onSubmit={promoteMemberManually} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Current Lifespan Group</label>
                <div className="text-sm font-semibold bg-gray-100 px-3 py-2 rounded-lg text-gray-600 border border-gray-200">
                  {selectedMember.groupId}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Target Lifespan Group</label>
                <select
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value as MemberGroup)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                >
                  <option value={MemberGroup.MASOWANI}>Masowani (Youth 14+ unmarried)</option>
                  <option value={MemberGroup.RUWADZANO}>Ruwadzano (Married Women - Female only)</option>
                  <option value={MemberGroup.SUNGANO}>Sungano (Married Men - Male only)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsPromoOpen(false); setSelectedMember(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#1D4ED8]/95 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm"
                >
                  Finalize Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
