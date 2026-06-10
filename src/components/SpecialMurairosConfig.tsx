import React, { useState, useEffect } from 'react';
import { UserProfile, JdnLevel, UnganoCategory, ContributionTarget, Member } from '../types';
import { 
  getCurrencies, 
  addCustomCurrency, 
  getPaymentMethods, 
  addCustomPaymentMethod,
  getUnganoCategories,
  saveUnganoCategories,
  getContributionTargets,
  saveContributionTargets,
  getMembers,
  getUserProfiles
} from '../lib/storage';
import { Plus, Trash2, Edit, Target, Save, X, Coins, CreditCard } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  currentUser: UserProfile;
  onConfigChange: () => void;
}

export function SpecialMurairosConfig({ currentUser, onConfigChange }: Props) {
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([]);
  const [supportedPaymentMethods, setSupportedPaymentMethods] = useState<string[]>([]);
  const [categories, setCategories] = useState<UnganoCategory[]>([]);
  const [allTargets, setAllTargets] = useState<ContributionTarget[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  const [newCurrency, setNewCurrency] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  const [isEditingType, setIsEditingType] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '', description: '', amount: 0 });

  const [activeTargetTypeId, setActiveTargetTypeId] = useState<string | null>(null);
  const [targetForm, setTargetForm] = useState({ entityType: 'Member', entityId: '', amount: 0 });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const curr = await getCurrencies();
    const meth = await getPaymentMethods();
    const cats = await getUnganoCategories();
    const targs = await getContributionTargets();
    const mems = await getMembers();
    const profs = await getUserProfiles();

    setSupportedCurrencies(curr);
    setSupportedPaymentMethods(meth);
    setCategories(cats);
    setAllTargets(targs);
    setAllMembers(mems);
    setAllProfiles(profs);
    onConfigChange();
  };

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurrency.trim()) return;
    await addCustomCurrency(newCurrency);
    setNewCurrency('');
    await loadConfig();
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaymentMethod.trim()) return;
    await addCustomPaymentMethod(newPaymentMethod);
    setNewPaymentMethod('');
    await loadConfig();
  };

  const saveType = async () => {
    if (!typeForm.name.trim()) return toast.error('Name is required');
    if (isEditingType === 'new') {
      const newCat: UnganoCategory = {
        id: `sp-mur-${Date.now()}`,
        name: typeForm.name,
        description: typeForm.description,
        amount: typeForm.amount || null,
        currency: supportedCurrencies,
        createdBy: currentUser.levelCode,
        creatorLevel: currentUser.level,
        createdAt: new Date().toISOString()
      };
      await saveUnganoCategories([...categories, newCat]);
      toast.success('Special Murairo Type Created');
    } else if (isEditingType) {
      const updated = categories.map(c => c.id === isEditingType ? { ...c, name: typeForm.name, description: typeForm.description, amount: typeForm.amount || null } : c);
      await saveUnganoCategories(updated);
      toast.success('Special Murairo Type Updated');
    }
    setIsEditingType(null);
    await loadConfig();
  };

  const deleteType = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this type?')) return;
    await saveUnganoCategories(categories.filter(c => c.id !== id));
    toast.success('Type deleted');
    await loadConfig();
  };

  const handleSaveTarget = async () => {
    if (!activeTargetTypeId || !targetForm.entityId || targetForm.amount <= 0) return toast.error('Fill all fields with valid data');
    
    let entityName = targetForm.entityId;
    if (targetForm.entityType === 'Member') {
      const m = allMembers.find(x => x.memberId === targetForm.entityId);
      if (m) entityName = m.fullName;
    } else {
      const p = allProfiles.find(x => x.levelCode === targetForm.entityId);
      if (p) entityName = p.branchName;
    }

    const tId = `targ-${Date.now()}`;
    const newTarget: ContributionTarget = {
      id: tId,
      entityId: targetForm.entityId,
      entityType: targetForm.entityType as any,
      entityName,
      typeId: `spe-${activeTargetTypeId}`,
      typeClass: 'special',
      targetAmount: targetForm.amount,
      currency: 'USD',
      createdAt: new Date().toISOString()
    };

    const filtered = allTargets.filter(t => !(t.entityId === targetForm.entityId && t.entityType === targetForm.entityType && t.typeId === `spe-${activeTargetTypeId}`));
    await saveContributionTargets([...filtered, newTarget]);
    toast.success('Target set successfully');
    setTargetForm({ ...targetForm, amount: 0, entityId: '' });
    await loadConfig();
  };

  const getEntityOptions = () => {
    if (targetForm.entityType === 'Member') return allMembers;
    return allProfiles.filter(p => {
       if (targetForm.entityType === 'Tabhera') return p.level === JdnLevel.TABHERA;
       if (targetForm.entityType === 'Nyika') return p.level === JdnLevel.NYIKA;
       if (targetForm.entityType === 'District') return p.level === JdnLevel.DISTRICT;
       if (targetForm.entityType === 'Province') return p.level === JdnLevel.PROVINCIAL;
       if (targetForm.entityType === 'Nation') return p.level === JdnLevel.NATIONAL;
       return false;
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Special Murairo Types</h3>
          <button onClick={() => { setIsEditingType('new'); setTypeForm({name:'', description:'', amount: 0}); }} className="px-3 py-1.5 bg-[#166534] text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add Type
          </button>
        </div>

        {isEditingType && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-4 items-end mb-6">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
              <input type="text" value={typeForm.name} onChange={e => setTypeForm({...typeForm, name: e.target.value})} className="w-full mt-1 p-2 border border-gray-300 rounded text-sm"/>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
              <input type="text" value={typeForm.description} onChange={e => setTypeForm({...typeForm, description: e.target.value})} className="w-full mt-1 p-2 border border-gray-300 rounded text-sm"/>
            </div>
            <div className="w-32">
              <label className="text-xs font-bold text-gray-500 uppercase">Base Amt</label>
              <input type="number" value={typeForm.amount} onChange={e => setTypeForm({...typeForm, amount: parseFloat(e.target.value)})} className="w-full mt-1 p-2 border border-gray-300 rounded text-sm"/>
            </div>
            <button onClick={saveType} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm h-[38px] flex items-center gap-1"><Save className="h-4 w-4"/> Save</button>
            <button onClick={() => setIsEditingType(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm h-[38px]"><X className="h-4 w-4"/></button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {categories.map(c => (
            <div key={c.id} className="border border-gray-200 p-4 rounded-lg bg-white shadow-sm flex flex-col md:flex-row justify-between gap-4">
               <div>
                 <h4 className="font-black text-gray-900">{c.name}</h4>
                 <p className="text-sm text-gray-500">{c.description}</p>
                 <div className="text-xs font-mono text-gray-400 mt-2">Base Amt: ${c.amount || 'Flexible'}</div>
               </div>
               <div className="flex items-start gap-2">
                 <button onClick={() => setActiveTargetTypeId(activeTargetTypeId === c.id ? null : c.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded border border-indigo-100 flex items-center gap-1">
                   <Target className="h-3.5 w-3.5"/> Targets
                 </button>
                 <button onClick={() => { setIsEditingType(c.id); setTypeForm({name: c.name, description: c.description, amount: c.amount || 0}); }} className="p-1.5 text-gray-500 hover:text-blue-600 border border-gray-200 rounded">
                   <Edit className="h-4 w-4"/>
                 </button>
                 <button onClick={() => deleteType(c.id)} className="p-1.5 text-red-500 hover:text-red-700 border border-red-100 bg-red-50 rounded">
                   <Trash2 className="h-4 w-4"/>
                 </button>
               </div>
               
               {activeTargetTypeId === c.id && (
                 <div className="w-full md:w-auto p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 mt-4 md:mt-0 flex-1 md:ml-4 flex flex-col">
                    <h5 className="text-xs font-bold uppercase tracking-widest text-indigo-800 mb-3">Set Target</h5>
                    <div className="flex gap-2 mb-3">
                      <select value={targetForm.entityType} onChange={e => setTargetForm({...targetForm, entityType: e.target.value, entityId: ''})} className="p-2 border border-gray-200 rounded text-sm bg-white">
                        <option value="Member">Member</option>
                        <option value="Tabhera">Tabhera</option>
                        <option value="Nyika">Nyika</option>
                        <option value="District">District</option>
                        <option value="Province">Province</option>
                        <option value="Nation">Nation</option>
                      </select>
                      <select value={targetForm.entityId} onChange={e => setTargetForm({...targetForm, entityId: e.target.value})} className="p-2 border border-gray-200 rounded text-sm bg-white flex-1 max-w-[200px]">
                        <option value="">Select Entity...</option>
                        {getEntityOptions().map((opt: any) => (
                           <option key={opt.memberId || opt.levelCode} value={opt.memberId || opt.levelCode}>
                             {opt.fullName || opt.branchName}
                           </option>
                        ))}
                      </select>
                      <input type="number" placeholder="Amt" value={targetForm.amount || ''} onChange={e => setTargetForm({...targetForm, amount: parseFloat(e.target.value)})} className="w-20 p-2 border border-gray-200 rounded text-sm bg-white"/>
                      <button onClick={handleSaveTarget} className="bg-indigo-600 text-white px-3 py-1 text-sm font-bold rounded">Set</button>
                    </div>
                    
                    <div className="mt-2">
                       <h6 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Current Targets ({allTargets.filter(t => t.typeId === `spe-${c.id}`).length})</h6>
                       <div className="max-h-32 overflow-y-auto space-y-1">
                         {allTargets.filter(t => t.typeId === `spe-${c.id}`).map(t => (
                           <div key={t.id} className="flex justify-between items-center bg-white p-2 border border-gray-100 rounded text-xs">
                             <span className="font-bold text-gray-700">{t.entityType}: {t.entityName}</span>
                             <span className="font-mono text-indigo-700 font-bold">${t.targetAmount}</span>
                           </div>
                         ))}
                       </div>
                    </div>
                 </div>
               )}
            </div>
          ))}
          {categories.length === 0 && <div className="p-8 text-center text-gray-400 font-medium">No special murairo types configured.</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <Coins className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-gray-900">Supported Currencies</h3>
          </div>
          <div className="p-4 flex-grow flex flex-col justify-between">
            <div className="flex flex-wrap gap-2 mb-6">
              {supportedCurrencies.map((c, i) => (
                <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-black uppercase tracking-wider font-mono shadow-sm">
                  {c}
                </span>
              ))}
            </div>
            
            <form onSubmit={handleAddCurrency} className="flex items-center gap-2 border-t border-gray-100 pt-4">
              <input 
                type="text" 
                placeholder="Ex. MWK" 
                maxLength={4}
                value={newCurrency}
                onChange={e => setNewCurrency(e.target.value.toUpperCase())}
                className="flex-grow p-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-[#166534]" 
              />
              <button 
                type="submit" 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-sm flex flex-row items-center gap-1 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-gray-900">Valid Transaction Methods</h3>
          </div>
          <div className="p-4 flex-grow flex flex-col justify-between">
            <div className="flex flex-col gap-2 mb-6 max-h-[150px] overflow-y-auto">
              {supportedPaymentMethods.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg font-medium">
                  <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                  {m}
                </div>
              ))}
            </div>
            
            <form onSubmit={handleAddPaymentMethod} className="flex items-center gap-2 border-t border-gray-100 pt-4">
              <input 
                type="text" 
                placeholder="Ex. EcoCash..." 
                value={newPaymentMethod}
                onChange={e => setNewPaymentMethod(e.target.value)}
                className="flex-grow p-2 border border-gray-200 rounded-lg text-sm focus:outline-[#166534]" 
              />
              <button 
                type="submit" 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-sm flex flex-row items-center gap-1 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
