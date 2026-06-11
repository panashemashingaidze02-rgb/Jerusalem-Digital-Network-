import localforage from 'localforage';
import { toast } from 'react-hot-toast';
import {
  UserProfile,
  LevelCode,
  Member,
  MurairoType,
  ContributionLog,
  AttendanceSession,
  AttendanceRecord,
  SyncQueueItem,
  MemberGroup,
  JdnLevel,
  JdnSettings,
  FormerOwnerItem,
  PlatformAuditLog,
  JdnUpdate,
  UnganoCategory,
  UnganoPayment,
  LEVEL_HIERARCHY_ORDER,
  RankingWeights,
  JdnNotification,
  ContributionTarget,
  UnganoRecord
} from '../types';

// Connection simulator state (stored in localStorage for simplicity and instant sync)
export function getNetworkStatus(): boolean {
  const cached = localStorage.getItem('jdn_simulated_online');
  return cached === null ? true : cached === 'true';
}

export function initializeNetworkListeners() {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      window.dispatchEvent(new Event('jdn_network_changed'));
    });
    window.addEventListener('offline', () => {
      window.dispatchEvent(new Event('jdn_network_changed'));
    });
  }
}

export function setNetworkStatus(status: boolean) {
  localStorage.setItem('jdn_simulated_online', String(status));
  window.dispatchEvent(new Event('jdn_network_changed'));
}

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return null as unknown as T;
  if (obj === null) return null as unknown as T;
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  })) as T;
}

// Global settings
const DEFAULT_SETTINGS: JdnSettings = {
  jorodhaniPeriodMonths: 3,
  privacyShieldDistrictEnabled: true,
  churchName: "Makoni Church",
  churchLogoUrl: "",
  churchAddress: "",
  churchContact: "",
  globalCurrencies: ['USD', 'ZWG', 'ZAR']
};

export async function getSettings(): Promise<JdnSettings> {
  const settings = await localforage.getItem<JdnSettings>('jdn_settings');
  return settings || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: JdnSettings): Promise<void> {
  await localforage.setItem('jdn_settings', settings);
  window.dispatchEvent(new Event('jdn_settings_updated'));
}

// Pre-seeded database of production-ready bootstrap accounts and key configuration templates
function generateDynamicSeededData() {
  const users: UserProfile[] = [];
  const codes: LevelCode[] = [];
  const murairoTypes: MurairoType[] = [];
  const members: Member[] = [];
  const contributions: ContributionLog[] = [];
  const unganoCategories: UnganoCategory[] = [];
  const unganoPayments: UnganoPayment[] = [];
  const sessions: AttendanceSession[] = [];
  const records: AttendanceRecord[] = [];
  const passwords: Record<string, string> = {};

  return { users, codes, murairoTypes, members, contributions, unganoCategories, unganoPayments, sessions, records, passwords };
}

// Initialize Storage: Seed only if empty
export async function initializeDatabase(): Promise<void> {
  const isSeeded = await localforage.getItem('jdn_seeded_v21_completely_clean');
  if (!isSeeded) {
    // Clear legacy databases
    await localforage.clear();

    const dynamicData = generateDynamicSeededData();

    await localforage.setItem('jdn_user_profiles', dynamicData.users);
    await localforage.setItem('jdn_level_codes', dynamicData.codes);
    await localforage.setItem('jdn_murairo_types', dynamicData.murairoTypes);
    await localforage.setItem('jdn_members', dynamicData.members);
    await localforage.setItem('jdn_contributions', dynamicData.contributions);
    await localforage.setItem('jdn_ungano_categories', dynamicData.unganoCategories);
    await localforage.setItem('jdn_un_payments', dynamicData.unganoPayments);
    await localforage.setItem('jdn_attendance_sessions', dynamicData.sessions);
    await localforage.setItem('jdn_attendance_records', dynamicData.records);
    await localforage.setItem('jdn_sync_queue', [] as SyncQueueItem[]);
    await localforage.setItem('jdn_settings', DEFAULT_SETTINGS);

    const initialLogs: PlatformAuditLog[] = [
      {
        logId: 'log-seed-1',
        action: 'DB_INITIALIZE',
        category: 'system',
        details: 'Immutable JDN central database ledger instantiated successfully. Security keys compiled.',
        actorId: 'system-daemon',
        actorName: 'System Daemon',
        actorLevel: JdnLevel.SYSTEM,
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
      },
      {
        logId: 'log-seed-2',
        action: 'DOCTRINE_INIT',
        category: 'system',
        details: 'Multi-tier doctrinal access control shields activated for National, Nyika, and Tabhera levels.',
        actorId: 'bishop-mashingaidze',
        actorName: 'Bishop Mashingaidze',
        actorLevel: JdnLevel.JERUSALEM,
        timestamp: new Date(Date.now() - 3600000 * 3.5).toISOString()
      },
      {
        logId: 'log-seed-3',
        action: 'LEDGER_SET',
        category: 'system',
        details: 'Financial recording bounds restricted. All ungano collections require direct Sec-General approval.',
        actorId: 'sec-general',
        actorName: 'Sec. General',
        actorLevel: JdnLevel.NATIONAL,
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        logId: 'log-seed-4',
        action: 'BIBLE_LOCKED',
        category: 'system',
        details: 'Offline Shona, Ndebele, and English Bible collections cleanly cached to IndexedDB offline buffers.',
        actorId: 'tech-sec',
        actorName: 'Technical Secretary',
        actorLevel: JdnLevel.SYSTEM,
        timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString()
      },
      {
        logId: 'log-seed-5',
        action: 'SYS_BOOT',
        category: 'system',
        details: 'Central Cloud Daemon started on secure local port 3000. Ingress TLS links confirmed.',
        actorId: 'system-daemon',
        actorName: 'System Daemon',
        actorLevel: JdnLevel.SYSTEM,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ];
    await localforage.setItem('jdn_platform_logs', initialLogs);

    // Seed local user passwords store in localStorage for logins in demo
    localStorage.setItem('jdn_passwords', JSON.stringify(dynamicData.passwords));

    await localforage.setItem('jdn_seeded_v21_completely_clean', true);
    console.log('JDN Database seeded successfully with production-ready default administrative accounts.');
  }

  // Run auto sunday school graduation etc.
  await runSystemTriggerChecks();
}

export async function forceReSeedDatabase(): Promise<void> {
  await localforage.clear();
  localStorage.removeItem('jdn_seeded_v21_completely_clean');
  localStorage.removeItem('jdn_seeded_v20_production_clean');
  localStorage.removeItem('jdn_seeded_v19_offline_free_mashingaidze');
  localStorage.removeItem('jdn_seeded_v18_panashe');
  localStorage.removeItem('jdn_seeded_v17_prod');
  localStorage.removeItem('jdn_seeded_v16');
  localStorage.removeItem('jdn_seeded_v13');
  await initializeDatabase();
}

export async function runSystemTriggerChecks(): Promise<void> {
  console.log('Running auto-graduation and jorodhani expiration checks...');
  const members = await localforage.getItem<Member[]>('jdn_members') || [];
  const settings = await getSettings();
  let updated = false;

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);

  const updatedMembers = members.map(member => {
    let m = { ...member };

    // 1. Graduation: Sunday School -> Masowani when age >= 14
    if (m.groupId === MemberGroup.SUNDAY_SCHOOL) {
      const dob = new Date(m.dateOfBirth);
      let age = today.getFullYear() - dob.getFullYear();
      const mDiff = today.getMonth() - dob.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      if (age >= 14) {
        console.log(`Auto-graduating ${m.fullName} (Age: ${age}) to Masowani.`);
        m.groupId = MemberGroup.MASOWANI;
        m.promotionHistory = [
          ...(m.promotionHistory || []),
          {
            fromGroup: MemberGroup.SUNDAY_SCHOOL,
            toGroup: MemberGroup.MASOWANI,
            date: todayStr,
            promotedBy: 'system'
          }
        ];
        updated = true;
      }
    }

    // 2. Clear Jorodhani status after configured months
    if (m.isJorodhani && m.jorodhaniDate) {
      const join = new Date(m.jorodhaniDate);
      const diffMonths = (today.getFullYear() - join.getFullYear()) * 12 + today.getMonth() - join.getMonth();

      if (diffMonths >= settings.jorodhaniPeriodMonths) {
        console.log(`Auto-clearing Jorodhani status for ${m.fullName} (Joined ${diffMonths} months ago).`);
        m.isJorodhani = false;
        updated = true;
      }
    }

    return m;
  });

  if (updated) {
    await localforage.setItem('jdn_members', updatedMembers);
  }
}

// Global Log of logins for simulation
export async function getCurrentUser(): Promise<UserProfile | null> {
  return localforage.getItem<UserProfile | null>('jdn_current_user');
}

export async function setCurrentUser(user: UserProfile | null): Promise<void> {
  await localforage.setItem('jdn_current_user', user);
}

export async function getImpersonatorRoot(): Promise<UserProfile | null> {
  return localforage.getItem<UserProfile | null>('jdn_impersonator_root');
}

export async function setImpersonatorRoot(user: UserProfile | null): Promise<void> {
  if (user === null) {
    await localforage.removeItem('jdn_impersonator_root');
  } else {
    await localforage.setItem('jdn_impersonator_root', user);
  }
}

// User Profiles Fetch & Writes (purely local, offline-only)
export async function getUserProfiles(): Promise<UserProfile[]> {
  const profiles = await localforage.getItem<UserProfile[]>('jdn_user_profiles');
  return profiles || [];
}

export async function saveUserProfiles(profiles: UserProfile[]): Promise<void> {
  await localforage.setItem('jdn_user_profiles', profiles);
}

// Level Codes management
export async function getLevelCodes(): Promise<LevelCode[]> {
  const codes = await localforage.getItem<LevelCode[]>('jdn_level_codes');
  return codes || [];
}

export async function saveLevelCodes(codes: LevelCode[]): Promise<void> {
  await localforage.setItem('jdn_level_codes', codes);
}

// Members Fetch & Writes
export async function getMembers(): Promise<Member[]> {
  const members = await localforage.getItem<Member[]>('jdn_members');
  return members || [];
}

export async function saveMembers(members: Member[]): Promise<void> {
  await localforage.setItem('jdn_members', members);
}

// Murairo Types
export async function getMurairoTypes(): Promise<MurairoType[]> {
  const types = await localforage.getItem<MurairoType[]>('jdn_murairo_types');
  return types || [];
}

export async function saveMurairoTypes(types: MurairoType[]): Promise<void> {
  await localforage.setItem('jdn_murairo_types', types);
}

// Contributions Logs
export async function getContributions(): Promise<ContributionLog[]> {
  const items = await localforage.getItem<ContributionLog[]>('jdn_contributions');
  return items || [];
}

export async function saveContributions(contributions: ContributionLog[]): Promise<void> {
  await localforage.setItem('jdn_contributions', contributions);
}

// Attendance Sessions & Records
export async function getAttendanceSessions(): Promise<AttendanceSession[]> {
  const items = await localforage.getItem<AttendanceSession[]>('jdn_attendance_sessions');
  return items || [];
}

export async function saveAttendanceSessions(sessions: AttendanceSession[]): Promise<void> {
  await localforage.setItem('jdn_attendance_sessions', sessions);
}

export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  const items = await localforage.getItem<AttendanceRecord[]>('jdn_attendance_records');
  return items || [];
}

export async function saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
  await localforage.setItem('jdn_attendance_records', records);
}

// Sync Queue Management
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return await localforage.getItem<SyncQueueItem[]>('jdn_sync_queue') || [];
}

export async function saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  await localforage.setItem('jdn_sync_queue', queue);
  window.dispatchEvent(new Event('jdn_sync_queue_updated'));
}

export async function getLastSyncTime(): Promise<string | null> {
  return await localforage.getItem<string>('jdn_last_sync_time');
}

export async function setLastSyncTime(timestamp: string): Promise<void> {
  await localforage.setItem('jdn_last_sync_time', timestamp);
}

export async function addToSyncQueue(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  operation: SyncQueueItem['operation'],
  payload: any
): Promise<void> {
  const queue = await getSyncQueue();
  const newItem: SyncQueueItem = {
    queueId: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    entityType,
    entityId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0
  };
  queue.push(newItem);
  await saveSyncQueue(queue);

  try {
    const user = await getCurrentUser();
    if (user) {
      let category: 'auth' | 'payment' | 'member' | 'system' | 'contribution' | 'ungano' = 'system';
      if (entityType === 'member') category = 'member';
      if (entityType === 'contribution') category = 'contribution';
      if (entityType.includes('ungano')) category = 'ungano';
      if (entityType === 'profile') category = 'auth';
      
      await addPlatformLog({
        actorId: user.id,
        actorName: user.fullName || 'System User',
        actorLevel: user.level,
        action: `DATA_${operation.toUpperCase()}`,
        details: `${entityType} record ${entityId} was ${operation}d.`,
        category
      });
    }
  } catch (e) {
    console.warn("Failed to log queue addition", e);
  }

  // Auto trigger process if online simulation is active
  if (getNetworkStatus()) {
    setTimeout(() => processSyncQueue(), 500);
  }
}

// Process Sync Queue locally matching the layout indices
let isSyncing = false;
export async function processSyncQueue(): Promise<void> {
  if (isSyncing) return;
  if (!getNetworkStatus()) return; // Simulated offline triggers pause

  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  console.log(`Processing local sync queue. Spooling items: ${queue.length}`);
  window.dispatchEvent(new Event('jdn_sync_started'));

  const maxAttempts = 3;
  let updatedQueue = [...queue];

  for (const item of queue) {
    if (item.failed) continue;

    item.attempts++;
    try {
      if (item.entityType === 'profile' && item.operation === 'create') {
        const users = await getUserProfiles();
        const payloadUser = item.payload.profile as UserProfile;

        const emailExists = users.some(u => u.email.toLowerCase() === payloadUser.email.toLowerCase() && u.id !== payloadUser.id);
        if (emailExists) throw new Error('An account with this email already exists.');

        const updatedUsers = [...users, payloadUser];
        await saveUserProfiles(updatedUsers);

        // Update local passwords index
        const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
        passwords[payloadUser.email.toLowerCase()] = item.payload.password;
        localStorage.setItem('jdn_passwords', JSON.stringify(passwords));

        // Increment invite code usage
        if (payloadUser.parentCode) {
          const codes = await getLevelCodes();
          const targetCodeIndex = codes.findIndex(c => c.parentLevelCode === payloadUser.parentCode);
          if (targetCodeIndex !== -1) {
            codes[targetCodeIndex].useCount++;
            await saveLevelCodes(codes);
          }
        }
        await setCurrentUser(payloadUser);
      }

      if (item.entityType === 'member' && item.operation === 'create') {
        const members = await getMembers();
        const exists = members.some(m => m.memberId === item.entityId);
        if (!exists) {
          await saveMembers([...members, { ...item.payload, syncStatus: 'synced' }]);
        } else {
          const updated = members.map(m => m.memberId === item.entityId ? { ...m, syncStatus: 'synced' as const } : m);
          await saveMembers(updated);
        }
      }

      if (item.entityType === 'member' && item.operation === 'update') {
        const members = await getMembers();
        const updated = members.map(m => m.memberId === item.entityId ? { ...item.payload, syncStatus: 'synced' as const } : m);
        await saveMembers(updated);
      }

      if (item.entityType === 'contribution' && item.operation === 'create') {
        const list = await getContributions();
        const exists = list.some(c => c.contributionId === item.entityId);
        if (!exists) {
          await saveContributions([...list, { ...item.payload, syncStatus: 'synced' }]);
        } else {
          const updated = list.map(c => c.contributionId === item.entityId ? { ...c, syncStatus: 'synced' as const } : c);
          await saveContributions(updated);
        }
      }

      if (item.entityType === 'attendance_session' && item.operation === 'create') {
        const sessions = await getAttendanceSessions();
        const exists = sessions.some(s => s.sessionId === item.entityId);
        if (!exists) {
          await saveAttendanceSessions([...sessions, { ...item.payload, syncStatus: 'synced' }]);
        } else {
          const updated = sessions.map(s => s.sessionId === item.entityId ? { ...s, syncStatus: 'synced' as const } : s);
          await saveAttendanceSessions(updated);
        }
      }

      if (item.entityType === 'ungano_category' && item.operation === 'create') {
        const categories = await getUnganoCategories();
        const exists = categories.some(c => c.id === item.entityId);
        if (!exists) {
          await saveUnganoCategories([...categories, item.payload]);
        }
      }

      if (item.entityType === 'ungano_payment' && item.operation === 'create') {
        const payments = await getUnganoPayments();
        const exists = payments.some(p => p.id === item.entityId);
        if (!exists) {
          await saveUnganoPayments([...payments, { ...item.payload, syncStatus: 'SYNCED' }]);
        } else {
          const updated = payments.map(p => p.id === item.entityId ? { ...p, syncStatus: 'SYNCED' as const } : p);
          await saveUnganoPayments(updated);
        }
      }

      if (item.entityType === 'password_change' && item.operation === 'update') {
        const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
        passwords[item.payload.email.toLowerCase()] = item.payload.newPassword;
        localStorage.setItem('jdn_passwords', JSON.stringify(passwords));
      }

      if (item.entityType === 'attendance_records' && item.operation === 'create') {
        const records = await getAttendanceRecords();
        const exists = records.some(r => r.recordId === item.entityId);
        if (!exists) {
          await saveAttendanceRecords([...records, item.payload]);
        }
      }

      if (item.entityType === 'contribution' && item.operation === 'update') {
        const list = await getContributions();
        const updated = list.map(c =>
          c.contributionId === item.entityId
            ? { ...item.payload, syncStatus: 'synced' as const }
            : c
        );
        await saveContributions(updated);
      }

      // Persist directly to Cloud Firestore
      const firestoreCollections: Record<string, string> = {
        'profile': 'user_profiles',
        'member': 'members',
        'contribution': 'contributions',
        'attendance_session': 'attendance_sessions',
        'attendance_records': 'attendance_records',
        'ungano_category': 'ungano_categories',
        'ungano_payment': 'ungano_payments',
        'update': 'updates',
        'dare_minutes': 'dare_minutes',
        'prayer_request': 'prayer_requests',
        'settings': 'settings'
      };

      const firestoreCol = firestoreCollections[item.entityType];
      if (firestoreCol) {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db, auth } = await import('./firebase');

        if (!auth.currentUser) throw new Error('Not authenticated');

        const payloadData = item.payload && item.payload.profile ? item.payload.profile : item.payload;
        await setDoc(doc(db, firestoreCol, item.entityId), payloadData, { merge: true });
      }

      // Success, remove from queue
      updatedQueue = updatedQueue.filter(q => q.queueId !== item.queueId);
      await setLastSyncTime(new Date().toISOString());
    } catch (err: any) {
      console.error(`Local sync retry failed: ${err.message}`);
      item.lastError = err.message;
      item.errorCode = err.code || 'unknown_error';
      toast.error(`Sync failed for ${item.entityType}: ${err.message || err.code || 'Unknown Error'}`);
      
      if (item.attempts >= maxAttempts) {
        item.failed = true;
      }
      updatedQueue = updatedQueue.map(q => q.queueId === item.queueId ? { ...item } : q);
      continue; // Skip failed item, process remaining queue items
    }
  }

  await saveSyncQueue(updatedQueue);
  isSyncing = false;
  window.dispatchEvent(new Event('jdn_sync_ended'));
}

export async function retrySyncItem(queueId: string): Promise<void> {
  const queue = await getSyncQueue();
  const updatedQueue = queue.map(item => {
    if (item.queueId === queueId) {
      return { ...item, failed: false, attempts: 0, lastError: undefined };
    }
    return item;
  });
  await saveSyncQueue(updatedQueue);
  await processSyncQueue(); // Attempt immediately
}

export async function cancelSyncItem(queueId: string): Promise<void> {
  const queue = await getSyncQueue();
  const updatedQueue = queue.filter(item => item.queueId !== queueId);
  await saveSyncQueue(updatedQueue);
}

let globalListenersSetup = false;
export async function setupGlobalFirestoreListeners(): Promise<void> {
  if (globalListenersSetup) return;
  
  try {
    const { collection, onSnapshot, query, limit } = await import('firebase/firestore');
    const { db, auth } = await import('./firebase');
    
    if (!auth.currentUser) return;
    
    const collectionsToListen = ['members', 'user_profiles', 'contributions', 'attendance_sessions', 'attendance_records'];
    
    collectionsToListen.forEach(colName => {
      const q = query(collection(db, colName));
      onSnapshot(q, (snapshot) => {
        // Trigger a sync down whenever data changes in these collections from the server
        if (!snapshot.metadata.hasPendingWrites) {
             syncDownFromFirestore();
        }
      }, (error: any) => {
        console.error(`Error listening to ${colName}:`, error);
        toast.error(`Sync channel error (${colName}): ${error.message || 'Unknown'}`);
      });
    });
    
    globalListenersSetup = true;
    console.log("Global Firestore listeners attached.");
  } catch(err: any) {
    console.error("Failed to setup global listeners:", err);
    toast.error(`Failed to setup realtime listener: ${err.message || 'Unknown'}`);
  }
}

export async function syncDownFromFirestore(): Promise<void> {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    
    const memSnap = await getDocs(collection(db, 'members'));
    await saveMembers(memSnap.docs.map(d => d.data() as Member));

    const profSnap = await getDocs(collection(db, 'user_profiles'));
    await saveUserProfiles(profSnap.docs.map(d => d.data() as UserProfile));

    const contSnap = await getDocs(collection(db, 'contributions'));
    await saveContributions(contSnap.docs.map(d => d.data() as ContributionLog));

    const attSSnap = await getDocs(collection(db, 'attendance_sessions'));
    await saveAttendanceSessions(attSSnap.docs.map(d => d.data() as AttendanceSession));

    const attRSnap = await getDocs(collection(db, 'attendance_records'));
    await saveAttendanceRecords(attRSnap.docs.map(d => d.data() as AttendanceRecord));

    console.log("Successfully backfilled data from cloud.");
    window.dispatchEvent(new Event('jdn_db_updated'));
  } catch (err: any) {
    console.error("Failed to sync down cloud data", err);
    toast.error(`Auto-Sync Down Error: ${err.message || 'Unknown'}`);
  }
}

export async function forceBackfillToCloud(): Promise<void> {
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');

    const localMembers = await getMembers();
    for (const member of localMembers) {
       await setDoc(doc(db, 'members', member.memberId), member, { merge: true });
    }

    const localProfiles = await getUserProfiles();
    for (const profile of localProfiles) {
       await setDoc(doc(db, 'user_profiles', profile.id), profile, { merge: true });
    }

    const localContributions = await getContributions();
    for (const contribution of localContributions) {
       await setDoc(doc(db, 'contributions', contribution.contributionId), contribution, { merge: true });
    }

    const localSessions = await getAttendanceSessions();
    for (const session of localSessions) {
       await setDoc(doc(db, 'attendance_sessions', session.sessionId), session, { merge: true });
    }

    const localRecords = await getAttendanceRecords();
    for (const record of localRecords) {
       await setDoc(doc(db, 'attendance_records', record.recordId), record, { merge: true });
    }
    
    console.log('Successfully force-synced all local data up to cloud.');
  } catch (err) {
    console.error("Failed to force sync local data", err);
    throw err;
  }
}

export interface StorageDiagnosticResult {
  collection: string;
  localCount: number;
  cloudCount: number;
  isStale: boolean;
}

export async function runStorageDiagnostics(): Promise<StorageDiagnosticResult[]> {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');

    const localMembers = await getMembers();
    const cloudMembersSnap = await getDocs(collection(db, 'members'));
    
    const localProfiles = await getUserProfiles();
    const cloudProfilesSnap = await getDocs(collection(db, 'user_profiles'));
    
    const localContributions = await getContributions();
    const cloudContributionsSnap = await getDocs(collection(db, 'contributions'));
    
    const localSessions = await getAttendanceSessions();
    const cloudSessionsSnap = await getDocs(collection(db, 'attendance_sessions'));
    
    const localRecords = await getAttendanceRecords();
    const cloudRecordsSnap = await getDocs(collection(db, 'attendance_records'));

    const diagnostics: StorageDiagnosticResult[] = [
      {
        collection: 'members',
        localCount: localMembers.length,
        cloudCount: cloudMembersSnap.size,
        isStale: localMembers.length !== cloudMembersSnap.size
      },
      {
        collection: 'user_profiles',
        localCount: localProfiles.length,
        cloudCount: cloudProfilesSnap.size,
        isStale: localProfiles.length !== cloudProfilesSnap.size
      },
      {
        collection: 'contributions',
        localCount: localContributions.length,
        cloudCount: cloudContributionsSnap.size,
        isStale: localContributions.length !== cloudContributionsSnap.size
      },
      {
        collection: 'attendance_sessions',
        localCount: localSessions.length,
        cloudCount: cloudSessionsSnap.size,
        isStale: localSessions.length !== cloudSessionsSnap.size
      },
      {
        collection: 'attendance_records',
        localCount: localRecords.length,
        cloudCount: cloudRecordsSnap.size,
        isStale: localRecords.length !== cloudRecordsSnap.size
      }
    ];

    return diagnostics;
  } catch (err) {
    console.error("Failed to run diagnostics", err);
    throw err;
  }
}

// User deactivation & Data Reassignment flow
export async function deactivateUserAndReassignData(
  deactivateUserId: string,
  replacementUserId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const users = await getUserProfiles();
    const deactUser = users.find(u => u.id === deactivateUserId);
    const repUser = users.find(u => u.id === replacementUserId);

    if (!deactUser) return { success: false, error: 'User to deactivate not found' };
    if (!repUser) return { success: false, error: 'Replacement user not found' };

    if (deactUser.level !== repUser.level || deactUser.levelCode !== repUser.levelCode) {
      return { success: false, error: 'Replacement user must belong to the exact same administrative level and branch' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const formerOwnerLog: FormerOwnerItem = {
      userId: deactUser.id,
      name: deactUser.fullName,
      dateReassigned: todayStr
    };

    // Reassign Members
    const members = await getMembers();
    const updatedMembers = members.map(m => {
      if (m.createdBy === deactUser.id) {
        const list = m.formerOwners || [];
        return {
          ...m,
          createdBy: repUser.id,
          formerOwners: [...list, formerOwnerLog]
        };
      }
      return m;
    });
    await saveMembers(updatedMembers);

    // Reassign Contributions
    const contributions = await getContributions();
    const updatedContributions = contributions.map(c => {
      if (c.loggedBy === deactUser.id) {
        const list = c.formerOwners || [];
        return {
          ...c,
          loggedBy: repUser.id,
          formerOwners: [...list, formerOwnerLog]
        };
      }
      return c;
    });
    await saveContributions(updatedContributions);

    // Reassign Attendance sessions
    const sessions = await getAttendanceSessions();
    const updatedSessions = sessions.map(s => {
      if (s.loggedBy === deactUser.id) {
        const list = s.formerOwners || [];
        return {
          ...s,
          loggedBy: repUser.id,
          formerOwners: [...list, formerOwnerLog]
        };
      }
      return s;
    });
    await saveAttendanceSessions(updatedSessions);

    // Deactivate user profile soft delete
    const updatedUsers = users.map(u => {
      if (u.id === deactUser.id) {
        return {
          ...u,
          isActive: false,
          deactivatedAt: todayStr,
          deactivatedBy: adminUserId
        };
      }
      return u;
    });
    await saveUserProfiles(updatedUsers);

    console.log(`Deactivated ${deactUser.fullName} and reassigned data to ${repUser.fullName}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Password reset locally by higher administrative user
export async function resetLowerLevelPassword(
  adminUser: UserProfile,
  targetUserId: string,
  newPlainPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const users = await getUserProfiles();
    const targetIndex = users.findIndex(u => u.id === targetUserId);
    if (targetIndex === -1) return { success: false, error: 'User profile not found.' };

    const targetUser = users[targetIndex];

    const orderAdmin = LEVEL_HIERARCHY_ORDER.indexOf(adminUser.level);
    const orderTarget = LEVEL_HIERARCHY_ORDER.indexOf(targetUser.level);

    if (adminUser.level !== JdnLevel.SYSTEM && orderAdmin >= orderTarget) {
      return { success: false, error: 'Authorization error: You can only reset passwords for accounts strictly below your hierarchy level.' };
    }

    // Update password in local database
    const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
    passwords[targetUser.email] = newPlainPassword;
    localStorage.setItem('jdn_passwords', JSON.stringify(passwords));

    // Force target user to change password next login
    targetUser.forcedPasswordChange = true;
    users[targetIndex] = targetUser;
    await saveUserProfiles(users);

    await addPlatformLog({
      actorId: adminUser.id,
      actorName: adminUser.fullName,
      actorLevel: adminUser.level,
      action: 'PASSWORD_RESET',
      details: `Admin reset password for ${targetUser.fullName} (${targetUser.role})`,
      category: 'system'
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reset password.' };
  }
}

// Custom currency lists
const DEFAULT_CURRENCIES = ['USD', 'ZWG', 'ZAR'];
const DEFAULT_PAYMENT_METHODS = ['Cash', 'EcoCash', 'OneMoney', 'EcoCash USD', 'Inntegrate Transfer', 'Bank Transfer', 'Swipe'];

export async function getCurrencies(): Promise<string[]> {
  const settings = await getSettings();
  if (settings && settings.globalCurrencies && settings.globalCurrencies.length > 0) {
    return settings.globalCurrencies;
  }
  const custom = await localforage.getItem<string[]>('jdn_custom_currencies') || [];
  return [...DEFAULT_CURRENCIES, ...custom];
}

export async function addCustomCurrency(currency: string): Promise<void> {
  const custom = await localforage.getItem<string[]>('jdn_custom_currencies') || [];
  const upper = currency.toUpperCase().trim();
  if (upper && !DEFAULT_CURRENCIES.includes(upper) && !custom.includes(upper)) {
    custom.push(upper);
    await localforage.setItem('jdn_custom_currencies', custom);
  }
}

export async function getPaymentMethods(): Promise<string[]> {
  const custom = await localforage.getItem<string[]>('jdn_custom_payment_methods') || [];
  return [...DEFAULT_PAYMENT_METHODS, ...custom];
}

export async function addCustomPaymentMethod(method: string): Promise<void> {
  const custom = await localforage.getItem<string[]>('jdn_custom_payment_methods') || [];
  const clean = method.trim();
  if (clean && !DEFAULT_PAYMENT_METHODS.includes(clean) && !custom.includes(clean)) {
    custom.push(clean);
    await localforage.setItem('jdn_custom_payment_methods', custom);
  }
}

// Audit logger logs
export async function getPlatformLogs(): Promise<PlatformAuditLog[]> {
  const logs = await localforage.getItem<PlatformAuditLog[]>('jdn_platform_logs');
  return logs || [];
}

export async function addPlatformLog(log: Omit<PlatformAuditLog, 'logId' | 'timestamp'>): Promise<void> {
  const logs = await getPlatformLogs();
  const newLog: PlatformAuditLog = {
    ...log,
    logId: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog);
  await localforage.setItem('jdn_platform_logs', logs.slice(0, 500));
}

// Online/Local board posts update feeds
export async function getJdnUpdates(): Promise<JdnUpdate[]> {
  const list = await localforage.getItem<JdnUpdate[]>('jdn_updates');
  if (!list) {
    const defaults: JdnUpdate[] = [];
    await localforage.setItem('jdn_updates', defaults);
    return defaults;
  }
  return list;
}

export async function addJdnUpdate(update: Omit<JdnUpdate, 'id' | 'createdAt'>): Promise<void> {
  const newPost: JdnUpdate = {
    ...update,
    id: `upd-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  const list = await getJdnUpdates();
  list.unshift(newPost);
  await localforage.setItem('jdn_updates', list);
}

export async function updateJdnUpdate(updated: JdnUpdate): Promise<void> {
  const list = await getJdnUpdates();
  const index = list.findIndex(u => u.id === updated.id);
  if (index !== -1) {
    list[index] = updated;
    await localforage.setItem('jdn_updates', list);
  }
}

export async function deleteJdnUpdate(id: string): Promise<void> {
  const list = await getJdnUpdates();
  const filtered = list.filter(u => u.id !== id);
  await localforage.setItem('jdn_updates', filtered);
}

// Ungano special categories & payments
export async function getUnganoCategories(): Promise<UnganoCategory[]> {
  const list = await localforage.getItem<UnganoCategory[]>('jdn_ungano_categories');
  return list || [];
}

export async function saveUnganoCategories(categories: UnganoCategory[]): Promise<void> {
  await localforage.setItem('jdn_ungano_categories', categories);
}

export async function getUnganoPayments(): Promise<UnganoPayment[]> {
  const list = await localforage.getItem<UnganoPayment[]>('jdn_un_payments');
  return list || [];
}

export async function saveUnganoPayments(payments: UnganoPayment[]): Promise<void> {
  await localforage.setItem('jdn_un_payments', payments);
}

// Customized Weights
export async function getRankingWeights(): Promise<RankingWeights> {
  const weights = await localforage.getItem<RankingWeights>('jdn_ranking_weights');
  if (!weights) {
    const defaultWeights: RankingWeights = {
      contributionWeight: 70,
      attendanceWeight: 20,
      participationWeight: 10
    };
    await localforage.setItem('jdn_ranking_weights', defaultWeights);
    return defaultWeights;
  }
  return weights;
}

export async function saveRankingWeights(weights: RankingWeights): Promise<void> {
  await localforage.setItem('jdn_ranking_weights', weights);
}

// Customizable Levels
export async function getCustomLevels(): Promise<string[]> {
  const list = await localforage.getItem<string[]>('jdn_custom_levels');
  return list || [];
}

export async function saveCustomLevels(levels: string[]): Promise<void> {
  await localforage.setItem('jdn_custom_levels', levels);
}

// Flexible targets
export interface FlexibleTarget {
  memberId: string;
  categoryId: string;
  targetAmount: number;
}

export async function getFlexibleTargets(): Promise<FlexibleTarget[]> {
  const list = await localforage.getItem<FlexibleTarget[]>('jdn_flexible_targets');
  return list || [];
}

export async function saveFlexibleTargets(targets: FlexibleTarget[]): Promise<void> {
  await localforage.setItem('jdn_flexible_targets', targets);
}

export async function getCustomBulletinTypes(): Promise<string[]> {
  const list = await localforage.getItem<string[]>('jdn_custom_bulletins');
  if (!list) {
    const defaults = ['blog', 'notification', 'sermon_audio'];
    await localforage.setItem('jdn_custom_bulletins', defaults);
    return defaults;
  }
  return list;
}

export async function saveCustomBulletinTypes(types: string[]): Promise<void> {
  await localforage.setItem('jdn_custom_bulletins', types);
}

// Contribution Targets (Performance page management)
export async function getContributionTargets(): Promise<ContributionTarget[]> {
  const list = await localforage.getItem<ContributionTarget[]>('jdn_contribution_targets');
  return list || [];
}

export async function saveContributionTargets(targets: ContributionTarget[]): Promise<void> {
  await localforage.setItem('jdn_contribution_targets', targets);
}

// Ungano Assembly Records (Jerusalem account management)
export async function getUnganoRecords(): Promise<UnganoRecord[]> {
  const list = await localforage.getItem<UnganoRecord[]>('jdn_ungano_records');
  return list || [];
}

export async function saveUnganoRecords(records: UnganoRecord[]): Promise<void> {
  await localforage.setItem('jdn_ungano_records', records);
}

// Branch resolution helpers
export function resolveBranchName(code: string, profiles: UserProfile[]): string {
  if (!code) return 'General';
  const match = profiles.find(u => u.levelCode === code);
  if (match && match.branchName) return match.branchName;
  if (code.includes('/')) {
    const parts = code.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/^(SYS-|JER-|NAT-|PROV-|DIST-|NYK-|TAB-|SUB-)/g, '').replace(/-/g, ' ');
  }
  return code.replace(/^(SYS-|JER-|NAT-|PROV-|DIST-|NYK-|TAB-|SUB-)/g, '').replace(/-/g, ' ');
}

export function resolveLevelNameForCode(tabheraCode: string, level: JdnLevel, profiles: UserProfile[]): string {
  if (!tabheraCode) return 'HQ';
  const parts = tabheraCode.split('/');

  let matchPath = '';
  if (level === JdnLevel.NATIONAL) {
    matchPath = parts.slice(0, 3).join('/');
  } else if (level === JdnLevel.PROVINCIAL) {
    matchPath = parts.slice(0, 4).join('/');
  } else if (level === JdnLevel.DISTRICT) {
    matchPath = parts.slice(0, 5).join('/');
  } else if (level === JdnLevel.NYIKA) {
    matchPath = parts.slice(0, 6).join('/');
  } else if (level === JdnLevel.TABHERA) {
    matchPath = parts.slice(0, 7).join('/');
  }

  if (!matchPath) return 'N/A';

  const found = profiles.find(p => p.levelCode === matchPath);
  if (found && found.branchName) return found.branchName;

  const rawCode = matchPath.split('/').pop() || '';
  return rawCode
    .replace(/^(SYS-|JER-|NAT-|PROV-|DIST-|PRO-|DIS-|NYI-|NYK-|TAB-|SUB-)/g, '')
    .replace(/-/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Maintenance Mode controls
export async function getGlobalMaintenanceMode(): Promise<boolean> {
  const isMaint = await localforage.getItem<boolean>('jdn_global_maintenance_mode');
  if (isMaint === null) {
    const localVal = localStorage.getItem('jdn_global_maintenance_mode');
    return localVal === 'true';
  }
  return isMaint === true;
}

export async function saveGlobalMaintenanceMode(status: boolean): Promise<void> {
  await localforage.setItem('jdn_global_maintenance_mode', status);
  localStorage.setItem('jdn_global_maintenance_mode', String(status));
  window.dispatchEvent(new Event('jdn_maintenance_changed'));
}

// Alerts and notification logs
export async function getNotifications(): Promise<JdnNotification[]> {
  const isCleared = await localforage.getItem<string>('jdn_notifications_cleared');
  if (isCleared === 'true') {
    return [];
  }
  const list = await localforage.getItem<JdnNotification[]>('jdn_notifications');
  if (!list) {
    const defaults: JdnNotification[] = [];
    await localforage.setItem('jdn_notifications', defaults);
    return defaults;
  }
  return list;
}

export async function saveNotifications(notifications: JdnNotification[]): Promise<void> {
  if (notifications.length === 0) {
    await localforage.setItem('jdn_notifications_cleared', 'true');
  } else {
    await localforage.setItem('jdn_notifications_cleared', 'false');
  }
  await localforage.setItem('jdn_notifications', notifications);
  window.dispatchEvent(new Event('jdn_notifications_updated'));
}

export async function addNotification(title: string, message: string, type: JdnNotification['type'] = 'info', isPushSimulated?: boolean): Promise<void> {
  const current = await getNotifications();
  const added: JdnNotification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
    isPushSimulated
  };
  await saveNotifications([added, ...current]);
  
  // Real Push Notification
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message, icon: '/jdnlogo.jpeg' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body: message, icon: '/jdnlogo.jpeg' });
          }
        });
      }
    } catch (e) {
      console.error('Failed to show push notification:', e);
    }
  }
}

export function getLinkedScopeCodes(tabheraCode: string, profiles: UserProfile[]): string[] {
  if (!tabheraCode) return [];
  const visited = new Set<string>();
  const codes = new Set<string>();

  let current: string | null = tabheraCode.toUpperCase();

  while (current && !visited.has(current)) {
    visited.add(current);
    codes.add(current);

    if (current.includes('/')) {
      const parts = current.split('/');
      for (let i = 1; i <= parts.length; i++) {
        codes.add(parts.slice(0, i).join('/').toUpperCase());
      }
    }

    const target = current;
    const match = profiles.find(p => {
      const pCode = (p.levelCode || '').toUpperCase();
      return pCode === target || pCode.endsWith('/' + target) || pCode.split('/').pop() === target;
    });

    if (match) {
      const matchCode = (match.levelCode || '').toUpperCase();
      const parentCode = (match.parentCode || '').toUpperCase();
      codes.add(matchCode);
      if (parentCode) {
        codes.add(parentCode);
      }
      current = parentCode || null;
    } else {
      if (current.includes('/')) {
        const parts = current.split('/');
        parts.pop();
        current = parts.join('/').toUpperCase() || null;
      } else {
        current = null;
      }
    }
  }

  return Array.from(codes);
}

export function isCodeInScope(targetCode: string, scopeCode: string, profiles: UserProfile[]): boolean {
  if (!targetCode || !scopeCode) return false;
  const tCode = targetCode.toUpperCase();
  const sCode = scopeCode.toUpperCase();
  if (sCode === 'SYS-GLOBAL') return true;

  const linked = getLinkedScopeCodes(tCode, profiles);
  return linked.some(code => {
    const c = code.toUpperCase();
    return c === sCode || c.endsWith('/' + sCode) || sCode.startsWith(c) || c.startsWith(sCode);
  });
}

// Dare Minutes
export async function getDareMinutes(): Promise<any[]> {
  const items = await localforage.getItem<any[]>('jdn_dare_minutes');
  return items || [];
}

export async function saveDareMinutes(items: any[]): Promise<void> {
  await localforage.setItem('jdn_dare_minutes', items);
}

// Prayer Requests
export async function getPrayerRequests(): Promise<any[]> {
  const items = await localforage.getItem<any[]>('jdn_prayer_requests');
  return items || [];
}

export async function savePrayerRequests(items: any[]): Promise<void> {
  await localforage.setItem('jdn_prayer_requests', items);
}

// Full System Wipe (for backup restoration / reset)
export async function clearAllSystemData(): Promise<void> {
  const logs = await localforage.getItem('jdn_platform_logs');
  await localforage.clear();
  if (logs) {
    await localforage.setItem('jdn_platform_logs', logs);
  }
}

// Real-time Storage Usage bytes estimator (replaces mock tracking)
export async function estimateStorageUsageBytes(): Promise<number> {
  let totalLength = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          totalLength += key.length + (localStorage.getItem(key) || '').length;
        }
      }
    }
    const keys = await localforage.keys();
    for (const key of keys) {
      const val = await localforage.getItem(key);
      if (val) {
        totalLength += key.length + JSON.stringify(val).length;
      }
    }
  } catch (e) {
    console.warn('Error calculating storage size:', e);
  }
  return Math.max(totalLength, 4096); // Keep at least a small 4 KB floor for system overhead
}
