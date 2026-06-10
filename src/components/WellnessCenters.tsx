import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { UserProfile, JdnLevel } from '../types';
import {
  getUserProfiles,
  saveUserProfiles,
  addPlatformLog,
  getNetworkStatus
} from '../lib/storage';
import {
  Building2,
  List,
  UserPlus,
  Search,
  Key,
  ShieldAlert,
  Power,
  PowerOff,
  User,
  Phone,
  Mail,
  Locate,
  Hash,
  Activity,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface WellnessCentersProps {
  currentUser: UserProfile;
}

export function WellnessCenters({ currentUser }: WellnessCentersProps) {
  const [wellnessCenters, setWellnessCenters] = useState<UserProfile[]>([]);
  const [nationals, setNationals] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Form Creation states
  const [centerName, setCenterName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+263');
  const [nationalId, setNationalId] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [linkedNationalCode, setLinkedNationalCode] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Password reset state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const isOnline = getNetworkStatus();

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allUsers = await getUserProfiles();
      
      // Filter National units for linking dropdown
      const nationalProfiles = allUsers.filter(u => u.level === JdnLevel.NATIONAL);
      setNationals(nationalProfiles);

      // Set default linked national code for National users
      if (currentUser.level === JdnLevel.NATIONAL) {
        setLinkedNationalCode(currentUser.levelCode);
      } else if (nationalProfiles.length > 0) {
        setLinkedNationalCode(nationalProfiles[0].levelCode);
      }

      // Filter Wellness Centers based on ownership access
      let centers = allUsers.filter(u => u.level === JdnLevel.WELLNESS_CENTER);
      if (currentUser.level === JdnLevel.NATIONAL) {
        // Only centers linked to this specific National
        centers = centers.filter(c => c.parentCode === currentUser.levelCode);
      }
      
      setWellnessCenters(centers);
    } catch (e) {
      toast.error('Failed to load Wellness Centers data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!centerName.trim()) {
      toast.error('Please enter the Wellness Center name.');
      return;
    }
    if (!adminName.trim()) {
      toast.error('Please enter the contact administrator full name.');
      return;
    }
    const emailStr = email.trim().toLowerCase();
    if (!emailStr || !emailStr.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (phone.trim().length < 8) {
      toast.error('Please enter a valid contact phone number.');
      return;
    }
    if (!tempPassword || tempPassword.length < 6) {
      toast.error('Temporary password must be at least 6 characters.');
      return;
    }
    if (!linkedNationalCode) {
      toast.error('A linked National HQ unit is strictly required.');
      return;
    }

    try {
      const allUsers = await getUserProfiles();

      // Check uniqueness of Email and Phone
      if (allUsers.some(u => u.email.toLowerCase() === emailStr)) {
        toast.error('An account with this email address already exists.');
        return;
      }
      if (allUsers.some(u => u.phoneNumber === phone.trim())) {
        toast.error('An account with this phone number already exists.');
        return;
      }

      // Build specific branch code for Wellness Center under the selected National
      const branchSlug = centerName.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .toUpperCase();
      
      const levelCode = `${linkedNationalCode}/WLC-${branchSlug}`;

      const newCenter: UserProfile = {
        id: `usr-wlc-${Date.now()}`,
        email: emailStr,
        fullName: adminName.trim(),
        phoneNumber: phone.trim(),
        nationalId: nationalId.trim() || 'N/A',
        level: JdnLevel.WELLNESS_CENTER,
        levelCode: levelCode,
        branchName: centerName.trim(),
        parentCode: linkedNationalCode,
        role: 'Wellness Center Leader',
        isActive: true,
        forcedPasswordChange: true,
        createdAt: new Date().toISOString()
      };

      const updatedUsers = [...allUsers, newCenter];
      await saveUserProfiles(updatedUsers);

      // Store password in emulated password storage
      const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
      passwords[emailStr] = tempPassword;
      localStorage.setItem('jdn_passwords', JSON.stringify(passwords));

      // Audit Logger
      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'WELLNESS_CENTER_CREATE',
        details: `Registered Wellness Center Account "${newCenter.branchName}" linked to National "${linkedNationalCode}".`,
        category: 'system'
      });

      toast.success(`Successfully registered Wellness Center "${newCenter.branchName}"!`);
      
      // Reset Form State
      setCenterName('');
      setAdminName('');
      setEmail('');
      setPhone('+263');
      setNationalId('');
      setTempPassword('');
      setIsCreateOpen(false);
      
      // Reload
      await loadData();
    } catch (err) {
      toast.error('Failed to register wellness center. Please retry.');
    }
  };

  const handleToggleActive = async (targetId: string, currentStatus: boolean) => {
    try {
      const allUsers = await getUserProfiles();
      const updated = allUsers.map(u => {
        if (u.id === targetId) {
          return { ...u, isActive: !currentStatus };
        }
        return u;
      });

      await saveUserProfiles(updated);

      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'WELLNESS_CENTER_STATUS_TOGGLE',
        details: `Toggled active status of Wellness Center user profile "${targetId}" to ${!currentStatus}.`,
        category: 'system'
      });

      toast.success('Wellness Center status updated successfully.');
      await loadData();
    } catch (e) {
      toast.error('Failed to change center active status.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;

    if (!newPassword || newPassword.length < 6) {
      toast.error('Password override must contain at least 6 characters.');
      return;
    }

    try {
      const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
      passwords[resetTargetUser.email] = newPassword;
      localStorage.setItem('jdn_passwords', JSON.stringify(passwords));

      // Mark user for forced password change on next login
      const allUsers = await getUserProfiles();
      const updated = allUsers.map(u => {
        if (u.id === resetTargetUser.id) {
          return { ...u, forcedPasswordChange: true };
        }
        return u;
      });
      await saveUserProfiles(updated);

      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'WELLNESS_CENTER_PASSWORD_RESET',
        details: `Forced emergency password reset override for Wellness Center leader "${resetTargetUser.fullName}".`,
        category: 'system'
      });

      toast.success(`Credentials successfully updated for ${resetTargetUser.fullName}.`);
      setNewPassword('');
      setIsResetOpen(false);
      setResetTargetUser(null);
    } catch (err) {
      toast.error('Unable to complete credential overrides.');
    }
  };

  const filteredCenters = wellnessCenters.filter(c => {
    return c.branchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getNationalName = (natCode: string | null) => {
    if (!natCode) return 'Unspecified National';
    const match = nationals.find(n => n.levelCode === natCode);
    return match ? match.branchName : natCode.split('/').pop()?.replace(/-/g, ' ') || natCode;
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading Wellness Center Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="wellness-centers-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#166534]" />
            Wellness Centers Directory
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {currentUser.level === JdnLevel.JERUSALEM 
              ? 'Global oversight and administrative authority for all territorial branches.'
              : `Managing wellness centers linked to the ${currentUser.branchName} National footprint.`}
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors duration-150 cursor-pointer shadow-sm"
        >
          <UserPlus className="h-4 w-4" /> Add Wellness Center
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg text-[#166534]">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-2xl font-black text-gray-900">{wellnessCenters.length}</span>
            <span className="text-xs font-semibold text-gray-500">Total Registered Centers</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-2xl font-black text-gray-900">
              {wellnessCenters.filter(c => c.isActive).length}
            </span>
            <span className="text-xs font-semibold text-gray-500">Active Operational Sites</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <span className="block text-2xl font-black text-gray-900">
              {wellnessCenters.filter(c => !c.isActive).length}
            </span>
            <span className="text-xs font-semibold text-gray-500">Inactive Centers</span>
          </div>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search center name, administrator, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#166534] placeholder-gray-400"
          />
        </div>
        <span className="text-xs font-mono font-bold text-gray-500 hidden sm:inline">
          Showing {filteredCenters.length} of {wellnessCenters.length} centers
        </span>
      </div>

      {/* Grid or Table list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {filteredCenters.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <AlertCircle className="h-10 w-10 text-gray-300 mb-3 animate-pulse" />
            <p className="font-bold">No Wellness Centers Found</p>
            <p className="text-xs mt-1">Modify your search query or register a new wellness center above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="py-3.5 px-5">Wellness Center / Code</th>
                  <th className="py-3.5 px-5">Linked National HQ</th>
                  <th className="py-3.5 px-5">Contact Administrator</th>
                  <th className="py-3.5 px-5">Email & Phone</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredCenters.map((center) => (
                  <tr key={center.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-bold text-gray-900 text-sm">{center.branchName}</div>
                      <div className="font-mono text-[10px] text-gray-500 mt-1 uppercase tracking-wide bg-gray-100 px-1.5 py-0.5 rounded inline-block">
                        {center.levelCode.split('/').pop()}
                      </div>
                    </td>
                    <td className="py-4 px-5 font-semibold text-gray-750">
                      {getNationalName(center.parentCode)}
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        {center.fullName}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">ID: {center.nationalId}</div>
                    </td>
                    <td className="py-4 px-5 space-y-1">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail className="h-3 w-3 text-gray-400" />
                        {center.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600 font-mono">
                        <Phone className="h-3 w-3 text-gray-400" />
                        {center.phoneNumber}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      {center.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 uppercase tracking-wide">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wide">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setResetTargetUser(center);
                          setIsResetOpen(true);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-emerald-700 transition-colors inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] uppercase border border-gray-100 hover:border-emerald-100 bg-white"
                        title="Force Credentials Reset"
                      >
                        <Key className="h-3 w-3" /> Credentials
                      </button>

                      <button
                        onClick={() => handleToggleActive(center.id, center.isActive)}
                        className={`p-[5.5px] rounded border transition-colors inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] uppercase ${
                          center.isActive
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {center.isActive ? (
                          <>
                            <PowerOff className="h-3 w-3" /> Suspend
                          </>
                        ) : (
                          <>
                            <Power className="h-3 w-3" /> Activate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Register New Center */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-extrabold text-[#111827] text-sm uppercase tracking-wide">
                Register New Wellness Center
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-900 font-bold"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateCenter} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                  Wellness Center Unit Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Harare Central Wellness Center"
                    value={centerName}
                    onChange={(e) => setCenterName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                    Contact Person (Administrator Name)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Brother Noah"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block block">
                    National ID Number (Optional)
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. 58-123456-R-43"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                    Account Access Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. hre-wellness@jdn.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                    Contact Phone Number (E.164)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. +263777123456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                    />
                  </div>
                </div>
              </div>

              {/* Linked National HQ - selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                  Select Linked National HQ
                </label>
                <select
                  disabled={currentUser.level === JdnLevel.NATIONAL}
                  value={linkedNationalCode}
                  onChange={(e) => setLinkedNationalCode(e.target.value)}
                  className="w-full p-2 text-xs border border-gray-200 rounded-lg text-gray-900 bg-white font-semibold focus:outline-[#166534] disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {currentUser.level === JdnLevel.NATIONAL ? (
                    <option value={currentUser.levelCode}>
                      {currentUser.branchName} ({currentUser.levelCode.split('/').pop()})
                    </option>
                  ) : (
                    nationals.map((nat) => (
                      <option key={nat.id} value={nat.levelCode}>
                        {nat.branchName} ({nat.levelCode.split('/').pop()})
                      </option>
                    ))
                  )}
                </select>
                <span className="text-[10px] text-gray-500 font-medium">
                  {currentUser.level === JdnLevel.NATIONAL 
                    ? 'Automatically bound to your National instance.' 
                    : 'System-wide National link. Used to establish hierarchical scope.'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                  Temporary Account Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters (forced reset on first sign in)"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
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
                  Create Center Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Emergency credentials reset */}
      {isResetOpen && resetTargetUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-extrabold text-[#111827] text-xs uppercase tracking-wide">
                Force Reset Credentials
              </h3>
              <button
                onClick={() => {
                  setIsResetOpen(false);
                  setResetTargetUser(null);
                }}
                className="text-gray-400 hover:text-gray-900 font-bold text-xs"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-150 p-3 rounded-lg text-red-900 text-[11px] leading-relaxed">
                Emergency override will set a new credentials password for **{resetTargetUser.fullName}** ({resetTargetUser.branchName}).
                The account will be forced to set a new personal key on their subsequent login.
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                  New Temporary Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters required"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-900 focus:outline-[#166534]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetOpen(false);
                    setResetTargetUser(null);
                  }}
                  className="px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
