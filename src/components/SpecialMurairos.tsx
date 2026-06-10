import React, { useState, useEffect } from 'react';
import { UserProfile, JdnLevel, UnganoCategory, ContributionTarget, Member, UnganoPayment } from '../types';
import { 
  getCurrencies, 
  getPaymentMethods, 
  getUnganoCategories,
  getContributionTargets,
  getMembers,
  getUnganoPayments,
  getUserProfiles
} from '../lib/storage';
import { Coins, LayoutDashboard, CreditCard, ScrollText, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { MurairoDashboard } from './MurairoDashboard';
import { MurairoPaymentRecorder } from './MurairoPaymentRecorder';
import { MurairoAuditCenter } from './MurairoAuditCenter';
import { SpecialMurairosConfig } from './SpecialMurairosConfig'; 

interface SpecialMurairosProps {
  currentUser: UserProfile;
}

export function SpecialMurairos({ currentUser }: SpecialMurairosProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry' | 'audit' | 'config'>('dashboard');
  const [data, setData] = useState<{
    categories: UnganoCategory[];
    members: Member[];
    payments: UnganoPayment[];
  }>({ categories: [], members: [], payments: [] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [categories, members, payments] = await Promise.all([
      getUnganoCategories(),
      getMembers(),
      getUnganoPayments()
    ]);
    setData({ categories, members, payments });
  };

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'audit', name: 'Audit Center', icon: ScrollText },
  ];

  if (currentUser.level === JdnLevel.JERUSALEM || currentUser.level === JdnLevel.SYSTEM) {
    tabs.push({ id: 'config', name: 'Configuration', icon: SettingsIcon });
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="h-6 w-6 text-[#D97706]" />
            Special Murairos Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">Event-based financial logistics and compliance hub.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === tab.id ? 'bg-white text-[#166534] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Special Murairo Recording form sits directly at the top of the page */}
      <div className="max-w-2xl bg-white rounded-xl">
        <MurairoPaymentRecorder {...data} currentUser={currentUser} onPaymentRecorded={loadData} />
      </div>
      
      <div className="mt-4">
        {activeTab === 'dashboard' && <MurairoDashboard {...data} />}
        {activeTab === 'audit' && <MurairoAuditCenter {...data} />}
        {activeTab === 'config' && <SpecialMurairosConfig currentUser={currentUser} onConfigChange={loadData} />}
      </div>
    </div>
  );
}
