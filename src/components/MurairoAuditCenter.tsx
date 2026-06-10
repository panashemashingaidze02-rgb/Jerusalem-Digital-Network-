import React, { useState } from 'react';
import { Member, UnganoCategory, UnganoPayment } from '../types';
import { FileDown, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  const parts = text.split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === search.toLowerCase() 
          ? <span key={i} className="bg-yellow-100 font-extrabold text-[#1a1a1a] px-0.5 rounded border border-yellow-300 shadow-sm">{part}</span> 
          : part
      )}
    </>
  );
}

interface Props {
  payments: UnganoPayment[];
  members: Member[];
  categories: UnganoCategory[];
}

export function MurairoAuditCenter({ payments, members, categories }: Props) {
  const [filter, setFilter] = useState('');

  const filteredPayments = payments.filter(p => {
    if (!filter) return true;
    const mName = members.find(m => m.memberId === p.memberId)?.fullName || '';
    const cName = categories.find(c => c.id === p.categoryId)?.name || '';
    return mName.toLowerCase().includes(filter.toLowerCase()) || 
           cName.toLowerCase().includes(filter.toLowerCase());
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Under-Target Report', 10, 10);
    
    const tableData = filteredPayments.map(p => {
      const mName = members.find(m => m.memberId === p.memberId)?.fullName || 'Unknown';
      const cName = categories.find(c => c.id === p.categoryId)?.name || 'N/A';
      return [mName, cName, `$${p.amountPaid}`];
    });

    // @ts-ignore
    doc.autoTable({
      head: [['Name', 'Category', 'Paid']],
      body: tableData
    });
    doc.save('report_filtered.pdf');
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-base text-gray-900">Murairo / JDN Audit Center</h3>
          <p className="text-xs text-gray-500">Real-time contribution audit verification</p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-1.5 bg-[#D97706] hover:bg-[#D97706]/90 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer">
          <FileDown className="h-4 w-4"/> Export Audited PDF
        </button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search audits by member name or category / murairo type..." 
            value={filter} 
            onChange={e => setFilter(e.target.value)} 
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Dynamic target description */}
        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-sans mt-0.5 flex-wrap pt-1.5">
          <span className="font-bold uppercase tracking-wider text-gray-400">Searching fields:</span>
          <span className={`px-1.5 py-0.2 rounded font-semibold transition-all ${filter && filteredPayments.some(p => (members.find(m => m.memberId === p.memberId)?.fullName || '').toLowerCase().includes(filter.toLowerCase())) ? 'bg-amber-100 text-[#D97706] font-bold ring-1 ring-amber-200' : 'bg-gray-100'}`}>Member Full Name</span>
          <span className={`px-1.5 py-0.2 rounded font-semibold transition-all ${filter && filteredPayments.some(p => (categories.find(c => c.id === p.categoryId)?.name || '').toLowerCase().includes(filter.toLowerCase())) ? 'bg-amber-100 text-[#D97706] font-bold ring-1 ring-amber-200' : 'bg-gray-100'}`}>Murairo Category Type</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider font-bold">
              <th className="p-3">Audit Name</th>
              <th className="p-3">Murairo Category / Type</th>
              <th className="p-3 text-right">Paid Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPayments.map(p => {
              const mName = members.find(m => m.memberId === p.memberId)?.fullName || 'Unknown';
              const cName = categories.find(c => c.id === p.categoryId)?.name || 'Unknown Category';
              return (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-3 font-semibold text-gray-900">
                    <div>
                      <HighlightText text={mName} search={filter} />
                    </div>
                    {filter && mName.toLowerCase().includes(filter.toLowerCase()) && (
                      <span className="inline-flex text-[8px] font-black uppercase bg-amber-50 text-[#D97706] border border-amber-200 px-1 mt-0.5 rounded">Matched Name</span>
                    )}
                  </td>
                  <td className="p-3 font-medium text-gray-700">
                    <div>
                      <HighlightText text={cName} search={filter} />
                    </div>
                    {filter && cName.toLowerCase().includes(filter.toLowerCase()) && (
                      <span className="inline-flex text-[8px] font-black uppercase bg-amber-50 text-[#D97706] border border-amber-200 px-1 mt-0.5 rounded">Matched Category</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-[#166534]">${p.amountPaid.toFixed(2)}</td>
                </tr>
              );
            })}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gray-500 italic">No audited records match your search criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
