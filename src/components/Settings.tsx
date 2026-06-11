import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserProfile, LevelCode, JdnLevel, getRoleTitleForLevel, getStoredHierarchyOrder, getStoredLevelNames } from '../types';
import {
  getLevelCodes,
  saveLevelCodes,
  getUserProfiles,
  saveUserProfiles,
  getCurrentUser,
  getSyncQueue,
  saveSyncQueue,
  processSyncQueue,
  deactivateUserAndReassignData,
  getNetworkStatus,
  setNetworkStatus,
  addToSyncQueue,
  resetLowerLevelPassword,
  getCustomLevels,
  saveCustomLevels,
  getSettings,
  saveSettings,
  resolveBranchName,
  forceBackfillToCloud
} from '../lib/storage';
import { KeyRound, ShieldAlert, CheckCircle2, AlertTriangle, Key, Download, Trash, UserPlus, ToggleLeft, ToggleRight, Wifi, WifiOff, RefreshCw, FolderSearch, Users, Activity, Layers, ExternalLink, User, Image as ImageIcon, Coins } from 'lucide-react';
import { JdnSettings } from '../types';

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

interface SettingsProps {
  currentUser: UserProfile;
  onRefreshSession: () => void;
}

const LEVEL_HIERARCHY_ORDER = [
  JdnLevel.SYSTEM,
  JdnLevel.JERUSALEM,
  JdnLevel.NATIONAL,
  JdnLevel.PROVINCIAL,
  JdnLevel.DISTRICT,
  JdnLevel.NYIKA,
  JdnLevel.TABHERA
];

export function Settings({ currentUser, onRefreshSession }: SettingsProps) {
  const [codes, setCodes] = useState<LevelCode[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allUserProfiles, setAllUserProfiles] = useState<UserProfile[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(getNetworkStatus());

  // Password Overrides modal state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserProfile | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  
  // Own Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Own Account Details editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(currentUser.fullName);
  const [profilePhone, setProfilePhone] = useState(currentUser.phoneNumber || '');
  const [profileNationalId, setProfileNationalId] = useState(currentUser.nationalId || '');
  const [profileEmail, setProfileEmail] = useState(currentUser.email);
  
  // Create invitation code states
  const [newCodeValue, setNewCodeValue] = useState('');
  const [inviteType, setInviteType] = useState<'child' | 'coworker'>('child');
  const [newCodeScope, setNewCodeScope] = useState<JdnLevel>(JdnLevel.TABHERA);
  const [newCodeBranch, setNewCodeBranch] = useState('');
  const [newCodeExpiry, setNewCodeExpiry] = useState('2027-12-31');

  // Path B: Create Admin User state
  const [isPathBOpen, setIsPathBOpen] = useState(false);
  const [bFullName, setBFullName] = useState('');
  const [bPhone, setBPhone] = useState('+263');
  const [bEmail, setBEmail] = useState('');
  const [bNationalId, setBNationalId] = useState('');
  const [bPassword, setBPassword] = useState('');
  const [bRole, setBRole] = useState('');
  const [bLevel, setBLevel] = useState<JdnLevel>(JdnLevel.TABHERA);
  const [bBranchName, setBBranchName] = useState('');
  const [bError, setBError] = useState<string | null>(null);
  const [bSuccess, setBSuccess] = useState<string | null>(null);

  // Deactivate & Reassign user properties
  const [isDeactOpen, setIsDeactOpen] = useState(false);
  const [targetDeactUser, setTargetDeactUser] = useState<UserProfile | null>(null);
  const [replacementUserId, setReplacementUserId] = useState('');
  const [deactError, setDeactError] = useState<string | null>(null);

  // Storage tracking simulation (Safari 50MB budget constraint)
  const [storageUsageBytes, setStorageUsageBytes] = useState(1240 * 1024); // mock initial: 1.2MB used

  // Change custom levels configuration states
  const [customLevels, setCustomLevels] = useState<string[]>([]);
  const [newLevelInput, setNewLevelInput] = useState('');

  const [jdnSettings, setJdnSettings] = useState<JdnSettings | null>(null);
  const [newGlobalCurrencyInput, setNewGlobalCurrencyInput] = useState('');

  // Pagination & Search
  const [userPage, setUserPage] = useState(0);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Dynamic target church context for backup/reset operations
  const [targetChurchFilter, setTargetChurchFilter] = useState('ALL');

  // Built-in renaming and reordering state
  const [hierarchyOrder, setHierarchyOrder] = useState<JdnLevel[]>(getStoredHierarchyOrder());
  const [hierarchyNames, setHierarchyNames] = useState<Record<string, string>>(getStoredLevelNames());
  const [editingLevelMap, setEditingLevelMap] = useState<Record<string, string>>({});

  // Custom confirmation states to replace window.prompt/confirm (unsupported in iframe)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [confirmSyncBulk, setConfirmSyncBulk] = useState(false);
  const [isSyncingBulk, setIsSyncingBulk] = useState(false);

  // Helper: which levels can the current user create?
  const allowedChildLevels = hierarchyOrder.filter(lvl => {
    // Co-worker creation handles itself separately
    const myIndex = hierarchyOrder.indexOf(currentUser.level);
    const targetIndex = hierarchyOrder.indexOf(lvl);
    if (myIndex === -1 || targetIndex === -1) return false;
    
    // Condition 1: Level is exactly one level below
    if (targetIndex === myIndex + 1) return true;
    
    // Condition 2: National can create Wellness Center (index 7)
    if (currentUser.level === JdnLevel.NATIONAL && lvl === JdnLevel.WELLNESS_CENTER) return true;
    
    // System and Jerusalem can create anything below them
    if (currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM) {
      if (targetIndex > myIndex) return true;
    }
    
    return false;
  });

  const handleSaveSettings = async (updates: Partial<JdnSettings>) => {
    if (!jdnSettings) return;
    const newSettings = { ...jdnSettings, ...updates };
    setJdnSettings(newSettings);
    await saveSettings(newSettings);
    toast.success('Settings updated successfully');
  };

  useEffect(() => {
    loadSettingsData();
    // Watch for network toggle events
    const handleNet = () => setIsOnline(getNetworkStatus());
    const handleQueue = async () => setQueue(await getSyncQueue());
    
    window.addEventListener('jdn_network_changed', handleNet);
    window.addEventListener('jdn_sync_queue_updated', handleQueue);
    return () => {
      window.removeEventListener('jdn_network_changed', handleNet);
      window.removeEventListener('jdn_sync_queue_updated', handleQueue);
    };
  }, []);

  useEffect(() => {
    if (currentUser.level === JdnLevel.TABHERA) {
      setInviteType('coworker');
    }
    setProfileName(currentUser.fullName);
    setProfilePhone(currentUser.phoneNumber || '');
    setProfileNationalId(currentUser.nationalId || '');
    setProfileEmail(currentUser.email);
  }, [currentUser]);

  useEffect(() => {
    if (allowedChildLevels.length > 0 && !allowedChildLevels.includes(newCodeScope)) {
      setNewCodeScope(allowedChildLevels[0]);
    }
    if (allowedChildLevels.length > 0 && !allowedChildLevels.includes(bLevel)) {
      setBLevel(allowedChildLevels[0]);
    }
  }, [allowedChildLevels, newCodeScope, bLevel]);

  const loadSettingsData = async () => {
    const codeList = await getLevelCodes();
    const userList = await getUserProfiles();
    setAllUserProfiles(userList);
    const queueList = await getSyncQueue();
    const customList = await getCustomLevels();
    const settings = await getSettings();
    setJdnSettings(settings);
    
    // Scoping lists for child hierarchy simulation
    let filterCodes = codeList;
    let filterUsers = userList;
    if (currentUser.level !== JdnLevel.SYSTEM) {
      // System accounts must never appear to any church level, even Jerusalem
      filterUsers = userList.filter(u => u.level !== JdnLevel.SYSTEM);
      if (currentUser.level !== JdnLevel.JERUSALEM) {
        filterCodes = codeList.filter(c => c.createdBy === currentUser.id);
        filterUsers = filterUsers.filter(u => u.parentCode === currentUser.levelCode || u.levelCode === currentUser.levelCode);
      }
    }

    setCodes(filterCodes);
    setUsers(filterUsers);
    setQueue(queueList);
    setCustomLevels(customList);
    
    // Storage calculation
    let rawStr = JSON.stringify(codeList) + JSON.stringify(userList) + JSON.stringify(queueList);
    setStorageUsageBytes(1.2 * 1024 * 1024 + rawStr.length * 2); // 1.2MB pre-seeded base assets + dynamic JSON characters * 2 bytes
  };

  const handleAddCustomLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLevelInput.trim()) return;
    const cleanLvl = newLevelInput.trim();
    if (customLevels.includes(cleanLvl)) {
      toast.error('Level already exists in system customization catalogue.');
      return;
    }
    const updated = [...customLevels, cleanLvl];
    await saveCustomLevels(updated);
    setCustomLevels(updated);
    setNewLevelInput('');
    toast.success(`Distinct custom hierarchy level "${cleanLvl}" added to your administrative structure logs.`);
  };

  const handleDeleteCustomLevel = async (levelName: string) => {
    const updated = customLevels.filter(x => x !== levelName);
    await saveCustomLevels(updated);
    setCustomLevels(updated);
    toast.success(`Custom hierarchy level "${levelName}" removed.`);
  };

  const handleSaveRenameLevel = (levelId: JdnLevel) => {
    const updatedNames = { ...hierarchyNames, [levelId]: editingLevelMap[levelId] || hierarchyNames[levelId] };
    setHierarchyNames(updatedNames);
    localStorage.setItem('jdn_level_names_v18', JSON.stringify(updatedNames));
    toast.success(`Hierarchy name successfully mapped locally.`);
  };

  const handleMoveLevelOrder = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newOrder = [...hierarchyOrder];
      const temp = newOrder[index - 1];
      newOrder[index - 1] = newOrder[index];
      newOrder[index] = temp;
      setHierarchyOrder(newOrder);
      localStorage.setItem('jdn_hierarchy_order_v18', JSON.stringify(newOrder));
    } else if (direction === 'down' && index < hierarchyOrder.length - 1) {
      const newOrder = [...hierarchyOrder];
      const temp = newOrder[index + 1];
      newOrder[index + 1] = newOrder[index];
      newOrder[index] = temp;
      setHierarchyOrder(newOrder);
      localStorage.setItem('jdn_hierarchy_order_v18', JSON.stringify(newOrder));
    }
  };

  const handleDeleteHierarchyLevel = (levelId: JdnLevel) => {
    if (hierarchyOrder.length <= 1) {
       toast.error("Cannot delete the last hierarchy level.");
       return;
    }
    const confirmDelete = window.confirm(`Are you sure you want to delete the ${levelId} hierarchy level? This could impact existing users linked to it.`);
    if (confirmDelete) {
       const newOrder = hierarchyOrder.filter(l => l !== levelId);
       setHierarchyOrder(newOrder);
       localStorage.setItem('jdn_hierarchy_order_v18', JSON.stringify(newOrder));
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCodeValue.trim().length < 4) {
      toast.error('Invitation code value must be at least 4 alphanumeric characters.');
      return;
    }

    const generatedCode: LevelCode = {
      codeId: `cd-${Date.now()}`,
      codeValue: newCodeValue.trim().toUpperCase(),
      createdBy: currentUser.id,
      parentLevelCode: inviteType === 'coworker' ? currentUser.parentCode : currentUser.levelCode,
      levelScope: inviteType === 'coworker' ? currentUser.level : newCodeScope,
      branchName: inviteType === 'coworker' ? currentUser.branchName : (newCodeBranch.trim() || `${newCodeScope} branch`),
      exactUnitCode: inviteType === 'coworker' ? currentUser.levelCode : undefined,
      expiryDate: new Date(newCodeExpiry).toISOString(),
      useCount: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      const allCodes = await getLevelCodes();
      if (allCodes.some(c => c.codeValue === generatedCode.codeValue)) {
        toast.error('This invitation code already exists in the database. Choose a unique name.');
        return;
      }

      const updated = [...allCodes, generatedCode];
      await saveLevelCodes(updated);
      setNewCodeValue('');
      setNewCodeBranch('');
      await loadSettingsData();
      toast.success(`Successfully generated invitation code ${generatedCode.codeValue}`);
    } catch (err: any) {
      toast.error('Failed saving generated registration invitation code: ' + err.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim() || !profileEmail.trim()) {
      toast.error('Full Name and Email are required.');
      return;
    }

    try {
      const updatedUser: UserProfile = {
        ...currentUser,
        fullName: profileName.trim(),
        email: profileEmail.trim(),
        phoneNumber: profilePhone.trim(),
        nationalId: profileNationalId.trim(),
      };

      // Save to current user session
      const localforage = (await import('localforage')).default;
      await localforage.setItem('jdn_current_user', updatedUser);

      // Save to all user profiles array
      const allProfiles = await getUserProfiles();
      const updatedList = allProfiles.map(p => p.id === currentUser.id ? updatedUser : p);
      await saveUserProfiles(updatedList);

      // Save to Firestore / Queue
      const isOnline = getNetworkStatus();
      if (isOnline) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          await setDoc(doc(db, 'user_profiles', currentUser.id), updatedUser);
        } catch (fsErr: any) {
          console.warn("Firestore update had some issues, queuing instead...", fsErr);
          await addToSyncQueue('profile', currentUser.id, 'update', { profile: updatedUser });
        }
      } else {
        await addToSyncQueue('profile', currentUser.id, 'update', { profile: updatedUser });
      }

      toast.success('Your account details have been securely updated (and synced with Firestore).');
      setIsEditingProfile(false);
      onRefreshSession();
    } catch (err: any) {
      toast.error('Failed to update account details: ' + err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!resetTargetUser) return;
    if (resetPasswordValue.trim().length < 6) {
      setResetError('Security protocol requires passwords to be at least 6 characters.');
      return;
    }

    const res = await resetLowerLevelPassword(currentUser, resetTargetUser.id, resetPasswordValue.trim());
    if (res.success) {
      setResetSuccess(`Password successfully overridden for ${resetTargetUser.fullName}. Login is locked until user updates key.`);
      setResetPasswordValue('');
      await loadSettingsData();
    } else {
      setResetError(res.error || 'Failed to complete reset override.');
    }
  };

  // Export Bulk generated CSV file simulation
  const exportCodesCSV = () => {
    if (codes.length === 0) return;
    const headers = 'CodeId,InvitationCode,LevelScope,BranchName,ExpiryDate,UseCount,IsActive\n';
    const rows = codes.map(c => `"${c.codeId}","${c.codeValue}","${c.levelScope}","${c.branchName}","${c.expiryDate}",${c.useCount},${c.isActive}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `JDN-Codes-Export-${currentUser.levelCode}.csv`);
    a.click();
  };

  // Toggle specific code deactivation manually
  const toggleCodeStatus = async (codeId: string) => {
    const all = await getLevelCodes();
    const updated = all.map(c => {
      if (c.codeId === codeId) {
        return { ...c, isActive: !c.isActive };
      }
      return c;
    });
    await saveLevelCodes(updated);
    await loadSettingsData();
  };

  // Path B User creation (Admin creates child account)
  const handlePathBUserCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBError(null);
    setBSuccess(null);

    if (bFullName.trim().length < 3) {
      setBError('Full Name must be at least 3 characters.');
      return;
    }

    const phoneRegex = /^\+263[0-9]{9}$/;
    if (!phoneRegex.test(bPhone.trim())) {
      setBError('Phone must match E.164 format (e.g. +263777123456).');
      return;
    }

    if (!bPassword || bPassword.length < 8) {
      setBError('Temporary password must be at least 8 characters.');
      return;
    }

    const todayStr = new Date('2026-05-27').toISOString();
    const autoCode = currentUser.levelCode; // Path B reads own levelCode

    const branchSlug = (bBranchName.trim() || `${bLevel} Unit`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .toUpperCase();

    const lvlPrefix = bLevel.substring(0, 3).toUpperCase();
    const cleanLevelCode = `${autoCode}/${lvlPrefix}-${branchSlug}`;

    const newAdminUser: UserProfile = {
      id: `usr-admin-${Date.now()}`,
      email: bEmail.trim(),
      fullName: bFullName.trim(),
      phoneNumber: bPhone.trim(),
      nationalId: bNationalId.trim(),
      level: bLevel,
      levelCode: cleanLevelCode,
      branchName: bBranchName.trim() || `${bLevel} Unit`,
      parentCode: autoCode, // Auto-filled from parent admin
      role: bRole.trim() || getRoleTitleForLevel(bLevel),
      isActive: true,
      forcedPasswordChange: true, // MUST change password on first login
      createdAt: todayStr
    };

    const runCreation = async () => {
      const allUsers = await getUserProfiles();

      // Duplicates validation Check
      if (allUsers.some(u => u.email.toLowerCase() === bEmail.trim().toLowerCase())) {
        setBError('An account with this email already exists.');
        return false;
      }
      if (allUsers.some(u => u.phoneNumber === bPhone.trim())) {
        setBError('This phone number is already registered.');
        return false;
      }
      if (allUsers.some(u => u.nationalId === bNationalId.trim())) {
        setBError('This ID is already linked to an account.');
        return false;
      }

      // Online configuration: Create genuine Firebase login and save Firestore records
      try {
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth');
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const firebaseConfig = await import('../../firebase-applet-config.json');

        const tempAppName = `temp-child-${Date.now()}`;
        const cfg = (firebaseConfig as any).default || firebaseConfig;
        const tempApp = initializeApp(cfg, tempAppName);
        const tempAuth = getAuth(tempApp);

        const tempCred = await createUserWithEmailAndPassword(tempAuth, bEmail.trim(), bPassword);
        const childUid = tempCred.user.uid;

        // Match child profile UID to real Auth UID
        newAdminUser.id = childUid;

        // Save profile in Firestore user_profiles collection
        await setDoc(doc(db, 'user_profiles', childUid), newAdminUser);

        // Delete temp app instance
        await deleteApp(tempApp);
      } catch (fbErr: any) {
        console.error('Account registration failed: ', fbErr);
        const msg = (fbErr.message || String(fbErr)).toLowerCase();
        let displayError = 'An unexpected error occurred during account creation. Please verify your connection status and try again.';
        
        if (msg.includes('network-request-failed') || msg.includes('network-error') || msg.includes('network error') || msg.includes('failed to fetch')) {
          displayError = 'A network connection failure occurred. Please check your internet connection and try again.';
        } else if (msg.includes('email-already-in-use') || msg.includes('email-already-exists')) {
          displayError = 'The email address is already registered to another user account.';
        } else if (msg.includes('invalid-email')) {
          displayError = 'The email address format is invalid. Please check your spelling and try again.';
        } else if (msg.includes('weak-password')) {
          displayError = 'The selected security password is too weak. Please ensure it has a minimum of 8 characters, an uppercase letter, and a number.';
        }
        
        setBError(displayError);
        return false;
      }

      // Sync and Save
      const updated = [...allUsers, newAdminUser];
      await saveUserProfiles(updated);

      // Populate passwords hash mock
      const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
      passwords[newAdminUser.email.toLowerCase()] = bPassword;
      localStorage.setItem('jdn_passwords', JSON.stringify(passwords));

      return true;
    };

    const isOnlineMode = getNetworkStatus();
    if (!isOnlineMode) {
      // offline creation queues details
      try {
        await addToSyncQueue('profile', newAdminUser.id, 'create', {
          profile: newAdminUser,
          password: bPassword
        });
        setBSuccess('Offline Notice: Admin-creation queued locally. Share details out-of-band.');
        setBFullName('');
        setBEmail('');
        setBPhone('+263');
        setBPassword('');
        setBBranchName('');
        setBLevel(JdnLevel.TABHERA);
        setTimeout(() => {
          setIsPathBOpen(false);
          setBSuccess(null);
          loadSettingsData();
        }, 3000);
      } catch (err) {
        setBError('Failed queuing profile details.');
      }
    } else {
      // Online Flow
      const succeeded = await runCreation();
      if (succeeded) {
        setBSuccess('Account created successfully! Credentials recorded. You can now share details out-of-band.');
        setBFullName('');
        setBEmail('');
        setBPhone('+263');
        setBPassword('');
        setBBranchName('');
        setBLevel(JdnLevel.TABHERA);
        setTimeout(() => {
          setIsPathBOpen(false);
          setBSuccess(null);
          loadSettingsData();
        }, 3000);
      }
    }
  };

  // Proceed with deactivation & data reassignment
  // Full Code Deactivation & Permanent Delete
  const handleFullDeleteUser = async (userId: string) => {
    if (!window.confirm("CRITICAL WARNING: Are you sure you want to PERMANENTLY delete this user? This removes them from the database immediately.")) return;
    
    const remainingUsers = users.filter(u => u.id !== userId);
    const remainingAllProfiles = allUserProfiles.filter(p => p.id !== userId);
    
    setUsers(remainingUsers);
    setAllUserProfiles(remainingAllProfiles);
    await saveUserProfiles(remainingAllProfiles);
    toast.success('User permanently deleted from database.');
  };

  const getSubordinateTabheraAndUserIds = () => {
    if (targetChurchFilter === 'ALL') return null;
    
    // Find all user profiles that belong to the targeted church (by branchName)
    const targetProfiles = allUserProfiles.filter(u => u.branchName === targetChurchFilter);
    const profileIds = new Set(targetProfiles.map(u => u.id));
    
    // Find all level codes/tabhera codes created/managed by these users
    const levelCodes = new Set<string>();
    targetProfiles.forEach(u => {
      levelCodes.add(u.levelCode);
      if (u.parentCode) {
        levelCodes.add(u.parentCode);
      }
    });
    
    return { profileIds, levelCodes };
  };

  const handleExportBackup = async () => {
    try {
      const localforage = (await import('localforage')).default;

      const keys = await localforage.keys();
      const targets = getSubordinateTabheraAndUserIds();
      const backup: Record<string, any> = {};
      
      for (const k of keys) {
        const item = await localforage.getItem(k);
        if (targets && Array.isArray(item)) {
          if (k.includes('user_profiles')) {
            backup[k] = item.filter((u: any) => targets.profileIds.has(u.id));
          } else if (k.includes('members')) {
            backup[k] = item.filter((m: any) => targets.levelCodes.has(m.tabheraCode));
          } else if (k.includes('contributions') || k.includes('payment')) {
            backup[k] = item.filter((c: any) => 
              targets.profileIds.has(c.recordedByUserId) || 
              targets.levelCodes.has(c.hierarchyPath) ||
              targets.levelCodes.has(c.levelCode)
            );
          } else if (k.includes('level_codes')) {
            backup[k] = item.filter((c: any) => targets.profileIds.has(c.createdBy));
          } else {
            backup[k] = item;
          }
        } else {
          backup[k] = item;
        }
      }

      const fileLabel = targetChurchFilter === 'ALL' ? 'System_All_Churches' : targetChurchFilter.replace(/\s+/g, '_');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `JDN_Backup_${fileLabel}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success(targetChurchFilter === 'ALL' ? 'Full System Backup Exported' : `Church Backup for "${targetChurchFilter}" Exported Successfully`);
    } catch (e) {
      toast.error('Failed to export backup');
    }
  };

  const handleExportExcel = async () => {
    try {
      const localforage = (await import('localforage')).default;
      
      const keys = await localforage.keys();
      const targets = getSubordinateTabheraAndUserIds();
      let csvContent = "";
      
      for (const k of keys) {
        let data = await localforage.getItem(k);
        if (Array.isArray(data)) {
          if (targets) {
            if (k.includes('user_profiles')) {
              data = data.filter((u: any) => targets.profileIds.has(u.id));
            } else if (k.includes('members')) {
              data = data.filter((m: any) => targets.levelCodes.has(m.tabheraCode));
            } else if (k.includes('contributions') || k.includes('payment')) {
              data = data.filter((c: any) => 
                targets.profileIds.has(c.recordedByUserId) || 
                targets.levelCodes.has(c.hierarchyPath) ||
                targets.levelCodes.has(c.levelCode)
              );
            } else if (k.includes('level_codes')) {
              data = data.filter((c: any) => targets.profileIds.has(c.createdBy));
            }
          }

          csvContent += `\n=== DATABASE COLLECTION: ${k.toUpperCase()} ===\n`;
          if (data.length > 0) {
            const headers = Object.keys(data[0]);
            csvContent += headers.join(",") + "\n";
            for (const item of data) {
              const row = headers.map(h => {
                const val = item[h];
                if (val === null || val === undefined) return "";
                const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
                return `"${str.replace(/'/g, "''").replace(/"/g, '""')}"`;
              });
              csvContent += row.join(",") + "\n";
            }
          } else {
            csvContent += "No records found\n";
          }
        }
      }
      
      const fileLabel = targetChurchFilter === 'ALL' ? 'System_All_Churches' : targetChurchFilter.replace(/\s+/g, '_');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `JDN_Spreadsheet_Backup_${fileLabel}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(targetChurchFilter === 'ALL' ? 'System Spreadsheet Backup Downloaded' : `Spreadsheet Backup for "${targetChurchFilter}" Downloaded`);
    } catch (err: any) {
      toast.error('Failed to export Excel spreadsheet: ' + err.message);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        const localforage = (await import('localforage')).default;
        
        const isTargeted = targetChurchFilter !== 'ALL';
        if (!isTargeted) {
          await localforage.clear();
          for (const k in json) {
            await localforage.setItem(k, json[k]);
          }
          toast.success('System Restored Successfully! Reloading module...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          const targets = getSubordinateTabheraAndUserIds();
          if (!targets) {
            toast.error('Could not map targeted church boundaries.');
            return;
          }
          
          for (const k in json) {
            const importedList = json[k];
            if (Array.isArray(importedList)) {
              const currentList = (await localforage.getItem(k)) || [];
              let filteredImport = importedList;
              
              if (k.includes('user_profiles')) {
                filteredImport = importedList.filter((u: any) => u.branchName === targetChurchFilter);
              } else if (k.includes('members')) {
                filteredImport = importedList.filter((m: any) => targets.levelCodes.has(m.tabheraCode));
              } else if (k.includes('contributions') || k.includes('payment')) {
                filteredImport = importedList.filter((c: any) => 
                  targets.levelCodes.has(c.hierarchyPath) || 
                  targets.levelCodes.has(c.levelCode)
                );
              } else if (k.includes('level_codes')) {
                filteredImport = importedList.filter((c: any) => c.branchName === targetChurchFilter);
              }
              
              const importedIds = new Set(filteredImport.map((x: any) => x.id || x.memberId || x.codeId || x.contributionId));
              const cleanedCurrentList = currentList.filter((x: any) => !importedIds.has(x.id || x.memberId || x.codeId || x.contributionId));
              
              const merged = [...cleanedCurrentList, ...filteredImport];
              await localforage.setItem(k, merged);
            }
          }
          await loadSettingsData();
          toast.success(`Successfully imported and merged database backup for: ${targetChurchFilter}`);
        }
      } catch (err) {
        toast.error('Failed processing backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleResetSystemData = async () => {
    const isTargeted = targetChurchFilter !== 'ALL';
      
    try {
      const localforage = (await import('localforage')).default;
      
      if (!isTargeted) {
        await localforage.clear();
        localStorage.clear();
        window.location.reload();
      } else {
        const targets = getSubordinateTabheraAndUserIds();
        if (!targets) return;
        
        const keys = await localforage.keys();
        for (const k of keys) {
          const item = await localforage.getItem(k);
          if (Array.isArray(item)) {
            let updated: any[] = [];
            if (k.includes('user_profiles')) {
              updated = item.filter((u: any) => !targets.profileIds.has(u.id));
            } else if (k.includes('members')) {
              updated = item.filter((m: any) => !targets.levelCodes.has(m.tabheraCode));
            } else if (k.includes('contributions') || k.includes('payment')) {
              updated = item.filter((c: any) => 
                !targets.profileIds.has(c.recordedByUserId) && 
                !targets.levelCodes.has(c.hierarchyPath) &&
                !targets.levelCodes.has(c.levelCode)
              );
            } else if (k.includes('level_codes')) {
              updated = item.filter((c: any) => !targets.profileIds.has(c.createdBy));
            } else {
              updated = item;
            }
            await localforage.setItem(k, updated);
          }
        }
        await loadSettingsData();
        toast.success(`Successfully cleared all database records for: ${targetChurchFilter}`);
      }
    } catch (err: any) {
      toast.error('Failed to reset system data: ' + err.message);
    }
  };

  const handleDeactivate = async () => {
    setDeactError(null);
    if (!targetDeactUser) return;
    if (!replacementUserId) {
      setDeactError('A replacement user of the same level and branch must be chosen.');
      return;
    }

    const res = await deactivateUserAndReassignData(targetDeactUser.id, replacementUserId, currentUser.id);
    if (res.success) {
      toast.success(`User ${targetDeactUser.fullName} has been deactivated and all data reassigned.`);
      setIsDeactOpen(false);
      setTargetDeactUser(null);
      setReplacementUserId('');
      await loadSettingsData();
      onRefreshSession(); // refresh main context if deactivated self or sibling
    } else {
      setDeactError(res.error || 'Deactivation process error.');
    }
  };

  // Storage metrics calculation details
  const storageLimitSafariBytes = 50 * 1024 * 1024; // Safari 50MB budget limit
  const storageUsagePercentage = (storageUsageBytes / storageLimitSafariBytes) * 100;
  const isHighCapacity = storageUsagePercentage > 8.0; // Warnings threshold (e.g. mock high-test trigger)

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('The new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('The typed passwords do not match.');
      return;
    }

    try {
      const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
      const userEmail = currentUser.email.toLowerCase();
      
      const storedPass = passwords[userEmail];
      if (storedPass && storedPass !== currentPassword) {
        toast.error('The current password you entered is incorrect.');
        return;
      }

      passwords[userEmail] = newPassword;
      localStorage.setItem('jdn_passwords', JSON.stringify(passwords));

      const usersList = JSON.parse(localStorage.getItem('jdn_user_profiles_v18') || '[]');
      const updatedUsers = usersList.map((u: any) => {
        if (u.id === currentUser.id) {
          return { ...u, forcedPasswordChange: false };
        }
        return u;
      });
      localStorage.setItem('jdn_user_profiles_v18', JSON.stringify(updatedUsers));

      await addToSyncQueue('password_change', currentUser.id, 'update', {
        email: currentUser.email,
        newPassword
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Your password has been successfully updated.');
    } catch (err: any) {
      toast.error('Failed to change password: ' + err.message);
    }
  };

  const filteredUsersForPagination = users.filter(u => 
    u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    (resolveBranchName(u.levelCode, allUserProfiles) || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  );
  const paginatedUsers = filteredUsersForPagination.slice(userPage * 7, (userPage + 1) * 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] tracking-tight">System Settings & Administration</h1>
        <p className="text-sm text-[#6B7280]">
          Manage codes generation, administrative credentials, synchronized offline events, and storage backups.
        </p>
      </div>

      {/* Account Info and Developer Credits */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-4 items-center">
          <div className="h-20 w-20 relative rounded-xl overflow-hidden shadow border-2 border-white flex-shrink-0 group">
             <img src={currentUser.profilePhoto || "/jdnlogo.jpeg"} alt="Profile" className="w-full h-full object-cover" />
             <label className="absolute inset-x-0 bottom-0 top-0 bg-black/50 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-center px-1">
               Upload Photo
               <input 
                 type="file" 
                 accept="image/*" 
                 className="hidden" 
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) {
                     const r = new FileReader();
                     r.onloadend = async () => {
                        const img = new window.Image();
                        img.onload = async () => {
                           const canvas = document.createElement('canvas');
                           const MAX_WIDTH = 120; // Drastically downscale resolution for 500% size reduction
                           let scaleSize = 1;
                           if (img.width > MAX_WIDTH) { scaleSize = MAX_WIDTH / img.width; }
                           canvas.width = img.width * scaleSize;
                           canvas.height = img.height * scaleSize;
                           const ctx = canvas.getContext('2d');
                           if (ctx) {
                             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                             const compressed = canvas.toDataURL('image/jpeg', 0.4); // 0.4 Quality factor reduces file footprint by over 500%
                             const updatedUser = { ...currentUser, profilePhoto: compressed };
                             await saveUserProfiles(allUserProfiles.map(p => p.id === currentUser.id ? updatedUser : p));
                             toast.success('Profile photo updated. Refresh page if needed.');
                             onRefreshSession();
                           }
                        };
                        img.src = r.result as string;
                     };
                     r.readAsDataURL(f);
                   }
                 }} 
               />
             </label>
          </div>
          <div className="w-full">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-[#166534]" /> My Account Details
              </h2>
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="text-xs font-bold text-[#166534] hover:underline cursor-pointer flex items-center gap-1"
              >
                {isEditingProfile ? 'Cancel' : 'Edit Details'}
              </button>
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-3 max-w-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1">Full Name</label>
                    <input
                      type="text"
                      className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1">Phone Number</label>
                    <input
                      type="text"
                      className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1">National ID</label>
                    <input
                      type="text"
                      className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-[#166534]"
                      value={profileNationalId}
                      onChange={(e) => setProfileNationalId(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-[#166534] hover:bg-[#166534]/90 text-white font-bold text-[#fefefe] text-xs px-4 py-2 rounded-lg cursor-pointer transition-all border border-[#166534]"
                >
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-700 min-w-[280px]">
                <div><span className="font-semibold uppercase text-[10px] text-gray-500 block">Name</span> {currentUser.fullName}</div>
                <div><span className="font-semibold uppercase text-[10px] text-gray-500 block">Level</span> {currentUser.level}</div>
                <div>
                  <span className="font-semibold uppercase text-[10px] text-gray-500 block">Level Code / ID</span> 
                  <span className="font-mono bg-gray-100 text-[#1D4ED8] px-1.5 py-0.5 rounded font-bold border border-gray-200 mt-0.5 inline-block">{currentUser.levelCode}</span>
                </div>
                <div><span className="font-semibold uppercase text-[10px] text-gray-500 block">Email</span> {currentUser.email}</div>
                {currentUser.phoneNumber && (
                  <div><span className="font-semibold uppercase text-[10px] text-gray-500 block">Phone</span> {currentUser.phoneNumber}</div>
                )}
                {currentUser.nationalId && (
                  <div><span className="font-semibold uppercase text-[10px] text-gray-500 block">National ID</span> {currentUser.nationalId}</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center sm:text-right flex-shrink-0">
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">Developer & Support</p>
          <a href="https://wmtech.co.zw" target="_blank" rel="noreferrer" className="text-[#166534] font-bold text-sm hover:underline flex items-center justify-center sm:justify-end gap-1.5">
             WeKwaMashie Technologies <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="text-[10px] text-gray-500 mt-1">Need help? Contact support via wmtech.co.zw</p>
        </div>
      </div>

      {/* Change Password Form (All Users Change Passwords) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5">
          <KeyRound className="h-4.5 w-4.5 text-[#166534]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
            Change Your Password
          </h3>
        </div>
        <form onSubmit={handleChangeOwnPassword} className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Current Password</label>
            <input
              type="password"
              required
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534] bg-gray-50 focus:bg-white"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">New Password (min 6 char)</label>
            <input
              type="password"
              required
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534] bg-gray-50 focus:bg-white"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534] bg-gray-50 focus:bg-white"
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="bg-[#166534] hover:bg-[#115e2e] text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer h-[38px] self-end shrink-0"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>



      {/* Global Branding & Settings (Jerusalem or System Only) */}
      {(currentUser.level === JdnLevel.JERUSALEM || currentUser.level === JdnLevel.SYSTEM) && jdnSettings && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1">
              <ImageIcon className="h-4 w-4" /> Global Organization Branding
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Organization / Church Name</label>
                  <input
                    type="text"
                    className="w-full text-xs font-bold text-gray-800 p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534]"
                    value={jdnSettings.churchName || ''}
                    onChange={e => setJdnSettings({ ...jdnSettings, churchName: e.target.value })}
                  />
               </div>
               <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Logo Image URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 text-xs font-mono p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534]"
                      value={jdnSettings.churchLogoUrl || ''}
                      onChange={e => setJdnSettings({ ...jdnSettings, churchLogoUrl: e.target.value })}
                      placeholder="https://..."
                    />
                    <button className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-200 flex items-center justify-center relative cursor-pointer" title="Upload Logo">
                      <ImageIcon className="h-4 w-4" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const r = new FileReader();
                            r.onloadend = () => setJdnSettings({ ...jdnSettings, churchLogoUrl: r.result as string });
                            r.readAsDataURL(f);
                          }
                        }} 
                      />
                    </button>
                  </div>
               </div>
               <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Portal Background Image URL / File</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 text-xs font-mono p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534]"
                      value={jdnSettings.churchBackgroundUrl || ''}
                      onChange={e => setJdnSettings({ ...jdnSettings, churchBackgroundUrl: e.target.value })}
                      placeholder="https://..."
                    />
                    <button className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-200 flex items-center justify-center relative cursor-pointer" title="Upload Background Image">
                      <ImageIcon className="h-4 w-4" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const r = new FileReader();
                            r.onloadend = () => setJdnSettings({ ...jdnSettings, churchBackgroundUrl: r.result as string });
                            r.readAsDataURL(f);
                          }
                        }} 
                      />
                    </button>
                    {jdnSettings.churchBackgroundUrl && (
                      <button 
                        type="button"
                        onClick={() => setJdnSettings({ ...jdnSettings, churchBackgroundUrl: undefined })}
                        className="px-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
               </div>
               <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Address / Headquarters</label>
                  <input
                    type="text"
                    className="w-full text-xs text-gray-800 p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534]"
                    value={jdnSettings.churchAddress || ''}
                    onChange={e => setJdnSettings({ ...jdnSettings, churchAddress: e.target.value })}
                  />
               </div>
               <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Contact Details</label>
                  <input
                    type="text"
                    className="w-full text-xs text-gray-800 p-2.5 border border-gray-200 rounded-lg focus:outline-[#166534]"
                    value={jdnSettings.churchContact || ''}
                    onChange={e => setJdnSettings({ ...jdnSettings, churchContact: e.target.value })}
                  />
               </div>
            </div>

            {/* Currency Manager Block ( Jerusalem admin is able to set all globally supported currencies ) */}
            <div className="border-t border-gray-200/60 pt-5 mt-3 space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-extrabold text-gray-600 tracking-wider mb-1 flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-[#166534]" /> Globally Supported Currencies
                </label>
                <p className="text-[10px] text-gray-400 font-sans">
                  Configure the list of officially supported currencies across all branches. Standard and Special Murairo (Ungano) forms will automatically offer selection from these presets.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {(jdnSettings.globalCurrencies || ['USD', 'ZWG', 'ZAR']).map((curr) => (
                  <span 
                    key={curr} 
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#166534] border border-[#166534]/20 rounded-full text-xs font-extrabold uppercase tracking-wide font-mono"
                  >
                    {curr}
                    <button
                      type="button"
                      onClick={() => {
                        const currentList = jdnSettings.globalCurrencies || ['USD', 'ZWG', 'ZAR'];
                        const updated = currentList.filter(c => c !== curr);
                        if (updated.length === 0) {
                          toast.error('At least one global currency must remain configured.');
                          return;
                        }
                        setJdnSettings({ ...jdnSettings, globalCurrencies: updated });
                      }}
                      className="text-[#166534]/60 hover:text-red-650 transition-colors font-extrabold text-xs cursor-pointer focus:outline-none"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex max-w-sm gap-2">
                <input
                  type="text"
                  placeholder="e.g. MWK, AUD"
                  maxLength={5}
                  className="flex-1 p-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-[#166534] uppercase text-gray-800"
                  value={newGlobalCurrencyInput}
                  onChange={(e) => setNewGlobalCurrencyInput(e.target.value.toUpperCase())}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = newGlobalCurrencyInput.trim().toUpperCase();
                      if (val) {
                        const currentList = jdnSettings.globalCurrencies || ['USD', 'ZWG', 'ZAR'];
                        if (!currentList.includes(val)) {
                          const updated = [...currentList, val];
                          setJdnSettings({ ...jdnSettings, globalCurrencies: updated });
                          setNewGlobalCurrencyInput('');
                        } else {
                          toast.error('Currency already configured.');
                        }
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = newGlobalCurrencyInput.trim().toUpperCase();
                    if (val) {
                      const currentList = jdnSettings.globalCurrencies || ['USD', 'ZWG', 'ZAR'];
                      if (!currentList.includes(val)) {
                        const updated = [...currentList, val];
                        setJdnSettings({ ...jdnSettings, globalCurrencies: updated });
                        setNewGlobalCurrencyInput('');
                      } else {
                        toast.error('Currency already configured.');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Add Currency
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
               <button 
                 onClick={() => handleSaveSettings(jdnSettings)}
                 className="bg-[#166534] hover:bg-[#14532D] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors"
               >
                 Save Global Configurations & Branding
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Path B and Users Administration (Visible to Admins) */}
      {true && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1">
              <Users className="h-4 w-4" /> Unit User Accounts (Hierarchy branch)
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full sm:w-auto">
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <div className="relative">
                  <FolderSearch className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Users..."
                    value={userSearchQuery}
                    onChange={(e) => { setUserSearchQuery(e.target.value); setUserPage(0); }}
                    className="pl-8 pr-3 py-1.5 border border-gray-200 bg-white rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#166534] w-full sm:w-60 shadow-xs"
                  />
                </div>
                {/* Dynamically display fields being searched */}
                <div className="flex items-center gap-1 text-[9px] text-gray-500 font-sans mt-0.5 flex-wrap">
                  <span className="font-bold uppercase tracking-wider text-gray-400">Searching:</span>
                  <span className={`px-1.5 py-0.2 rounded ${userSearchQuery && users.some(u => u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-bold' : 'bg-gray-100'}`}>Full Name</span>
                  <span className={`px-1.5 py-0.2 rounded ${userSearchQuery && users.some(u => u.email.toLowerCase().includes(userSearchQuery.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-bold' : 'bg-gray-100'}`}>Admin Email</span>
                  <span className={`px-1.5 py-0.2 rounded ${userSearchQuery && users.some(u => (resolveBranchName(u.levelCode, allUserProfiles) || '').toLowerCase().includes(userSearchQuery.toLowerCase())) ? 'bg-emerald-100 text-[#166534] font-bold' : 'bg-gray-100'}`}>Branch Name</span>
                </div>
              </div>
              <button
                onClick={() => setIsPathBOpen(true)}
                className="bg-[#166534] hover:bg-[#166534]/90 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite / Add User
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-bold uppercase text-[#6B7280] border-b border-gray-100">
                  <th className="py-3 px-4">Full Name / Email</th>
                  <th className="py-3 px-4">Access Level</th>
                  <th className="py-3 px-4">Branch Name</th>
                  <th className="py-3 px-4">Registered Unit</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Delete / Reassign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {paginatedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        <HighlightText text={u.fullName} search={userSearchQuery} />
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        <HighlightText text={u.email} search={userSearchQuery} />
                      </div>
                      {/* Interactive Field Matched Indicator */}
                      {userSearchQuery && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) && (
                            <span className="text-[8px] bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Matched: Name</span>
                          )}
                          {u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) && (
                            <span className="text-[8px] bg-indigo-50 text-[#3730a3] border border-indigo-200 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Matched: Email</span>
                          )}
                          {(resolveBranchName(u.levelCode, allUserProfiles) || '').toLowerCase().includes(userSearchQuery.toLowerCase()) && (
                            <span className="text-[8px] bg-purple-50 text-indigo-900 border border-purple-200 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Matched: Branch</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 group">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] text-xs font-semibold border border-blue-100">
                          {u.level}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500 font-mono">{u.role || getRoleTitleForLevel(u.level)}</span>
                          {(currentUser.level === JdnLevel.SYSTEM || LEVEL_HIERARCHY_ORDER.indexOf(currentUser.level) < LEVEL_HIERARCHY_ORDER.indexOf(u.level)) && (
                            <button
                              onClick={() => {
                                const newRole = window.prompt("Enter new Church Role for " + u.fullName, u.role || getRoleTitleForLevel(u.level));
                                if (newRole && newRole.trim()) {
                                  const updated = users.map(user => user.id === u.id ? { ...user, role: newRole.trim() } : user);
                                  setUsers(updated);
                                  saveUserProfiles(allUserProfiles.map(p => p.id === u.id ? { ...p, role: newRole.trim() } : p));
                                }
                              }}
                              className="px-1 py-0.5 text-[8px] bg-gray-100 text-gray-500 rounded hover:bg-blue-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                              EDIT ROLE
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#166534] text-xs uppercase tracking-wider group">
                      <HighlightText text={resolveBranchName(u.levelCode, allUserProfiles) || 'HQ / Jerusalem'} search={userSearchQuery} />
                      {currentUser.level === JdnLevel.JERUSALEM && (
                        <button 
                          onClick={() => {
                            const newBranch = window.prompt("Enter new Branch Name for " + u.fullName, resolveBranchName(u.levelCode, allUserProfiles) || '');
                            if (newBranch && newBranch.trim()) {
                               const updated = users.map(user => user.id === u.id ? { ...user, branchName: newBranch.trim() } : user);
                               setUsers(updated);
                               saveUserProfiles(allUserProfiles.map(p => p.id === u.id ? { ...p, branchName: newBranch.trim() } : p));
                            }
                          }}
                          className="px-1.5 ml-2 py-0.5 text-[9px] bg-gray-100 text-gray-600 rounded hover:bg-[#166534] hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        >
                          EDIT
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-700">{u.levelCode.split('/').pop()}</td>
                    <td className="py-3 px-4">
                      {u.isActive ? (
                        <span className="text-green-600 text-xs font-bold">Active</span>
                      ) : (
                        <div className="text-xs text-red-500 space-y-0.5">
                          <span className="font-bold">Deactivated</span>
                          <div className="text-[10px] text-gray-400">Soft delete</div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1.5 justify-end items-center flex-wrap">
                        {u.isActive && (currentUser.level === JdnLevel.SYSTEM || LEVEL_HIERARCHY_ORDER.indexOf(currentUser.level) < LEVEL_HIERARCHY_ORDER.indexOf(u.level)) && (
                          <button
                            onClick={() => {
                              setResetTargetUser(u);
                              setResetPasswordValue('');
                              setResetError(null);
                              setResetSuccess(null);
                              setIsResetOpen(true);
                            }}
                            className="bg-white hover:bg-gray-50 text-blue-700 font-bold text-xs px-2.5 py-1 border border-gray-200 rounded transition-colors cursor-pointer"
                          >
                            Reset Pass
                          </button>
                        )}

                        {u.isActive && u.id !== currentUser.id ? (
                          <div className="flex flex-col gap-1 items-end">
                            <button
                              onClick={() => {
                                setTargetDeactUser(u);
                                setReplacementUserId('');
                                setDeactError(null);
                                setIsDeactOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs border border-red-200 text-[#DC2626] font-bold hover:bg-red-50 rounded transition-colors cursor-pointer"
                            >
                              Deactivate
                            </button>
                            {(currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM) && (
                               <button 
                                 onClick={() => handleFullDeleteUser(u.id)}
                                 className="px-2.5 py-1 text-[10px] bg-red-600 text-white font-bold hover:bg-red-700 rounded transition-colors cursor-pointer"
                               >
                                 Perm. Delete
                               </button>
                            )}
                          </div>
                        ) : u.id === currentUser.id ? (
                          <span className="text-xs text-[#166534] font-bold">Your Account</span>
                        ) : (
                          <span className="text-xs text-[#6B7280] italic">Managed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          <div className="p-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 text-xs text-gray-600">
            <div>
              Showing {userPage * 7 + 1} to {Math.min((userPage + 1) * 7, filteredUsersForPagination.length)} of {filteredUsersForPagination.length} entries
            </div>
            <div className="flex gap-1">
              <button
                disabled={userPage === 0}
                onClick={() => setUserPage(p => p - 1)}
                className="px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={(userPage + 1) * 7 >= filteredUsersForPagination.length}
                onClick={() => setUserPage(p => p + 1)}
                className="px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Generator Panel (All Admins) */}
      {true && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 gap-2">
            <div>
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <Key className="h-4.5 w-4.5 text-[#166534]" /> Manage Invitation Codes
              </h3>
              <p className="text-xs text-gray-500">Generating codes links newcomer self-registrations to child administrative units.</p>
            </div>
            <button
              onClick={exportCodesCSV}
              className="border border-[#166534] text-[#166534] hover:bg-green-50 font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <Download className="h-3.5 w-3.5" /> CSV Bulk Export
            </button>
          </div>

          {/* Generator form */}
          <form onSubmit={handleGenerateCode} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Code Value</label>
              <input
                type="text"
                required
                value={newCodeValue}
                onChange={(e) => setNewCodeValue(e.target.value)}
                placeholder="e.g. HRE-INV-DIS"
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white uppercase font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
            </div>

            {currentUser.level !== JdnLevel.TABHERA && (
              <div className="col-span-full mb-3 border-b border-gray-100 pb-3">
                 <label className="block text-[10px] font-bold uppercase text-gray-600 mb-2">Invitation Type</label>
                 <div className="flex gap-4">
                   <label className="flex items-center gap-2 text-xs font-semibold">
                     <input 
                       type="radio" 
                       className="text-[#166534] focus:ring-[#166534]"
                       checked={inviteType === 'child'} 
                       onChange={() => setInviteType('child')} 
                     />
                     Create Subordinate Branch (Child)
                   </label>
                   <label className="flex items-center gap-2 text-xs font-semibold">
                     <input 
                       type="radio" 
                       className="text-[#D97706] focus:ring-[#D97706]"
                       checked={inviteType === 'coworker'} 
                       onChange={() => setInviteType('coworker')} 
                     />
                     Invite Co-worker (Same Unit)
                   </label>
                 </div>
              </div>
            )}

            {inviteType === 'child' && (
              <>
                 <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Scope Grant Level</label>
                  <select
                    value={newCodeScope}
                    onChange={(e) => setNewCodeScope(e.target.value as JdnLevel)}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-[#166534]"
                  >
                    {/* Dynamic scopes based on active hierarchy elements */}
                    {allowedChildLevels.map(lvl => (
                        <option key={lvl} value={lvl}>
                          {hierarchyNames[lvl] || lvl} Level
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Branch Name</label>
                  <input
                    type="text"
                    required={inviteType === 'child'}
                    list="existing-branches-list"
                    value={newCodeBranch}
                    onChange={(e) => setNewCodeBranch(e.target.value)}
                    placeholder="e.g. Select or type New Tabhera"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
                  />
                  <datalist id="existing-branches-list">
                     {Array.from(new Set(codes.filter(c => c.levelScope === newCodeScope).map(c => c.branchName))).map(name => (
                        <option key={name} value={name} />
                     ))}
                  </datalist>
                </div>
              </>
            )}

            <button
              type="submit"
              className={`bg-[#166534] hover:bg-[#166534]/95 text-white font-bold text-xs py-1.5 rounded self-end cursor-pointer shadow-sm min-h-[32px] ${inviteType === 'child' ? '' : 'col-span-full'}`}
            >
              Generate Code
            </button>
          </form>

          {/* Active Codes Grid */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left font-sans text-xs">
              <thead className="bg-[#F9FAFB] border-b border-gray-100 font-bold uppercase text-[#6B7280]">
                <tr>
                  <th className="py-2.5 px-3">Code Value</th>
                  <th className="py-2.5 px-3">Grants Scope</th>
                  <th className="py-2.5 px-3">Target Unit</th>
                  <th className="py-2.5 px-3">Utilized</th>
                  <th className="py-2.5 px-3">Expires</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3 text-right">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.map(c => (
                  <tr key={c.codeId} className="hover:bg-gray-50/50">
                    <td className="py-2 px-3 font-mono font-bold text-[#111827]">{c.codeValue}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] text-[10px] font-semibold border border-blue-100">{c.levelScope}</span>
                    </td>
                    <td className="py-2 px-3 text-[#111827]">
                      {c.branchName}
                      {c.exactUnitCode && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#D97706]/10 text-[#D97706] text-[9px] font-bold tracking-wider uppercase border border-[#D97706]/20">Co-Worker</span>}
                    </td>
                    <td className="py-2 px-3 font-mono text-[#6B7280]">{c.useCount} times</td>
                    <td className="py-2 px-3 text-[#6B7280]">{c.expiryDate.split('T')[0]}</td>
                    <td className="py-2 px-3">
                      <span className={`font-bold ${c.isActive ? 'text-green-600' : 'text-red-500'}`}>{c.isActive ? 'Active' : 'Deactivated'}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => toggleCodeStatus(c.codeId)}
                        className={`text-[10px] font-bold p-1 px-2 border rounded cursor-pointer transition-all ${c.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                      >
                        {c.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Custom Hierarchy Levels setup (System Admins only) */}
      {currentUser.level === JdnLevel.SYSTEM && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm space-y-4 p-5">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <Layers className="h-4.5 w-4.5 text-[#166534]" /> Manage System Hierarchy Levels
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              System Admin console for creating custom roles and hierarchy levels in Jerusalem Digital Network.
            </p>
          </div>

          <form onSubmit={handleAddCustomLevel} className="flex gap-2 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">New Custom Hierarchy Level Name</label>
              <input
                type="text"
                required
                value={newLevelInput}
                onChange={(e) => setNewLevelInput(e.target.value)}
                placeholder="e.g. Zone, Region, Department etc."
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
              />
            </div>
            <button
              type="submit"
              className="bg-[#166534] hover:bg-[#166534]/95 text-white font-bold text-xs px-4 py-1.5 rounded self-end cursor-pointer shadow-sm min-h-[32px] transition-colors"
            >
              Add Hierarchy Level
            </button>
          </form>

          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Configure Core Levels</h4>
            <div className="space-y-2">
              {hierarchyOrder.map((lvl, index) => (
                <div key={lvl} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                  <div className="flex flex-col gap-0.5 mr-1 border-r border-gray-200 pr-2">
                    <button type="button" onClick={() => handleMoveLevelOrder(index, 'up')} disabled={index === 0} className={`text-gray-400 hover:text-gray-700 ${index === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}>▲</button>
                    <button type="button" onClick={() => handleMoveLevelOrder(index, 'down')} disabled={index === hierarchyOrder.length - 1} className={`text-gray-400 hover:text-gray-700 ${index === hierarchyOrder.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}>▼</button>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded uppercase">{lvl}</span>
                  <input
                    type="text"
                    value={editingLevelMap[lvl] ?? hierarchyNames[lvl]}
                    onChange={(e) => setEditingLevelMap({ ...editingLevelMap, [lvl]: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded object-contain bg-white font-semibold"
                  />
                  <button 
                    onClick={() => handleSaveRenameLevel(lvl)}
                    className="bg-[#166534] hover:bg-[#166534]/90 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded cursor-pointer transition-colors"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => handleDeleteHierarchyLevel(lvl)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded cursor-pointer transition-colors border border-red-200"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 mt-6">Additional Metadata Tags (Legacy Custom)</h4>
            <div className="flex flex-wrap gap-2">
              {/* Custom levels */}
              {customLevels.map(lvl => (
                <span key={lvl} className="px-2.5 py-1 rounded bg-green-50 border border-green-200 text-xs font-semibold text-green-700 flex items-center gap-1 shadow-sm">
                  ✨ {lvl} (Custom)
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomLevel(lvl)}
                    className="text-[#DC2626] hover:text-black focus:outline-none font-bold text-sm ml-1"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced System Operations (Jerusalem / System only) for Database backup/restore */}
      {(currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM) && (
        <div className="bg-white rounded-xl border border-rose-200 overflow-hidden shadow-sm space-y-4 p-5 mt-6">
          <div className="border-b border-rose-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
                <ShieldAlert className="h-4.5 w-4.5 text-rose-600" /> Advanced Database Operations
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                Export system backups, restore environments, or perform full factory resets from the JSON/Excel datastores.
              </p>
            </div>
            
            {/* Targeted Church Selection dropdown */}
            <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 flex-shrink-0 self-start sm:self-auto">
              <span className="text-[10px] uppercase font-bold text-rose-905 block">Target Church:</span>
              <select 
                value={targetChurchFilter}
                onChange={e => setTargetChurchFilter(e.target.value)}
                className="text-xs font-bold text-rose-900 bg-white border border-rose-200 rounded px-2 py-1 max-w-[200px] outline-none"
              >
                <option value="ALL">-- ALL CHURCHES (Entire System) --</option>
                {Array.from(new Set(allUserProfiles.map(u => u.branchName).filter(Boolean))).map(church => (
                  <option key={church} value={church}>{church}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-lg flex flex-col items-start gap-2">
              <div className="font-bold text-xs uppercase text-rose-800">Export JSON Backup</div>
              <p className="text-[10px] text-gray-600 flex-1">
                {targetChurchFilter === 'ALL' 
                  ? 'Download the entire database state as a JSON file.' 
                  : `Download only records belonging to "${targetChurchFilter}" as JSON.`}
              </p>
              <button 
                onClick={handleExportBackup}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded text-xs transition-colors cursor-pointer"
              >
                Download (.json)
              </button>
            </div>

            <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-lg flex flex-col items-start gap-2">
              <div className="font-bold text-xs uppercase text-rose-800">Export Excel Backup</div>
              <p className="text-[10px] text-gray-600 flex-1">
                {targetChurchFilter === 'ALL' 
                  ? 'Download database tables inside an Excel-compatible spreadsheet (.csv).' 
                  : `Download database tables filtered for "${targetChurchFilter}" as Excel sheet.`}
              </p>
              <button 
                onClick={handleExportExcel}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2 rounded text-xs transition-colors cursor-pointer"
              >
                Download (.excel/.csv)
              </button>
            </div>
            
            <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-lg flex flex-col items-start gap-2">
              <div className="font-bold text-xs uppercase text-rose-800">Restore/Import Backup</div>
              <p className="text-[10px] text-gray-600 flex-1">
                {targetChurchFilter === 'ALL' 
                  ? 'Import a JSON backup to overwrite the entire system database.' 
                  : `Merge JSON records specifically for "${targetChurchFilter}" into database.`}
              </p>
              <label className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded text-xs transition-colors cursor-pointer text-center">
                Select Backup file
                <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
              </label>
            </div>
            
            <div className="bg-red-50 p-4 border border-red-200 rounded-lg flex flex-col items-start gap-2">
              <div className="font-bold text-xs uppercase text-red-800 font-mono">Clear/Reset Data</div>
              <p className="text-[10px] text-gray-600 flex-1">
                {targetChurchFilter === 'ALL' 
                  ? 'WARNING: Permanently deletes all system records.' 
                  : `WARNING: Permanently deletes all rows linked to "${targetChurchFilter}".`}
              </p>
              {showDeleteConfirm && (
                <div className="w-full">
                  <input
                    type="text"
                    placeholder={`Type '${targetChurchFilter === 'ALL' ? 'DELETE ALL' : 'DELETE ' + targetChurchFilter.toUpperCase()}'`}
                    className="w-full p-2 text-xs border border-red-300 rounded mb-2 font-mono uppercase bg-red-100 placeholder:text-red-300 placeholder:normal-case text-red-900"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                  />
                </div>
              )}
              <button 
                onClick={() => {
                  if (!showDeleteConfirm) {
                    setShowDeleteConfirm(true);
                    return;
                  }
                  
                  const targetStr = targetChurchFilter === 'ALL' ? 'DELETE ALL' : `DELETE ${targetChurchFilter.toUpperCase()}`;
                  if (deleteConfirmText === targetStr) {
                    handleResetSystemData();
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  } else {
                    toast.error(`Please type '${targetStr}' exactly to confirm deletion.`);
                  }
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-xs transition-colors cursor-pointer text-center"
              >
                {showDeleteConfirm ? 'CONFIRM AND RESET' : (targetChurchFilter === 'ALL' ? 'RESET WHOLE SYSTEM' : `RESET ${targetChurchFilter.toUpperCase()}`)}
              </button>
              {showDeleteConfirm && (
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} className="w-full bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2 rounded text-xs transition-colors cursor-pointer text-center">
                    CANCEL
                  </button>
              )}
            </div>

            <div className="bg-blue-50 p-4 border border-blue-200 rounded-lg flex flex-col items-start gap-2">
              <div className="font-bold text-xs uppercase text-blue-800 font-mono">Force Backfill to Cloud</div>
              <p className="text-[10px] text-gray-600 flex-1">
                If some records exist only locally, click this to upload all local records spanning your account scope to Firebase.
              </p>
              <button 
                disabled={isSyncingBulk}
                onClick={async () => {
                  if (!confirmSyncBulk) {
                    setConfirmSyncBulk(true);
                    setTimeout(() => setConfirmSyncBulk(false), 5000);
                    return;
                  }
                  try {
                    setIsSyncingBulk(true);
                    await forceBackfillToCloud();
                    toast.success("Successfully bulk pushed all data to cloud database.");
                    setConfirmSyncBulk(false);
                  } catch (err: any) {
                     toast.error("Failed to push to cloud. Ensure you have permissions. Error: " + err.message);
                  } finally {
                    setIsSyncingBulk(false);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
              >
                <Activity className={`h-3.5 w-3.5 ${isSyncingBulk ? 'animate-spin' : ''}`} /> 
                {isSyncingBulk ? 'Syncing...' : (confirmSyncBulk ? 'Click again to confirm' : 'Bulk Sync to Remote')}
              </button>
            </div>

          </div>
        </div>
      )}



      {/* Path B Modal Account addition (Admin creates account) */}
      {isPathBOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto animate-fade-in" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Add New Unit Administrator</h3>
              <button onClick={() => setIsPathBOpen(false)} className="text-gray-400 hover:text-black font-semibold text-xl cursor-pointer">&times;</button>
            </div>

            {bError && (
              <div className="p-3 bg-red-50 text-[#DC2626] border border-red-100 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" />
                <span>{bError}</span>
              </div>
            )}

            {bSuccess && (
              <div className="p-3 bg-green-50 text-[#16A34A] border border-green-100 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>{bSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePathBUserCreation} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Full Admin Name</label>
                <input
                  type="text"
                  required
                  value={bFullName}
                  onChange={(e) => setBFullName(e.target.value)}
                  placeholder="e.g. Timothy Mutendi"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Phone Number (E.164)</label>
                  <input
                    type="tel"
                    required
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                    placeholder="+263777123456"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={bEmail}
                    onChange={(e) => setBEmail(e.target.value)}
                    placeholder="name@church.org"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">National ID Number</label>
                  <input
                    type="text"
                    required
                    value={bNationalId}
                    onChange={(e) => setBNationalId(e.target.value)}
                    placeholder="63-987654-H-77"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Temporary Password</label>
                  <input
                    type="text"
                    required
                    value={bPassword}
                    onChange={(e) => setBPassword(e.target.value)}
                    placeholder="Enter security temp key"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Parent Level Code (Read-only)</label>
                  <input
                    type="text"
                    readOnly
                    value={currentUser.levelCode}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 focus:outline-none text-gray-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Target Account Level</label>
                  <select
                    value={bLevel}
                    onChange={(e) => setBLevel(e.target.value as JdnLevel)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  >
                    {allowedChildLevels.map(lvl => (
                        <option key={lvl} value={lvl}>
                          {hierarchyNames[lvl] || lvl}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Custom Role Title (Optional)</label>
                <input
                  type="text"
                  value={bRole}
                  onChange={(e) => setBRole(e.target.value)}
                  placeholder="e.g. Tabhera Assistant Secretary"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={bBranchName}
                  onChange={(e) => setBBranchName(e.target.value)}
                  placeholder="e.g. Chizhanje Tabhera"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPathBOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#166534] hover:bg-[#166534]/95 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm"
                >
                  Create Account instantly
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password override modal dialogue */}
      {isResetOpen && resetTargetUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-200 animate-fade-in" role="dialog" aria-modal="true" id="password-reset-modal">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Overriding Password: {resetTargetUser.fullName}</h3>
              <button
                onClick={() => { setIsResetOpen(false); setResetTargetUser(null); }}
                className="text-gray-400 hover:text-black font-semibold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#1D4ED8] font-semibold bg-blue-50 p-3 rounded-lg border border-blue-100 leading-normal mt-1">
              🔐 Overriding rules: This administrative pass-override will set a new temporary password for the level below. The user will be requested/forced to immediately select a new secure credentials credential key on next login.
            </p>

            {resetError && (
              <div className="p-3 bg-red-50 text-[#DC2626] border border-red-150 rounded text-xs mt-2">
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded text-xs mt-2 font-semibold">
                {resetSuccess}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4 pt-4 text-xs font-sans">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Account details</label>
                <div className="text-xs font-medium bg-gray-50 px-3 py-2 border rounded-lg text-gray-700 font-mono">
                  {resetTargetUser.fullName} ({resetTargetUser.email}) <br />
                  Level scope: {resetTargetUser.level} | {resetTargetUser.role}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">New temporary password Key <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Minimum 6 characters password"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 text-xs font-sans">
                <button
                  type="button"
                  onClick={() => { setIsResetOpen(false); setResetTargetUser(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Close panel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Override password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate & Reassign custom Dialog */}
      {isDeactOpen && targetDeactUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-gray-200 animate-fade-in" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 border-red-500">Deactivation Audit Transfer</h3>
              <button
                onClick={() => { setIsDeactOpen(false); setTargetDeactUser(null); }}
                className="text-gray-400 hover:text-black font-semibold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[#DC2626] font-semibold bg-red-50 p-3 rounded-lg border border-red-100 leading-normal">
              ⚠️ Strict Protocol Constraint: Deactivating a user must NOT delete their underlying church records. You must select an active replacement administrator at the same hierarchical division to reassign all logged members, contributions, and sessions correctly.
            </p>

            {deactError && (
              <div className="p-3 bg-red-50 text-[#DC2626] border border-red-150 rounded text-xs">
                {deactError}
              </div>
            )}

            <div className="space-y-4 pt-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600">User to de-register</label>
                <div className="text-sm font-semibold bg-gray-50 px-3 py-2 border rounded-lg text-gray-700">
                  {targetDeactUser.fullName} ({targetDeactUser.email})
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Select Replacement User <span className="text-red-500">*</span></label>
                <select
                  required
                  value={replacementUserId}
                  onChange={(e) => setReplacementUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Choose replacement leader --</option>
                  {/* Select users of the exact same level/code of the deactivated targets */}
                  {users
                    .filter(u => u.id !== targetDeactUser.id && u.isActive && u.level === targetDeactUser.level && u.levelCode === targetDeactUser.levelCode)
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                    ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                  Note: Pre-seeded accounts like <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono font-semibold">former-sec@jdn.org</code> belong to the Harare South branch and can be targets/replacements.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setIsDeactOpen(false); setTargetDeactUser(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel Protocol
                </button>
                <button
                  onClick={handleDeactivate}
                  className="px-4 py-2 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-bold rounded-lg cursor-pointer"
                >
                  Confirm Soft Deactivate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
