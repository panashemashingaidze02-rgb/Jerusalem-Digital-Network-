import React, { useState } from 'react';
import { UserProfile, JdnLevel } from '../types';
import { 
  BookOpen, 
  HelpCircle, 
  Users, 
  CalendarCheck2, 
  Coins, 
  Radio, 
  ShieldCheck, 
  ChevronRight,
  Info,
  Server,
  Activity,
  Trophy,
  RefreshCw,
  Crown,
  Globe,
  Home,
  Heart,
  Key,
  Flame,
  Search,
  ClipboardList
} from 'lucide-react';

interface HelpProps {
  currentUser: UserProfile;
}

export function Help({ currentUser }: HelpProps) {
  const isSystem = currentUser.level === JdnLevel.SYSTEM;
  const [activeManualLevel, setActiveManualLevel] = useState<JdnLevel>(currentUser.level);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Define details for each of the 8 levels
  const levelMetadata = {
    [JdnLevel.SYSTEM]: {
      roleTitle: 'Super Administrator / System Architect',
      jurisdiction: 'Jerusalem Digital Network Global Platform infrastructure',
      icon: Server,
      color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
      activeColor: 'bg-indigo-650 text-white ring-4 ring-indigo-150',
      tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      badgeColor: 'border-indigo-200 bg-indigo-50 text-indigo-800',
      description: 'Maintains system-wide operational health, platform security, log streams, and deactivations.',
      duties: [
        { label: 'Provision Invitation Passcodes', detail: 'Generate single-use or multi-use level passcodes to onboard national, provincial, and local officers.' },
        { label: 'Manage Identity Access', detail: 'Trigger password overrides, force state changes on initial logins, and deactivate/activate portal profiles.' },
        { label: 'Platform Telemetry Audit', detail: 'Inspect background IndexDB sizes, diagnostic log events, and error buffers to prevent offline queue corruption.' },
        { label: 'Toggle App Safety Locks', detail: 'Activate global structural maintenance mode to freeze inputs during live schema upgrades/adjustments.' }
      ],
      steps: [
        { title: 'To Register & Dispatch a New Regional Leader', text: 'Navigate to the Super Admin Dashboard. Locate the Passcode Generator. Choose the target authority scope (e.g., National, Provincial) and type the dynamic unit branch name (e.g., Manicaland Province). Hit Generate. Securely copy and send the generated code to your appendant leader. They will use this code to register their credentials.' },
        { title: 'Executing Critical Account Deactivations', text: 'If an administrator moves from their post or loses their clearance: open the User Directory, search for their profile, and click Deactivate. The system automatically prompts you to reassign their member records, logged ledger balances, and pending sync-queues to another active administrator to ensure zero data gaps.' },
        { title: 'Testing Weak Network Resilience', text: 'To ensure offline queues are functioning: turn on "Simulate Offline Mode" in the Digital Sync Hub. Modify standard entries, then toggle it online again. Check that all logs successfully change from "pending" to "synced".' }
      ],
      privileges: 'Holds unrestricted root access to platform configurations, system-wide transaction frequencies, and invite-passcode registries. Has zero visibility into private member coordinates or individual confession names, preserving complete pastoral privacy shields.'
    },
    [JdnLevel.JERUSALEM]: {
      roleTitle: 'Jerusalem Overseer / HQ Bishop Council',
      jurisdiction: 'Jerusalem Digital Network Universal Spiritual Directives',
      icon: Crown,
      color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
      activeColor: 'bg-amber-600 text-white ring-4 ring-amber-150',
      tagColor: 'bg-amber-100 text-amber-800 border-amber-200',
      badgeColor: 'border-amber-200 bg-amber-50 text-amber-800',
      description: 'Formulates covenant doctrines (Murairos), publishes sermons, and sets universal branding guidelines.',
      duties: [
        { label: 'Formulate Standard Murairos', detail: 'Establish universal covenanted levies, tithes, building funds, or welfare goals across all countries.' },
        { label: 'Publish Universal Broadcasts', detail: 'Broadcast read-only notifications, sermons, spiritual studies, audio playlists, and church rulebooks.' },
        { label: 'Govern ID Brand Standards', detail: 'Configure global ID card colors, default org headers, custom seal elements, watermarks, and verification endpoints.' },
        { label: 'Administer Special Unganos', detail: 'Launch national or provincial fundraiser targets (Unganos) with flexible or fixed currency rates.' }
      ],
      steps: [
        { title: 'Declaring a Worldwide Special Campaign (Ungano)', text: 'Navigate to the "Special Murairos" configuration board. Click "Create Special Campaign". Enter the name (e.g., Ungano yeNyika), optional set targets, valid currencies (USD, ZWG, ZAR), and set active boundaries. It goes live instantly across every secretary portal global-wide.' },
        { title: 'Broadcasting Sunday Sermons', text: 'Go to the Updates & Sermons screen. Click "New Sermon Broadcast". Type the primary text content and optionally paste a secure audio track URL or local voice recording path. Click Publish to embed it into every Tabhera local dashboard.' },
        { title: 'Configuring Core ID Card Blueprints', text: 'Under Leadership Stats, access the ID Customizer panel. Upload the official church logo graphic, customize primary colors to match regional colors, specify default validity timeframes (global expiry), and save.' }
      ],
      privileges: 'Full access to definition libraries (Murairo types, Unganos, announcements, and global settings). Access is read-only for compiled aggregated statistics, and read-write for covenanted rules.'
    },
    [JdnLevel.NATIONAL]: {
      roleTitle: 'National HQ Director / National Secretary',
      jurisdiction: 'State-level executive operations and clergy alignment',
      icon: Globe,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
      activeColor: 'bg-emerald-650 text-white ring-4 ring-emerald-150',
      tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      description: 'Monitors nationwide provincial targets, aligns national clergy files, and audits high-level currencies.',
      duties: [
        { label: 'Evaluate National Aggregates', detail: 'Analyze provincial and district trends, membership totals, coin ratios, and attendance densities.' },
        { label: 'Manage National Leader Credentials', detail: 'Oversee background status checkups for national pastors, deacons, and provincial councils.' },
        { label: 'Supervise Campaign Progress', detail: 'Ensure state-level Ungano targets are successfully collected and allocated under standard policies.' },
        { label: 'Formulate Dare Minute Circulars', detail: 'Draft and publish high-level Dare (Council) minutes to advise regional administrators.' }
      ],
      steps: [
        { title: 'Conducting Nationwide Progress Auditing', text: 'Open the "Hierarchy Stats" or "Performance" tab. Filter data by Nation. Inspect absolute transaction frequencies, check USD versus ZWG collection proportions, and identify provinces falling behind on critical targets.' },
        { title: 'Updating National Pastor Records', text: 'Go to the Leadership Stats tab. Filter the directory to view National-level personnel. Confirm their active offices (Basa), edit their credentials if promoted, and verify their ID card statuses are active and approved.' },
        { title: 'Authorizing National Council Guidelines', text: 'Go to the "Dare Minutes" board. Click "Publish Advisory". Write the national minutes guidelines (e.g., National Conference Agenda), assign the target audience, and distribute, creating an auditable history of council orders.' }
      ],
      privileges: 'Read-write access to National-level personnel records, national council minutes, and prayer requests. Read-only access to combined country-wide contribution indices, with absolute privacy shields.'
    },
    [JdnLevel.PROVINCIAL]: {
      roleTitle: 'Provincial HQ Overseer / Provincial Secretary',
      jurisdiction: 'Provinces and secondary regional sub-districts',
      icon: Home,
      color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
      activeColor: 'bg-blue-600 text-white ring-4 ring-blue-150',
      tagColor: 'bg-blue-100 text-blue-800 border-blue-200',
      badgeColor: 'border-blue-200 bg-blue-50 text-blue-800',
      description: 'Coordinates provincial districts, reviews minute logs, and drives regional performance competition.',
      duties: [
        { label: 'Run Provincial Competitions', detail: 'Compare district performance lists to stimulate local progress in member retention and tithes.' },
        { label: 'Review District Minutes', detail: 'Verify minutes submitted by various District Councils to maintain doctrinal alignment.' },
        { label: 'Coordinate Welfare Aids', detail: 'Track regional clinic logs or health cases forwarded by local Wellness Centers.' },
        { label: 'Validate District Leadership', detail: 'Review clerical credentials in your province before sending ID approval tags.' }
      ],
      steps: [
        { title: 'Auditing District Performance Ratios', text: 'Navigate to the "Performance" dashboard. Under rankings, analyze comparative numbers. Check which district has the highest newcomer retention (Jorodhani active conversion) and which district is lagging on Ungano campaign ratios.' },
        { title: 'Authorizing Regional Healthcare Aid', text: 'Open the "Wellness Centers" panel. Inspect welfare diagnostics submitted by provincial centers. Verify their funding requests and push them to National queues for state allocation.' },
        { title: 'Fling Council Advisory Responses', text: 'Go to "Dare Minutes". Select "Create Council Entry", record the manutes of the provincial assembly, note critical doctrinal challenges, and share with linked district overseers.' }
      ],
      privileges: 'Read-write access to provincial council logs, leadership badges, and healthcare audits. Read-only access to provincial contribution summaries.'
    },
    [JdnLevel.DISTRICT]: {
      roleTitle: 'District Leader / District Overseer',
      jurisdiction: 'Districts and associated Nyikas (vanguard areas)',
      icon: BookOpen,
      color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100',
      activeColor: 'bg-teal-605 text-white ring-4 ring-teal-150',
      tagColor: 'bg-teal-100 text-teal-800 border-teal-200',
      badgeColor: 'border-teal-200 bg-teal-50 text-teal-800',
      description: 'Guides local Nyikas, monitors collective assembly health, and prints leadership IDs.',
      duties: [
        { label: 'Oversee Valley Congregations', detail: 'Keep tab on weekly assemblies, attendance levels, and physical church facilities.' },
        { label: 'Authorize Local Clerical IDs', detail: 'Coordinate leadership rosters in the district and authorize ID printing.' },
        { label: 'Monitor District Targets', detail: 'Check contribution rates and ensure local secretaries record values accurately.' },
        { label: 'Coordinate Regional Prayer Lists', detail: 'Log and track district prayer requirements and answered prayers.' }
      ],
      steps: [
        { title: 'Validating and Printing District Clerical Badges', text: 'Go to "Leadership Stats". Locate the ID Card Generator. Check that the leaders name, Basa, and photograph are correct. Adjust card parameters if needed, check card expiry, and download the ID card.' },
        { title: 'Investigating District Assembly Ratios', text: 'Go to the "Hierarchy Stats" tab. Filter by your District Code. Check that all local secretaries are submitting weekly service roster entries and keep track of active attendance densities.' },
        { title: 'Managing District Prayer Requests', text: 'Navigate to the "Prayer Requests" tab. Click "Add Request" or view active district entries. Check off answered prayers as "answered" to bolster district testimony lists.' }
      ],
      privileges: 'Read-write access to district leader databases, local council logs, and prayer listings. Restricted aggregate read-only visibility for financial summaries.'
    },
    [JdnLevel.NYIKA]: {
      roleTitle: 'Nyika Organizer / Area Coordinator',
      jurisdiction: 'Local clusters of small Tabhera structures',
      icon: ClipboardList,
      color: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
      activeColor: 'bg-rose-600 text-white ring-4 ring-rose-150',
      tagColor: 'bg-rose-100 text-rose-800 border-rose-200',
      badgeColor: 'border-rose-200 bg-rose-50 text-rose-800',
      description: 'Onboards local Tabhera secretaries, monitors area minutes, and checks welfare tasks.',
      duties: [
        { label: 'Onboard Local Secretaries', detail: 'Generate local Tabhera invitation codes to register local secretaries safely.' },
        { label: 'Supervise Weekly Records', detail: 'Visit local Tabheras and ensure databases are up-to-date and synchronized.' },
        { label: 'Review Welfare Petitions', detail: 'Compile local financial relief or health lists and pass them to District HQ.' },
        { label: 'Organize Combined Area Gatherings', detail: 'Track attendance logs and contributions for monthly joint council assemblies.' }
      ],
      steps: [
        { title: 'Onboarding a New Tabhera Secretary', text: 'Open your Account settings or passcode console. Click "Generate Passcode". Select the authority as Tabhera and write the local Tabheras name (e.g., Chizhanje Tabhera). Export the code and hand it to the designated secretary.' },
        { title: 'Tracking Local Audit Reports', text: 'Periodically open "Hierarchy Stats" and filter by Nyika. Confirm which local clusters have active updates, check database syncing queues, and verify ledger collections.' },
        { title: 'Drafting Inter-Tabhera Joint Minutes', text: 'Navigate to "Dare Minutes". Create an entry detailing the combined area leaders meeting, record resolution points, and sync them immediately.' }
      ],
      privileges: 'Read-write access to localized area profiles and prayer lists. Access codes generator privileges for local Tabheras.'
    },
    [JdnLevel.TABHERA]: {
      roleTitle: 'Tabhera Secretary / Local Registrar',
      jurisdiction: 'Frontend local church registration and services tracking',
      icon: Users,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100',
      activeColor: 'bg-emerald-700 text-white ring-4 ring-emerald-150',
      tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      badgeColor: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      description: 'Runs daily data logging: registers members, updates attendance sheets, and records collection log books.',
      duties: [
        { label: 'Onboard and Clean Member Files', detail: 'Add members with birth dates. The app automatically groups them: Sunday School, Masowani, Ruwadzano, or Sungano.' },
        { label: 'Roster Weekly Attendance', detail: 'Mark attendance (Present/Absent/Excused with reasons) for Sunday and midweek prayer services.' },
        { label: 'Register General and Special Tithes', detail: 'Log all standard Murairos or Special Ungano contributions using dynamic currencies.' },
        { label: 'Local Offline DB Orchestration', detail: 'Mark and update files when operating off-grid, and monitor sync status counters.' }
      ],
      steps: [
        { title: 'Registering a New Congregrant and Group Assignment', text: 'Go to the "Members" page and click "Add Member". Input the full name, gender, marital status, birth date, and phone number. The platform uses age and marital status to assign them to Sunday School (<14), Masowani (14-25 unmarried), Ruwadzano (females married/widowed), or Sungano (males mature). Click Save Member.' },
        { title: 'Rostering Sabbath Service Attendance', text: 'Go to the "Attendance" section. Click "Log New Session". Choose the date (e.g., today) and select "Sunday Service". Click Create Session. Next, check the list and select "Present", "Absent", or "Excused" for each member. Tap Save Session.' },
        { title: 'Recording Covenant Contributions (Zunde & Ungano)', text: 'Open the "Contributions" page. Click "Record Contribution". Select the member, pick standard Murairo (Zunde reChechi, Building etc) or active Special Ungano campaign. Select the payment currency (USD, ZWG, Rand) and input the amount. Tap Save Contribution. The transaction prints a unique secure audit hash.' }
      ],
      privileges: 'Read-write access to every member file, attendance sheet, and financial ledger under their specific Tabhera code. No access to other Tabheras data.'
    },
    [JdnLevel.WELLNESS_CENTER]: {
      roleTitle: 'Wellness Coordinator / Healthcare Officer',
      jurisdiction: 'Local Wellness Centers and sanitary compliance',
      icon: Heart,
      color: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100',
      activeColor: 'bg-pink-650 text-white ring-4 ring-pink-150',
      tagColor: 'bg-pink-100 text-pink-800 border-pink-200',
      badgeColor: 'border-pink-200 bg-pink-50 text-pink-800',
      description: 'Registers welfare diagnostics, medical prescriptions, sanitary reports, and welfare distributions.',
      duties: [
        { label: 'Track Wellness Attendance', detail: 'Mark member attendance for wellness sessions or natural therapy checkups.' },
        { label: 'Submit Health Case Diagnostics', detail: 'Create caseworkers diagnostics for members requiring specialized support.' },
        { label: 'Coordinate Welfare AID', detail: 'Log distributions of groceries, clean water assistance, and healthcare aid.' },
        { label: 'Report Sanitary Actions', detail: 'File sanitary compliance checklists for gatherings and pass them to Nyika/District HQ.' }
      ],
      steps: [
        { title: 'Filing a Welfare Aid or Medical Diagnostic Case', text: 'Go to the "Wellness Centers" tab. Click "Log New Support Case". Select the member name, write brief diagnostic notes, categorise the support category (e.g., Medical relief, food support), and input logged monetary aid if applicable. Click Sync Case.' },
        { title: 'Auditing Welfare Supply Allocations', text: 'Go to Wellness Dashboard, review active distribution tables, and confirm if regional supplies (e.g., clothing, clean materials) are allocated fairly to single parents, widows, and orphans.' },
        { title: 'Submitting Weekly Sanitary Compliance checklists', text: 'Go to settings or wellness logs. Run through the mandatory checklists (e.g., Water stations set, clean washing points installed), select checklist result, and click Broadcast Compliance.' }
      ],
      privileges: 'Read-write access to local clinic attendance, diagnostic case files, and welfare distributions. No visibility into standard church logs.'
    }
  };

  const LEVEL_RANKS: Record<JdnLevel | string, number> = {
    [JdnLevel.SYSTEM]: 8,
    [JdnLevel.JERUSALEM]: 7,
    [JdnLevel.NATIONAL]: 6,
    [JdnLevel.PROVINCIAL]: 5,
    [JdnLevel.DISTRICT]: 4,
    [JdnLevel.NYIKA]: 3,
    [JdnLevel.TABHERA]: 2,
    [JdnLevel.WELLNESS_CENTER]: 2,
  };

  const currentUserRank = LEVEL_RANKS[currentUser?.level] || 0;

  // Ensure activeManualLevel doesn't exceed permissible rank
  const initialManualLevel = (LEVEL_RANKS[activeManualLevel] || 0) <= currentUserRank
    ? activeManualLevel
    : (currentUser?.level || JdnLevel.TABHERA);

  const selectedData = levelMetadata[initialManualLevel] || levelMetadata[currentUser?.level] || levelMetadata[JdnLevel.TABHERA];
  const ActiveIcon = selectedData.icon;

  // Filter keys for roles search, matching both search terms and maximum accessible rank
  const filteredLevels = Object.keys(levelMetadata).filter(level => {
    const targetRank = LEVEL_RANKS[level as JdnLevel] || 0;
    if (targetRank > currentUserRank) return false;

    const data = levelMetadata[level as JdnLevel];
    const matchStr = `${data.roleTitle} ${data.jurisdiction} ${data.description}`.toLowerCase();
    return matchStr.includes(searchQuery.toLowerCase());
  }) as JdnLevel[];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 to-[#1e3a24] p-6 lg:p-8 rounded-2xl shadow-md border border-slate-800 text-white relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <span className="inline-block bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
            JDN KNOWLEDGE BASE
          </span>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight font-sans">
            Administrative Interactive Operating Manuals
          </h1>
          <p className="text-xs lg:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Welcome to the Jerusalem Digital Network integrated help desks. Study specific step-by-step guidelines, authority coordinates, and exact transactional workflows for all administrative access levels.
          </p>
        </div>
      </div>

      {/* Main Container - Interactive Accounts Manual */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        
        {/* Security Access Notice */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-slate-650 font-sans">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Doctrinal Hierarchy Access Shield:</strong> You are authorized to access manuals up to 
              <span className="text-[#166534] font-bold"> {currentUser.level ? currentUser.level.toUpperCase() : ''}</span>. 
              Higher levels (e.g. Nyika, District, Province, National, or Jerusalem HQ directories) are locked, hidden, and restricted.
            </span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase font-bold shrink-0">
            Rank {currentUserRank} Protected
          </span>
        </div>
        
        {/* Manual Hub Search & Overview */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#166534]" /> Account Tiers & Role Manual
            </h2>
            <p className="text-xs text-[#6B7280]">
              Toggle tabs below to explore the operational instructions for each ministerial rank in Jerusalem.
            </p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search roles or workflows..."
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-[#166534] bg-slate-50 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Level Selection Tabs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            <span>CHOOSE THE ADMINISTRATIVE ACCOUNT LEVEL TO EXPLORE:</span>
            {currentUser && (
              <span className="text-[#166534] font-extrabold">
                YOUR ROLE: {currentUser.level ? currentUser.level.toUpperCase() : ''}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {Object.keys(levelMetadata)
              .filter(levelKey => (LEVEL_RANKS[levelKey as JdnLevel] || 0) <= currentUserRank)
              .map((levelKey) => {
                const lvl = levelKey as JdnLevel;
                const meta = levelMetadata[lvl];
                const TabIcon = meta.icon;
                const isActive = initialManualLevel === lvl;
                const matchesSearch = filteredLevels.includes(lvl);

              return (
                <button
                  key={lvl}
                  id={`tab-help-${lvl.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => setActiveManualLevel(lvl)}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer min-h-[84px] relative ${
                    isActive 
                      ? meta.activeColor 
                      : meta.color
                  } ${!matchesSearch ? 'opacity-30' : ''}`}
                >
                  <TabIcon className="h-5 w-5 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wide leading-tight line-clamp-2">
                    {lvl}
                  </span>
                  {currentUser.level === lvl && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Level Interactive Handbook */}
        <div className="border border-slate-150 rounded-2xl bg-slate-50/50 p-5 lg:p-6 space-y-6">
          
          {/* Handbook Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
            <div className="flex gap-3 items-center">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                <ActiveIcon className="h-6 w-6 text-[#166534]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-sans text-base lg:text-lg font-black text-slate-900 leading-tight">
                    {selectedData.roleTitle}
                  </h3>
                  <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full border font-black tracking-wide ${selectedData.badgeColor}`}>
                    {activeManualLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">
                  <strong>Jurisdiction:</strong> {selectedData.jurisdiction}
                </p>
              </div>
            </div>
            {currentUser.level === activeManualLevel && (
              <span className="inline-flex self-start sm:self-center items-center gap-1.5 bg-emerald-100 text-emerald-800 text-[10px] uppercase font-black px-3 py-1 rounded-full tracking-wider border border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" /> AUTHORIZED ACCOUNT
              </span>
            )}
          </div>

          {/* Core Overview */}
          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium bg-white p-4 rounded-xl border border-slate-150">
            <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider mb-1">ROLE PURPOSE & ECOSYSTEM DESCRIPTION:</span>
            {selectedData.description}
          </div>

          {/* Grid: Core Duties & Privacy Guidelines */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Primary Duties (Left/Center) */}
            <div className="lg:col-span-8 space-y-3">
              <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">
                PRIMARY BUSINESS DUTIES & ACCESS CONSTANTS:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedData.duties.map((duty, idx) => (
                  <div key={idx} className="p-4 bg-white border border-slate-150 rounded-xl hover:shadow-xs transition-shadow">
                    <div className="font-extrabold text-xs text-slate-800 flex items-center gap-2 mb-1">
                      <span className="h-5 w-5 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      {duty.label}
                    </div>
                    <p className="text-xs text-[#6B7280] leading-relaxed">
                      {duty.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Safeguard Bounds & Privileges (Right) */}
            <div className="lg:col-span-4 space-y-3">
              <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">
                PRIVILEGES & PRIVACY PRIVACY SHIELDS:
              </span>
              <div className="p-4 bg-emerald-50/40 border border-emerald-200/50 rounded-xl space-y-2 h-full">
                <div className="font-extrabold text-xs text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Isolation Boundaries
                </div>
                <p className="text-xs text-[#4B5563] leading-relaxed">
                  {selectedData.privileges}
                </p>
              </div>
            </div>

          </div>

          {/* Step-by-Step Functional Walkthroughs */}
          <div className="space-y-3">
            <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">
              STEP-BY-STEP ADMINISTRATIVE SYSTEM PROCEDURES:
            </span>
            <div className="space-y-3">
              {selectedData.steps.map((step, idx) => (
                <div key={idx} className="p-4 bg-white border border-slate-150 rounded-xl space-y-2 relative overflow-hidden pl-10">
                  <div className="absolute left-4 top-4.5 h-2 w-2 rounded-full bg-[#166534]" />
                  <div className="font-extrabold text-xs text-slate-900 font-sans">
                    {step.title}
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed pl-1 sm:pl-0">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Grid: Secondary Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* System Operations Guidance & Offline Sync */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex gap-3 items-center text-[#166534]">
            <RefreshCw className="h-5 w-5 shrink-0" />
            <h3 className="font-sans text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Mabasa Digital Sync Protocols
            </h3>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            All user actions (e.g. log member, attendance ticks, payment hashes) write instantly to a localized offline transaction ledger queue within sandbox variables to survive intermittent cellular grid connections:
          </p>
          <ul className="space-y-2 text-xs text-slate-600 pl-1">
            <li className="flex gap-2 items-start leading-relaxed">
              <ChevronRight className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <strong>Active Synchronization Pill:</strong> Tapping the status banner (Live/Offline indicator in major headers) opens the <strong>Jerusaremu Sync Hub dialog</strong> instantly.
              </div>
            </li>
            <li className="flex gap-2 items-start leading-relaxed">
              <ChevronRight className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <strong>Local Queue Inspection:</strong> View unique identifiers, attempts counters, operational methods (CREATE/UPDATE/DELETE), and error reports for outstanding records.
              </div>
            </li>
            <li className="flex gap-2 items-start leading-relaxed">
              <ChevronRight className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <strong>Forced Offline Simulation:</strong> Secretary accounts can manually decouple the device network simulator to test transaction logs cache before visiting remote outposts.
              </div>
            </li>
          </ul>
        </div>

        {/* General Church Rules & Lifecycles */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex gap-3 items-center text-[#166534]">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <h3 className="font-sans text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Global Church Guidelines & Covenants
            </h3>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed font-sans">
            Automatic member lifecycle transitions take effect globally to ease administrative load and respect church rules:
          </p>
          <ul className="space-y-2 text-xs text-slate-600 pl-1 font-sans">
            <li className="flex gap-2 items-start leading-relaxed">
              <ChevronRight className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <strong>The Jorodhani Rule:</strong> New congregants are designated in the <strong>Jorodhani register</strong> for exactly 3 months of consistent service evaluations before graduating to full covenants.
              </div>
            </li>
            <li className="flex gap-2 items-start leading-relaxed">
              <ChevronRight className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <strong>Autonomic Sabbath Graduations:</strong> Youth in the Sunday School cohort who reach exactly 14 years of age are automatically promoted to the Masowani list to reflect youth growth.
              </div>
            </li>
            <li className="flex gap-2 items-start leading-relaxed">
              <ChevronRight className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" />
              <div>
                <strong>Privacy Shield Compliance:</strong> Standard financial transacting rosters remain dynamic at the Tabhera tier, showing only collective sums at higher tiers to preserve local sanctuary space.
              </div>
            </li>
          </ul>
        </div>

      </div>

    </div>
  );
}
