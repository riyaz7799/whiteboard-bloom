import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface Board {
  boardId: string;
  updatedAt: string;
  name?: string;
  pinned?: boolean;
  archived?: boolean;
}

type SortMode   = 'newest' | 'oldest' | 'name';
type FilterMode = 'all' | 'pinned' | 'archived';

const getMeta = (): Record<string, { name?: string; pinned?: boolean; archived?: boolean }> => {
  try { return JSON.parse(localStorage.getItem('cwb_meta') || '{}'); } catch { return {}; }
};
const saveMeta = (boardId: string, data: object) => {
  const all = getMeta();
  all[boardId] = { ...all[boardId], ...data };
  localStorage.setItem('cwb_meta', JSON.stringify(all));
};

const formatDate = (dateStr: string) => {
  try {
    const date  = new Date(dateStr);
    const diff  = Date.now() - date.getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
};

export default function Dashboard() {
  const navigate         = useNavigate();
  const { user, logout } = useAuthStore();
  const menuRef          = useRef<HTMLDivElement>(null);

  const [boards, setBoards]         = useState<Board[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState<SortMode>('newest');
  const [filterBy, setFilterBy]     = useState<FilterMode>('all');
  const [toasts, setToasts]         = useState<{ id: string; msg: string; ok: boolean }[]>([]);

  const toast = (msg: string, ok = true) => {
    const id = Date.now().toString();
    setToasts(p => [...p, { id, msg, ok }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => { load(); }, []);

  const load = () => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/boards`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.boards) {
          const meta = getMeta();
          setBoards(data.boards.map((b: Board) => ({
            ...b,
            name:     meta[b.boardId]?.name     ?? `Board #${b.boardId.slice(0, 6).toUpperCase()}`,
            pinned:   meta[b.boardId]?.pinned   ?? false,
            archived: meta[b.boardId]?.archived ?? false,
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Close menu when clicking outside
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setActiveMenu(null);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const createBoard = async () => {
    setCreating(true);
    try {
      const r    = await fetch(`${BACKEND_URL}/api/boards`, { method: 'POST', credentials: 'include' });
      const data = await r.json();
      if (data.boardId) {
        // Mark this user as HOST of this board in localStorage
        // Board.tsx reads this to decide if you can draw or are a viewer
        const myId = user?.email || user?.id || '';
        localStorage.setItem(`cwb_host_${data.boardId}`, myId);
        navigate(`/board/${data.boardId}`);
      }
    } finally { setCreating(false); }
  };

  const deleteBoard = async (boardId: string) => {
    setDeletingId(boardId);
    try {
      await fetch(`${BACKEND_URL}/api/boards/${boardId}`, { method: 'DELETE', credentials: 'include' });
      setBoards(p => p.filter(b => b.boardId !== boardId));
      toast('Board deleted');
    } catch { toast('Delete failed', false); }
    finally { setDeletingId(null); setConfirmId(null); }
  };

  const renameBoard = (boardId: string) => {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    saveMeta(boardId, { name: renameVal.trim() });
    setBoards(p => p.map(b => b.boardId === boardId ? { ...b, name: renameVal.trim() } : b));
    setRenamingId(null);
    toast('Renamed!');
  };

  const togglePin = (boardId: string) => {
    setActiveMenu(null);
    const wasPinned = boards.find(b => b.boardId === boardId)?.pinned;
    setBoards(p => p.map(b => {
      if (b.boardId !== boardId) return b;
      saveMeta(boardId, { pinned: !b.pinned });
      return { ...b, pinned: !b.pinned };
    }));
    toast(wasPinned ? 'Unpinned' : '📌 Pinned to top');
  };

  const toggleArchive = (boardId: string) => {
    setActiveMenu(null);
    const wasArchived = boards.find(b => b.boardId === boardId)?.archived;
    setBoards(p => p.map(b => {
      if (b.boardId !== boardId) return b;
      saveMeta(boardId, { archived: !b.archived });
      return { ...b, archived: !b.archived };
    }));
    toast(wasArchived ? 'Unarchived' : '📦 Archived');
  };

  const handleLogout = async () => { await logout(); navigate('/auth'); };

  const filtered = boards
    .filter(b => {
      if (filterBy === 'pinned')   return b.pinned && !b.archived;
      if (filterBy === 'archived') return b.archived;
      return !b.archived;
    })
    .filter(b =>
      (b.name || '').toLowerCase().includes(search.toLowerCase()) ||
      b.boardId.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sortBy === 'newest') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sortBy === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return (a.name || '').localeCompare(b.name || '');
    });

  const stats = {
    total:    boards.filter(b => !b.archived).length,
    pinned:   boards.filter(b => b.pinned && !b.archived).length,
    archived: boards.filter(b => b.archived).length,
  };

  // ── 3-dot menu: ONLY Edit Name / Pin / Archive / Delete ──────────────────
  const BoardMenu = ({ board }: { board: Board }) => (
    <div className="absolute right-0 top-9 w-44 rounded-2xl border shadow-2xl py-1 z-50 overflow-hidden"
      style={{ background: '#18181b', borderColor: 'rgba(255,255,255,0.1)' }}>

      {/* Edit Name */}
      <button
        onClick={() => { setRenamingId(board.boardId); setRenameVal(board.name || ''); setActiveMenu(null); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
        style={{ color: 'rgba(255,255,255,0.8)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        ✏️ Edit Name
      </button>

      {/* Pin / Unpin */}
      <button
        onClick={() => togglePin(board.boardId)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
        style={{ color: 'rgba(255,255,255,0.8)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        📌 {board.pinned ? 'Unpin' : 'Pin to top'}
      </button>

      {/* Archive */}
      <button
        onClick={() => toggleArchive(board.boardId)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
        style={{ color: 'rgba(255,255,255,0.8)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        {board.archived ? '📤 Unarchive' : '📦 Archive'}
      </button>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 12px' }} />

      {/* Delete */}
      <button
        onClick={() => { setConfirmId(board.boardId); setActiveMenu(null); }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
        style={{ color: '#f87171' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        🗑️ Delete Board
      </button>
    </div>
  );

  // ── Board Card — clean, NO bottom action row ─────────────────────────────
  const BoardCard = ({ board }: { board: Board }) => (
    <div
      className="group relative rounded-2xl overflow-hidden border transition-all duration-200"
      style={{ background: '#111113', borderColor: 'rgba(255,255,255,0.07)' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>

      {/* Pinned badge */}
      {board.pinned && (
        <div className="absolute top-2 left-2 z-10 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
          📌 Pinned
        </div>
      )}

      {/* 3-dot button — top right, visible on hover */}
      <div className="absolute top-2 right-2 z-20" ref={activeMenu === board.boardId ? menuRef : undefined}>
        <button
          onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === board.boardId ? null : board.boardId); }}
          className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', fontSize: 20, lineHeight: '1' }}>
          ⋮
        </button>
        {activeMenu === board.boardId && <BoardMenu board={board} />}
      </div>

      {/* Preview area — click to open */}
      <div
        onClick={() => navigate(`/board/${board.boardId}`)}
        className="h-36 cursor-pointer flex items-center justify-center relative overflow-hidden border-b"
        style={{ background: '#0d0d10', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, #ffffff10 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="text-xs font-semibold px-4 py-2 rounded-full border"
            style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.35)', background: 'rgba(0,212,255,0.1)' }}>
            Open →
          </span>
        </div>
      </div>

      {/* Name + date — only content below preview */}
      <div className="px-4 py-3">
        {renamingId === board.boardId ? (
          <input
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={() => renameBoard(board.boardId)}
            onKeyDown={e => { if (e.key === 'Enter') renameBoard(board.boardId); if (e.key === 'Escape') setRenamingId(null); }}
            className="w-full text-sm outline-none rounded-lg px-2 py-1 border"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(0,212,255,0.4)', color: 'white' }}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <p
            className="text-sm font-semibold truncate cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.85)' }}
            onClick={() => navigate(`/board/${board.boardId}`)}>
            {board.name}
          </p>
        )}
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {formatDate(board.updatedAt)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: '#0a0a0c', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Toasts */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl border"
            style={t.ok
              ? { background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.2)', color: '#6ee7b7', backdropFilter: 'blur(12px)' }
              : { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5', backdropFilter: 'blur(12px)' }}>
            {t.ok ? '✓' : '✗'} {t.msg}
          </div>
        ))}
      </div>

      {/* Delete confirm modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-7 shadow-2xl border"
            style={{ background: '#18181b', borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-5"
              style={{ background: 'rgba(239,68,68,0.12)' }}>🗑️</div>
            <h3 className="text-xl font-bold mb-2">Delete this board?</h3>
            <p className="text-sm mb-7 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Board <span className="font-mono" style={{ color: '#00d4ff' }}>#{confirmId.slice(0, 8)}</span> and all its content will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                Cancel
              </button>
              <button onClick={() => deleteBoard(confirmId)} disabled={deletingId === confirmId}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: '#ef4444', color: 'white' }}
                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}>
                {deletingId === confirmId ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(10,10,12,0.94)', borderColor: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-bold" style={{ fontFamily: "'DM Mono',monospace", color: '#00d4ff' }}>
            Collab Whiteboard
          </span>
          <div className="flex items-center gap-3">
            {user?.image && (
              <img src={user.image} className="w-8 h-8 rounded-full border" style={{ borderColor: 'rgba(255,255,255,0.15)' }} alt="" />
            )}
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold" style={{ color: 'white' }}>{user?.name}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{user?.email}</p>
            </div>
            <button onClick={handleLogout}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Total boards', value: stats.total,    icon: '🎨', color: '#00d4ff' },
            { label: 'Pinned',       value: stats.pinned,   icon: '📌', color: '#fbbf24' },
            { label: 'Archived',     value: stats.archived, icon: '📦', color: '#9ca3af' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl px-4 py-3 border"
              style={{ background: '#111113', borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="text-2xl font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">

          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
              style={{ color: 'rgba(255,255,255,0.2)' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search boards…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border outline-none transition-all"
              style={{ background: '#111113', borderColor: 'rgba(255,255,255,0.08)', color: 'white' }}
              onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.35)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex p-1 gap-1 rounded-xl border" style={{ background: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}>
            {[
              { val: 'all',      label: 'All' },
              { val: 'pinned',   label: '📌 Pinned' },
              { val: 'archived', label: '📦 Archived' },
            ].map(f => (
              <button key={f.val} onClick={() => setFilterBy(f.val as FilterMode)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
                style={filterBy === f.val
                  ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }
                  : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortMode)}
            className="px-3 py-2.5 text-sm rounded-xl border outline-none cursor-pointer"
            style={{ background: '#111113', borderColor: 'rgba(255,255,255,0.08)', color: 'white' }}>
            <option value="newest">↓ Newest first</option>
            <option value="oldest">↑ Oldest first</option>
            <option value="name">A→Z Name</option>
          </select>

          {/* Share link — copies dashboard URL */}
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast('🔗 Link copied!'); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap border"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
            🔗 Share
          </button>

          {/* New Board */}
          <button
            onClick={createBoard}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 whitespace-nowrap"
            style={{ background: '#00d4ff', color: '#0a0a0c', boxShadow: '0 0 20px rgba(0,212,255,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(0,212,255,0.4)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,0.25)'}>
            + {creating ? 'Creating…' : 'New Board'}
          </button>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border"
                style={{ background: '#111113', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="h-36 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
                <div className="px-4 py-3 space-y-2">
                  <div className="h-3 rounded-full animate-pulse w-3/4" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="h-2 rounded-full animate-pulse w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 rounded-3xl border border-dashed"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <span className="text-6xl mb-5">
              {search ? '🔍' : filterBy === 'archived' ? '📦' : filterBy === 'pinned' ? '📌' : '🎨'}
            </span>
            <p className="text-xl font-bold mb-2">
              {search ? `No results for "${search}"` : filterBy !== 'all' ? `No ${filterBy} boards` : 'No boards yet'}
            </p>
            <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {!search && filterBy === 'all' ? 'Create your first whiteboard and start collaborating.' : 'Try a different filter.'}
            </p>
            {!search && filterBy === 'all' && (
              <button onClick={createBoard} disabled={creating}
                className="px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: '#00d4ff', color: '#0a0a0c' }}>
                {creating ? 'Creating…' : 'Create first board'}
              </button>
            )}
          </div>
        )}

        {/* Grid — only grid view, no list view */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* New board card */}
            <button
              onClick={createBoard}
              disabled={creating}
              className="rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 border border-dashed"
              style={{ minHeight: 190, background: 'transparent', borderColor: 'rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)'; e.currentTarget.style.background = 'rgba(0,212,255,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'transparent'; }}>
              <div className="w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
                +
              </div>
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {creating ? 'Creating…' : 'New Board'}
              </span>
            </button>

            {filtered.map(board => <BoardCard key={board.boardId} board={board} />)}
          </div>
        )}
      </main>
    </div>
  );
}