import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function MurairoDashboard({ categories, payments, members }: any) {
  const summary = categories.map((cat: any) => {
    const relevantPayments = payments.filter((p: any) => p.categoryId === cat.id);
    const totalPaid = relevantPayments.reduce((sum: number, p: any) => sum + p.amountPaid, 0);
    const target = cat.amount || 0; // Simplified
    const completionRate = target > 0 ? (totalPaid / target) * 100 : 0;
    
    return {
      name: cat.name,
      totalPaid,
      target,
      completionRate: Math.min(completionRate, 100)
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summary.map((s: any, i: number) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h4 className="font-bold text-gray-700">{s.name}</h4>
            <div className="mt-4 text-3xl font-black text-[#166534]">${s.totalPaid}</div>
            <p className="text-sm text-gray-500">Collected of ${s.target} target</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
              <div className="bg-[#D97706] h-2.5 rounded-full" style={{width: `${s.completionRate}%`}}></div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-80">
        <h4 className="font-bold text-gray-900 mb-4">Collection Progress</h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={summary}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="totalPaid" fill="#166534" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
