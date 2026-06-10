import React, { useState, useEffect } from 'react';
import { UserProfile, JdnLevel, JdnUpdate } from '../types';
import { getJdnUpdates, addJdnUpdate, updateJdnUpdate, deleteJdnUpdate, addPlatformLog, getCustomBulletinTypes, saveCustomBulletinTypes, addNotification } from '../lib/storage';
import { Radio, Plus, MessageSquare, Play, Pause, Bookmark, Bell, Calendar, User, Eye, Sparkles, Edit, Trash2, Clock, Upload, X } from 'lucide-react';

interface UpdatesProps {
  currentUser: UserProfile;
}

export function Updates({ currentUser }: UpdatesProps) {
  const [updates, setUpdates] = useState<JdnUpdate[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPostOpen, setIsPostOpen] = useState(false);
  
  // Custom bulletin types
  const [availableTypes, setAvailableTypes] = useState<string[]>(['blog', 'notification', 'sermon_audio']);
  const [newTypeName, setNewTypeName] = useState('');

  // Post form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<string>('blog');
  const [audioUrl, setAudioUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Edit & Schedule helpers
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [scheduledPubDate, setScheduledPubDate] = useState<string>('');
  const [updatesSubTab, setUpdatesSubTab] = useState<'all' | 'scheduled'>('all');

  // Audio player mock states
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadUpdates();
    loadTypes();
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, []);

  const loadTypes = async () => {
    const types = await getCustomBulletinTypes();
    setAvailableTypes(types);
  };

  const handleAddType = async () => {
    if (!newTypeName.trim()) return;
    const cleaned = newTypeName.trim();
    if (!availableTypes.includes(cleaned)) {
      const updatedTypes = [...availableTypes, cleaned];
      await saveCustomBulletinTypes(updatedTypes);
      setAvailableTypes(updatedTypes);
      setType(cleaned);
      setNewTypeName('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileType === 'image' && !file.type.startsWith('image/')) {
        setErrorCode('Please upload a valid image file');
        return;
    }

    if (fileType === 'audio' && !file.type.startsWith('audio/')) {
        setErrorCode('Please upload a valid audio file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        if (fileType === 'image') {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; // Drastically downscale resolution for 500% size reduction
                let scaleSize = 1;
                
                if (img.width > MAX_WIDTH) {
                  scaleSize = MAX_WIDTH / img.width;
                }
                
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.4); // 0.4 Quality factor reduces file footprint by over 500%
                    setImageUrl(compressed);
                } else {
                    setImageUrl(event.target?.result as string);
                }
            };
            img.src = event.target?.result as string;
        } else {
            setAudioUrl(event.target?.result as string);
        }
    };
    reader.readAsDataURL(file);
  };


  const loadUpdates = async () => {
    const data = await getJdnUpdates();
    setUpdates(data);
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCode(null);

    if (title.trim().length < 5) {
      setErrorCode('Post title must be at least 5 characters long.');
      return;
    }

    if (content.trim().length < 10) {
      setErrorCode('Content body must be at least 10 characters long.');
      return;
    }

    if (type === 'sermon_audio' && !audioUrl) {
      setErrorCode('Please upload an audio file or enter an audio source link.');
      return;
    }

    try {
      if (editPostId) {
        // Find existing post
        const existing = updates.find(u => u.id === editPostId);
        if (existing) {
          const updatedRecord: JdnUpdate = {
            ...existing,
            title: title.trim(),
            content: content.trim(),
            type,
            audioUrl: audioUrl.trim(),
            imageUrl: imageUrl.trim(),
            scheduledPublishDate: scheduledPubDate ? scheduledPubDate : undefined
          };
          await updateJdnUpdate(updatedRecord);
          await addPlatformLog({
            actorId: currentUser.id,
            actorName: currentUser.fullName,
            actorLevel: currentUser.level,
            action: 'UPDATE_EDIT',
            details: `Edited bulletin post: "${title.trim()}"`,
            category: 'system'
          });
        }
      } else {
        const payload: Omit<JdnUpdate, 'id' | 'createdAt'> = {
          title: title.trim(),
          content: content.trim(),
          type,
          authorId: currentUser.id,
          authorName: currentUser.fullName,
          authorLevel: currentUser.level,
          audioUrl: audioUrl.trim(),
          imageUrl: imageUrl.trim(),
          scheduledPublishDate: scheduledPubDate ? scheduledPubDate : undefined
        };

        await addJdnUpdate(payload);
        await addNotification(title.trim(), content.trim(), 'info', true);
        await addPlatformLog({
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorLevel: currentUser.level,
          action: 'UPDATE_PUBLISH',
          details: `Published official ${type}: "${title.trim()}"`,
          category: 'system'
        });
      }

      await loadUpdates();

      // Reset
      setTitle('');
      setContent('');
      setType('blog');
      setAudioUrl('');
      setImageUrl('');
      setScheduledPubDate('');
      setEditPostId(null);
      setIsPostOpen(false);
    } catch (err: any) {
      setErrorCode('Failed to publish updates to local storage.');
    }
  };

  const handleDeletePost = async (id: string, postTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete the bulletin: "${postTitle}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteJdnUpdate(id);
      await loadUpdates();

      await addPlatformLog({
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorLevel: currentUser.level,
        action: 'UPDATE_DELETE',
        details: `Deleted bulletin post "${postTitle}"`,
        category: 'system'
      });
    } catch (err) {
      alert('Failed to delete update.');
    }
  };

  const handleEditInitiate = (post: JdnUpdate) => {
    setEditPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setType(post.type);
    setAudioUrl(post.audioUrl || '');
    setScheduledPubDate(post.scheduledPublishDate || '');
    setIsPostOpen(true);
    // Scroll to form
    setTimeout(() => {
      const formElement = document.getElementById('new-post-modal');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleTogglePlay = (update: JdnUpdate) => {
    if (!update.audioUrl) return;

    if (playingId === update.id) {
      if (audioElement) {
        audioElement.pause();
        setPlayingId(null);
      }
    } else {
      if (audioElement) {
        audioElement.pause();
      }
      const el = new Audio(update.audioUrl);
      el.play().catch(err => {
        alert('Simulator note: Loading public spiritual audio stream might fail if client network restricts audio objects. Continuing playback fallback state simulation.');
      });
      el.addEventListener('ended', () => {
        setPlayingId(null);
      });
      setAudioElement(el);
      setPlayingId(update.id);
    }
  };

  const isPublisher = currentUser.level === JdnLevel.JERUSALEM || 
                      currentUser.level === JdnLevel.NATIONAL;

  const now = new Date();
  const liveUpdates = updates.filter(post => 
    (!post.scheduledPublishDate || new Date(post.scheduledPublishDate) <= now) &&                
    post.authorLevel !== JdnLevel.SYSTEM
  );
  const scheduledUpdates = updates.filter(post => 
    post.scheduledPublishDate && new Date(post.scheduledPublishDate) > now &&
    post.authorLevel !== JdnLevel.SYSTEM
  );
  const displayedUpdates = (isPublisher && updatesSubTab === 'scheduled') 
    ? scheduledUpdates 
    : liveUpdates;

  const sortedUpdates = [...displayedUpdates].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const UPDATES_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(sortedUpdates.length / UPDATES_PER_PAGE));
  const paginatedUpdates = sortedUpdates.slice((currentPage - 1) * UPDATES_PER_PAGE, currentPage * UPDATES_PER_PAGE);

  const getBadgeStyle = (postType: JdnUpdate['type']) => {
    switch (postType) {
      case 'notification': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'sermon_audio': return 'bg-green-100 text-green-800 border-green-200';
      case 'blog': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Congregation Updates Board</h1>
          <p className="text-sm text-[#6B7280]">
            Feed of latest theological insights, leadership blogs, important national notifications, and spiritual audio sermons.
          </p>
        </div>

        {isPublisher && (
          <button
            onClick={() => setIsPostOpen(true)}
            className="bg-[#166534] hover:bg-[#166534]/95 text-white font-semibold text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" /> Publish New Update
          </button>
        )}
      </div>

      {/* Sub-Tabs for Administrators */}
      {isPublisher && (
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setUpdatesSubTab('all'); setCurrentPage(1); }}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
              updatesSubTab === 'all'
                ? 'border-[#166534] text-[#166534]'
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            📢 Live Published Feed ({liveUpdates.length})
          </button>
          <button
            onClick={() => { setUpdatesSubTab('scheduled'); setCurrentPage(1); }}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1 ${
              updatesSubTab === 'scheduled'
                ? 'border-[#166534] text-[#166534]'
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Scheduled Publications ({scheduledUpdates.length})
          </button>
        </div>
      )}

      {isPostOpen && (
        <div className="bg-white p-5 rounded-xl border border-emerald-200/50 shadow-md space-y-4 animate-fade-in" id="new-post-modal">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-bold text-sm text-[#111827] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#166534]" /> 
              {editPostId ? '🔧 Edit Official Church Bulletin Post' : '✍️ Draft Official Church Bulletin Post'}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">As a regional headquarters administrator, your write-up will immediately sync to all Nyikas and Tabheras.</p>
          </div>

          <form onSubmit={handlePostSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider">Bulletin Type</label>
                <div className="flex gap-2">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="block w-full py-1.5 px-2.5 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#166534] focus:outline-none"
                  >
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                {isPublisher && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="New type e.g. event"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      className="flex-1 py-1 px-2 border border-gray-200 bg-white rounded text-xs focus:ring-1 focus:ring-[#166534]"
                    />
                    <button type="button" onClick={handleAddType} className="bg-gray-100 text-[#166534] px-2 py-1 rounded text-xs font-bold border border-gray-200">Add</button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider">Post Title</label>
                <input
                  type="text"
                  placeholder="e.g. Guidance on Sacrificial Giving"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full py-1.5 px-2.5 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#166534] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                   <Upload className="h-3 w-3" /> Upload Image cover (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'image')}
                  className="block w-full py-1 px-2 border border-gray-200 bg-gray-50 rounded-lg text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-[#166534] file:text-white"
                />
                {imageUrl && (
                  <div className="relative inline-block mt-2">
                     <img src={imageUrl} alt="preview" className="h-16 rounded border" />
                     <button type="button" onClick={() => setImageUrl('')} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                  </div>
                )}
              </div>

              <div className="space-y-1 animate-fade-in">
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                  <Upload className="h-3 w-3" /> Upload Audio / Web Stream URL (Optional)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleFileChange(e, 'audio')}
                  className="block w-full py-1 px-2 border border-gray-200 bg-gray-50 rounded-lg text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-[#1D4ED8] file:text-white mb-2"
                />
                <input
                  type="text"
                  placeholder="Or paste audio URL stream link..."
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="block w-full py-1.5 px-2.5 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#166534] focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider">Message Content / Bodyset</label>
              <textarea
                rows={4}
                placeholder="Write your spiritual sermon outline, bulleted reminders, or blog article content details here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#166534] focus:outline-none leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3 text-emerald-700" /> Optional Scheduled Publication Date / Time
              </label>
              <input
                type="datetime-local"
                value={scheduledPubDate}
                onChange={(e) => setScheduledPubDate(e.target.value)}
                className="block w-full py-1.5 px-2.5 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-[#166534] focus:outline-none font-mono"
              />
              <p className="text-[9px] text-gray-400">Leave blank to make it viewable immediately. Fill it to plan a scheduled release!</p>
            </div>

            {errorCode && (
              <p className="text-xs font-semibold text-[#DC2626] bg-red-50 p-2.5 rounded-lg border border-red-200">{errorCode}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTitle('');
                  setContent('');
                  setType('blog');
                  setAudioUrl('');
                  setScheduledPubDate('');
                  setEditPostId(null);
                  setIsPostOpen(false);
                }}
                className="px-3.5 py-2 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#166534] hover:bg-[#166534]/90 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer shadow-sm"
              >
                {editPostId ? 'Save Edits' : 'Publish Broadcast'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Board Post Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {paginatedUpdates.length > 0 ? (
          paginatedUpdates.map((post) => {
            const isPlaying = playingId === post.id;
            return (
              <div key={post.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  {/* Header badges */}
                  <div className="flex justify-between items-center mb-3 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(post.type)}`}>
                      {post.type === 'blog' ? '✍️ Pastoral Blog' : post.type === 'notification' ? '📢 Important Bulletin' : '🎙️ Sermon Audio'}
                    </span>
                    <span className="text-[10px] text-[#6B7280] font-medium font-sans flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {post.scheduledPublishDate && (
                    <div className="mb-3 text-[9px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded flex items-center gap-1 w-max font-semibold font-sans">
                      <Clock className="h-3 w-3 text-amber-600 animate-spin-slow" /> Scheduled for: {new Date(post.scheduledPublishDate).toLocaleString()}
                    </div>
                  )}

                  {post.imageUrl && (
                    <div className="mb-3">
                       <img src={post.imageUrl} alt={post.title} className="w-full h-40 object-cover rounded-lg border border-gray-200" />
                    </div>
                  )}

                  <h3 className="text-md font-bold text-gray-900 leading-snug tracking-tight mb-2">
                    {post.title}
                  </h3>

                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap mb-4">
                    {post.content}
                  </p>

                  {/* Built-in high fidelity sound block */}
                  {post.audioUrl && (
                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/50 flex items-center justify-between mb-4 animate-pulse-slow">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-[#166534] text-white rounded-full flex items-center justify-center shadow-sm">
                          <Radio className="h-4 w-4 animate-bounce" />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-[#166534]">AUDIO TRACK</span>
                          <span className="block text-[8px] text-[#6B7280] truncate max-w-[150px] font-mono">{post.audioUrl.substring(0, 30)}...</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTogglePlay(post)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer select-none transition-all ${
                          isPlaying 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                            : 'bg-[#166534] text-white hover:bg-[#166534]/90'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="h-3 w-3" /> Mute Stream
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 fill-white" /> Listen Now
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-3.5 flex justify-between items-center text-[10px] text-gray-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 bg-gray-100 text-[#166534] rounded-full flex items-center justify-center font-bold text-[9px] uppercase">
                      {post.authorName.charAt(0)}
                    </div>
                    <div>
                      <span className="text-gray-900 font-bold block">{post.authorName}</span>
                      <span className="text-[9px] text-[#6B7280] leading-none block">{post.authorLevel} Channel</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                        onClick={async () => {
                          const text = `${post.title}\n\n${post.content}\n\nShared via Jerusalem Digital Network (JDN)`;
                          
                          let filesToShare: File[] = [];
                          
                          try {
                            if (post.imageUrl && post.imageUrl.startsWith('data:')) {
                               const res = await fetch(post.imageUrl);
                               const blob = await res.blob();
                               const file = new File([blob], 'update-image.jpg', { type: blob.type });
                               filesToShare.push(file);
                            } else if (post.audioUrl && post.audioUrl.startsWith('data:')) {
                               const res = await fetch(post.audioUrl);
                               const blob = await res.blob();
                               const file = new File([blob], 'update-audio.mp3', { type: blob.type });
                               filesToShare.push(file);
                            }
                          } catch (e) {
                              console.error('Error preparing media file for sharing', e);
                          }
                          
                          if (navigator.share) {
                            const shareData: ShareData = {
                              title: post.title,
                              text: text,
                            };
                            if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
                               shareData.files = filesToShare;
                            }
                            try {
                              await navigator.share(shareData);
                            } catch (error) {
                              console.error('Error sharing', error);
                            }
                          } else {
                            // Fallback to clipboard
                            navigator.clipboard.writeText(text);
                            alert("Copied to clipboard!");
                          }
                        }}
                        className="p-1 px-1.5 text-gray-400 hover:text-[#166534] bg-gray-50 hover:bg-green-50 border border-gray-100 rounded transition-all cursor-pointer"
                        title="Share via Social Media"
                    >
                        <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                    <button
                        onClick={async () => {
                          const saved = JSON.parse(localStorage.getItem('jdn_saved_updates') || '[]');
                          if (!saved.some((s: any) => s.id === post.id)) {
                             saved.push(post);
                             localStorage.setItem('jdn_saved_updates', JSON.stringify(saved));
                             alert('Update saved to local storage for offline reading.');
                          } else {
                             alert('Update is already saved.');
                          }
                        }}
                        className="p-1 px-1.5 text-gray-400 hover:text-[#1D4ED8] bg-gray-50 hover:bg-blue-50 border border-gray-100 rounded transition-all cursor-pointer"
                        title="Save to local storage"
                    >
                        <Bookmark className="h-3 w-3" />
                    </button>
                    {isPublisher && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditInitiate(post)}
                          className="p-1 px-1.5 text-gray-400 hover:text-[#1D4ED8] bg-gray-50 hover:bg-[#1D4ED8]/5 border border-gray-100 rounded transition-all cursor-pointer"
                          title="Edit bulletin"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id, post.title)}
                          className="p-1 px-1.5 text-gray-400 hover:text-[#DC2626] bg-gray-50 hover:bg-[#DC2626]/5 border border-gray-100 rounded transition-all cursor-pointer"
                          title="Delete bulletin"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                      ID: {post.id}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 bg-white text-center p-12 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <Bookmark className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-500">
              {updatesSubTab === 'scheduled' ? 'No scheduled publications configured' : 'The updates board is currently empty'}
            </p>
            <p className="text-xs text-gray-400">
              {updatesSubTab === 'scheduled' 
                ? 'Administrators can schedule important theological blog articles or sermons dynamic releases.' 
                : 'Headquarters leaders will publish holy sermons and events listings shortly.'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-4">
          <span className="text-xs text-gray-500 font-semibold">
            Showing <span className="font-bold">{(currentPage - 1) * UPDATES_PER_PAGE + 1}</span> to <span className="font-bold">{Math.min(currentPage * UPDATES_PER_PAGE, sortedUpdates.length)}</span> of <span className="font-bold">{sortedUpdates.length}</span> updates
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-xs font-bold text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-[#374151] px-3 py-1 bg-gray-50 rounded-md border border-gray-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-xs font-bold text-[#374151] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
