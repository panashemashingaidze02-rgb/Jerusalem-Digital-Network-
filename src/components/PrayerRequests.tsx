import React, { useEffect, useState } from 'react';
import { UserProfile, PrayerRequest, JdnLevel } from '../types';
import { getPrayerRequests, savePrayerRequests } from '../lib/storage';
import { HeartPulse, Plus, Send, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  currentUser: UserProfile;
}

export function PrayerRequests({ currentUser }: Props) {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [title, setTitle] = useState('');
  const [requestContent, setRequestContent] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  
  // Jerusalem and System can view all, others can only view their own
  const isJerusalemOrSystem = currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM;

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    const all = await getPrayerRequests();
    
    const visible = all.filter(r => {
      if (isJerusalemOrSystem) return true;
      return r.authorId === currentUser.id;
    });
    
    setRequests(visible.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !requestContent.trim()) return;
    
    const newReq: PrayerRequest = {
      id: `prayer-${Date.now()}`,
      title: title.trim(),
      request: requestContent.trim(),
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorLevelCode: currentUser.levelCode,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    const all = await getPrayerRequests();
    await savePrayerRequests([...all, newReq]);
    
    toast.success('Prayer request sent to Jerusalem');
    setTitle('');
    setRequestContent('');
    setIsAdding(false);
    loadData();
  };

  const handleMarkStatus = async (id: string, newStatus: PrayerRequest['status']) => {
    const all = await getPrayerRequests();
    const updated = all.map(r => r.id === id ? { ...r, status: newStatus } : r);
    await savePrayerRequests(updated);
    toast.success('Status updated');
    loadData();
  };

  const filtered = requests.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.request.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const paginated = filtered.slice(page * 7, (page + 1) * 7);

  return (
    <div className="space-y-6 flex-1 w-full animate-fade-in p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
            <HeartPulse className="h-6 w-6 text-rose-600" /> Prayer Requests
          </h2>
          <p className="text-xs text-gray-500 mt-2 font-medium">
            {isJerusalemOrSystem 
              ? 'Review and manage prayer requests submitted by all branches directly to Jerusalem HQ.' 
              : 'Submit a confidential prayer request that goes directly to the Jerusalem Headquarters.'}
          </p>
        </div>
        {!isJerusalemOrSystem && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
          >
            {isAdding ? 'Cancel' : <><Plus className="h-4 w-4" /> New Prayer Request</>}
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4 animate-slide-down">
          <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wider mb-2">Compose Prayer Request to HQ</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Subject / Focus</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-rose-600"
              placeholder="e.g. Health, Family, Branch Guidance..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Request</label>
            <textarea 
              required
              value={requestContent}
              onChange={e => setRequestContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-rose-600 resize-none"
              placeholder="Detail your prayer needs..."
            />
          </div>
          <button type="submit" className="bg-rose-600 text-white px-4 py-2 rounded font-bold text-sm flex items-center gap-2">
            <Send className="h-4 w-4" /> Send Request
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search requests..." 
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-rose-600 focus:outline-none bg-white"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {paginated.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No prayer requests found.</div>
          ) : (
            paginated.map(r => (
              <div key={r.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm text-gray-900">{r.title}</h4>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 block">From: <span className="font-bold text-gray-700">{r.authorName} ({r.authorLevelCode})</span> • {new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      r.status === 'prayed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      'bg-green-100 text-green-700 border border-green-200'
                    }`}>
                      {r.status}
                    </span>
                    {isJerusalemOrSystem && (
                      <div className="flex gap-1 ml-2">
                        {r.status !== 'prayed' && (
                          <button onClick={() => handleMarkStatus(r.id, 'prayed')} className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded font-bold transition">Mark Prayed</button>
                        )}
                        {r.status !== 'answered' && (
                          <button onClick={() => handleMarkStatus(r.id, 'answered')} className="text-[10px] bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded font-bold transition">Mark Answered</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap mt-3 bg-white p-3 rounded border border-gray-100">{r.request}</div>
              </div>
            ))
          )}
        </div>
        
        {filtered.length > 0 && (
          <div className="p-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 text-xs text-gray-600">
            <div>Showing {page * 7 + 1} to {Math.min((page + 1) * 7, filtered.length)} of {filtered.length}</div>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50">Previous</button>
              <button disabled={(page + 1) * 7 >= filtered.length} onClick={() => setPage(p => p + 1)} className="px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
