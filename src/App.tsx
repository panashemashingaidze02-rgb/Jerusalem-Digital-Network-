import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { UserProfile, JdnLevel } from './types';
import {
  initializeDatabase,
  getCurrentUser,
  setCurrentUser,
  getSyncQueue,
  saveSyncQueue,
  processSyncQueue,
  getNetworkStatus,
  setNetworkStatus,
  initializeNetworkListeners,
  getGlobalMaintenanceMode,
  getNotifications,
  saveNotifications,
  addNotification,
  getLastSyncTime,
  getSettings
} from './lib/storage';
import { Auth, ForcedPasswordChange } from './components/Auth';
import Verify from './components/Verify';
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Members = React.lazy(() => import('./components/Members').then(m => ({ default: m.Members })));
const Attendance = React.lazy(() => import('./components/Attendance').then(m => ({ default: m.Attendance })));
const Contributions = React.lazy(() => import('./components/Contributions').then(m => ({ default: m.Contributions })));
const Settings = React.lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const PlatformLogs = React.lazy(() => import('./components/PlatformLogs').then(m => ({ default: m.PlatformLogs })));
const Help = React.lazy(() => import('./components/Help').then(m => ({ default: m.Help })));
const Updates = React.lazy(() => import('./components/Updates').then(m => ({ default: m.Updates })));
const SpecialMurairos = React.lazy(() => import('./components/SpecialMurairos').then(m => ({ default: m.SpecialMurairos })));
const LeadershipStats = React.lazy(() => import('./components/LeadershipStats'));
const HierarchyStats = React.lazy(() => import('./components/HierarchyStats'));
const Performance = React.lazy(() => import('./components/Performance').then(m => ({ default: m.Performance })));
const WellnessCenters = React.lazy(() => import('./components/WellnessCenters').then(m => ({ default: m.WellnessCenters })));
const Ungano = React.lazy(() => import('./components/Ungano').then(m => ({ default: m.Ungano })));
const DareMinutes = React.lazy(() => import('./components/DareMinutes').then(m => ({ default: m.DareMinutes })));
const PrayerRequests = React.lazy(() => import('./components/PrayerRequests').then(m => ({ default: m.PrayerRequests })));
const BibleModule = React.lazy(() => import('./components/BibleModule').then(m => ({ default: m.BibleModule })));
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import {
  LayoutDashboard,
  Users,
  CalendarCheck2,
  Coins,
  Settings as SettingsIcon,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Menu,
  X,
  Radio,
  Church,
  Truck,
  Trophy,
  ScrollText,
  Landmark,
  Crown,
  Layers,
  HelpCircle,
  ShieldAlert,
  Clock,
  HeartPulse,
  BookOpen
} from 'lucide-react';

export default function App() {
  const [currentUser, setUser] = useState<UserProfile | null>(null);
  const [bgImgUrl, setBgImgUrl] = useState<string | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVerifyMode, setIsVerifyMode] = useState(false);

  // Connection and indicators state
  const [isUnderMaintenance, setIsUnderMaintenance] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  // Sync Queue states for layout indicator
  const [queueState, setQueueState] = useState<{ count: number; hasFailed: boolean; isProcessing: boolean }>({
    count: 0,
    hasFailed: false,
    isProcessing: false
  });
  const [isOnline, setIsOnline] = useState(getNetworkStatus());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [showSyncHub, setShowSyncHub] = useState(false);
  const [syncHubItems, setSyncHubItems] = useState<any[]>([]);

  const openSyncHub = async () => {
    const queue = await getSyncQueue();
    setSyncHubItems(queue);
    setShowSyncHub(true);
  };

  const loadSettingsBackground = async () => {
    try {
      const settings = await getSettings();
      if (settings && settings.churchBackgroundUrl) {
        setBgImgUrl(settings.churchBackgroundUrl);
      } else {
        setBgImgUrl(null);
      }
    } catch (err) {
      console.warn('Failed loading background image settings', err);
    }
  };

  useEffect(() => {
    // 1. Initialise localForage preseeded assets DB safely
    const bootDb = async () => {
      if (window.location.pathname.startsWith('/verify/')) {
        setIsVerifyMode(true);
        setIsDbLoaded(true);
        setShowSplash(false);
        return;
      }
      try {
        await initializeDatabase();
        await loadSettingsBackground();
        const user = await getCurrentUser();
        setUser(user);

        const maint = await getGlobalMaintenanceMode();
        setIsUnderMaintenance(maint);

        const notifs = await getNotifications();
        setNotifications(notifs);

        if (typeof window !== 'undefined' && 'Notification' in window) {
          setNotificationPermission(Notification.permission);
        }

        initializeNetworkListeners();

        setIsDbLoaded(true);
        await updateSyncIndicators();

        // Check Firebase connection
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
          console.log("Firebase connection established.");
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      } catch (err) {
        console.error('Error booting database constraints', err);
      }
    };
    bootDb();

    const splashTimer = setTimeout(() => {
       setShowSplash(false);
    }, 2500);

    // 2. Custom events listeners to trigger real-time layout sync cues
    const refreshQueueStats = () => updateSyncIndicators();
    const refreshNetwork = () => setIsOnline(getNetworkStatus());
    const refreshNotifications = async () => {
      const updated = await getNotifications();
      setNotifications(updated);
    };
    const refreshMaintenanceState = async () => {
      const maint = await getGlobalMaintenanceMode();
      setIsUnderMaintenance(maint);
    };

    const handleSyncStarted = () => setQueueState(prev => ({ ...prev, isProcessing: true }));
    const handleSyncEnded = () => {
      setQueueState(prev => ({ ...prev, isProcessing: false }));
      updateSyncIndicators();
    };

    window.addEventListener('jdn_sync_queue_updated', refreshQueueStats);
    window.addEventListener('jdn_network_changed', refreshNetwork);
    window.addEventListener('jdn_notifications_updated', refreshNotifications);
    window.addEventListener('jdn_maintenance_changed', refreshMaintenanceState);
    window.addEventListener('jdn_sync_started', handleSyncStarted);
    window.addEventListener('jdn_sync_ended', handleSyncEnded);
    window.addEventListener('jdn_settings_updated', loadSettingsBackground);

    return () => {
      window.removeEventListener('jdn_sync_queue_updated', refreshQueueStats);
      window.removeEventListener('jdn_network_changed', refreshNetwork);
      window.removeEventListener('jdn_notifications_updated', refreshNotifications);
      window.removeEventListener('jdn_maintenance_changed', refreshMaintenanceState);
      window.removeEventListener('jdn_sync_started', handleSyncStarted);
      window.removeEventListener('jdn_sync_ended', handleSyncEnded);
      window.removeEventListener('jdn_settings_updated', loadSettingsBackground);
    };
  }, []);

  const updateSyncIndicators = async () => {
    const queue = await getSyncQueue();
    setSyncHubItems(queue);
    const lSync = await getLastSyncTime();
    setLastSyncTime(lSync);
    const hasFailed = queue.some(item => item.failed);
    setQueueState(prev => ({
      ...prev,
      count: queue.length,
      hasFailed
    }));
  };

  const handleLogout = async () => {
    await setCurrentUser(null);
    setUser(null);
    setActiveTab('Dashboard');
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      alert('You are currently simulated offline. Please switch network simulator to Online to sync.');
      return;
    }
    await processSyncQueue();
    await updateSyncIndicators();
  };

  const forceReloadSessionProfile = async () => {
    const updated = await getCurrentUser();
    setUser(updated);
  };

  const handleNotificationMarkRead = async (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    setNotifications(updated);
    await saveNotifications(updated);

    // Identify related tab and navigate
    const targetNotif = notifications.find(n => n.id === id);
    if (targetNotif) {
      const titleLower = targetNotif.title.toLowerCase();
      const msgLower = targetNotif.message.toLowerCase();

      let targetTab = 'Dashboard';
      if (titleLower.includes('bible') || msgLower.includes('bible') || titleLower.includes('verse') || msgLower.includes('verse')) {
        targetTab = 'Bible';
      } else if (titleLower.includes('audit') || msgLower.includes('audit') || titleLower.includes('security') || msgLower.includes('security')) {
        targetTab = 'Audit Logs';
      } else if (titleLower.includes('help') || msgLower.includes('help') || titleLower.includes('support') || msgLower.includes('support')) {
        targetTab = 'Help & Support';
      } else if (titleLower.includes('settings') || msgLower.includes('settings') || titleLower.includes('sync') || msgLower.includes('sync') || titleLower.includes('backup') || msgLower.includes('backup')) {
        targetTab = 'Settings';
      } else if (titleLower.includes('mabasa') || msgLower.includes('mabasa') || titleLower.includes('murairo') || msgLower.includes('murairo') || titleLower.includes('ungano') || msgLower.includes('ungano')) {
        targetTab = 'Mabasa';
      } else if (titleLower.includes('member') || msgLower.includes('member') || titleLower.includes('convert') || msgLower.includes('convert') || titleLower.includes('sunday school') || msgLower.includes('sunday school')) {
        targetTab = 'Members';
      } else if (titleLower.includes('wellness') || msgLower.includes('wellness') || titleLower.includes('center') || msgLower.includes('center')) {
        targetTab = 'Wellness';
      } else if (titleLower.includes('dare') || msgLower.includes('dare') || titleLower.includes('minutes') || msgLower.includes('minutes')) {
        targetTab = 'Dare Minutes';
      } else if (titleLower.includes('prayer') || msgLower.includes('prayer') || titleLower.includes('request') || msgLower.includes('request')) {
        targetTab = 'Prayer Requests';
      }

      // Check if the tab is available for the current user
      const isSystem = currentUser?.level === JdnLevel.SYSTEM;
      const availableTabs = isSystem
        ? ['Dashboard', 'Bible', 'Audit Logs', 'Help & Support', 'Settings']
        : [
            'Dashboard',
            'Bible',
            'Help & Support',
            'Settings',
            ...((currentUser?.level === JdnLevel.JERUSALEM) ? ['Mabasa'] : []),
            'Members',
            'Wellness',
            'Dare Minutes',
            'Prayer Requests'
          ];

      if (availableTabs.includes(targetTab)) {
        setActiveTab(targetTab);
        toast.success(`Navigated to ${targetTab}`);
      }
    }
  };

  const handleClearAllNotifications = async () => {
    setNotifications([]);
    await saveNotifications([]);
  };

  const handleRequestPushPermission = async () => {
    console.log('Requesting push permission...');
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        setNotificationPermission(permission);
        if (permission === 'granted') {
          await addNotification(
            'Push Enabled Successfully',
            'You have granted permission for Capacitor/PWA native push notifications on your device.',
            'success',
            true
          );
        } else {
          alert('Native push permissions were declined or dismissed. You can enable them in your device platform settings.');
        }
      } catch (e) {
        console.error('Permission request error:', e);
        // Fallback for simulation purposes only
        setNotificationPermission('granted');
        await addNotification(
          'Push Notifications Authorized',
          'Capacitor native push integration is authorized for this simulated hybrid app client.',
          'success',
          true
        );
      }
    } else {
      console.warn('Notifications not supported in this environment');
      setNotificationPermission('granted');
      await addNotification(
        'Push Status Configured',
        'Capacitor native push integration ready on device wrapper.',
        'info',
        true
      );
    }
  };

  const handleTriggerTestPush = async () => {
    const title = 'JDN System Alert 🔔';
    const message = 'Test Push Notification! This represents a real-time native Capacitor push log.';
    
    if (notificationPermission === 'granted' && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        new Notification(title, { body: message, icon: '/jdnlogo.jpeg' });
      } catch (e) {
        console.log('Failed raising browser notification, showing internal alert');
      }
    }
    
    await addNotification(title, message, 'info', true);
    alert(`[Push Emulated] ${title}: ${message}`);
  };

  const renderSyncAndNotifications = (isMobile: boolean) => (
    <div className={`flex items-center gap-2 sm:gap-3 ${isMobile ? '' : 'hidden md:flex flex-1 justify-between w-full'}`}>
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Sync Status Badge */}
        {!isMobile && (
          <button
            onClick={openSyncHub}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider transition-all hover:opacity-90 cursor-pointer border-0 shadow-sm ${syncIndicatorClass}`}
          >
            <Radio className="h-3.5 w-3.5" />
            {syncIndicatorLabel}
          </button>
        )}
        
        {isMobile && (
          <button
            onClick={openSyncHub}
            className="focus:outline-none cursor-pointer border-0 p-0 m-0 bg-transparent flex shrink-0"
          >
            <span className={`h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full flex shrink-0 border border-white/20 shadow-sm ${queueState.count > 0 ? 'bg-amber-405 animate-pulse' : 'bg-[#166534]'}`} title={syncIndicatorLabel} />
          </button>
        )}

        {/* Network Indicator Badge */}
        <button
          onClick={openSyncHub}
          className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase transition-all hover:opacity-90 cursor-pointer border-0 shrink-0 ${isOnline ? (isMobile ? 'bg-white/20 text-white border-transparent' : 'bg-green-100 text-green-800') : (isMobile ? 'bg-white text-red-650 border-white' : 'bg-red-100 text-red-800')}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? (isMobile ? 'bg-green-400' : 'bg-green-500') : 'bg-red-500'} ${!isOnline ? 'animate-pulse' : ''}`} />
          {isOnline ? 'Live' : 'Offline'}
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        {/* Sync Trigger button */}
        {queueState.count > 0 && isOnline && !isMobile && (
          <button
            onClick={handleManualSync}
            disabled={queueState.isProcessing}
            className="bg-amber-100 border border-amber-200 text-[#D97706] hover:bg-amber-200 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${queueState.isProcessing ? 'animate-spin' : ''}`} />
            Upload
          </button>
        )}

        {/* NOTIFICATION BELL BLOCK */}
        <div className="relative">
          <button
            id={isMobile ? 'jdn_notif_bell_btn_mob' : 'jdn_notif_bell_btn'}
            onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors relative cursor-pointer border shadow-sm flex items-center justify-center ${isMobile ? 'bg-white/10 hover:bg-white/20 text-white border-white/10' : 'bg-gray-50/50 hover:bg-gray-100 text-gray-600 hover:text-[#166534] border-gray-100'}`}
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className={`absolute -top-1 -right-1 font-mono text-[8px] sm:text-[9px] font-black h-4 w-4 sm:h-4.5 sm:w-4.5 rounded-full flex items-center justify-center border-2 animate-bounce ${isMobile ? 'bg-red-500 text-white border-[#166534]' : 'bg-red-600 text-white border-white'}`}>
                {notifications.filter(n => !n.isRead).length}
              </span>
            )}
          </button>

          {/* NOTIFICATION DROPDOWN POPUP */}
          {showNotificationsDropdown && (
            <div id={isMobile ? 'jdn_notif_dropdown_mob' : 'jdn_notif_dropdown'} className={`absolute ${isMobile ? 'right-0 top-12' : 'right-0 mt-2.5'} w-72 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden text-xs text-gray-900`}>
              {/* Dropdown Header */}
              <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h4 className="font-extrabold text-[#111827] text-xs sm:text-sm">Alerts & System Push</h4>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium font-sans">Capacitor Native Sync Hub</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const updated = notifications.map(n => ({ ...n, isRead: true }));
                      setNotifications(updated);
                      await saveNotifications(updated);
                    }}
                    className="text-[9px] sm:text-[10px] text-[#166534] hover:underline font-bold bg-transparent cursor-pointer font-sans"
                  >
                    Read All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleClearAllNotifications}
                    className="text-[9px] sm:text-[10px] text-red-600 hover:underline font-bold bg-transparent cursor-pointer font-sans"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Native Capacitor Push permissions emulation console */}
              {isSystem && (
                <div className="bg-green-50/50 p-2 sm:p-3.5 border-b border-gray-100 space-y-1.5 sm:space-y-2">
                  <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-bold text-gray-700 font-sans">
                    <span>Native Push Status:</span>
                    <span className={`uppercase font-mono font-black ${notificationPermission === 'granted' ? 'text-green-600' : 'text-amber-500'}`}>
                      {notificationPermission}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestPushPermission}
                      className="flex-1 bg-white hover:bg-gray-50 text-gray-700 text-[9px] sm:text-[10px] font-bold py-1 px-1.5 sm:px-2 border border-gray-200 rounded transition-colors cursor-pointer font-sans"
                    >
                      Ask Perms
                    </button>
                    <button
                      onClick={handleTriggerTestPush}
                      className="flex-1 bg-white hover:bg-gray-50 text-gray-700 text-[9px] sm:text-[10px] font-bold py-1 px-1.5 sm:px-2 border border-gray-200 rounded transition-colors cursor-pointer flex items-center justify-center gap-1 font-sans"
                    >
                      Test Push
                    </button>
                  </div>
                </div>
              )}

              {/* List Container */}
              <div className="max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-gray-100 text-left">
                {notifications.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-gray-400 space-y-1">
                    <Bell className="h-6 w-6 sm:h-8 sm:w-8 mx-auto stroke-1" />
                    <p className="text-[10px] font-bold uppercase tracking-wider font-sans">Spooler Ledger Clean</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationMarkRead(notif.id)}
                      className={`p-2 sm:p-3.5 hover:bg-gray-50 transition-colors flex items-start gap-2.5 sm:gap-3 cursor-pointer ${notif.isRead ? 'opacity-70' : 'bg-green-50/30 font-semibold'}`}
                    >
                      <span className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full shrink-0 mt-1.5 ${notif.isRead ? 'bg-transparent' : 'bg-[#166534]'}`} />
                      
                      <div className="space-y-0.5 sm:space-y-1 flex-1 text-left">
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-gray-900 leading-snug font-bold text-[10px] sm:text-xs">{notif.title}</span>
                          {notif.isPushSimulated && (
                            <span className="bg-[#166534]/10 text-[#166534] font-bold uppercase text-[7px] sm:text-[8px] font-mono px-1 rounded tracking-wide shrink-0">PUSH APN</span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium leading-normal">{notif.message}</p>
                        <span className="block text-[8px] sm:text-[9px] text-gray-400 font-mono">{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Navigations Links Definitions
  const isSystem = currentUser?.level === JdnLevel.SYSTEM;
  const tabs = isSystem
    ? [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Bible', icon: BookOpen },
        { name: 'Audit Logs', icon: ScrollText },
        { name: 'Help & Support', icon: HelpCircle },
        { name: 'Settings', icon: SettingsIcon }
      ]
    : [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Bible', icon: BookOpen },
        { name: 'Members', icon: Users },
        { name: 'Attendance', icon: CalendarCheck2 },
        { name: 'Murairo Logs', icon: Coins },
        { name: 'Special Murairos', icon: Landmark },
        ...((currentUser?.level === JdnLevel.JERUSALEM) ? [{ name: 'Mabasa', icon: Crown }] : []),
        { name: 'Dare Minutes', icon: Clock },
        { name: 'Prayer Requests', icon: HeartPulse },
        ...(currentUser?.level !== JdnLevel.WELLNESS_CENTER ? [{ name: 'Hierarchy', icon: Layers }] : []),
        { name: 'Notices & Updates', icon: Radio },
        ...((currentUser?.level === JdnLevel.JERUSALEM || currentUser?.level === JdnLevel.NATIONAL)
          ? [{ name: 'Wellness Centers', icon: Church }]
          : []),
        ...((currentUser?.level === JdnLevel.JERUSALEM)
          ? [{ name: 'Ungano', icon: ScrollText }]
          : []),
        { name: 'Zvibatwa', icon: Trophy },
        ...((currentUser?.level === JdnLevel.JERUSALEM || currentUser?.level === JdnLevel.NATIONAL)
          ? [{ name: 'Audit Logs', icon: ScrollText }]
          : []),
        { name: 'Help & Support', icon: HelpCircle },
        { name: 'Settings', icon: SettingsIcon }
      ];

  if (isVerifyMode) {
    return <Verify />;
  }

  if (!isDbLoaded || showSplash) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center relative">
        <div className="flex-1 flex flex-col items-center justify-center space-y-5 px-4 w-full">
           <div className="h-36 w-36 bg-white rounded-3xl flex items-center justify-center shadow-2xl mb-4 overflow-hidden border-2 border-[#166534]">
             <img src="/jdnlogo.jpeg" alt="JDN Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
           </div>
           <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] text-center tracking-tight">Jerusalem Digital Network</h1>
           <div className="animate-spin h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full mx-auto"></div>
           <p className="text-sm font-bold text-gray-800 font-sans tracking-wide">Initializing Church Management System...</p>
        </div>
        <div className="pb-10 text-center px-4">
           <a href="https://1913connect.co.zw" target="_blank" rel="noreferrer" className="text-[11px] sm:text-xs text-gray-500 font-black uppercase tracking-widest hover:text-[#166534] transition-colors cursor-pointer block mb-2">Powered by 1913 Connect</a>
           <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">
              Developed by <a href="https://wmtech.co.zw" target="_blank" rel="noreferrer" className="text-[#166534] hover:underline font-bold">WeKwaMashie Technologies</a>
           </p>
        </div>
      </div>
    );
  }

  // Clear session displays if unauthenticated
  if (!currentUser) {
    return (
      <Auth
        onAuthSuccess={(user) => setUser(user)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  // Check if trying to access the restricted system admin page
  if (window.location.pathname.startsWith('/panashe') && currentUser.level !== JdnLevel.SYSTEM) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-red-200">
           <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
           <p className="text-gray-600 mb-6">The System Dashboard (/panashe) is restricted to authorized Jerusalem Digital Network master administrators only.</p>
           <button onClick={() => { window.location.href = '/'; }} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold w-full transition-colors">Return to Standard Dashboard</button>
        </div>
      </div>
    );
  }

  // Check if system-wide maintenance mode is enabled
  if (isUnderMaintenance && currentUser && currentUser.level !== JdnLevel.SYSTEM) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-gray-200 shadow-xl text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-28 w-28 bg-[#FEF2F2] rounded-full flex items-center justify-center border border-red-200">
              <ShieldAlert className="h-14 w-14 text-red-600 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">System Under Maintenance</h1>
            <p className="text-xs text-gray-500 font-mono tracking-wider uppercase font-bold text-red-600">Global Lock Active</p>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed font-semibold">
            Jerusalem Digital Network is currently undergoing scheduled optimization, safety audits, and schema reordering. Only Super Administrators can log in or access administrative tools at this time.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={async () => {
                const refreshed = await getGlobalMaintenanceMode();
                setIsUnderMaintenance(refreshed);
                if (!refreshed) {
                  alert('Maintenance lock is now lifted! Reloading...');
                } else {
                  alert('Maintenance lock is still engaged. Please try again later.');
                }
              }}
              className="w-full bg-[#166534] hover:bg-[#166534]/90 text-white font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Verify System Status
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-transparent hover:bg-gray-100 text-gray-700 font-bold text-xs py-2.5 rounded-lg border border-gray-200 transition-colors cursor-pointer"
            >
              Sign Out & Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Force Full Screen Password Change overlay for Path B admin creations or fresh sign-ups
  if (currentUser.forcedPasswordChange) {
    return (
      <ForcedPasswordChange
        user={currentUser}
        onPasswordChanged={forceReloadSessionProfile}
      />
    );
  }

  // Sync state colors for header indicator matching JDN specifications
  let syncIndicatorClass = 'bg-[#16A34A]'; // Green matches success: all items synced
  let syncIndicatorLabel = 'Database Synced';
  if (queueState.count > 0) {
    syncIndicatorClass = 'bg-[#D97706]'; // Yellow matches pending syncs
    syncIndicatorLabel = `Sync Queue: ${queueState.count} Pending`;
  }
  if (queueState.hasFailed) {
    syncIndicatorClass = 'bg-[#DC2626]'; // Red matches failed items uploads
    syncIndicatorLabel = 'Upload Actions Failed';
  }

  const ActiveComponent = () => {
    const renderTabContent = () => {
      switch (activeTab) {
        case 'Dashboard':
          return <Dashboard currentUser={currentUser} onChangeTab={(tab) => setActiveTab(tab)} />;
        case 'Bible':
          return <BibleModule currentUser={currentUser!} />;
        case 'Members':
          return <Members currentUser={currentUser} />;
        case 'Attendance':
          return <Attendance currentUser={currentUser} />;
        case 'Murairo Logs':
          return <Contributions currentUser={currentUser} />;
        case 'Special Murairos':
          return <SpecialMurairos currentUser={currentUser} />;
        case 'Mabasa':
          return <LeadershipStats currentUser={currentUser} />;
        case 'Dare Minutes':
          return <DareMinutes currentUser={currentUser} />;
        case 'Prayer Requests':
          return <PrayerRequests currentUser={currentUser} />;
        case 'Hierarchy':
          return <HierarchyStats currentUser={currentUser} />;
        case 'Notices & Updates':
          return <Updates currentUser={currentUser} />;
        case 'Zvibatwa':
          return <Performance currentUser={currentUser} />;
        case 'Wellness Centers':
          return <WellnessCenters currentUser={currentUser} />;
        case 'Ungano':
          return <Ungano currentUser={currentUser} />;
        case 'Audit Logs':
          return <PlatformLogs currentUser={currentUser} />;
        case 'Help & Support':
          return <Help currentUser={currentUser} />;
        case 'Settings':
          return <Settings currentUser={currentUser} onRefreshSession={forceReloadSessionProfile} />;
        default:
          return <Dashboard currentUser={currentUser} onChangeTab={(tab) => setActiveTab(tab)} />;
      }
    };

    return (
      <React.Suspense
        fallback={
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <RefreshCw className="h-10 w-10 text-[#166534] animate-spin mb-3" />
            <p className="text-sm font-semibold text-[#166534]">Loading portal session data...</p>
          </div>
        }
      >
        {renderTabContent()}
      </React.Suspense>
    );
  };

  return (
    <div 
      className="h-screen bg-[#F3F4F6] text-[#111827] flex flex-col md:flex-row font-sans overflow-hidden"
      style={bgImgUrl ? {
        backgroundImage: `url(${bgImgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } : {}}
    >
      <Toaster position="top-right" />
      
      {/* 1. DESKTOP PERMANENT SIDEBAR LAYOUT (tablet & desktop wider screen sizes - rigid dimension constraints) */}
      <aside className="hidden md:flex flex-col w-64 min-w-[256px] max-w-[256px] bg-[#166534] text-white border-r border-[#166534]/10 shrink-0 select-none h-full overflow-y-auto">
        <div className="p-5 border-b border-[#166534]/30 flex flex-col items-center">
          <div className="h-24 w-24 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-md overflow-hidden border-2 border-white/20">
            <img src={currentUser.profilePhoto || "/jdnlogo.jpeg"} alt="JDN Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">JDN Digital</span>
          <span className="text-[10px] text-white/70 font-mono uppercase tracking-wider mt-0.5">{currentUser.branchName || currentUser.level}</span>
        </div>

        {/* Links lists navigation */}
        <nav className="flex-1 p-4 space-y-1.5 focus:outline-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${isActive ? 'bg-white text-[#166534] shadow-sm' : 'text-white/80 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Foot user sidebar account controls */}
        <div className="p-4 border-t border-[#166534]/30 space-y-2 text-xs">
          <div className="font-semibold text-white/90 truncate leading-none">{currentUser.fullName}</div>
          <div className="text-[10px] text-white/50 truncate font-mono">{currentUser.role}</div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white font-bold p-2 rounded-lg flex items-center gap-1.5 justify-center transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" /> Log Out
          </button>
        </div>
      </aside>

      {/* 2. MOBILE TOP HEADER (displayed only on mobile screens) */}
      <header className="md:hidden bg-[#166534] text-white p-3 flex justify-between items-center z-10 sticky top-0 shadow-sm border-b border-[#166534]/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 sm:h-11 sm:w-11 bg-white rounded-xl overflow-hidden flex items-center justify-center border-2 border-white/20 shrink-0">
            <img src="/jdnlogo.jpeg" alt="JDN Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <span className="font-bold text-sm sm:text-md tracking-tight whitespace-nowrap">JDN Digital</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 relative">
          {renderSyncAndNotifications(true)}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-white hover:text-gray-100 p-1 sm:p-1.5 cursor-pointer ml-1"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
          </button>
        </div>
      </header>

      {/* MOBILE COLLAPSED DROPDOWN DRAWER */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[60px] bg-[#166534] text-white z-40 p-4 border-b border-[#166534]/30 space-y-3 animate-slide-down max-h-[calc(100vh-60px)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <img src={currentUser.profilePhoto || "/jdnlogo.jpeg"} alt="Profile" className="h-8 w-8 rounded-full border border-white/30 object-cover" />
              <div className="overflow-hidden">
                <div className="font-bold truncate text-white">{currentUser.fullName}</div>
                <div className="text-[10px] text-white/60 truncate font-mono mt-0.5">{currentUser.role}</div>
              </div>
            </div>
            <button
              onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
              className="bg-white/10 hover:bg-white/20 p-2 rounded font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" /> Out
            </button>
          </div>
          <nav className="flex flex-col gap-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.name;
              return (
                <button
                  key={tab.name}
                  onClick={() => { setActiveTab(tab.name); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-white text-[#166534]' : 'text-white/80 hover:bg-white/5'}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* 3. CORE VIEWPORT WRAPPER (containing top header controls bar) */}
      <main className={`flex-1 min-w-0 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto h-full ${bgImgUrl ? 'backdrop-blur-[2px] bg-white/15' : ''}`}>
        
        {/* Dynamic header row containing sync queue controls, notifications bell, and network indicators */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-30 hidden md:flex">
          {renderSyncAndNotifications(false)}
        </div>

        {!isOnline && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-blue-600" />
              <div>
                <h4 className="font-bold text-sm">Offline Mode – Displaying Cached Data</h4>
                <p className="text-xs text-blue-600">Showing Local Storage Data • Last Synced: {lastSyncTime ? new Date(lastSyncTime).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}</p>
              </div>
            </div>
          </div>
        )}

        {isOnline && queueState.count > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-amber-600 animate-spin" />
              <div>
                <h4 className="font-bold text-sm">Pending Synchronization</h4>
                <p className="text-xs text-amber-600">{queueState.count} records waiting to sync</p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Inner Main Content area */}
        <div className="flex-1 animate-fade-in relative z-0">
          <ActiveComponent />
        </div>
      </main>

      {/* Sync Ledger Hub Modal Dialog */}
      {showSyncHub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-[#111827] text-sm uppercase tracking-wider flex items-center gap-2">
                  <Radio className="h-5 w-5 text-[#166534] animate-pulse" />
                  Jerusaremu Digital Sync Hub
                </h3>
                <p className="text-[10px] text-gray-550 font-sans">View client-side ledger and simulate hybrid native push syncing</p>
              </div>
              <button
                onClick={() => setShowSyncHub(false)}
                className="text-gray-400 hover:text-gray-905 font-bold p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              
              {/* Simulator Connection Control */}
              {isSystem && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-gray-650">SIMULATED NETWORK SWITCH</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${isOnline ? 'bg-green-105 text-green-800' : 'bg-red-105 text-red-800'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} ${!isOnline ? 'animate-pulse' : ''}`} />
                      {isOnline ? 'LIVE MODE (ONLINE)' : 'OFFLINE MODE (LOCAL)'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-550">
                    Switch the simulator node to offline to enque database transactions locally, or online to simulate automated syncing back to Jerusalem secure cloud nodes.
                  </p>
                  <button
                    onClick={async () => {
                      const nextOnline = !isOnline;
                      setIsOnline(nextOnline);
                      await setNetworkStatus(nextOnline);
                      await updateSyncIndicators();
                    }}
                    className={`w-full py-2 px-4 rounded-lg font-bold text-xs cursor-pointer transition-colors text-center ${
                      isOnline 
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {isOnline ? '🔌 Toggle Simulator Offline' : '⚡ Connect Simulator Online'}
                  </button>
                </div>
              )}

              {/* Sync Queue Table Ledger */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-gray-600">Pending Sync Queue Ledger ({syncHubItems.length})</h4>
                  {syncHubItems.length > 0 && (
                    <button
                      onClick={async () => {
                        const confirmClear = window.confirm('Are you sure you want to purge all pending data transactions from the local cache sync ledger? This action is irreversible.');
                        if (confirmClear) {
                          await saveSyncQueue([]);
                          await updateSyncIndicators();
                        }
                      }}
                      className="text-[10px] font-bold text-red-650 hover:underline bg-transparent border-0 cursor-pointer"
                    >
                      Purge Queue
                    </button>
                  )}
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px] font-mono">
                      <thead className="bg-gray-100 sticky top-0 border-b border-gray-200">
                        <tr className="text-[9px] uppercase font-bold text-gray-500">
                          <th className="py-2.5 px-3">Operation</th>
                          <th className="py-2.5 px-3">Entity Type</th>
                          <th className="py-2.5 px-3">Payload Data Details</th>
                          <th className="py-2.5 px-3 text-center">Attempts</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {syncHubItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 font-sans text-gray-400 italic">
                              No data operations locked in queue. Client is fully synced!
                            </td>
                          </tr>
                        ) : (
                          syncHubItems.map((item, index) => {
                            let labelColor = 'bg-green-50 text-green-800 border border-green-100';
                            if (item.operation === 'update') labelColor = 'bg-blue-50 text-blue-800 border border-blue-100';
                            if (item.operation === 'delete') labelColor = 'bg-rose-50 text-rose-800 border border-rose-100';

                            // Extract details safely
                            const details = item.payload 
                              ? (item.payload.fullName || item.payload.name || item.payload.memberId || item.payload.amount || JSON.stringify(item.payload).slice(0, 35))
                              : 'No payload';

                            return (
                              <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-3 font-semibold">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${labelColor}`}>
                                    {item.operation}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-semibold text-gray-700 capitalize">
                                  {item.entityType}
                                </td>
                                <td className="py-2 px-3 text-gray-500 truncate max-w-xs font-sans">
                                  {typeof details === 'object' ? JSON.stringify(details) : String(details)}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-gray-700">
                                  {item.attempts || 0}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {item.failed ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">
                                      Failed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                                      Pending
                                    </span>
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
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowSyncHub(false)}
                className="px-4 py-2 text-xs font-bold border border-gray-200 text-gray-700 rounded-lg bg-white hover:bg-gray-50 cursor-pointer shadow-xs transition-colors"
              >
                Close Hub
              </button>
              {syncHubItems.length > 0 && (
                <button
                  onClick={async () => {
                    await handleManualSync();
                    // Refetch queue inside the hub modal
                    const queue = await getSyncQueue();
                    setSyncHubItems(queue);
                  }}
                  disabled={queueState.isProcessing}
                  className="bg-[#166534] hover:bg-[#14532D] text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${queueState.isProcessing ? 'animate-spin' : ''}`} />
                  {queueState.isProcessing ? 'Syncing...' : 'Force Local Upload Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
