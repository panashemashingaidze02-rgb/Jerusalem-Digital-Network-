/**
 * JDN TypeScript Types Specification
 */

export enum JdnLevel {
  SYSTEM = 'System',
  JERUSALEM = 'Jerusalem',
  NATIONAL = 'National',
  PROVINCIAL = 'Provincial',
  DISTRICT = 'District',
  NYIKA = 'Nyika',
  TABHERA = 'Tabhera',
  WELLNESS_CENTER = 'Wellness Center'
}

export enum MemberGroup {
  SUNDAY_SCHOOL = 'Sunday School',
  MASOWANI = 'Masowani',
  RUWADZANO = 'Ruwadzano',
  SUNGANO = 'Sungano'
}

export type Gender = 'Male' | 'Female' | 'Other';

export interface FormerOwnerItem {
  userId: string;
  name: string;
  dateReassigned: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  nationalId: string;
  level: JdnLevel;
  levelCode: string; // Dynamic code tied to their administrative unit (e.g., "HAR-PROV" or "TAB-1")
  branchName: string; // The specific unit name, e.g. "Chizhanje Tabhera"
  parentCode: string | null; // Code of the unit directly above them
  role: string; // Role Title (e.g., "System Administrator", "Tabhera Secretary", etc.)
  isActive: boolean;
  forcedPasswordChange: boolean;
  createdAt: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  profilePhoto?: string;
}

export interface LevelCode {
  codeId: string;
  codeValue: string;
  createdBy: string; // Profile ID
  levelScope: JdnLevel; // The level that this code is granting access to
  branchName: string; // The specific unit name, e.g. "Harare South District" or "Mbare Tabhera"
  expiryDate: string;
  useCount: number;
  isActive: boolean;
  createdAt: string;
  parentLevelCode?: string | null; // The level structure parent code to dynamically build hierarchical links
  exactUnitCode?: string; // If set, bypasses slug generation and directly assigns the user to this specific branch code
}

export interface CodeUsageLog {
  logId: string;
  codeId: string;
  userPhone: string;
  registeredUserId: string | null;
  usedAt: string;
}

export interface PromotionHistoryItem {
  fromGroup: MemberGroup;
  toGroup: MemberGroup;
  date: string;
  promotedBy: string; // Admin User ID, or "system" for auto-promotions
}

export interface Member {
  memberId: string;
  fullName: string;
  dateOfBirth: string; // ISO format (YYYY-MM-DD)
  gender: Gender;
  maritalStatus: string; // "Single", "Married", "Widowed", "Divorced"
  groupId: MemberGroup;
  joinDate: string;
  tabheraCode: string; // Matches a Tabhera's levelCode
  isJorodhani: boolean;
  jorodhaniDate: string | null;
  promotionHistory: PromotionHistoryItem[];
  createdBy: string;
  createdAt: string;
  formerOwners?: FormerOwnerItem[];
  syncStatus?: 'pending' | 'synced';
  phoneNumber?: string;
  isLeadership?: boolean;
  basa?: string; // Leadership title / Basa
  family?: string;
  memberNumber?: string;
  pictureUrl?: string;
  isSuspended?: boolean;
  idExpiryDate?: string;
}

export interface MurairoType {
  murairoId: string;
  name: string;
  description: string;
  currency: string[]; // e.g., ["USD", "ZWG"]
  createdByLevel: JdnLevel;
  createdByCode: string;
  isActive: boolean;
  createdAt: string;
  targetLevels?: JdnLevel[]; // Target structural levels, e.g. [JdnLevel.TABHERA, JdnLevel.NYIKA]
}

export interface ContributionLog {
  contributionId: string;
  memberId: string;
  murairoId: string;
  amount: number;
  currency: string; // Dynamic currency support
  paymentMethod?: string; // Dynamic payment method support
  date: string; // YYYY-MM-DD
  loggedBy: string; // User Profile ID
  tabheraCode: string;
  syncStatus: 'pending' | 'synced';
  formerOwners?: FormerOwnerItem[];
  hierarchyPath?: string; // Slashed hierarchy path for RLS-mimicking queries
  referenceCode?: string; // Unique financial reference code e.g., JDN-MUR-123456
  family?: string;
  isGuest?: boolean;
  guestName?: string;
}

export interface RankingWeights {
  contributionWeight: number; // default: 70
  attendanceWeight: number; // default: 20
  participationWeight: number; // default: 10
}

export interface AttendanceSession {
  sessionId: string;
  tabheraCode: string;
  date: string; // YYYY-MM-DD
  serviceType: 'Sunday Service' | 'Midweek' | 'Special';
  isCorrection: boolean;
  loggedBy: string; // User Profile ID
  syncStatus: 'pending' | 'synced';
  formerOwners?: FormerOwnerItem[];
}

export interface AttendanceRecord {
  recordId: string;
  sessionId: string;
  memberId: string;
  status: 'Present' | 'Absent' | 'Excused';
  excuseReason?: string;
}

export interface SyncQueueItem {
  queueId: string;
  entityType: 'member' | 'attendance_session' | 'attendance_records' | 'contribution' | 'profile' | 'code' | 'password_change' | 'ungano_category' | 'ungano_payment';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
  failed?: boolean;
}

export interface JdnSettings {
  jorodhaniPeriodMonths: number; // Configurable period, default is 3
  privacyShieldDistrictEnabled: boolean; // District+ visibility settings
  churchName?: string;
  churchLogoUrl?: string;
  churchBackgroundUrl?: string;
  churchAddress?: string;
  churchContact?: string;
  globalCurrencies?: string[];
}

// Hierarchy ordering helper
export function getStoredHierarchyOrder(): JdnLevel[] {
  try {
    const cached = localStorage.getItem('jdn_hierarchy_order_v18');
    if (cached) {
      return JSON.parse(cached) as JdnLevel[];
    }
  } catch (e) {}
  return [
    JdnLevel.SYSTEM,
    JdnLevel.JERUSALEM,
    JdnLevel.NATIONAL,
    JdnLevel.PROVINCIAL,
    JdnLevel.DISTRICT,
    JdnLevel.NYIKA,
    JdnLevel.TABHERA,
    JdnLevel.WELLNESS_CENTER
  ];
}

export const LEVEL_HIERARCHY_ORDER: JdnLevel[] = [
  JdnLevel.SYSTEM,
  JdnLevel.JERUSALEM,
  JdnLevel.NATIONAL,
  JdnLevel.PROVINCIAL,
  JdnLevel.DISTRICT,
  JdnLevel.NYIKA,
  JdnLevel.TABHERA,
  JdnLevel.WELLNESS_CENTER
];

/**
 * Returns true if levelA is higher or equal than levelB (e.g. System is higher than District)
 */
export function isLevelHigherOrEqual(levelA: JdnLevel, levelB: JdnLevel): boolean {
  const order = getStoredHierarchyOrder();
  const indexA = order.indexOf(levelA);
  const indexB = order.indexOf(levelB);
  if (indexA === -1 || indexB === -1) return false;
  return indexA <= indexB;
}

export function getStoredLevelNames(): Record<string, string> {
  try {
    const cached = localStorage.getItem('jdn_level_names_v18');
    if (cached) {
      return JSON.parse(cached) as Record<string, string>;
    }
  } catch (e) {}
  return {
    [JdnLevel.SYSTEM]: 'Super Admin',
    [JdnLevel.JERUSALEM]: 'Jerusalem Overseer',
    [JdnLevel.NATIONAL]: 'National HQ',
    [JdnLevel.PROVINCIAL]: 'Provincial HQ',
    [JdnLevel.DISTRICT]: 'District Leader',
    [JdnLevel.NYIKA]: 'Nyika Coordinator',
    [JdnLevel.TABHERA]: 'Tabhera Local',
    [JdnLevel.WELLNESS_CENTER]: 'Wellness Center'
  };
}

/**
 * Returns role names based on the levels
 */
export function getRoleTitleForLevel(level: JdnLevel): string {
  const names = getStoredLevelNames();
  return names[level] || String(level);
}

/**
 * Platform Audit Log Definition
 */
export interface PlatformAuditLog {
  logId: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorLevel: JdnLevel;
  action: string;
  details: string;
  category: 'auth' | 'payment' | 'member' | 'system' | 'contribution' | 'ungano';
}

/**
 * JDN Updates Board (Blogs, Notifications, Sermons)
 */
export interface JdnUpdate {
  id: string;
  title: string;
  content: string;
  type: string;
  authorId: string;
  authorName: string;
  authorLevel: JdnLevel;
  audioUrl?: string; // local audio track mockup
  imageUrl?: string;
  scheduledPublishDate?: string; // empty means publish immediately
  createdAt: string;
}

/**
 * Ungano Logistics Category
 */
export interface UnganoCategory {
  id: string;
  name: string;
  description: string;
  amount: number | null; // Nullable if flexible (user-defined)
  currency: string[];
  createdBy: string; // ID of Jerusalem/National user
  creatorLevel: JdnLevel;
  targetLevels?: string[]; // e.g. ["Tabhera", "Nyika"] or null for all
  dueDate?: string; // YYYY-MM-DD
  createdAt: string;
  tabheraTarget?: number;
  nyikaTarget?: number;
  districtTarget?: number;
  provincialTarget?: number;
  nationalTarget?: number;
  currencyTargets?: Record<string, number>;
}

/**
 * Ungano Logistics Payment Record
 */
export interface UnganoPayment {
  id: string;
  memberId: string;
  categoryId: string;
  amountPaid: number;
  currency: string;
  paymentMethod: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  paymentDate: string; // YYYY-MM-DD
  recordedByUserId: string;
  hierarchyPath: string; // Slash-delimited administrative trail, e.g. "SYS-GLOBAL/JER-HQ/NAT-ZIM-1/PROV-HRE-1/DIS-HRE-S-1/NYK-HRE-S-1A/TAB-HRE-S-1A-1"
  referenceCode: string; // E.g., JDN-UUN-123456
  syncStatus: 'LOCAL' | 'SYNCED';
  createdAt: string;
}

/**
 * Computed compliance summary for a member and category
 */
export interface UnganoMemberSummary {
  memberId: string;
  categoryId: string;
  totalRequired: number;
  totalPaid: number;
  balance: number;
  complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
}

/**
 * System notification logs schema
 */
export interface JdnNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  isPushSimulated?: boolean;
}

/**
 * Contribution targets per entity and/or contribution type
 */
export interface ContributionTarget {
  id: string;
  entityId: string; // memberId, levelCode, etc.
  entityType: 'Member' | 'Tabhera' | 'District' | 'Province' | 'Wellness Center' | 'Nation';
  entityName: string;
  typeId: string; // murairoId or unganoCategoryId
  typeClass: 'standard' | 'special'; // Standard Murairo vs Special Murairo (Ungano)
  targetAmount: number; // in USD standard
  currency: string; // e.g. "USD"
  createdAt: string;
}

/**
 * Ungano Assembly Event / Gathering record
 */
export interface UnganoRecord {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  location: string;
  totalMoneyContributed: number; // in USD total
  contributions: {
    contributorName: string;
    amount: number;
    currency: string;
    paymentMethod: string;
  }[];
  totalAttendance: number;
  attendanceDetails?: {
    men: number;
    women: number;
    youth: number;
  };
  leadersAttendedIds: string[]; // UserProfile ids of leaders who attended
  notes?: string;
  createdAt: string;
}

export interface DareMinute {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorLevelCode: string; // Used for filtering (only visible to linked users/parents)
  createdAt: string;
}

export interface PrayerRequest {
  id: string;
  title: string;
  request: string;
  authorId: string;
  authorName: string;
  authorLevelCode: string;
  status: 'pending' | 'prayed' | 'answered';
  createdAt: string;
}