import React, { useState } from 'react';
import { Member, UnganoCategory, UserProfile, UnganoPayment } from '../types';
import { addToSyncQueue, getPaymentMethods } from '../lib/storage';
import { toast } from 'react-hot-toast';
import { Save } from 'lucide-react';

interface Props {
  members: Member[];
  categories: UnganoCategory[];
  currentUser: UserProfile;
  onPaymentRecorded: () => void;
}

export function MurairoPaymentRecorder({ members, categories, currentUser, onPaymentRecorded }: Props) {
  const [form, setForm] = useState({ memberId: '', categoryId: '', amount: 0, paymentMethod: 'Cash', date: new Date().toISOString().split('T')[0] });
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash']);
  const [memberSearch, setMemberSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  React.useEffect(() => {
    getPaymentMethods().then(setPaymentMethods);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId || !form.categoryId || form.amount <= 0) return toast.error('Check fields');

    const payment: UnganoPayment = {
      id: `pay-${Date.now()}`,
      memberId: form.memberId,
      categoryId: form.categoryId,
      amountPaid: form.amount,
      currency: 'USD',
      paymentMethod: form.paymentMethod,
      status: 'PAID', // Simplified
      paymentDate: form.date,
      recordedByUserId: currentUser.id,
      hierarchyPath: currentUser.levelCode,
      referenceCode: `JDN-${Date.now()}`,
      syncStatus: 'LOCAL',
      createdAt: new Date().toISOString()
    };
    await addToSyncQueue('ungano_payment', payment.id, 'create', payment);
    toast.success('Payment recorded');
    onPaymentRecorded();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <h3 className="font-bold text-lg text-gray-900 border-b border-gray-100 pb-2">Record Special Payment</h3>
      
      <div>
        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Search Congregation Member</label>
        <input
          type="text"
          placeholder="Type member name..."
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="w-full mb-1.5 p-2 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#166534]"
        />
        <select required value={form.memberId} onChange={e => setForm({...form, memberId: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 focus:bg-white focus:outline-none">
          <option value="">Select Member</option>
          {members
            .filter(m => !memberSearch || m.fullName.toLowerCase().includes(memberSearch.toLowerCase()))
            .slice(0, 100)
            .map(m => <option key={m.memberId} value={m.memberId}>{m.fullName}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Search Category</label>
        <input
          type="text"
          placeholder="Type category..."
          value={categorySearch}
          onChange={(e) => setCategorySearch(e.target.value)}
          className="w-full mb-1.5 p-2 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#166534]"
        />
        <select required value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 focus:bg-white focus:outline-none">
          <option value="">Select Category</option>
          {categories
            .filter(c => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase()))
            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Amount Paid</label>
          <input type="number" required placeholder="Amount" value={form.amount || ''} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 focus:bg-white focus:outline-none"/>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Payment Method</label>
          <select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 focus:bg-white focus:outline-none">
            {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" className="w-full bg-[#166534] hover:bg-[#115e2e] text-white p-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer">
        <Save className="h-4 w-4"/> Record Payment
      </button>
    </form>
  );
}
