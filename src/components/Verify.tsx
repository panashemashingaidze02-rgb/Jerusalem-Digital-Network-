import React, { useEffect, useState } from 'react';
import { Member, UserProfile } from '../types';
import { getMembers, getUserProfiles, resolveBranchName } from '../lib/storage';
import { ShieldAlert, CheckCircle2, XCircle, Search, AlertCircle, ArrowLeft } from 'lucide-react';
import { IDCardTemplate, IDConfig } from './IDCardTemplate';

export default function Verify() {
  const [member, setMember] = useState<Member | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'Valid' | 'Suspended' | 'Invalid'>('Valid');
  const [idConfig, setIdConfig] = useState<IDConfig | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('jdn_id_config');
    if (saved) {
      setIdConfig(JSON.parse(saved));
    } else {
      setIdConfig({
        logoUrl: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=100&auto=format&fit=crop',
        frontBgUrl: '',
        backBgUrl: '',
        signatureUrl: '',
        primaryColor: '#166534',
        secondaryColor: '#D97706',
        fontFamily: 'Inter, sans-serif',
        textColor: '#111827',
        globalExpiry: '2028-12-31',
        layoutStyle: 'modern',
        orgName: 'JERUSALEM DIGITAL NETWORK',
        globalBasa: ''
      });
    }

    const runVerification = async () => {
      try {
        const pathParts = window.location.pathname.split('/');
        const idToCheck = pathParts[2]; // /verify/123

        if (!idToCheck) {
          setError("No ID provided in URL");
          setIsLoading(false);
          return;
        }

        const members = await getMembers();
        const existingProfiles = await getUserProfiles();
        setProfiles(existingProfiles);

        const found = members.find(m => m.memberNumber === idToCheck || m.memberId === idToCheck);
        
        if (!found) {
          setError("No member found with this ID.");
          setStatus('Invalid');
        } else {
          setMember(found);
          let isValid = true;
          if (found.isSuspended) {
             setError("This member is currently SUSPENDED from official leadership duties.");
             setStatus('Suspended');
             isValid = false;
          }
          if (found.idExpiryDate) {
             const expiry = new Date(found.idExpiryDate);
             if (expiry < new Date()) {
                setError("This ID card has EXPIRED.");
                setStatus('Invalid');
                isValid = false;
             }
          } else {
             const saved = localStorage.getItem('jdn_id_config');
             if (saved) {
                const conf = JSON.parse(saved);
                if (new Date(conf.globalExpiry) < new Date()) {
                   setError("This ID card has EXPIRED.");
                   setStatus('Invalid');
                   isValid = false;
                }
             }
          }

          if (isValid) setStatus('Valid');
        }

      } catch (e) {
        setError("System error during verification.");
      } finally {
        setIsLoading(false);
      }
    };
    runVerification();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 space-y-4">
        <div className="h-8 w-8 border-4 border-[#166534] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium font-mono text-xs uppercase tracking-widest">Scanning Registry...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        <div className={`p-6 text-center text-white flex flex-col items-center ${status === 'Valid' ? 'bg-[#166534]' : status === 'Suspended' ? 'bg-amber-600' : 'bg-red-600'}`}>
           <div className="bg-white/20 p-3 rounded-full inline-block backdrop-blur-sm mb-3 shadow-inner">
             {status === 'Valid' ? (
                <CheckCircle2 className="h-10 w-10 text-white" />
             ) : status === 'Suspended' ? (
                <ShieldAlert className="h-10 w-10 text-white" />
             ) : (
                <XCircle className="h-10 w-10 text-white" />
             )}
           </div>
           <h1 className="text-2xl font-black tracking-tight">
             {status === 'Valid' ? 'VALID ID' : status === 'Suspended' ? 'SUSPENDED' : 'INVALID ID'}
           </h1>
           <p className="text-sm font-medium text-white/80 mt-1 uppercase tracking-wide">
             {status === 'Valid' ? 'Verified Member' : status === 'Suspended' ? 'Action Required' : 'Registry Lookup Failed'}
           </p>
        </div>

        {member && idConfig && (
          <div className="p-4 bg-gray-100 flex flex-col items-center gap-4 overflow-hidden border-b border-gray-100 relative pt-8 pb-8 custom-scrollbar">
             {member.pictureUrl && (
               <div className="flex justify-center -mt-16 relative z-30 mb-2">
                 <img src={member.pictureUrl} alt="ID" className="h-16 w-16 rounded-full border-4 border-white shadow-md object-cover" />
               </div>
             )}
             <div className="transform scale-[0.60] sm:scale-75 md:scale-90 origin-top h-[750px] md:h-[410px]">
                 <IDCardTemplate 
                   leader={{...member, basa: idConfig.globalBasa || member.basa}} 
                   config={idConfig} 
                   profiles={profiles} 
                   className="flex flex-col md:flex-row gap-4 items-center md:items-start" 
                 />
             </div>
          </div>
        )}

        {member && (
          <div className="p-6 space-y-5">
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Name</label>
                <div className="text-lg font-black text-gray-900">{member.fullName}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Member NUM</label>
                  <div className="text-sm font-mono font-bold text-gray-800">{member.memberNumber || member.memberId.substring(0,8)}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Group</label>
                  <div className="text-sm font-bold text-blue-700">{member.groupId}</div>
                </div>
              </div>

              {member.isLeadership && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                  <label className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1">
                     <ShieldAlert className="h-3 w-3" /> Leadership Role
                  </label>
                  <div className="text-sm font-black text-amber-900 mt-0.5">{member.basa || 'Mutungamiri'}</div>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Branch</label>
                <div className="text-sm font-medium text-gray-700">{resolveBranchName(member.tabheraCode, profiles)}</div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-red-600 font-bold bg-red-50 flex items-center justify-center flex-col gap-2">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
            <button
               onClick={() => window.location.href = '/'}
               className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center justify-center w-full gap-2 transition-colors uppercase tracking-widest"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Return to System
            </button>
        </div>
      </div>
    </div>
  );
}
