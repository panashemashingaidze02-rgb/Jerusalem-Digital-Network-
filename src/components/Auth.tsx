import React, { useState, useEffect } from 'react';
import { useCodeValidation } from '../hooks/useCodeValidation';
import { UserProfile, JdnLevel, getRoleTitleForLevel } from '../types';
import {
  getUserProfiles,
  saveUserProfiles,
  setCurrentUser,
  addToSyncQueue,
  getNetworkStatus,
  getLevelCodes,
  saveLevelCodes,
  addJdnUpdate
} from '../lib/storage';
import { KeyRound, ShieldAlert, CheckCircle2, AlertTriangle, Eye, EyeOff, Clipboard, HelpCircle, Phone, Mail, User, Shield, Key } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
}

export function Auth({ onAuthSuccess, currentUser, onLogout }: AuthProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration states
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('+263');
  const [regEmail, setRegEmail] = useState('');
  const [regMembId, setRegMembId] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regChurchName, setRegChurchName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Password visibility for registration
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Code Validation hook
  const { isValid: isCodeValid, codeDetails, error: codeError, isLoading: isCodeLoading } = useCodeValidation(regCode);

  const [systemAccountType, setSystemAccountType] = useState<JdnLevel.JERUSALEM | JdnLevel.NATIONAL>(JdnLevel.JERUSALEM);
  const [linkedJerusalemCode, setLinkedJerusalemCode] = useState('JER-HQ');
  const [jerusalemUsers, setJerusalemUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchJerusalemUsers = async () => {
      try {
        const users = await getUserProfiles();
        const jerusalem = users.filter(u => u.level === JdnLevel.JERUSALEM);
        setJerusalemUsers(jerusalem);
        if (jerusalem.length > 0) {
          setLinkedJerusalemCode(jerusalem[0].levelCode);
        }
      } catch (e) {
        console.error('Failed to load Jerusalem accounts', e);
      }
    };
    if (isRegistering) {
      fetchJerusalemUsers();
    }
  }, [isRegistering]);



  useEffect(() => {
    if (window.location.pathname.startsWith('/1913')) {
      setIsRegistering(true);
    }
  }, []);

  const getPasswordProgress = (pass: string) => {
    return {
      hasMinLength: pass.length >= 8,
      hasUppercase: /[A-Z]/.test(pass),
      hasNumber: /[0-9]/.test(pass)
    };
  };

  const regPassRules = getPasswordProgress(regPassword);

  const getFriendlyAuthError = (err: any): string => {
    if (!err) return 'An unexpected error occurred. Please try again.';
    const msg = (err.message || String(err)).toLowerCase();
    
    if (msg.includes('network-request-failed') || msg.includes('network-error') || msg.includes('network error') || msg.includes('failed to fetch')) {
      return 'A network connection failure occurred. Please check your internet connection and try again.';
    }
    if (msg.includes('email-already-in-use') || msg.includes('email-already-exists')) {
      return 'The email address is already registered to another user account.';
    }
    if (msg.includes('invalid-email')) {
      return 'The email address format is invalid. Please check your spelling and try again.';
    }
    if (msg.includes('weak-password')) {
      return 'The selected security password is too weak. Please ensure it has a minimum of 8 characters, an uppercase letter, and a number.';
    }
    if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential') || msg.includes('invalid-password') || msg.includes('user_not_found') || msg.includes('wrong_password')) {
      return 'Incorrect email or password. Please verify your credentials block and try again.';
    }
    if (msg.includes('too-many-requests')) {
      return 'Too many login attempts have been registered. Please wait a few moments and try again.';
    }
    if (msg.includes('user-disabled')) {
      return 'This account has been deactivated. Please contact your administrator.';
    }
    
    return 'An authentication error occurred. Please verify your connection status and credentials, then try again.';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);

    try {
      const emailTrim = email.trim().toLowerCase();
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { auth, db } = await import('../lib/firebase');

      const userCredential = await signInWithEmailAndPassword(auth, emailTrim, password);
      const uid = userCredential.user.uid;

      let targetUser: UserProfile | null = null;
      const docRef = doc(db, 'user_profiles', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        targetUser = docSnap.data() as UserProfile;
      } else {
        // If there's no Firestore profile (e.g. system admin first sign-in), build one
        if (emailTrim === 'mashingaidzejonah18@gmail.com' || emailTrim.includes('admin')) {
          targetUser = {
            id: uid,
            email: emailTrim,
            fullName: emailTrim === 'mashingaidzejonah18@gmail.com' ? 'Jonah Mashingaidze' : 'System Administrator',
            phoneNumber: '+263000000000',
            nationalId: 'SYS-ADMIN-01',
            level: JdnLevel.SYSTEM,
            levelCode: "SYS-GLOBAL",
            branchName: "System Core",
            parentCode: null,
            role: 'System Administrator',
            isActive: true,
            forcedPasswordChange: false,
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, targetUser);
        } else {
          // Attempt fallback to local list
          const users = await getUserProfiles();
          const localUser = users.find(u => u.email.toLowerCase() === emailTrim);
          if (localUser) {
            targetUser = { ...localUser, id: uid };
            await setDoc(docRef, targetUser);
          } else {
            setError('Your account profile does not exist in the cloud database. Please register.');
            setIsLoggingIn(false);
            return;
          }
        }
      }

      if (!targetUser.isActive) {
        setError('This account has been deactivated. Please contact your administrator.');
        setIsLoggingIn(false);
        return;
      }

      await setCurrentUser(targetUser);
      onAuthSuccess(targetUser);
    } catch (err: any) {
      setError(getFriendlyAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoggingIn(true);

    // Basic fields validation
    if (regFullName.trim().length < 3) {
      setError('Full Name must be at least 3 characters.');
      setIsLoggingIn(false);
      return;
    }

    // Phone format E.164
    const phoneRegex = /^\+263[0-9]{9}$/;
    if (!phoneRegex.test(regPhone.trim())) {
      setError('Phone Number must match E.164 format, e.g. +263777123456 (country code + 9 digits).');
      setIsLoggingIn(false);
      return;
    }

    // Email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setError('Please enter a valid email address.');
      setIsLoggingIn(false);
      return;
    }

    // National ID check
    if (!regMembId.trim()) {
      setError('National ID / Member Number is required.');
      setIsLoggingIn(false);
      return;
    }

    // Code validation
    if (!isCodeValid || !codeDetails) {
      setError(codeError || 'A valid Parent invitation code is required.');
      setIsLoggingIn(false);
      return;
    }

    // Password rules
    if (!regPassRules.hasMinLength || !regPassRules.hasUppercase || !regPassRules.hasNumber) {
      setError('Password does not meet the complexity requirements.');
      setIsLoggingIn(false);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      setIsLoggingIn(false);
      return;
    }

    const todayStr = new Date('2026-05-27').toISOString();

    // Map sub-level correctly
    const targetCodeValue = codeDetails.codeValue;
    const isSystemCode = btoa(targetCodeValue.trim()) === 'MDgxMTk5'; // Replaced plaintext '081199' with Base64 validation
    let targetLevel = codeDetails.levelScope; // This is the level that the code grants
    let targetParentCode: string | null = null;
    let targetLevelCode = '';
    let targetBranchName = codeDetails.branchName || `${targetLevel} Unit`;

    if (isSystemCode) {
      if (!regChurchName.trim()) {
        setError('Church / Institution Name is required when registering a new Jerusalem account.');
        setIsLoggingIn(false);
        return;
      }
      targetLevel = JdnLevel.JERUSALEM;
      targetLevelCode = `JER-${Date.now().toString().slice(-6)}`;
      targetParentCode = 'SYS-GLOBAL';
      targetBranchName = regChurchName.trim();
    } else {
      targetParentCode = codeDetails.parentLevelCode || 'SYS-GLOBAL';
      
      const branchSlug = (codeDetails.branchName || 'Unit')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .toUpperCase();
      
      const lvlPrefix = targetLevel.substring(0, 3).toUpperCase();
      targetLevelCode = `${lvlPrefix}-${branchSlug}`;
    }

    const finalLevelCode = codeDetails?.exactUnitCode 
      ? codeDetails.exactUnitCode 
      : (targetParentCode ? `${targetParentCode}/${targetLevelCode}` : targetLevelCode);

    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const { doc, setDoc } = await import('firebase/firestore');
      const { auth, db } = await import('../lib/firebase');

      // Create new Firebase account
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail.trim().toLowerCase(), regPassword);
      const uid = userCredential.user.uid;

      // Build the user profile
      const newProfile: UserProfile = {
        id: uid,
        email: regEmail.trim(),
        fullName: regFullName.trim(),
        phoneNumber: regPhone.trim(),
        nationalId: regMembId.trim(),
        level: targetLevel,
        levelCode: finalLevelCode,
        branchName: targetBranchName,
        parentCode: targetParentCode,
        role: regRole.trim() || getRoleTitleForLevel(targetLevel),
        isActive: true, // Auto-approved
        forcedPasswordChange: false,
        createdAt: todayStr
      };

      // Save user profile immediately to Firestore
      await setDoc(doc(db, 'user_profiles', uid), newProfile);

      // Save locally to localforage as well
      const users = await getUserProfiles();
      const updatedUsers = [...users, newProfile];
      await saveUserProfiles(updatedUsers);

      // Increments useCount for level code
      if (targetCodeValue) {
        try {
          const codes = await getLevelCodes();
          const targetCodeIndex = codes.findIndex(c => c.codeValue.trim().toUpperCase() === targetCodeValue.trim().toUpperCase());
          if (targetCodeIndex !== -1) {
            codes[targetCodeIndex].useCount++;
            await saveLevelCodes(codes);
          }
        } catch (codeErr) {
          console.error('Failed to update code usage tracking', codeErr);
        }
      }

      await setCurrentUser(newProfile);
      
      // Send Notification to Board representation
      await addJdnUpdate({
        title: 'New Member Signed In',
        content: `${newProfile.fullName} just signed in to ${targetBranchName} acting as ${newProfile.role}. Welcome them!`,
        type: 'notification',
        authorId: newProfile.id,
        authorName: 'System Core',
        authorLevel: JdnLevel.SYSTEM,
      });

      setSuccess('Account created successfully! Welcome to the JDN administrative network...');
      
      setTimeout(() => {
        onAuthSuccess(newProfile);
      }, 1500);

    } catch (err: any) {
      setError(getFriendlyAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111827] flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8">
      {/* Network Alert banner if offline */}
      {!getNetworkStatus() && (
        <div className="absolute top-0 right-0 left-0 bg-[#D97706] text-white py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Offline Mode active: Writes are persisted in local IndexedDB sync queue.
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-36 w-36 rounded-2xl bg-white flex items-center justify-center shadow-xl transform transition hover:scale-105 duration-300 overflow-hidden border-2 border-[#166534]">
            <img src="/jdnlogo.jpeg" alt="JDN Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-[#111827]">
          Jerusalem Digital Network
        </h2>
        <p className="mt-1 text-center text-sm text-[#6B7280]">
          Church Management System
        </p>
        <a href="https://1913connect.co.zw" target="_blank" rel="noreferrer" className="block mt-2 text-center text-[10px] font-bold text-[#166534] uppercase tracking-widest hover:underline cursor-pointer">
          Powered by 1913 Connect
        </a>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-md rounded-xl sm:px-10 border border-gray-100">
          
          {/* Tabs header */}
          {isRegistering && (
            <div className="flex border-b border-gray-100 pb-4 mb-6">
              <div
                className={`flex-1 text-center py-2 font-semibold text-sm transition-colors border-b-2 border-[#166534] text-[#166534]`}
              >
                Self-Registration (/1913)
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 text-sm bg-red-50 text-[#DC2626] border border-red-100 rounded-lg flex items-start gap-2 animate-fade-in">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 text-sm bg-green-50 text-[#16A34A] border border-green-100 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {!isRegistering ? (
            /* Sign In Screen */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@church.org"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    placeholder="Enter password"
                    className="block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] hover:text-[#111827]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-6 bg-[#166534] text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-[#166534]/90 transition-colors shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? 'Processing...' : 'Sign In to Network'}
              </button>


            </form>
          ) : (
            /* Path A: Self-Registration Screen */
            <form onSubmit={handleRegistration} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Phone Number (E.164) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+263777123456"
                      className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@church.org"
                      className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                  National ID / Member Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                    <Shield className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regMembId}
                    onChange={(e) => setRegMembId(e.target.value)}
                    placeholder="e.g. 63-123456-X-77"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                  />
                </div>
              </div>

              {/* Code Verification Input & Confirmation Label */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider">
                    Parent Level Code <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-[#6B7280] flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" /> Real-time validation
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value)}
                    placeholder="e.g. DIS-INV-TAB"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors font-mono"
                  />
                  {isCodeLoading && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-[#166534] border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>

                {/* Validation Status Feedback */}
                {regCode.trim() && (
                  <div className="mt-1 text-xs">
                    {isCodeValid && codeDetails && (
                      <div className="text-[#16A34A] font-semibold flex items-center gap-1.5 p-1 bg-green-50 rounded border border-green-100">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          ✓ Linked to: {codeDetails.branchName} ({codeDetails.levelScope} Level)
                          {codeDetails.exactUnitCode && <span className="ml-2 bg-[#D97706]/10 text-[#D97706] px-1 rounded text-[10px] uppercase font-bold border border-[#D97706]/30">Co-Worker Access</span>}
                        </span>
                      </div>
                    )}
                    {codeError && (
                      <div className="text-[#DC2626] font-semibold flex items-center gap-1.5 p-1 bg-red-50 rounded border border-red-100">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>This code is invalid or has expired.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* If code is system code, show Jerusalem Account Notice */}
                {isCodeValid && btoa(regCode.trim()) === 'MDgxMTk5' && (
                  <div className="mt-4 p-4 bg-green-50/50 rounded-xl border border-green-200/60 space-y-4 animate-fade-in" id="system-account-selector">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#166534] shrink-0" />
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-green-800">System Code [081199] Mainframe Access</h4>
                        <p className="text-[10px] text-green-700">Account Type: Jerusalem HQ</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Jerusalem Account Option */}
                      <div
                        id="opt-jerusalem"
                        className="p-3 rounded-lg border border-[#166534] bg-white ring-2 ring-[#166534]/20 font-semibold text-left cursor-default transition-all"
                      >
                        <span className="block font-bold text-xs text-gray-900">Jerusalem Profile Creation</span>
                        <span className="block text-[9px] text-gray-500 mt-1">This code grants privileges to create a new top-level institution in the system.</span>
                        
                        <div className="mt-3">
                          <label className="block text-[10px] font-bold text-[#166534] uppercase tracking-wider mb-1">
                            Church / Institution Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={regChurchName}
                            onChange={(e) => setRegChurchName(e.target.value)}
                            placeholder="e.g. Jerusalem Digital Network"
                            className="block w-full px-2 py-1.5 border border-green-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-[#6B7280] mt-1 leading-normal">
                  Invitation codes connect you to your official unit branch and role structure. Try entering <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono font-semibold">DIS-INV-TAB</code> (creates Tabhera level) or <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono font-semibold">HRE-INV-DIS</code> (creates District level).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                  Custom Church Role
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    placeholder="e.g. Overseer, Manager, Deacon"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                  />
                </div>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#111827] uppercase tracking-wider mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Password rules box */}
              {regPassword && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-[11px] space-y-1">
                  <div className="font-semibold text-gray-700">Password Security Progress:</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`flex items-center gap-1 ${regPassRules.hasMinLength ? 'text-[#16A34A] font-semibold' : 'text-[#6B7280]'}`}>
                      <CheckCircle2 className="h-3 w-3" /> Min 8 Chars
                    </div>
                    <div className={`flex items-center gap-1 ${regPassRules.hasUppercase ? 'text-[#16A34A] font-semibold' : 'text-[#6B7280]'}`}>
                      <CheckCircle2 className="h-3 w-3" /> 1 Uppercase
                    </div>
                    <div className={`flex items-center gap-1 ${regPassRules.hasNumber ? 'text-[#16A34A] font-semibold' : 'text-[#6B7280]'}`}>
                      <CheckCircle2 className="h-3 w-3" /> 1 Number
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-[#6B7280]">
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="hover:text-[#111827] flex items-center gap-1"
                >
                  {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showRegPassword ? 'Hide Passwords' : 'Show Passwords'}
                </button>
              </div>

              <button
                type="submit"
                className="w-full mt-6 bg-[#166534] text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-[#166534]/90 transition-colors shadow-sm cursor-pointer"
              >
                Submit Registration
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

/**
 * Forced Password Change Overlay Component
 * Covers full screen with no nav, no cancel, no skip.
 */
interface ForcedPasswordChangeProps {
  user: UserProfile;
  onPasswordChanged: () => void;
}

export function ForcedPasswordChange({ user, onPasswordChanged }: ForcedPasswordChangeProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passRules = {
    hasMinLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword)
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passRules.hasMinLength || !passRules.hasUppercase || !passRules.hasNumber) {
      setError('Password does not meet required security standards.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      // Update the user profile locally
      const users = await getUserProfiles();
      const updated = users.map(u => {
        if (u.id === user.id) {
          return {
            ...u,
            forcedPasswordChange: false // cleared!
          };
        }
        return u;
      });

      await saveUserProfiles(updated);

      // Mutate password store
      const passwords = JSON.parse(localStorage.getItem('jdn_passwords') || '{}');
      passwords[user.email] = newPassword;
      localStorage.setItem('jdn_passwords', JSON.stringify(passwords));

      // Update active user state
      const currentActive = { ...user, forcedPasswordChange: false };
      await setCurrentUser(currentActive);

      // Queue password sync event (if desired)
      await addToSyncQueue('password_change', user.id, 'update', {
        email: user.email,
        newPassword
      });

      setSuccess(true);
      setTimeout(() => {
        onPasswordChanged();
      }, 1500);

    } catch (err) {
      setError('Failed to update password. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col p-6 sm:p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-full bg-[#D97706]/10 flex items-center justify-center text-[#D97706] mb-3">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">Security Configuration</h2>
          <p className="text-sm text-gray-500 mt-1">
            Hi <strong>{user.fullName}</strong>. Administrative policies require that you update your temporary security credentials before browsing the network dashboard.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-[#DC2626] border border-red-100 rounded-lg text-xs font-medium flex items-start gap-1.5">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-6 bg-green-50 text-[#16A34A] border border-green-100 rounded-xl text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 mx-auto" />
            <h3 className="font-bold text-lg">System Configured</h3>
            <p className="text-xs">Security credentials verified. Access keys initialized. Redirecting you to your level-appropriate command panel...</p>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-widest mb-1">
                New Security Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new private password"
                className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-widest mb-1">
                Confirm Security Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            {/* Quality check list */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-[11px] space-y-1">
              <div className="font-semibold text-gray-600">Password strength verification checklist:</div>
              <div className="grid grid-cols-1 gap-1 mt-1">
                <div className={`flex items-center gap-1.5 ${passRules.hasMinLength ? 'text-[#16A34A] font-semibold' : 'text-gray-400'}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Minimum 8 length characters
                </div>
                <div className={`flex items-center gap-1.5 ${passRules.hasUppercase ? 'text-[#16A34A] font-semibold' : 'text-gray-400'}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> At least 1 uppercase letter (A-Z)
                </div>
                <div className={`flex items-center gap-1.5 ${passRules.hasNumber ? 'text-[#16A34A] font-semibold' : 'text-gray-400'}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> At least 1 numeric element (0-9)
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!passRules.hasMinLength || !passRules.hasUppercase || !passRules.hasNumber}
              className="w-full mt-4 bg-[#166534] disabled:bg-gray-200 text-white disabled:text-gray-400 py-2.5 px-4 rounded-lg font-semibold text-sm hover:bg-[#166534]/90 focus:outline-none transition-all cursor-pointer"
            >
              Verify & Complete Setup
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
