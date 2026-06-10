import React, { useEffect, useState } from 'react';
import { UserProfile, DareMinute, JdnLevel } from '../types';
import { getDareMinutes, saveDareMinutes, getUserProfiles, isCodeInScope } from '../lib/storage';
import { Clock, Plus, Save, FileText, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  currentUser: UserProfile;
}

export function DareMinutes({ currentUser }: Props) {
  const [minutes, setMinutes] = useState<DareMinute[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  
  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    const min = await getDareMinutes();
    const profs = await getUserProfiles();
    setProfiles(profs);
    
    // Filter: Only parents or children linked can view
    // A profile is linked if they share a direct path. 
    // Jerusalem/System can view all.
    const isSysAdmin = currentUser.level === JdnLevel.SYSTEM || currentUser.level === JdnLevel.JERUSALEM;
    
    const visible = min.filter(m => {
      if (isSysAdmin) return true;
      if (m.authorId === currentUser.id) return true;
      // Check if current user is in scope of author, or author is in scope of current user
      const inScopeDown = isCodeInScope(m.authorLevelCode, currentUser.levelCode, profs);
      const inScopeUp = isCodeInScope(currentUser.levelCode, m.authorLevelCode, profs);
      return inScopeDown || inScopeUp;
    });
    
    setMinutes(visible.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    const newMin: DareMinute = {
      id: `dare-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      authorLevelCode: currentUser.levelCode,
      createdAt: new Date().toISOString()
    };
    
    const all = await getDareMinutes();
    await saveDareMinutes([...all, newMin]);
    
    toast.success('Dare Minutes recorded successfully');
    setTitle('');
    setContent('');
    setIsAdding(false);
    loadData();
  };

  const filtered = minutes.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const paginated = filtered.slice(page * 7, (page + 1) * 7);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
            <Clock className="h-6 w-6 text-[#166534]" /> Dare Minutes
          </h2>
          <p className="text-xs text-gray-500 mt-2 font-medium">Record and review official Dare Minutes for your branch and linked accounts.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#166534] hover:bg-[#166534]/90 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
        >
          {isAdding ? 'Cancel' : <><Plus className="h-4 w-4" /> Record Minutes</>}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4 animate-slide-down">
          <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wider mb-2">New Dare Minutes Entry</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Topic / Title</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
              placeholder="E.g. Monthly Branch Review"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Minutes / Notes</label>
            <textarea 
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] resize-none"
              placeholder="Enter comprehensive details of the dare..."
            />
          </div>
          <button type="submit" className="bg-[#166534] text-white px-4 py-2 rounded font-bold text-sm flex items-center gap-2">
            <Save className="h-4 w-4" /> Save Minutes
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search minutes..." 
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-[#166534] focus:outline-none bg-white"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {paginated.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No dare minutes found.</div>
          ) : (
            paginated.map(m => (
              <div key={m.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5"><FileText className="h-4 w-4 text-[#166534]"/> {m.title}</h4>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 block">Recorded by: <span className="font-bold text-[#166534]">{m.authorName}</span> • {new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-100">{m.authorLevelCode}</span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap mt-3 bg-white p-3 rounded border border-gray-100">{m.content}</div>
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
