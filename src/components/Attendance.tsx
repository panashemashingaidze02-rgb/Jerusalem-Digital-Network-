import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Member, AttendanceSession, AttendanceRecord, UserProfile, JdnLevel, ContributionLog, MurairoType } from '../types';
import {
  getMembers,
  getAttendanceSessions,
  getAttendanceRecords,
  saveAttendanceSessions,
  saveAttendanceRecords,
  addToSyncQueue,
  getNetworkStatus,
  resolveBranchName,
  resolveLevelNameForCode,
  getUserProfiles,
  getContributions,
  getMurairoTypes
} from '../lib/storage';
import { BookOpen, Calendar, CircleCheck, CircleX, CheckSquare, PlusCircle, Bookmark, Clipboard, Eye, AlertCircle, ShieldAlert, FileText, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceProps {
  currentUser: UserProfile;
}

export function Attendance({ currentUser }: AttendanceProps) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [contributions, setContributions] = useState<ContributionLog[]>([]);
  const [murairoTypes, setMurairoTypes] = useState<MurairoType[]>([]);

  // Toggles for adding extra sections to exported attendance report
  const [includeContributionsInReport, setIncludeContributionsInReport] = useState(false);
  const [includeLeadershipInReport, setIncludeLeadershipInReport] = useState(false);

  const [isSavingSession, setIsSavingSession] = useState(false);
  const [lastSubmitSessionTime, setLastSubmitSessionTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Logger screen states
  const [isLogging, setIsLogging] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState<string>('Sunday Service');
  const [isCustomService, setIsCustomService] = useState(false);
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [isCorrection, setIsCorrection] = useState(false);
  const [tempRecords, setTempRecords] = useState<Record<string, { status: 'Present' | 'Absent' | 'Excused'; reason: string }>>({});
  
  // Dashboard & session history filters
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterBranchCode, setFilterBranchCode] = useState<string>('All');

  const [globalStats, setGlobalStats] = useState({ worldwide: 0, worldwideTotal: 0, national: 0, nationalTotal: 0, tabhera: 0, tabheraTotal: 0, date: '' });

  // Inspection states
  const [inspectSession, setInspectSession] = useState<AttendanceSession | null>(null);
  const [attendanceTab, setAttendanceTab] = useState<'sessions' | 'leaderboard'>('sessions');

  const canSeeNames = true;

  const [currentPageSessions, setCurrentPageSessions] = useState(1);
  const [currentPageLeaderboard, setCurrentPageLeaderboard] = useState(1);
  const [currentPageInspect, setCurrentPageInspect] = useState(1);

  useEffect(() => {
    setCurrentPageSessions(1);
  }, [filterDay]);

  useEffect(() => {
    setCurrentPageLeaderboard(1);
  }, [filterGroup]);

  useEffect(() => {
    setCurrentPageSessions(1);
    setCurrentPageLeaderboard(1);
  }, [filterBranchCode]);

  useEffect(() => {
    setCurrentPageInspect(1);
  }, [inspectSession]);

  useEffect(() => {
    loadSessionsData();
  }, [currentUser, filterDay, filterBranchCode]);

  const loadSessionsData = async () => {
    setIsLoading(true);
    const sesList = await getAttendanceSessions() || [];
    const recList = await getAttendanceRecords() || [];
    const memList = await getMembers() || [];
    const pList = await getUserProfiles() || [];
    const contribs = await getContributions() || [];
    const mTypes = await getMurairoTypes() || [];
    const cleanPList = currentUser.level === JdnLevel.SYSTEM ? pList : pList.filter(p => p.level !== JdnLevel.SYSTEM);
    
    setProfiles(cleanPList);
    setContributions(contribs);
    setMurairoTypes(mTypes);

    // Filter based on Hierarchy branch matching
    let filterSes = sesList;
    let filterMem = memList;
    if (currentUser.level !== JdnLevel.SYSTEM && currentUser.level !== JdnLevel.JERUSALEM) {
      filterSes = sesList.filter(s => s.tabheraCode.startsWith(currentUser.levelCode) || currentUser.levelCode.startsWith(s.tabheraCode));
      filterMem = memList.filter(m => m.tabheraCode.startsWith(currentUser.levelCode) || currentUser.levelCode.startsWith(m.tabheraCode));
    }

    setSessions(filterSes);
    setRecords(recList);
    setMembers(filterMem);

    // Compute Global Stats (Worldwide / National / Tabhera)
    let targetDay = filterDay;
    if (!targetDay && sesList.length > 0) {
      targetDay = [...sesList].sort((a, b) => b.date.localeCompare(a.date))[0].date;
    } else if (!targetDay) {
      targetDay = new Date().toISOString().split('T')[0];
    }

    const latestSessions = sesList.filter(s => s.date === targetDay);
    const targetSessionIds = new Set(latestSessions.map(s => s.sessionId));
    const targetRecords = recList.filter(r => targetSessionIds.has(r.sessionId) && r.status === 'Present');
    
    const worldwideTotal = memList.length;
    const worldwide = targetRecords.length;

    // National
    const natPrefix = currentUser.levelCode.split('-')[1] || 'ZIM';
    const natMembers = memList.filter(m => m.tabheraCode.includes(natPrefix));
    const natRecords = targetRecords.filter(r => {
        const mem = memList.find(m => m.memberId === r.memberId);
        return mem && mem.tabheraCode.includes(natPrefix);
    });

    // Tabhera (or current view)
    const tabMembers = memList.filter(m => m.tabheraCode === currentUser.levelCode);
    const tabRecords = targetRecords.filter(r => {
        const mem = memList.find(m => m.memberId === r.memberId);
        return mem && mem.tabheraCode === currentUser.levelCode;
    });

    setGlobalStats({
       worldwide, worldwideTotal,
       national: natRecords.length, nationalTotal: natMembers.length,
       tabhera: tabRecords.length, tabheraTotal: tabMembers.length,
       date: targetDay
    });
    setIsLoading(false);
  };

  const startLoggingSession = () => {
    if (members.length === 0) {
      alert('Cannot start logging: No members registered in this unit. Add members first.');
      return;
    }

    // Default status of every member is 'Absent'
    const initialRecordsState: Record<string, { status: 'Present' | 'Absent' | 'Excused'; reason: string }> = {};
    members.forEach(m => {
      initialRecordsState[m.memberId] = { status: 'Absent', reason: '' };
    });

    setTempRecords(initialRecordsState);
    setIsLogging(true);
  };

  const handleStatusChange = (memberId: string, status: 'Present' | 'Absent' | 'Excused') => {
    setTempRecords(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], status }
    }));
  };

  const handleReasonChange = (memberId: string, reason: string) => {
    setTempRecords(prev => ({
      ...prev,
      [memberId]: { ...prev[memberId], reason }
    }));
  };

  const submitAttendanceSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (members.length === 0) return;

    const now = Date.now();
    if (now - lastSubmitSessionTime < 1500 || isSavingSession) {
      toast.error('Processing attendance logging, please wait...', { id: 'rate-limit-save-session' });
      return;
    }
    setLastSubmitSessionTime(now);
    setIsSavingSession(true);

    const newSessionId = `sess-${Date.now()}`;
    const newSession: AttendanceSession = {
      sessionId: newSessionId,
      tabheraCode: currentUser.level === JdnLevel.TABHERA ? currentUser.levelCode : 'TAB-HRE-S-1A-1',
      date: sessionDate,
      serviceType,
      isCorrection,
      loggedBy: currentUser.id,
      syncStatus: 'pending' // stores locally first
    };

    // Construct records payload
    const recordsToInsert: AttendanceRecord[] = members.map(member => {
      const val = tempRecords[member.memberId] || { status: 'Absent', reason: '' };
      return {
        recordId: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${member.memberId}`,
        sessionId: newSessionId,
        memberId: member.memberId,
        status: val.status,
        excuseReason: val.status === 'Excused' ? (val.reason || '') : '' // SANITIZED fallback against 'undefined' to prevent WriteBatch.set() failures
      };
    });

    try {
      // Write locally
      const currentSessions = await getAttendanceSessions() || [];
      const currentRecords = await getAttendanceRecords() || [];

      await saveAttendanceSessions([...currentSessions, newSession]);
      await saveAttendanceRecords([...currentRecords, ...recordsToInsert]);

      // Add operation to offline transaction SyncQueue
      await addToSyncQueue('attendance_session', newSessionId, 'create', {
        ...newSession,
        records: recordsToInsert
      });

      setIsLogging(false);
      await loadSessionsData();
      
      // Dispatch alert
      window.dispatchEvent(new Event('jdn_db_updated'));
      toast.success('Attendance session logged and queued for syncing successfully!');
      setIsSavingSession(false);
    } catch (err) {
      toast.error('Error saving attendance records locally.');
      setIsSavingSession(false);
    }
  };

  const getSessionStats = (sessId: string) => {
    const related = records.filter(r => r.sessionId === sessId);
    const present = related.filter(r => r.status === 'Present').length;
    const absent = related.filter(r => r.status === 'Absent').length;
    const excused = related.filter(r => r.status === 'Excused').length;
    return { present, absent, excused, total: related.length };
  };

  const getAggregatedOversightStats = (sessionId: string) => {
    const sessionRecords = records.filter(r => r.sessionId === sessionId);
    
    const tabheraCounts: Record<string, { present: number; absent: number; excused: number }> = {};
    const nyikaCounts: Record<string, { present: number; absent: number; excused: number }> = {};
    const groupCounts: Record<string, { present: number; absent: number; excused: number }> = {};
    const genderCounts: Record<string, { present: number; absent: number; excused: number }> = {};

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalExcused = 0;

    sessionRecords.forEach(rec => {
      const m = members.find(mem => mem.memberId === rec.memberId);
      const status = rec.status;
      
      if (status === 'Present') totalPresent++;
      else if (status === 'Absent') totalAbsent++;
      else if (status === 'Excused') totalExcused++;

      if (m) {
        const tabCode = m.tabheraCode || 'Unknown Tabhera';
        
        let nyikaCode = 'Unknown Nyika';
        if (tabCode.startsWith('TAB-')) {
          const parts = tabCode.split('-');
          if (parts.length > 1) {
            parts[0] = 'NYK';
            nyikaCode = parts.slice(0, -1).join('-');
          }
        } else {
          nyikaCode = 'NYK-' + tabCode;
        }

        const gId = m.groupId || 'Unknown Group';
        const gend = m.gender || 'Unknown Gender';

        if (!tabheraCounts[tabCode]) tabheraCounts[tabCode] = { present: 0, absent: 0, excused: 0 };
        if (!nyikaCounts[nyikaCode]) nyikaCounts[nyikaCode] = { present: 0, absent: 0, excused: 0 };
        if (!groupCounts[gId]) groupCounts[gId] = { present: 0, absent: 0, excused: 0 };
        if (!genderCounts[gend]) genderCounts[gend] = { present: 0, absent: 0, excused: 0 };

        const inc = (obj: any) => {
          if (status === 'Present') obj.present++;
          else if (status === 'Absent') obj.absent++;
          else if (status === 'Excused') obj.excused++;
        };

        inc(tabheraCounts[tabCode]);
        inc(nyikaCounts[nyikaCode]);
        inc(groupCounts[gId]);
        inc(genderCounts[gend]);
      }
    });

    return {
      totalPresent,
      totalAbsent,
      totalExcused,
      tabheras: Object.entries(tabheraCounts),
      nyikas: Object.entries(nyikaCounts),
      groups: Object.entries(groupCounts),
      genders: Object.entries(genderCounts)
    };
  };

  const getAttendanceLeaderboard = () => {
    return members.map(m => {
      const mRecords = records.filter(r => r.memberId === m.memberId);
      const total = mRecords.length;
      const present = mRecords.filter(r => r.status === 'Present').length;
      const excused = mRecords.filter(r => r.status === 'Excused').length;
      const absent = mRecords.filter(r => r.status === 'Absent').length;
      
      const percentage = total > 0 ? ((present + excused) / total) * 100 : 0;
      
      return {
        member: m,
        total,
        present,
        excused,
        absent,
        percentage
      };
    }).sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      return b.present - a.present;
    });
  };

  // Generate beautiful branch list in current user's scope
  const uniqueTabherasInScope = Array.from(
    new Set(members.map(m => m.tabheraCode).filter(Boolean) as string[])
  ).map((code: string) => {
    return {
      code,
      name: resolveBranchName(code, profiles)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const filteredSessions = sessions
    .filter(s => !filterDay || s.date === filterDay)
    .filter(s => filterBranchCode === 'All' || s.tabheraCode === filterBranchCode)
    .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime());
  const SESSIONS_ITEMS_PER_PAGE = 7;
  const totalSessionsPages = Math.ceil(filteredSessions.length / SESSIONS_ITEMS_PER_PAGE);
  const pagedSessions = filteredSessions.slice(
    (currentPageSessions - 1) * SESSIONS_ITEMS_PER_PAGE,
    currentPageSessions * SESSIONS_ITEMS_PER_PAGE
  );

  const leaderboardData = getAttendanceLeaderboard()
    .filter(row => filterGroup === 'All' || row.member.groupId === filterGroup)
    .filter(row => filterBranchCode === 'All' || row.member.tabheraCode === filterBranchCode);
  const LEADERBOARD_ITEMS_PER_PAGE = 7;
  const totalLeaderboardPages = Math.ceil(leaderboardData.length / LEADERBOARD_ITEMS_PER_PAGE);
  const pagedLeaderboardData = leaderboardData.slice(
    (currentPageLeaderboard - 1) * LEADERBOARD_ITEMS_PER_PAGE,
    currentPageLeaderboard * LEADERBOARD_ITEMS_PER_PAGE
  );

  const inspectRecords = inspectSession ? records.filter(r => r.sessionId === inspectSession.sessionId) : [];
  const INSPECT_ITEMS_PER_PAGE = 7;
  const totalInspectPages = Math.ceil(inspectRecords.length / INSPECT_ITEMS_PER_PAGE);
  const pagedInspectRecords = inspectRecords.slice(
    (currentPageInspect - 1) * INSPECT_ITEMS_PER_PAGE,
    currentPageInspect * INSPECT_ITEMS_PER_PAGE
  );

  const exportSessionsToCSV = () => {
    const headers = ['Date', 'Service Type', 'Tabhera Branch', 'Present', 'Absent', 'Excused', 'Logged By', 'Sync Status'];
    const delimiter = ',';
    const rows = filteredSessions.map(sess => {
      const stats = getSessionStats(sess.sessionId);
      return [
        sess.date,
        `"${sess.serviceType.replace(/"/g, '""')}"`,
        resolveBranchName(sess.tabheraCode, profiles),
        stats.present,
        stats.absent,
        stats.excused,
        `"${sess.loggedBy.replace(/"/g, '""')}"`,
        sess.syncStatus
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(delimiter), ...rows.map(r => r.join(delimiter))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JDN_Attendance_Sessions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSessionsToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text("Jerusalem Digital Network (JDN) Attendance Sessions", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Admin Scope: ${resolveBranchName(currentUser.levelCode, profiles) || 'Jerusalem HQ'}`, 14, 21);

    const headers = [['Date', 'Service Type', 'Tabhera Branch', 'Present', 'Absent', 'Excused', 'Logged By']];
    const rows = filteredSessions.map(sess => {
      const stats = getSessionStats(sess.sessionId);
      return [
        sess.date,
        sess.serviceType,
        resolveBranchName(sess.tabheraCode, profiles),
        stats.present,
        stats.absent,
        stats.excused,
        sess.loggedBy
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] },
      styles: { fontSize: 8 }
    });

    doc.save(`JDN_Attendance_Sessions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportLeaderboardToCSV = () => {
    const headers = ['Rank', 'Member Name', 'Guild Group', 'Tabhera Branch', 'Sessions Logged', 'Present', 'Excused', 'Rate (%)'];
    const delimiter = ',';
    const rows = leaderboardData.map((row, index) => {
      const m = row.member;
      const displayId = `Member #${m.memberId.split('-')[1] || m.memberId}`;
      const mName = canSeeNames ? m.fullName : displayId;
      return [
        index + 1,
        `"${mName.replace(/"/g, '""')}"`,
        m.groupId,
        resolveBranchName(m.tabheraCode, profiles),
        row.total,
        row.present,
        row.excused,
        row.percentage.toFixed(1)
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(delimiter), ...rows.map(r => r.join(delimiter))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JDN_Attendance_Leaderboard_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportLeaderboardToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text("Jerusalem Digital Network (JDN) Attendance Leaderboard", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Active Group: ${filterGroup}`, 14, 21);

    const headers = [['Rank', 'Member Name / Designation', 'Group', 'Tabhera Branch', 'Logged', 'Present', 'Excused', 'Rate (%)']];
    const rows = leaderboardData.map((row, index) => {
      const m = row.member;
      const displayId = `Member #${m.memberId.split('-')[1] || m.memberId}`;
      const mName = canSeeNames ? m.fullName : displayId;
      return [
        index + 1,
        mName,
        m.groupId,
        resolveBranchName(m.tabheraCode, profiles),
        row.total,
        row.present,
        row.excused,
        `${row.percentage.toFixed(1)}%`
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] },
      styles: { fontSize: 8 }
    });

    doc.save(`JDN_Attendance_Leaderboard_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportInspectToCSV = () => {
    if (!inspectSession) return;
    const headers = ['Member Name', 'Status', 'Excuse Reason', 'Tabhera Branch', 'Session Date'];
    const delimiter = ',';
    const rows = inspectRecords.map(rec => {
      const mDetails = members.find(m => m.memberId === rec.memberId);
      const mName = canSeeNames ? (mDetails ? mDetails.fullName : rec.memberId) : `Protected Member ID: ${rec.memberId.split('-')[1] || rec.memberId}`;
      return [
        `"${mName.replace(/"/g, '""')}"`,
        rec.status,
        `"${(rec.excuseReason || '').replace(/"/g, '""')}"`,
        resolveBranchName(inspectSession.tabheraCode, profiles),
        inspectSession.date
      ];
    });

    let csvContent = [headers.join(delimiter), ...rows.map(r => r.join(delimiter))].join('\n');

    if (includeContributionsInReport) {
      const dayContribs = contributions.filter(c => 
        c.date === inspectSession.date && 
        c.tabheraCode === inspectSession.tabheraCode
      );
      
      csvContent += '\n\n"CONTRIBUTED MURAIROS ON THIS DAY & SERVICE"\n';
      csvContent += '"Murairo Name","Amount","Currency","Member Name","Reference Code"\n';

      dayContribs.forEach(c => {
        const mType = murairoTypes.find(t => t.murairoId === c.murairoId);
        const mTypeName = mType ? mType.name : `Unknown (${c.murairoId})`;
        const mDetails = members.find(mem => mem.memberId === c.memberId);
        const mName = mDetails ? mDetails.fullName : (c.guestName || 'Unknown');
        csvContent += `"${mTypeName.replace(/"/g, '""')}","${c.amount}","${c.currency}","${mName.replace(/"/g, '""')}","${c.referenceCode || ''}"\n`;
      });

      if (dayContribs.length === 0) {
        csvContent += '"No contributions recorded for this date and unit"\n';
      }
    }

    if (includeLeadershipInReport) {
      const tabLead = members.filter(m => m.tabheraCode === inspectSession.tabheraCode && m.isLeadership);
      
      csvContent += '\n\n"LEADERSHIP ATTENDANCE AUDIT LOGS"\n';
      csvContent += '"Leader Name","Basa Title","Attendance Status","Reason/Notice"\n';

      tabLead.forEach(l => {
        const rec = inspectRecords.find(r => r.memberId === l.memberId);
        const status = rec ? rec.status : 'Absent (No Attendance Marked)';
        const reason = rec?.excuseReason || '';
        csvContent += `"${l.fullName.replace(/"/g, '""')}","${(l.basa || 'Leadership').replace(/"/g, '""')}","${status}","${reason.replace(/"/g, '""')}"\n`;
      });

      if (tabLead.length === 0) {
        csvContent += '"No registered leadership members found for this tabhera"\n';
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `JDN_Session_${inspectSession.date}_details.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportInspectToPDF = () => {
    if (!inspectSession) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`JDN Session Details Sheet (${inspectSession.date})`, 14, 15);
    doc.setFontSize(9);
    doc.text(`ServiceType: ${inspectSession.serviceType} | Scope Code: ${resolveBranchName(inspectSession.tabheraCode, profiles)}`, 14, 21);

    const headers = [['Member Name / Anonymous Badge', 'Status', 'Reason/Notice']];
    const rows = inspectRecords.map(rec => {
      const mDetails = members.find(m => m.memberId === rec.memberId);
      const mName = canSeeNames ? (mDetails ? mDetails.fullName : rec.memberId) : `Protected Member ID: ${rec.memberId.split('-')[1] || rec.memberId}`;
      return [
        mName,
        rec.status,
        rec.excuseReason || ''
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52] },
      styles: { fontSize: 8 }
    });

    if (includeContributionsInReport) {
      const dayContributions = contributions.filter(c => 
        c.date === inspectSession.date && 
        c.tabheraCode === inspectSession.tabheraCode
      );

      let currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 100;
      if (currentY > 220) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFont(doc.getFont().fontName, "bold");
      doc.setFontSize(10);
      doc.text("Contributed Murairos on this Day & Service", 14, currentY + 8);
      doc.setFont(doc.getFont().fontName, "normal");
      doc.setFontSize(8);

      const contribHeaders = [['Murairo Category', 'Paid Amount', 'Currency', 'Contributor Name', 'Reference Code']];
      const contribRows = dayContributions.map(c => {
        const mType = murairoTypes.find(t => t.murairoId === c.murairoId);
        const mTypeName = mType ? mType.name : `Unknown (${c.murairoId})`;
        const mDetails = members.find(mem => mem.memberId === c.memberId);
        const mName = mDetails ? mDetails.fullName : (c.guestName || 'Unknown');
        return [
          mTypeName,
          `$${c.amount.toFixed(2)}`,
          c.currency,
          mName,
          c.referenceCode || 'N/A'
        ];
      });

      if (contribRows.length === 0) {
        doc.text("No registered contributions recorded on this day.", 14, currentY + 15);
        (doc as any).lastAutoTable = { finalY: currentY + 15 };
      } else {
        autoTable(doc, {
          head: contribHeaders,
          body: contribRows,
          startY: currentY + 12,
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11] },
          styles: { fontSize: 8 }
        });
      }
    }

    if (includeLeadershipInReport) {
      const leadershipMembers = members.filter(m => 
        m.tabheraCode === inspectSession.tabheraCode && 
        m.isLeadership === true
      );

      let currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 150;
      if (currentY > 220) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFont(doc.getFont().fontName, "bold");
      doc.setFontSize(10);
      doc.text("Leadership Presence Audit", 14, currentY + 8);
      doc.setFont(doc.getFont().fontName, "normal");
      doc.setFontSize(8);

      const leadHeaders = [['Leader Name', 'Basa / Title', 'Status', 'Reason/Excuse']];
      const leadRows = leadershipMembers.map(l => {
        const rec = inspectRecords.find(r => r.memberId === l.memberId);
        const status = rec ? rec.status : 'Absent (No Record)';
        const reason = rec?.excuseReason || 'N/A';
        return [
          l.fullName,
          l.basa || 'Leadership',
          status,
          reason
        ];
      });

      if (leadRows.length === 0) {
        doc.text("No registered leadership members found for this tabhera branch.", 14, currentY + 15);
        (doc as any).lastAutoTable = { finalY: currentY + 15 };
      } else {
        autoTable(doc, {
          head: leadHeaders,
          body: leadRows,
          startY: currentY + 12,
          theme: 'grid',
          headStyles: { fillColor: [55, 48, 163] },
          styles: { fontSize: 8 }
        });
      }
    }

    doc.save(`JDN_Session_${inspectSession.date}_details.pdf`);
  };



  // Find all attendance records in scope: of members within the scope
  const memberIdsInScope = new Set(members.map(m => m.memberId));
  const recordsInScope = records.filter(r => memberIdsInScope.has(r.memberId));
  
  // Total members in scope
  const totalMembersCount = members.length;
  
  // Number of unique members who have ever attended (Present on at least 1 record)
  const uniqueAttendedIds = new Set(
    recordsInScope.filter(r => r.status === 'Present').map(r => r.memberId)
  );
  const uniqueAttendedCount = uniqueAttendedIds.size;
  const uniqueAttendedPercent = totalMembersCount > 0
    ? (uniqueAttendedCount / totalMembersCount) * 100
    : 0;

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 animate-fade-in h-[60vh]">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">
            {currentUser.level === JdnLevel.TABHERA ? 'Attendance Logging' : 'Attendance Oversight'}
          </h1>
          <p className="text-sm text-[#6B7280]">
            {currentUser.level === JdnLevel.TABHERA 
              ? 'Log standard service attendances, flag absent exceptions, or review historic records.'
              : 'Oversight panel to review session history metrics, filter attendances, and view leaderboard metrics.'}
          </p>
        </div>

        {/* Create Session: Reserved exclusively for Tabhera users as per guidelines */}
        {currentUser.level === JdnLevel.TABHERA && !isLogging ? (
          <button
            onClick={startLoggingSession}
            className="bg-[#166534] hover:bg-[#166534]/90 text-white font-semibold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" /> Start Attendance Session
          </button>
        ) : null}
      </div>



      {isLogging ? (
        /* Logging Area */
        <form onSubmit={submitAttendanceSession} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <h2 className="text-md font-bold text-[#111827] flex items-center gap-2">
              <Clipboard className="h-5 w-5 text-[#166534]" /> New Attendance Sheet
            </h2>
            <button
              type="button"
              onClick={() => setIsLogging(false)}
              className="px-3 py-1 border border-gray-200 hover:bg-gray-50 rounded text-xs text-[#6B7280] font-semibold cursor-pointer"
            >
              Cancel Sheet
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1">Service Date</label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1">Service Type</label>
              <select
                value={isCustomService ? "Custom" : (['Sunday Service', 'Midweek', 'Special'].includes(serviceType) ? serviceType : 'Custom')}
                onChange={(e) => {
                  if (e.target.value === "Custom") {
                    setIsCustomService(true);
                    setServiceType("");
                  } else {
                    setIsCustomService(false);
                    setServiceType(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                <option value="Sunday Service">Sunday Service</option>
                <option value="Midweek">Midweek Prayer</option>
                <option value="Special">Special Pilgrimage / Feast</option>
                <option value="Custom">Custom / Other Type...</option>
              </select>
              {(isCustomService || !['Sunday Service', 'Midweek', 'Special'].includes(serviceType)) && (
                <input
                  type="text"
                  required
                  placeholder="Type custom service name..."
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#166534] animate-fade-in"
                />
              )}
            </div>

            <div className="flex items-center gap-2 self-end pb-2 font-semibold text-xs text-gray-600 select-none">
              <input
                type="checkbox"
                id="isCor"
                checked={isCorrection}
                onChange={(e) => setIsCorrection(e.target.checked)}
                className="rounded border-gray-300 text-[#166534] focus:ring-[#166534]"
              />
              <label htmlFor="isCor" className="cursor-pointer">This is an active correction session</label>
            </div>
          </div>

          {/* Members Sheet Roll list */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                 <select
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none bg-white"
                 >
                    <option value="All">All Groups</option>
                    <option value="Sunday School">Sunday School</option>
                    <option value="Masowani">Masowani</option>
                    <option value="Ruwadzano">Ruwadzano</option>
                    <option value="Sungano">Sungano</option>
                 </select>
                 <span className="text-xs font-bold text-gray-500 uppercase">Group Filter</span>

                 <input
                   type="text"
                   placeholder="Search members to mark..."
                   value={memberSearch}
                   onChange={(e) => setMemberSearch(e.target.value)}
                   className="ml-2 px-3 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#166534] bg-white w-48 sm:w-56"
                 />
              </div>
              <button
                type="button"
                onClick={() => {
                   setTempRecords(prev => {
                     const copy = { ...prev };
                     members.forEach(m => {
                        if ((filterGroup === 'All' || m.groupId === filterGroup) && 
                            (!memberSearch || m.fullName.toLowerCase().includes(memberSearch.toLowerCase()))) {
                           copy[m.memberId] = { status: 'Present', reason: '' };
                        }
                     });
                     return copy;
                   });
                }}
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 text-xs font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer"
              >
                Mark Filtered Present
              </button>
            </div>
            
            <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-[#6B7280] uppercase tracking-wider grid grid-cols-1 md:grid-cols-3 gap-2 border-t border-gray-200">
              <div>Congregation Participant</div>
              <div>Sheet Status Checks (Defaults to Absent)</div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
              {members
                 .filter(m => filterGroup === 'All' || m.groupId === filterGroup)
                 .filter(m => !memberSearch || m.fullName.toLowerCase().includes(memberSearch.toLowerCase()))
                 .map(member => {
                const selections = tempRecords[member.memberId] || { status: 'Absent', reason: '' };
                return (
                  <div key={member.memberId} className="p-4 grid grid-cols-1 md:grid-cols-3 gap-2 items-center hover:bg-gray-50/55 transition-colors">
                    <div>
                      <div className="font-semibold text-gray-900">{member.fullName}</div>
                      <div className="text-[10px] text-gray-500">{member.groupId} • {member.gender}</div>
                    </div>

                    <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Radios for checking status */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(member.memberId, 'Present')}
                          className={`px-3 py-1 rounded text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${selections.status === 'Present' ? 'bg-[#16A34A] border-[#16A34A] text-white' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                          <CircleCheck className="h-3.5 w-3.5" /> Present
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(member.memberId, 'Absent')}
                          className={`px-3 py-1 rounded text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${selections.status === 'Absent' ? 'bg-[#DC2626] border-[#DC2626] text-white' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                          <CircleX className="h-3.5 w-3.5" /> Absent
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(member.memberId, 'Excused')}
                          className={`px-3 py-1 rounded text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${selections.status === 'Excused' ? 'bg-[#D97706] border-[#D97706] text-white' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                          <Bookmark className="h-3.5 w-3.5" /> Excused
                        </button>
                      </div>

                      {/* Excuse reason input if Excused is checked */}
                      {selections.status === 'Excused' && (
                        <input
                          type="text"
                          required
                          value={selections.reason}
                          onChange={(e) => handleReasonChange(member.memberId, e.target.value)}
                          placeholder="Provide official excuse reason..."
                          className="flex-1 px-2.5 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#166534]"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSavingSession}
              className={`text-white font-bold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95 duration-100 cursor-pointer ${
                isSavingSession
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#166534] hover:bg-[#115e2e] active:bg-[#0f4d25]'
              }`}
            >
              <CheckSquare className="h-4.5 w-4.5" /> 
              {isSavingSession ? 'Submitting Registry Session...' : 'Finalize and Submit Session'}
            </button>
          </div>
        </form>
      ) : (
        /* Sessions & Leaderboard Tabbed Screen */
        <div className="space-y-4">
          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="attendance-overview-banner">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Registered</p>
                <h3 className="text-xl font-extrabold text-gray-900 mt-1">{totalMembersCount}</h3>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">Congregants in database scope</p>
              </div>
              <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
                👥
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#166534]/10 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">Members Attended</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-xl font-extrabold text-[#166534]">{uniqueAttendedCount}</h3>
                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {uniqueAttendedPercent.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">At least 1 logged attendance</p>
              </div>
              <div className="h-10 w-10 bg-green-50 text-[#166534] rounded-lg flex items-center justify-center font-bold text-lg">
                ✓
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Submitted Sessions</p>
                <h3 className="text-xl font-extrabold text-gray-900 mt-1">{sessions.length}</h3>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">Historical logs recorded</p>
              </div>
              <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold text-lg">
                📝
              </div>
            </div>
          </div>

          {/* Custom Navigation Tab Headers */}
          <div className="flex border-b border-gray-200 gap-1 overflow-x-auto pb-px">
            <button
              type="button"
              onClick={() => setAttendanceTab('sessions')}
              className={`py-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap cursor-pointer ${attendanceTab === 'sessions' ? 'border-[#166534] text-[#166534]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              📜 Historical Sessions
            </button>
            <button
              type="button"
              onClick={() => setAttendanceTab('leaderboard')}
              className={`py-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap cursor-pointer ${attendanceTab === 'leaderboard' ? 'border-[#166534] text-[#166534]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
            >
              🏆 Top 20 Attendance Leaderboard
            </button>
          </div>

          {attendanceTab === 'sessions' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Historical Sync Sessions ({filteredSessions.length} total)</h3>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={exportSessionsToCSV}
                      disabled={filteredSessions.length === 0}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-700 hover:bg-blue-800 text-[10px] font-bold text-white rounded transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Download className="h-3 w-3" /> Export CSV
                    </button>
                    <button
                      onClick={exportSessionsToPDF}
                      disabled={filteredSessions.length === 0}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#166534] hover:bg-green-800 text-[10px] font-bold text-white rounded transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="h-3 w-3" /> Export PDF
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Branch filter */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Branch:</span>
                    <select
                      value={filterBranchCode}
                      onChange={(e) => setFilterBranchCode(e.target.value)}
                      className="px-2 py-0.5 text-xs font-bold text-gray-800 rounded bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="All">All Branches</option>
                      {uniqueTabherasInScope.map(tb => (
                        <option key={tb.code} value={tb.code}>{tb.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Day:</span>
                     <input type="date" value={filterDay} onChange={(e) => setFilterDay(e.target.value)} className="text-xs font-bold text-gray-800 bg-transparent focus:outline-none cursor-pointer" />
                     {filterDay && <button onClick={() => setFilterDay('')} className="text-[10px] font-bold text-red-500 hover:text-red-700">Clear</button>}
                  </div>
                </div>
              </div>
              {filteredSessions.length === 0 ? (
                <div className="p-12 text-center text-gray-400 space-y-2">
                  <BookOpen className="h-10 w-10 mx-auto text-[#6B7280]" />
                  <h4 className="font-semibold text-gray-700">No attendance sessions match these filters.</h4>
                  <p className="text-xs">Adjust the branch or day filter to locate session records.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-xs text-[#6B7280] font-bold uppercase border-b border-gray-100">
                        <th className="py-3 px-4">Date logged</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Code Scope</th>
                        <th className="py-3 px-4">Participants stats</th>
                        <th className="py-3 px-4">Origin / Logs</th>
                        <th className="py-3 px-4">Sync Status</th>
                        <th className="py-3 px-4 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {pagedSessions.map(sess => {
                        const stats = getSessionStats(sess.sessionId);
                        return (
                          <tr key={sess.sessionId} className="hover:bg-gray-50/40 transition-colors">
                            <td className="py-3 px-4 font-semibold text-gray-900 flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-[#6B7280]" />
                              {sess.date}
                              {sess.isCorrection && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-red-100 text-red-700 border border-red-200 rounded font-bold uppercase">
                                  Correction
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-gray-700">{sess.serviceType}</td>
                            <td className="py-3 px-4 text-xs font-mono text-gray-500 leading-tight">
                            {resolveBranchName(sess.tabheraCode, profiles)}
                          </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="font-bold text-green-600">{stats.present} present</span> •{' '}
                              <span className="text-red-500">{stats.absent} absent</span> •{' '}
                              <span className="text-amber-600">{stats.excused} excused</span>
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-500 font-mono">Logged: {sess.loggedBy.split('-')[1] || sess.loggedBy}</td>
                            <td className="py-3 px-4">
                              {sess.syncStatus === 'pending' ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                                  Queue Pending
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#16A34A] border border-green-200 text-xs font-medium">
                                  Locked & Synced
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setInspectSession(sess)}
                                className="p-1 px-2 hover:bg-gray-100 border border-gray-200 rounded text-xs text-gray-600 hover:text-black flex items-center gap-1 cursor-pointer mx-auto"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sessions Pagination (exactly 10 pages) */}
              {totalSessionsPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50/50">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      disabled={currentPageSessions === 1}
                      onClick={() => setCurrentPageSessions(prev => Math.max(prev - 1, 1))}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentPageSessions === totalSessionsPages}
                      onClick={() => setCurrentPageSessions(prev => Math.min(prev + 1, totalSessionsPages))}
                      className="relative ml-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] text-gray-750">
                        Showing <span className="font-semibold">{(currentPageSessions - 1) * SESSIONS_ITEMS_PER_PAGE + 1}</span> to{' '}
                        <span className="font-semibold">
                          {Math.min(currentPageSessions * SESSIONS_ITEMS_PER_PAGE, filteredSessions.length)}
                        </span>{' '}
                        of <span className="font-semibold">{filteredSessions.length}</span> sessions
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-xs bg-white border border-gray-200">
                        <button
                          disabled={currentPageSessions === 1}
                          onClick={() => setCurrentPageSessions(1)}
                          className="relative inline-flex items-center rounded-l-md px-2 py-1 text-[11px] font-bold text-gray-550 hover:bg-gray-50 disabled:opacity-50"
                        >
                          First
                        </button>
                        <button
                          disabled={currentPageSessions === 1}
                          onClick={() => setCurrentPageSessions(prev => Math.max(prev - 1, 1))}
                          className="relative inline-flex items-center px-2 py-1 text-[11px] font-bold text-gray-550 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalSessionsPages }, (_, i) => i + 1)
                          .filter(page => Math.abs(page - currentPageSessions) <= 2 || page === 1 || page === totalSessionsPages)
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
                                  onClick={() => setCurrentPageSessions(page)}
                                  className={`relative inline-flex items-center px-3 py-1 text-[11px] font-bold ${
                                    currentPageSessions === page
                                      ? 'bg-[#166534] text-white border-none'
                                      : 'bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-200'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            );
                          })}
                        <button
                          disabled={currentPageSessions === totalSessionsPages}
                          onClick={() => setCurrentPageSessions(prev => Math.min(prev + 1, totalSessionsPages))}
                          className="relative inline-flex items-center px-2 py-1 text-[11px] font-bold text-gray-550 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                        <button
                          disabled={currentPageSessions === totalSessionsPages}
                          onClick={() => setCurrentPageSessions(totalSessionsPages)}
                          className="relative inline-flex items-center rounded-r-md px-2 py-1 text-[11px] font-bold text-gray-550 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Last
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 col-span-full flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Congregation Attendance Rankings ({leaderboardData.length} records)</h3>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      onClick={exportLeaderboardToCSV}
                      disabled={leaderboardData.length === 0}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-700 hover:bg-blue-800 text-[10px] font-bold text-white rounded transition shadow-xs cursor-pointer"
                    >
                      <Download className="h-3 w-3" /> Export CSV
                    </button>
                    <button
                      onClick={exportLeaderboardToPDF}
                      disabled={leaderboardData.length === 0}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#166534] hover:bg-green-800 text-[10px] font-bold text-white rounded transition shadow-xs cursor-pointer"
                    >
                      <FileText className="h-3 w-3" /> Export PDF
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Branch filter */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Branch:</span>
                    <select
                      value={filterBranchCode}
                      onChange={(e) => setFilterBranchCode(e.target.value)}
                      className="px-2 py-0.5 text-xs font-bold text-gray-800 rounded bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="All">All Branches</option>
                      {uniqueTabherasInScope.map(tb => (
                        <option key={tb.code} value={tb.code}>{tb.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Group filter */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Group:</span>
                     <select
                        value={filterGroup}
                        onChange={(e) => setFilterGroup(e.target.value)}
                        className="px-2 py-0.5 text-xs font-bold text-gray-800 rounded bg-transparent focus:outline-none cursor-pointer"
                     >
                        <option value="All">All Groups</option>
                        <option value="Sunday School">Sunday School</option>
                        <option value="Masowani">Masowani</option>
                        <option value="Ruwadzano">Ruwadzano</option>
                        <option value="Sungano">Sungano</option>
                     </select>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-blue-50/50 border-b border-gray-200 text-xs text-blue-700 leading-relaxed">
                {!canSeeNames ? (
                  <div>
                    <strong>Privacy Shield Activated:</strong> Member-level names are hidden under strict JDN privacy compliance rules for oversight roles. Anonymized designation details are presented.
                  </div>
                ) : (
                  <span>Showing member attendance metrics sorted by overall attendance rate (includes Excuse logs). Rate is calculated against all logged sheets.</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-xs text-[#6B7280] font-bold uppercase border-b border-gray-100">
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Member Name / Designation</th>
                      <th className="py-3 px-4">Guild Group</th>
                      <th className="py-3 px-4">Tabhera Scope</th>
                      <th className="py-3 px-4 text-center">Sessions Logged</th>
                      <th className="py-3 px-4 text-center text-[#16A34A]">Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {pagedLeaderboardData.map((row, index) => {
                      const m = row.member;
                      const displayId = `Member #${m.memberId.split('-')[1] || m.memberId}`;
                      const computedIndex = (currentPageLeaderboard - 1) * LEADERBOARD_ITEMS_PER_PAGE + index;
                      return (
                        <tr key={m.memberId} className="hover:bg-gray-50/40 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-gray-500">
                            {computedIndex === 0 && '🥇 '}
                            {computedIndex === 1 && '🥈 '}
                            {computedIndex === 2 && '🥉 '}
                            {computedIndex > 2 && `${computedIndex + 1}`}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {canSeeNames ? m.fullName : displayId}
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-gray-700">{m.groupId}</td>
                          <td className="py-3 px-4 text-xs font-mono text-gray-500">{resolveBranchName(m.tabheraCode, profiles)}</td>
                          <td className="py-3 px-4 text-xs text-center text-gray-500">
                            <span className="font-bold text-gray-800">{row.total}</span> total
                            <span className="text-gray-400"> ({row.present} P, {row.excused} E)</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#16A34A] font-bold text-xs font-mono">
                              {row.percentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Leaderboard Pagination */}
              {totalLeaderboardPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50/50">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      disabled={currentPageLeaderboard === 1}
                      onClick={() => setCurrentPageLeaderboard(prev => Math.max(prev - 1, 1))}
                      className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentPageLeaderboard === totalLeaderboardPages}
                      onClick={() => setCurrentPageLeaderboard(prev => Math.min(prev + 1, totalLeaderboardPages))}
                      className="relative ml-2 inline-flex inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] text-gray-750">
                        Showing <span className="font-semibold">{(currentPageLeaderboard - 1) * LEADERBOARD_ITEMS_PER_PAGE + 1}</span> to{' '}
                        <span className="font-semibold">
                          {Math.min(currentPageLeaderboard * LEADERBOARD_ITEMS_PER_PAGE, leaderboardData.length)}
                        </span>{' '}
                        of <span className="font-semibold">{leaderboardData.length}</span> members
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-xs bg-white border border-gray-200">
                        <button
                          disabled={currentPageLeaderboard === 1}
                          onClick={() => setCurrentPageLeaderboard(1)}
                          className="relative inline-flex items-center rounded-l-md px-2 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          First
                        </button>
                        <button
                          disabled={currentPageLeaderboard === 1}
                          onClick={() => setCurrentPageLeaderboard(prev => Math.max(prev - 1, 1))}
                          className="relative inline-flex items-center px-2 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalLeaderboardPages }, (_, i) => i + 1)
                          .filter(page => Math.abs(page - currentPageLeaderboard) <= 2 || page === 1 || page === totalLeaderboardPages)
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
                                  onClick={() => setCurrentPageLeaderboard(page)}
                                  className={`relative inline-flex items-center px-3 py-1 text-[11px] font-bold ${
                                    currentPageLeaderboard === page
                                      ? 'bg-[#166534] text-white border-none'
                                      : 'bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-200'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            );
                          })}
                        <button
                          disabled={currentPageLeaderboard === totalLeaderboardPages}
                          onClick={() => setCurrentPageLeaderboard(prev => Math.min(prev + 1, totalLeaderboardPages))}
                          className="relative inline-flex items-center px-2 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                        <button
                          disabled={currentPageLeaderboard === totalLeaderboardPages}
                          onClick={() => setCurrentPageLeaderboard(totalLeaderboardPages)}
                          className="relative inline-flex items-center rounded-r-md px-2 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Last
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inspect Session Custom Dialog Overlay */}
      {inspectSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-gray-200 flex flex-col max-h-[80vh] overflow-hidden animate-fade-in" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-md font-bold text-gray-900">Attendance Sheet Inspection</h3>
                <p className="text-xs text-gray-400 font-medium mb-1">{inspectSession.serviceType} on {inspectSession.date}</p>
                <div className="flex gap-2">
                  <button
                    onClick={exportInspectToCSV}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-[9px] font-bold text-white rounded transition cursor-pointer"
                  >
                    <Download className="h-2.5 w-2.5" /> CSV
                  </button>
                  <button
                    onClick={exportInspectToPDF}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#166534] hover:bg-green-800 text-[9px] font-bold text-white rounded transition cursor-pointer"
                  >
                    <FileText className="h-2.5 w-2.5" /> PDF
                  </button>
                </div>
              </div>
              <button
                onClick={() => setInspectSession(null)}
                className="text-gray-400 hover:text-black text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {inspectSession.syncStatus === 'synced' && (
              <div className="my-3 p-2 bg-emerald-50 border border-green-100 text-[#16A34A] rounded text-xs flex items-center gap-1.5 leading-normal">
                <AlertCircle className="h-4 w-4 shrink-0" />
                This sheet has been synchronized and locked. Correction and modifications require a separate session flagged as correction: true.
              </div>
            )}

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-[11px] space-y-2 mt-1 text-gray-800">
              <div className="font-bold text-[9px] text-[#166534] uppercase tracking-wider">Report Export Options (Day & Service):</div>
              <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700">
                  <input 
                    type="checkbox" 
                    checked={includeContributionsInReport} 
                    onChange={(e) => setIncludeContributionsInReport(e.target.checked)}
                    className="rounded text-[#166534] focus:ring-[#166534] h-3.5 w-3.5 cursor-pointer"
                  />
                  Include Contributed Murairos
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700">
                  <input 
                    type="checkbox" 
                    checked={includeLeadershipInReport} 
                    onChange={(e) => setIncludeLeadershipInReport(e.target.checked)}
                    className="rounded text-[#166534] focus:ring-[#166534] h-3.5 w-3.5 cursor-pointer"
                  />
                  Audit Leadership Presence
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto outline-none py-1 space-y-4 mt-4">
              {canSeeNames ? (
                <>
                  <div className="text-xs font-bold uppercase tracking-widest text-[#6B7280] mb-2 p-1 border-b border-gray-100">Participant Logs ({inspectRecords.length}):</div>
                  {pagedInspectRecords.map(rec => {
                      const mDetails = members.find(m => m.memberId === rec.memberId);
                      return (
                        <div key={rec.recordId} className="flex justify-between items-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100/50 transition-colors">
                          <div>
                            <div className="text-sm font-semibold">{mDetails ? mDetails.fullName : `Loading ID: ${rec.memberId}`}</div>
                            {rec.status === 'Excused' && rec.excuseReason && (
                              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 mt-1">
                                Reason: {rec.excuseReason}
                              </div>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs font-bold rounded ${rec.status === 'Present' ? 'bg-green-100 text-[#16A34A]' : rec.status === 'Absent' ? 'bg-red-100 text-[#DC2626]' : 'bg-yellow-100 text-[#D97706]'}`}>
                            {rec.status}
                          </span>
                        </div>
                      );
                    })}

                  {/* Inspector Participant Logs Pagination */}
                  {totalInspectPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-3 bg-gray-50/50 p-2 rounded-lg">
                      <button
                        disabled={currentPageInspect === 1}
                        onClick={() => setCurrentPageInspect(prev => Math.max(prev - 1, 1))}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <span className="text-[10px] text-gray-655 font-medium">
                        Page {currentPageInspect} of {totalInspectPages}
                      </span>
                      <button
                        disabled={currentPageInspect === totalInspectPages}
                        onClick={() => setCurrentPageInspect(prev => Math.min(prev + 1, totalInspectPages))}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-xs leading-normal">
                    <strong>Privacy-Shield Active ({currentUser.level}):</strong> Individual names are hidden. Showing aggregated attendee count according to local statistics.
                  </div>

                  {(() => {
                    const stats = getAggregatedOversightStats(inspectSession.sessionId);
                    return (
                      <div className="space-y-4 mt-2">
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-lg text-center">
                          <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">Present</div>
                            <div className="text-sm font-bold text-green-600">{stats.totalPresent}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">Absent</div>
                            <div className="text-sm font-bold text-red-500">{stats.totalAbsent}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">Excused</div>
                            <div className="text-sm font-bold text-amber-600">{stats.totalExcused}</div>
                          </div>
                        </div>

                        {/* Tabhera totals */}
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1.5 border-b pb-0.5">Total Per Tabhera</div>
                          <div className="space-y-1">
                            {stats.tabheras.map(([code, c]) => (
                              <div key={code} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                                <span className="font-mono font-bold text-gray-800">{code}</span>
                                <span className="font-mono text-gray-500">
                                  <span className="text-green-600 font-bold">{c.present}</span> P • <span className="text-red-500 font-bold">{c.absent}</span> A • <span className="text-amber-500 font-bold">{c.excused}</span> E
                                </span>
                              </div>
                            ))}
                            {stats.tabheras.length === 0 && <span className="text-xs text-gray-400 italic">No registered tabheras found in this session.</span>}
                          </div>
                        </div>

                        {/* Nyika totals */}
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1.5 border-b pb-0.5">Total Per Nyika</div>
                          <div className="space-y-1">
                            {stats.nyikas.map(([code, c]) => (
                              <div key={code} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                                <span className="font-mono font-bold text-gray-800">{code}</span>
                                <span className="font-mono text-gray-500">
                                  <span className="text-green-600 font-bold">{c.present}</span> P • <span className="text-red-500 font-bold">{c.absent}</span> A • <span className="text-amber-500 font-bold">{c.excused}</span> E
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Guild Group totals */}
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1.5 border-b pb-0.5">Total Per Group</div>
                          <div className="space-y-1">
                            {stats.groups.map(([grp, c]) => (
                              <div key={grp} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                                <span className="font-semibold text-gray-800">{grp}</span>
                                <span className="font-mono text-gray-500">
                                  <span className="text-green-600 font-bold">{c.present}</span> P • <span className="text-red-500 font-bold">{c.absent}</span> A • <span className="text-amber-500 font-bold">{c.excused}</span> E
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Gender totals */}
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1.5 border-b pb-0.5">Total Per Gender</div>
                          <div className="space-y-1">
                            {stats.genders.map(([g, c]) => (
                              <div key={g} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                                <span className="font-semibold text-gray-800">{g}</span>
                                <span className="font-mono text-gray-500">
                                  <span className="text-green-600 font-bold">{c.present}</span> P • <span className="text-red-500 font-bold">{c.absent}</span> A • <span className="text-amber-500 font-bold">{c.excused}</span> E
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setInspectSession(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-100/80 rounded-lg text-xs font-bold cursor-pointer"
              >
                Close Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
