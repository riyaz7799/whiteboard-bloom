import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Line, Rect, Text, Circle, Arrow } from 'react-konva';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface DrawLine      { id: string; type: 'line';         points: number[]; color: string; strokeWidth: number; opacity: number; dash?: number[]; }
interface EraserMark   { id: string; type: 'eraser';        points: number[]; strokeWidth: number; }
interface HighlightLine{ id: string; type: 'highlight';     points: number[]; color: string; strokeWidth: number; }
interface RectShape    { id: string; type: 'rectangle';     x: number; y: number; width: number; height: number; fill: string; }
interface CircleShape  { id: string; type: 'circle';        x: number; y: number; radius: number; fill: string; }
interface TriangleShape{ id: string; type: 'triangle';      points: number[]; fill: string; }
interface DiamondShape { id: string; type: 'diamond';       x: number; y: number; size: number; fill: string; }
interface ArrowShape   { id: string; type: 'arrow';         points: number[]; color: string; strokeWidth: number; }
interface StraightLine { id: string; type: 'straightline';  points: number[]; color: string; strokeWidth: number; dash?: number[]; }
interface TextShape    { id: string; type: 'text';          x: number; y: number; text: string; color: string; fontSize: number; fontFamily: string; bold: boolean; italic: boolean; }
interface StickyNote   { id: string; type: 'sticky';        x: number; y: number; text: string; bg: string; }
interface ImageShape   { id: string; type: 'image';         x: number; y: number; width: number; height: number; src: string; }

type CanvasObject = DrawLine | EraserMark | HighlightLine | RectShape | CircleShape | TriangleShape | DiamondShape | ArrowShape | StraightLine | TextShape | StickyNote | ImageShape;
type ToolType = 'pen' | 'eraser' | 'highlight' | 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'arrow' | 'straightline' | 'text' | 'sticky' | 'image';

interface Page         { id: string; name: string; objects: CanvasObject[]; }
interface RemoteCursor { userId: string; name: string; x: number; y: number; color: string; isDrawing: boolean; }
interface RoomUser     { id: string; name: string; color: string; isDrawing?: boolean; }
interface ChatMessage  { userId: string; name: string; text: string; time: string; color: string; }
interface Toast        { id: string; message: string; type: 'success' | 'info' | 'error'; }

const PALETTE     = ['#00d4ff','#ff6b6b','#51cf66','#ffd43b','#cc5de8','#ff922b','#ffffff','#f06595','#74c0fc','#a9e34b'];
const STICKY_COLS = ['#ffd43b','#51cf66','#74c0fc','#ff6b6b','#cc5de8','#ff922b'];
const USER_COLORS = ['#00d4ff','#ff6b6b','#51cf66','#ffd43b','#cc5de8','#ff922b','#f06595','#74c0fc'];
const FONTS       = ['DM Sans', 'Georgia', 'Courier New', 'Impact', 'Trebuchet MS'];

const TOOL_GROUPS = [
  { label: 'Draw', items: [
    { id: 'pen',          icon: '✏️', label: 'Pen',         key: 'P', testid: 'tool-pen' },
    { id: 'highlight',    icon: '🖊',  label: 'Highlighter', key: 'H', testid: 'tool-highlight' },
    { id: 'eraser',       icon: '⌫',  label: 'Eraser',      key: 'E', testid: 'tool-eraser' },
  ]},
  { label: 'Shapes', items: [
    { id: 'rectangle',    icon: '▭',  label: 'Rectangle',   key: 'R', testid: 'tool-rectangle' },
    { id: 'circle',       icon: '○',  label: 'Circle',      key: 'C', testid: 'tool-circle' },
    { id: 'triangle',     icon: '△',  label: 'Triangle',    key: 'T', testid: 'tool-triangle' },
    { id: 'diamond',      icon: '◇',  label: 'Diamond',     key: 'D', testid: 'tool-diamond' },
    { id: 'arrow',        icon: '→',  label: 'Arrow',       key: 'A', testid: 'tool-arrow' },
    { id: 'straightline', icon: '─',  label: 'Line',        key: 'Q', testid: 'tool-line' },
  ]},
  { label: 'Insert', items: [
    { id: 'text',         icon: 'T',  label: 'Text',        key: 'X', testid: 'tool-text' },
    { id: 'sticky',       icon: '📌', label: 'Sticky Note', key: 'N', testid: 'tool-sticky' },
    { id: 'image',        icon: '🖼', label: 'Image',       key: 'I', testid: 'tool-image' },
  ]},
];

const Board = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate    = useNavigate();
  const { user }    = useAuthStore();

  const socketRef     = useRef<Socket | null>(null);
  const isDrawingRef  = useRef(false);
  const livePointsRef = useRef<number[]>([]);
  const containerRef  = useRef<HTMLDivElement>(null);
  const stageRef      = useRef<any>(null);
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const typingTimer   = useRef<any>(null);
  const myColor       = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);

  const [pages, setPages]                   = useState<Page[]>([{ id: 'page-1', name: 'Page 1', objects: [] }]);
  const [currentPageId, setCurrentPageId]   = useState('page-1');
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [pageNameVal, setPageNameVal]       = useState('');
  const [tool, setTool]                     = useState<ToolType>('pen');
  const [color, setColor]                   = useState('#00d4ff');
  const [strokeWidth, setStrokeWidth]       = useState(3);
  const [opacity, setOpacity]               = useState(100);
  const [lineStyle, setLineStyle]           = useState<'solid'|'dashed'|'dotted'>('solid');
  const [stickyColor, setStickyColor]       = useState(STICKY_COLS[0]);
  const [fontFamily, setFontFamily]         = useState(FONTS[0]);
  const [fontSize, setFontSize]             = useState(18);
  const [bold, setBold]                     = useState(false);
  const [italic, setItalic]                 = useState(false);
  const [shapeStart, setShapeStart]         = useState<{x:number;y:number}|null>(null);
  const [preview, setPreview]               = useState<CanvasObject|null>(null);
  const [dimensions, setDimensions]         = useState({ width:800, height:600 });
  const [livePoints, setLivePoints]         = useState<number[]>([]);
  const [isLiveDrawing, setIsLiveDrawing]   = useState(false);
  const [zoom, setZoom]                     = useState(100);
  const [showGrid, setShowGrid]             = useState(false);
  const [isReadOnly]                        = useState(false);
  const [boardName, setBoardName]           = useState('Untitled Board');
  const [editingName, setEditingName]       = useState(false);
  const [textPos, setTextPos]               = useState<{x:number;y:number}|null>(null);
  const [textInput, setTextInput]           = useState('');
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [editingStickyId, setEditingStickyId] = useState<string|null>(null);
  const [stickyEditText, setStickyEditText] = useState('');
  const [stickyEditPos, setStickyEditPos]   = useState<{x:number;y:number}|null>(null);
  const [undoStack, setUndoStack]           = useState<CanvasObject[][]>([]);
  const [redoStack, setRedoStack]           = useState<CanvasObject[][]>([]);
  const [remoteCursors, setRemoteCursors]   = useState<Record<string,RemoteCursor>>({});
  const [roomUsers, setRoomUsers]           = useState<RoomUser[]>([]);
  const [followUserId, setFollowUserId]     = useState<string|null>(null);
  const [chatMessages, setChatMessages]     = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]           = useState('');
  const [showChat, setShowChat]             = useState(true);
  const [typingUsers, setTypingUsers]       = useState<string[]>([]);
  const [toasts, setToasts]                 = useState<Toast[]>([]);

  // ── HOST / VIEWER SYSTEM ─────────────────────────────────────────────────────
  const [isHost, setIsHost]                   = useState(false);
  const [isAllowedToDraw, setIsAllowedToDraw] = useState(false);
  const [allowedUserIds, setAllowedUserIds]   = useState<Set<string>>(new Set());
  const [mySocketId, setMySocketId]           = useState('');
  const canDraw = isHost || isAllowedToDraw;

  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];
  const objects     = currentPage.objects;

  const setObjects = useCallback((upd: CanvasObject[] | ((p: CanvasObject[]) => CanvasObject[])) => {
    setPages(prev => prev.map(p =>
      p.id === currentPageId
        ? { ...p, objects: typeof upd === 'function' ? upd(p.objects) : upd }
        : p
    ));
  }, [currentPageId]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const getDash = useCallback(() => {
    if (lineStyle === 'dashed') return [12, 6];
    if (lineStyle === 'dotted') return [3, 6];
    return undefined;
  }, [lineStyle]);

  // ── window.getCanvasAsJSON — required by automated tests ─────────────────────
  useEffect(() => {
    (window as any).getCanvasAsJSON = () => JSON.parse(JSON.stringify(objects));
  }, [objects]);

  // ── Host detection via backend ownerId ───────────────────────────────────────
  useEffect(() => {
    if (!boardId || !user) return;
    fetch(`${BACKEND_URL}/api/boards/${boardId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const ownerId = data.ownerId || '';
        const myId    = user?.id || '';
        if (ownerId && myId && ownerId === myId) setIsHost(true);
      }).catch(() => {});
  }, [boardId, user]);

  // ── Resize ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (containerRef.current)
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Scroll zoom ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const stage = stageRef.current; if (!stage) return;
      const scaleBy  = 1.08;
      const oldScale = stage.scaleX();
      const pointer  = stage.getPointerPosition() || { x: el.clientWidth/2, y: el.clientHeight/2 };
      const pt = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
      const dir      = e.deltaY < 0 ? 1 : -1;
      const newScale = Math.min(Math.max(dir > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.05), 10);
      stage.scale({ x: newScale, y: newScale });
      stage.position({ x: pointer.x - pt.x * newScale, y: pointer.y - pt.y * newScale });
      stage.batchDraw();
      setZoom(Math.round(newScale * 100));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  const zoomTo = (scale: number) => {
    const stage = stageRef.current; if (!stage) return;
    const cx = dimensions.width / 2; const cy = dimensions.height / 2;
    const old = stage.scaleX();
    const pt  = { x: (cx - stage.x()) / old, y: (cy - stage.y()) / old };
    const clamped = Math.min(Math.max(scale, 0.05), 10);
    stage.scale({ x: clamped, y: clamped });
    stage.position({ x: cx - pt.x * clamped, y: cy - pt.y * clamped });
    stage.batchDraw(); setZoom(Math.round(clamped * 100));
  };
  const zoomIn    = () => zoomTo((stageRef.current?.scaleX() || 1) * 1.25);
  const zoomOut   = () => zoomTo((stageRef.current?.scaleX() || 1) / 1.25);
  const resetZoom = () => { const s = stageRef.current; if (!s) return; s.scale({x:1,y:1}); s.position({x:0,y:0}); s.batchDraw(); setZoom(100); };
  const zoomFit   = () => zoomTo(Math.min(dimensions.width / 1200, dimensions.height / 800));

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.ctrlKey && e.key === '=') { e.preventDefault(); zoomIn(); }
      if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); }
      if (e.ctrlKey && e.key === '0') { e.preventDefault(); resetZoom(); }
      if (e.key === 'Escape') { setTextPos(null); setTextInput(''); setEditingStickyId(null); }
      if (!e.ctrlKey && canDraw) {
        const map: Record<string, ToolType> = { p:'pen',e:'eraser',h:'highlight',r:'rectangle',c:'circle',t:'triangle',d:'diamond',a:'arrow',q:'straightline',x:'text',n:'sticky',i:'image' };
        if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [objects, undoStack, redoStack, canDraw]);

  // ── Socket ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!boardId) return;
    const socket = io(BACKEND_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setMySocketId(socket.id || '');
      socket.emit('joinRoom', { boardId, userName: user?.name || 'Anonymous', userColor: myColor.current });
    });
    socket.on('roomUsers',        ({ users }: { users: RoomUser[] }) => setRoomUsers(users));
    socket.on('userJoined',       ({ name }: { name: string })       => showToast(`👋 ${name} joined`, 'info'));
    socket.on('userLeft',         ({ name }: { name: string })       => showToast(`${name} left`, 'info'));
    socket.on('cursorUpdate',     (c: RemoteCursor) => {
      setRemoteCursors(prev => ({ ...prev, [c.userId]: c }));
      if (followUserId === c.userId && stageRef.current) {
        const s = stageRef.current;
        s.position({ x: -c.x * s.scaleX() + dimensions.width/2, y: -c.y * s.scaleY() + dimensions.height/2 });
        s.batchDraw();
      }
    });
    socket.on('cursorRemove',     ({ userId }: { userId: string }) =>
      setRemoteCursors(prev => { const n = {...prev}; delete n[userId]; return n; })
    );
    socket.on('drawUpdate',       (d: CanvasObject) => setObjects(prev => [...prev, d]));
    socket.on('objectAdded',      (d: CanvasObject) => setObjects(prev => [...prev, d]));
    socket.on('chatMessage',      (m: ChatMessage)  => setChatMessages(prev => [...prev, m]));
    socket.on('boardNameChanged', ({ name }: { name: string }) => setBoardName(name));
    socket.on('typing',           ({ name }: { name: string }) => {
      setTypingUsers(prev => prev.includes(name) ? prev : [...prev, name]);
      setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== name)), 2000);
    });
    socket.on('stickyUpdated',    ({ id, text }: { id: string; text: string }) =>
      setObjects(prev => prev.map(o => o.id === id && o.type === 'sticky' ? { ...o, text } : o))
    );
    socket.on('drawPermission',   ({ granted }: { granted: boolean }) => {
      setIsAllowedToDraw(granted);
      showToast(granted ? '✅ Host allowed you to draw!' : '🚫 Draw permission removed', granted ? 'success' : 'info');
    });
    socket.on('allowedUsers',     ({ ids }: { ids: string[] }) => setAllowedUserIds(new Set(ids)));

    fetch(`${BACKEND_URL}/api/boards/${boardId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.pages?.length > 0) { setPages(data.pages); setCurrentPageId(data.pages[0].id); }
        else if (data?.objects)      { setObjects(data.objects); }
        if (data?.boardName)         { setBoardName(data.boardName); }
      }).catch(() => {});

    return () => { socket.disconnect(); };
  }, [boardId, user, followUserId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Undo / Redo ──────────────────────────────────────────────────────────────
  const saveToUndo = useCallback((cur: CanvasObject[]) => {
    setUndoStack(prev => [...prev, cur]); setRedoStack([]);
  }, []);
  const handleUndo = () => {
    setUndoStack(prev => {
      if (!prev.length) return prev;
      const s = [...prev]; const last = s.pop()!;
      setRedoStack(r => [...r, objects]);
      setObjects(last); return s;
    });
  };
  const handleRedo = () => {
    setRedoStack(prev => {
      if (!prev.length) return prev;
      const s = [...prev]; const next = s.pop()!;
      setUndoStack(u => [...u, objects]);
      setObjects(next); return s;
    });
  };

  const getPos = (e: any) => {
    const stage = e.target.getStage();
    const tr = stage.getAbsoluteTransform().copy(); tr.invert();
    return tr.point(stage.getPointerPosition());
  };

  // ── Drawing ──────────────────────────────────────────────────────────────────
  const handleMouseDown = (e: any) => {
    if (!canDraw || isReadOnly) return;
    const pos = getPos(e); if (!pos) return;
    if (tool === 'pen' || tool === 'eraser' || tool === 'highlight') {
      isDrawingRef.current = true;
      livePointsRef.current = [pos.x, pos.y];
      setLivePoints([pos.x, pos.y]); setIsLiveDrawing(true);
      socketRef.current?.emit('presenceUpdate', { isDrawing: true });
    } else if (['rectangle','circle','triangle','diamond','arrow','straightline'].includes(tool)) {
      setShapeStart(pos);
    } else if (tool === 'text') {
      setTextPos(pos); setTextInput('');
      setTimeout(() => document.getElementById('text-overlay-input')?.focus(), 50);
    } else if (tool === 'sticky') {
      const note: StickyNote = { id:`sticky-${Date.now()}`, type:'sticky', x:pos.x, y:pos.y, text:'Double-click to edit', bg:stickyColor };
      saveToUndo(objects); setObjects(prev => [...prev, note]);
      socketRef.current?.emit('addObject', note);
    }
  };

  const handleMouseMove = (e: any) => {
    const pos = getPos(e); if (!pos) return;
    socketRef.current?.emit('cursorMove', { x:pos.x, y:pos.y, name:user?.name||'Anonymous', color:myColor.current, isDrawing:isDrawingRef.current });
    if ((tool==='pen'||tool==='eraser'||tool==='highlight') && isDrawingRef.current) {
      livePointsRef.current = [...livePointsRef.current, pos.x, pos.y];
      setLivePoints([...livePointsRef.current]);
    }
    if (shapeStart) {
      const [dx,dy] = [pos.x-shapeStart.x, pos.y-shapeStart.y];
      if (tool==='rectangle')    setPreview({id:'preview',type:'rectangle',   x:Math.min(pos.x,shapeStart.x),y:Math.min(pos.y,shapeStart.y),width:Math.abs(dx),height:Math.abs(dy),fill:color});
      if (tool==='circle')       setPreview({id:'preview',type:'circle',      x:shapeStart.x,y:shapeStart.y,radius:Math.sqrt(dx*dx+dy*dy)/2,fill:color});
      if (tool==='arrow')        setPreview({id:'preview',type:'arrow',       points:[shapeStart.x,shapeStart.y,pos.x,pos.y],color,strokeWidth});
      if (tool==='straightline') setPreview({id:'preview',type:'straightline',points:[shapeStart.x,shapeStart.y,pos.x,pos.y],color,strokeWidth});
      if (tool==='triangle')     setPreview({id:'preview',type:'triangle',    points:[shapeStart.x,shapeStart.y-Math.abs(dy),shapeStart.x-Math.abs(dx)/2,shapeStart.y,shapeStart.x+Math.abs(dx)/2,shapeStart.y],fill:color});
      if (tool==='diamond')      setPreview({id:'preview',type:'diamond',     x:shapeStart.x,y:shapeStart.y,size:Math.max(Math.abs(dx),Math.abs(dy)),fill:color});
    }
  };

  const handleMouseUp = (e: any) => {
    const pos = getPos(e);
    socketRef.current?.emit('presenceUpdate', { isDrawing: false });
    if ((tool==='pen'||tool==='eraser'||tool==='highlight') && isDrawingRef.current) {
      isDrawingRef.current = false; setIsLiveDrawing(false);
      const pts = livePointsRef.current;
      if (pts.length >= 2) {
        let obj: CanvasObject;
        if (tool==='eraser')         obj={id:`eraser-${Date.now()}`,type:'eraser',   points:pts,strokeWidth:strokeWidth*5};
        else if (tool==='highlight') obj={id:`hl-${Date.now()}`,    type:'highlight',points:pts,color,strokeWidth:strokeWidth*4};
        else                         obj={id:`line-${Date.now()}`,   type:'line',     points:pts,color,strokeWidth,opacity:opacity/100,dash:getDash()};
        saveToUndo(objects); setObjects(prev => [...prev, obj]);
        socketRef.current?.emit('draw', obj);
      }
      livePointsRef.current = []; setLivePoints([]);
    }
    if (shapeStart && pos) {
      const [dx,dy] = [pos.x-shapeStart.x, pos.y-shapeStart.y];
      let obj: CanvasObject|null = null;
      if (tool==='rectangle')    obj={id:`rect-${Date.now()}`, type:'rectangle',   x:Math.min(pos.x,shapeStart.x),y:Math.min(pos.y,shapeStart.y),width:Math.abs(dx),height:Math.abs(dy),fill:color};
      if (tool==='circle')       obj={id:`circ-${Date.now()}`, type:'circle',      x:shapeStart.x,y:shapeStart.y,radius:Math.sqrt(dx*dx+dy*dy)/2,fill:color};
      if (tool==='arrow')        obj={id:`arrow-${Date.now()}`,type:'arrow',       points:[shapeStart.x,shapeStart.y,pos.x,pos.y],color,strokeWidth};
      if (tool==='straightline') obj={id:`sl-${Date.now()}`,   type:'straightline',points:[shapeStart.x,shapeStart.y,pos.x,pos.y],color,strokeWidth,dash:getDash()};
      if (tool==='triangle')     obj={id:`tri-${Date.now()}`,  type:'triangle',    points:[shapeStart.x,shapeStart.y-Math.abs(dy),shapeStart.x-Math.abs(dx)/2,shapeStart.y,shapeStart.x+Math.abs(dx)/2,shapeStart.y],fill:color};
      if (tool==='diamond')      obj={id:`dia-${Date.now()}`,  type:'diamond',     x:shapeStart.x,y:shapeStart.y,size:Math.max(Math.abs(dx),Math.abs(dy)),fill:color};
      if (obj) { saveToUndo(objects); setObjects(prev=>[...prev,obj!]); socketRef.current?.emit('addObject',obj); }
      setShapeStart(null); setPreview(null);
    }
  };

  const handleDblClick = (e: any) => {
    const id  = e.target?.id?.();
    const obj = objects.find(o => o.id === id);
    if (obj?.type === 'sticky') {
      const tr = stageRef.current.getAbsoluteTransform().copy();
      const pt = tr.point({ x:(obj as StickyNote).x, y:(obj as StickyNote).y });
      setStickyEditPos({ x:pt.x, y:pt.y }); setStickyEditText((obj as StickyNote).text); setEditingStickyId(id);
    }
  };

  const saveStickyEdit = () => {
    if (!editingStickyId) return;
    setObjects(prev => prev.map(o => o.id===editingStickyId && o.type==='sticky' ? {...o,text:stickyEditText} : o));
    socketRef.current?.emit('stickyUpdate', { id:editingStickyId, text:stickyEditText });
    setEditingStickyId(null);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPos) return;
    const obj: TextShape = { id:`txt-${Date.now()}`,type:'text',x:textPos.x,y:textPos.y,text:textInput,color,fontSize,fontFamily,bold,italic };
    saveToUndo(objects); setObjects(prev=>[...prev,obj]);
    socketRef.current?.emit('addObject', obj);
    setTextPos(null); setTextInput('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new window.Image();
      img.onload = () => {
        const obj: ImageShape = { id:`img-${Date.now()}`,type:'image',x:80,y:80,width:Math.min(img.width,400),height:Math.min(img.height,300),src:ev.target?.result as string };
        saveToUndo(objects); setObjects(prev=>[...prev,obj]); showToast('🖼️ Image added!');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!boardId) return; setSaving(true);
    try {
      await fetch(`${BACKEND_URL}/api/boards/${boardId}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ objects, pages, boardName }),
      });
      setSaved(true); showToast('✅ All pages saved!');
      setTimeout(() => setSaved(false), 2000);
    } catch { showToast('Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleDownloadPNG = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement('a');
    a.download = `${boardName.replace(/\s+/g,'-')}-${boardId?.slice(0,6)}.png`;
    a.href = uri; a.click(); showToast('📥 Downloaded!');
  };

  const toggleAllowUser = (userId: string, userName: string) => {
    const isAllowed = allowedUserIds.has(userId);
    const updated   = new Set(allowedUserIds);
    isAllowed ? updated.delete(userId) : updated.add(userId);
    setAllowedUserIds(updated);
    socketRef.current?.emit('setDrawPermission', { targetUserId: userId, granted: !isAllowed, boardId });
    showToast(isAllowed ? `🚫 Removed draw access from ${userName}` : `✅ ${userName} can now draw`, 'info');
  };

  const addPage    = () => { const p: Page = { id:`page-${Date.now()}`, name:`Page ${pages.length+1}`, objects:[] }; setPages(prev=>[...prev,p]); setCurrentPageId(p.id); showToast(`📄 ${p.name} added`); };
  const deletePage = (id: string) => { if (pages.length===1) { showToast('Cannot delete last page','error'); return; } const rest=pages.filter(p=>p.id!==id); setPages(rest); if (currentPageId===id) setCurrentPageId(rest[0].id); };
  const renamePage = (id: string, name: string) => { if (name.trim()) setPages(prev=>prev.map(p=>p.id===id?{...p,name:name.trim()}:p)); setRenamingPageId(null); };
  const handleNameSave = () => { setEditingName(false); socketRef.current?.emit('boardNameChange', { boardId, name:boardName }); showToast('✏️ Board renamed!'); };
  const sendChat   = () => { if (!chatInput.trim()) return; const msg: ChatMessage = { userId:socketRef.current?.id||'', name:user?.name||'Anonymous', text:chatInput, time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), color:myColor.current }; socketRef.current?.emit('chatMessage', { boardId, ...msg }); setChatMessages(prev=>[...prev,msg]); setChatInput(''); };
  const handleChatTyping = () => { socketRef.current?.emit('typing', { boardId, name:user?.name||'Anonymous' }); clearTimeout(typingTimer.current); };

  const renderGrid = () => {
    const lines=[]; const step=40;
    for (let x=0;x<4000;x+=step) lines.push(<Line key={`v${x}`} points={[x,0,x,4000]} stroke="#ffffff04" strokeWidth={1} listening={false}/>);
    for (let y=0;y<4000;y+=step) lines.push(<Line key={`h${y}`} points={[0,y,4000,y]} stroke="#ffffff04" strokeWidth={1} listening={false}/>);
    return lines;
  };

  const renderObj = (obj: CanvasObject) => {
    switch (obj.type) {
      case 'line':         return <Line   key={obj.id} id={obj.id} points={obj.points} stroke={obj.color} strokeWidth={obj.strokeWidth} tension={0.4} lineCap="round" lineJoin="round" opacity={obj.opacity??1} dash={obj.dash} listening={false}/>;
      case 'highlight':    return <Line   key={obj.id} points={obj.points} stroke={obj.color} strokeWidth={obj.strokeWidth} tension={0.4} lineCap="round" opacity={0.35} listening={false}/>;
      case 'eraser':       return <Line   key={obj.id} points={obj.points} stroke="#0c0c0f" strokeWidth={obj.strokeWidth} tension={0.4} lineCap="round" listening={false}/>;
      case 'rectangle':    return <Rect   key={obj.id} x={obj.x} y={obj.y} width={obj.width} height={obj.height} fill={obj.fill} opacity={0.75} cornerRadius={4} listening={false}/>;
      case 'circle':       return <Circle key={obj.id} x={obj.x} y={obj.y} radius={obj.radius} fill={obj.fill} opacity={0.75} listening={false}/>;
      case 'triangle':     return <Line   key={obj.id} points={obj.points} fill={obj.fill} closed opacity={0.75} listening={false}/>;
      case 'diamond':      return <Line   key={obj.id} points={[obj.x,obj.y-obj.size/2,obj.x+obj.size/2,obj.y,obj.x,obj.y+obj.size/2,obj.x-obj.size/2,obj.y]} fill={obj.fill} closed opacity={0.75} listening={false}/>;
      case 'arrow':        return <Arrow  key={obj.id} points={obj.points} stroke={obj.color} strokeWidth={obj.strokeWidth} fill={obj.color} pointerLength={12} pointerWidth={10} listening={false}/>;
      case 'straightline': return <Line   key={obj.id} points={obj.points} stroke={obj.color} strokeWidth={obj.strokeWidth} dash={obj.dash} lineCap="round" listening={false}/>;
      case 'text':         return <Text   key={obj.id} x={obj.x} y={obj.y} text={obj.text} fill={obj.color} fontSize={obj.fontSize} fontFamily={obj.fontFamily} fontStyle={`${obj.bold?'bold':''} ${obj.italic?'italic':''}`} listening={false}/>;
      case 'sticky':       return (
        <React.Fragment key={obj.id}>
          <Rect x={obj.x} y={obj.y} width={180} height={130} fill={obj.bg} opacity={0.92} cornerRadius={8} shadowBlur={10} shadowOpacity={0.2} id={obj.id}/>
          <Text x={obj.x+10} y={obj.y+10} text={obj.text} fill="#1a1a1a" fontSize={13} width={160} fontFamily="DM Sans,sans-serif" id={obj.id} listening={false}/>
        </React.Fragment>
      );
      default: return null;
    }
  };

  const renderPreview = () => {
    if (!preview) return null;
    switch (preview.type) {
      case 'rectangle':    return <Rect   x={preview.x} y={preview.y} width={preview.width} height={preview.height} fill={preview.fill} opacity={0.3} stroke={color} strokeWidth={1} dash={[6,3]} cornerRadius={4} listening={false}/>;
      case 'circle':       return <Circle x={preview.x} y={preview.y} radius={preview.radius} fill={preview.fill} opacity={0.3} stroke={color} strokeWidth={1} dash={[6,3]} listening={false}/>;
      case 'arrow':        return <Arrow  points={preview.points} stroke={preview.color} strokeWidth={preview.strokeWidth} fill={preview.color} opacity={0.6} pointerLength={12} pointerWidth={10} listening={false}/>;
      case 'straightline': return <Line   points={preview.points} stroke={preview.color} strokeWidth={preview.strokeWidth} opacity={0.6} dash={getDash()} listening={false}/>;
      case 'triangle':     return <Line   points={preview.points} fill={preview.fill} closed opacity={0.3} stroke={color} strokeWidth={1} dash={[6,3]} listening={false}/>;
      case 'diamond':      return <Line   points={[preview.x,preview.y-preview.size/2,preview.x+preview.size/2,preview.y,preview.x,preview.y+preview.size/2,preview.x-preview.size/2,preview.y]} fill={preview.fill} closed opacity={0.3} stroke={color} strokeWidth={1} listening={false}/>;
      default: return null;
    }
  };

  const renderLiveStroke = () => {
    if (!isLiveDrawing || livePoints.length < 2) return null;
    if (tool==='eraser')    return <Line points={livePoints} stroke="#0c0c0f" strokeWidth={strokeWidth*5} tension={0.4} lineCap="round" lineJoin="round" listening={false}/>;
    if (tool==='highlight') return <Line points={livePoints} stroke={color}   strokeWidth={strokeWidth*4} tension={0.4} lineCap="round" opacity={0.35} listening={false}/>;
    return                         <Line points={livePoints} stroke={color}   strokeWidth={strokeWidth}   tension={0.4} lineCap="round" lineJoin="round" opacity={opacity/100} dash={getDash()} listening={false}/>;
  };

  const getCursor = () => {
    if (!canDraw || isReadOnly) return 'default';
    if (tool==='eraser') return 'cell';
    if (tool==='text')   return 'text';
    return 'crosshair';
  };

  // ── Btn style helpers ─────────────────────────────────────────────────────────
  const btnBase  = "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0";
  const btnGhost = { background:'rgba(255,255,255,0.03)', borderColor:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background:'#0a0a0c', fontFamily:"'DM Sans',sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        /* ── Tool tooltip ── */
        .cwb-tool { position:relative; display:flex; justify-content:center; width:100%; }
        .cwb-tip {
          visibility:hidden; opacity:0;
          position:absolute; left:52px; top:50%; transform:translateY(-50%);
          background:#1c1c24; color:#fff; font-size:12px; font-weight:600;
          padding:6px 12px; border-radius:10px; white-space:nowrap;
          border:1px solid rgba(255,255,255,0.12); pointer-events:none;
          z-index:99999; box-shadow:0 8px 32px rgba(0,0,0,0.8);
          transition:opacity 0.15s ease, visibility 0.15s ease;
        }
        .cwb-tip::before {
          content:''; position:absolute; right:100%; top:50%; transform:translateY(-50%);
          border:6px solid transparent; border-right-color:rgba(255,255,255,0.12);
        }
        .cwb-tip::after {
          content:''; position:absolute; right:calc(100% - 1px); top:50%; transform:translateY(-50%);
          border:6px solid transparent; border-right-color:#1c1c24;
        }
        .cwb-tool:hover .cwb-tip { visibility:visible; opacity:1; }
        .cwb-key {
          display:inline-block; margin-left:8px;
          background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.45);
          font-family:'DM Mono',monospace; font-size:10px;
          padding:1px 6px; border-radius:5px; border:1px solid rgba(255,255,255,0.12);
        }
        .cwb-viewer-badge {
          display:inline-block; margin-left:6px; font-size:9px;
          color:rgba(0,212,255,0.5); font-weight:400;
        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Text overlay */}
      {textPos && (
        <div style={{ position:'fixed', left:textPos.x+(containerRef.current?.getBoundingClientRect().left||0), top:textPos.y+(containerRef.current?.getBoundingClientRect().top||0), zIndex:100 }}>
          <div className="border rounded-2xl p-3 shadow-2xl" style={{ background:'#18181b', borderColor:'rgba(0,212,255,0.3)' }}>
            <div className="flex gap-2 mb-2">
              <select value={fontFamily} onChange={e=>setFontFamily(e.target.value)} className="text-white text-xs rounded-lg px-2 py-1 outline-none border" style={{ background:'#111113', borderColor:'rgba(255,255,255,0.08)' }}>
                {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
              <input type="number" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))} min={8} max={120} className="text-white text-xs rounded-lg px-2 py-1 outline-none border w-16 text-center" style={{ background:'#111113', borderColor:'rgba(255,255,255,0.08)' }}/>
              {[{l:'B',v:bold,set:setBold},{l:'I',v:italic,set:setItalic}].map(btn=>(
                <button key={btn.l} onClick={()=>btn.set(!btn.v)} className="w-8 h-8 rounded-lg text-xs font-bold border" style={btn.v?{background:'#00d4ff20',color:'#00d4ff',borderColor:'#00d4ff35'}:{background:'#111113',color:'rgba(255,255,255,0.5)',borderColor:'rgba(255,255,255,0.08)'}}>{btn.l}</button>
              ))}
            </div>
            <input id="text-overlay-input" value={textInput} onChange={e=>setTextInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') handleTextSubmit(); if(e.key==='Escape'){setTextPos(null);setTextInput('');} }}
              placeholder="Type then press Enter…" autoFocus
              className="w-64 text-sm outline-none rounded-xl px-3 py-2 border"
              style={{ background:'#111113', borderColor:'rgba(0,212,255,0.25)', color, fontFamily, fontWeight:bold?'bold':'normal', fontStyle:italic?'italic':'normal', fontSize }}/>
          </div>
        </div>
      )}

      {/* Sticky edit */}
      {editingStickyId && stickyEditPos && (
        <div style={{ position:'fixed', left:stickyEditPos.x+(containerRef.current?.getBoundingClientRect().left||0), top:stickyEditPos.y+(containerRef.current?.getBoundingClientRect().top||0), zIndex:100 }}>
          <textarea value={stickyEditText} onChange={e=>setStickyEditText(e.target.value)}
            onBlur={saveStickyEdit} onKeyDown={e=>e.key==='Escape'&&saveStickyEdit()}
            className="w-44 h-28 text-sm p-2 rounded-xl outline-none resize-none shadow-2xl border-2"
            style={{ background:'#ffd43b', color:'#1a1a1a', borderColor:'#f0c000' }} autoFocus/>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t=>(
          <div key={t.id} className="px-4 py-2 rounded-xl text-sm font-medium shadow-2xl border"
            style={t.type==='success'?{background:'#10b98115',borderColor:'#10b98125',color:'#6ee7b7',backdropFilter:'blur(8px)'}:t.type==='error'?{background:'#ef444415',borderColor:'#ef444425',color:'#fca5a5',backdropFilter:'blur(8px)'}:{background:'#00d4ff15',borderColor:'#00d4ff25',color:'#00d4ff',backdropFilter:'blur(8px)'}}>
            {t.message}
          </div>
        ))}
      </div>

      {/* ══════════════════════════ TOP BAR — TWO ROWS ══════════════════════════ */}
      <div className="flex flex-col border-b z-30 flex-shrink-0"
        style={{ background:'rgba(10,10,12,0.98)', borderColor:'rgba(255,255,255,0.07)' }}>
      {/* Row 1: Logo · Name · Back · Role · Grid · Drawing controls */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor:'rgba(255,255,255,0.05)', minHeight:42 }}>

        {/* Logo */}
        <span className="font-bold text-sm whitespace-nowrap flex-shrink-0" style={{ fontFamily:"'DM Mono',monospace", color:'#00d4ff' }}>Collab Whiteboard</span>
        <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>

        {/* Board name */}
        {editingName ? (
          <input value={boardName} onChange={e=>setBoardName(e.target.value)} onBlur={handleNameSave}
            onKeyDown={e=>e.key==='Enter'&&handleNameSave()}
            className="text-xs text-white outline-none rounded-lg px-2 py-1 border w-36 flex-shrink-0"
            style={{ background:'#111113', borderColor:'rgba(0,212,255,0.4)' }} autoFocus/>
        ) : (
          <button onClick={()=>setEditingName(true)} title="Click to rename"
            className="text-xs font-medium flex items-center gap-1 truncate max-w-[130px] flex-shrink-0"
            style={{ color:'rgba(255,255,255,0.6)' }}
            onMouseEnter={e=>e.currentTarget.style.color='#00d4ff'}
            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.6)'}>
            {boardName}<span style={{ color:'rgba(255,255,255,0.2)',fontSize:10 }}>✏</span>
          </button>
        )}

        <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>

        {/* Back */}
        <button onClick={()=>navigate('/dashboard')} className={`${btnBase} flex-shrink-0`} style={btnGhost}
          onMouseEnter={e=>{ e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.55)'; e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}>
          ← Back
        </button>

        <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>

        {/* Role badge */}
        <div className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap"
          style={isHost?{background:'rgba(251,191,36,0.12)',borderColor:'rgba(251,191,36,0.25)',color:'#fbbf24'}:canDraw?{background:'rgba(81,207,102,0.12)',borderColor:'rgba(81,207,102,0.25)',color:'#51cf66'}:{background:'rgba(0,212,255,0.08)',borderColor:'rgba(0,212,255,0.15)',color:'rgba(0,212,255,0.8)'}}>
          {isHost ? '👑 Host' : canDraw ? '✏️ Allowed to Draw' : '👁️ Viewer'}
        </div>

        <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>

        {/* Grid */}
        <button onClick={()=>setShowGrid(!showGrid)} className={btnBase}
          style={showGrid?{background:'rgba(0,212,255,0.12)',color:'#00d4ff',borderColor:'rgba(0,212,255,0.25)'}:btnGhost}>
          ⊞ Grid
        </button>

        {/* ── Drawing controls — only for host / allowed ── */}
        {canDraw && (<>
          <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>
          {/* Color palette */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {PALETTE.map(c=>(
              <button key={c} onClick={()=>setColor(c)} className="rounded-full transition-all hover:scale-125 flex-shrink-0"
                style={{ width:15,height:15,backgroundColor:c,border:`2px solid ${color===c?'white':'transparent'}`,transform:color===c?'scale(1.25)':'scale(1)' }}/>
            ))}
            <input type="color" value={color} onChange={e=>setColor(e.target.value)}
              style={{ width:15,height:15,borderRadius:'50%',border:'none',background:'transparent',cursor:'pointer' }} title="Custom colour"/>
          </div>
          <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>
          {/* Stroke size */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>Size</span>
            <input type="range" min={1} max={20} value={strokeWidth} onChange={e=>setStrokeWidth(Number(e.target.value))} className="w-14" style={{ accentColor:'#00d4ff' }}/>
            <span className="text-xs w-5 text-center" style={{ color:'rgba(255,255,255,0.4)',fontFamily:"'DM Mono',monospace" }}>{strokeWidth}</span>
          </div>
          {/* Opacity */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>α</span>
            <input type="range" min={10} max={100} value={opacity} onChange={e=>setOpacity(Number(e.target.value))} className="w-12" style={{ accentColor:'#cc5de8' }}/>
          </div>
          {/* Line style */}
          <div className="flex p-0.5 rounded-lg border flex-shrink-0" style={{ background:'rgba(255,255,255,0.02)',borderColor:'rgba(255,255,255,0.07)' }}>
            {([{v:'solid',l:'─'},{v:'dashed',l:'╌'},{v:'dotted',l:'···'}] as const).map(s=>(
              <button key={s.v} onClick={()=>setLineStyle(s.v)} className="px-2 py-1 rounded-md text-xs font-bold transition-all"
                style={lineStyle===s.v?{background:'#00d4ff20',color:'#00d4ff'}:{color:'rgba(255,255,255,0.3)'}}>
                {s.l}
              </button>
            ))}
          </div>
          <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>
        </>)}

      </div>{/* end row 1 */}
      {/* Row 2: Undo · Redo · Zoom · Download · Save · Clear */}
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ minHeight:38 }}>
        {/* ── Undo / Redo ── */}
        <button data-testid="undo-button" onClick={handleUndo} disabled={!undoStack.length} title="Undo (Ctrl+Z)"
          className={btnBase} style={btnGhost}
          onMouseEnter={e=>{ if(!undoStack.length) return; e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.55)'; e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}>
          ↩ Undo
        </button>
        <button data-testid="redo-button" onClick={handleRedo} disabled={!redoStack.length} title="Redo (Ctrl+Y)"
          className={btnBase} style={btnGhost}
          onMouseEnter={e=>{ if(!redoStack.length) return; e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.55)'; e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}>
          ↪ Redo
        </button>

        <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>

        {/* ── Zoom controls — always visible ── */}
        <div className="flex items-center rounded-lg border flex-shrink-0 overflow-hidden" style={{ background:'rgba(255,255,255,0.02)',borderColor:'rgba(255,255,255,0.08)' }}>
          <button onClick={zoomOut} title="Zoom Out (Ctrl + −)"
            className="px-3 py-1.5 text-lg font-bold transition-all" style={{ color:'rgba(255,255,255,0.5)' }}
            onMouseEnter={e=>{ e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.5)'; e.currentTarget.style.background='transparent'; }}>−</button>
          <button onClick={resetZoom} title="Reset to 100% (Ctrl+0)"
            className="px-2 py-1.5 text-xs w-16 text-center font-bold transition-all border-l border-r"
            style={{ color:'rgba(255,255,255,0.8)',fontFamily:"'DM Mono',monospace",borderColor:'rgba(255,255,255,0.07)' }}
            onMouseEnter={e=>e.currentTarget.style.color='#00d4ff'}
            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.8)'}>
            {zoom}%
          </button>
          <button onClick={zoomIn} title="Zoom In (Ctrl + =)"
            className="px-3 py-1.5 text-lg font-bold transition-all border-r" style={{ color:'rgba(255,255,255,0.5)',borderColor:'rgba(255,255,255,0.07)' }}
            onMouseEnter={e=>{ e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.5)'; e.currentTarget.style.background='transparent'; }}>+</button>
          <button onClick={zoomFit} title="Fit board to screen"
            className="px-2.5 py-1.5 text-xs font-medium transition-all" style={{ color:'rgba(255,255,255,0.4)' }}
            onMouseEnter={e=>{ e.currentTarget.style.color='#00d4ff'; e.currentTarget.style.background='rgba(0,212,255,0.08)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.4)'; e.currentTarget.style.background='transparent'; }}>⊡ Fit</button>
        </div>

        <div className="w-px h-5 flex-shrink-0" style={{ background:'rgba(255,255,255,0.08)' }}/>

        {/* ── Download — always visible ── */}
        <button onClick={handleDownloadPNG} title="Download as PNG" className={btnBase}
          style={{ background:'rgba(81,207,102,0.08)',borderColor:'rgba(81,207,102,0.2)',color:'#51cf66' }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(81,207,102,0.2)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(81,207,102,0.08)'}>
          📥 Download
        </button>

        {/* ── Save — always visible ── */}
        <button onClick={handleSave} disabled={saving} title="Save (Ctrl+S)"
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex-shrink-0 whitespace-nowrap"
          style={saved?{background:'#10b98120',borderColor:'#10b98130',color:'#6ee7b7'}:{background:'#00d4ff',borderColor:'#00d4ff',color:'#0a0a0c',boxShadow:'0 0 16px #00d4ff35'}}>
          {saved ? '✓ Saved' : saving ? '…' : '💾 Save'}
        </button>

        {/* Spacer pushes Clear to far right */}
        <div className="flex-1 min-w-0"/>

        {/* ── Clear — only host / allowed can use it ── */}
        {canDraw && (
          <button onClick={()=>{ saveToUndo(objects); setObjects([]); showToast('🗑️ Canvas cleared'); }}
            title="Clear all objects on this page" className={btnBase}
            style={{ background:'rgba(239,68,68,0.08)',borderColor:'rgba(239,68,68,0.2)',color:'#f87171' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.2)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,0.08)'}>
            🗑️ Clear
          </button>
        )}
      </div>{/* end row 2 */}
      </div>{/* end top bar wrapper */}

      {/* ══════════════════════════ MAIN AREA ══════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left toolbar — ALWAYS visible to everyone, tooltips work for all */}
        <div className="w-14 flex flex-col items-center pt-2 pb-2 gap-0.5 z-20 flex-shrink-0 border-r"
          style={{ background:'rgba(10,10,12,0.98)',borderColor:'rgba(255,255,255,0.07)',overflowY:'auto',scrollbarWidth:'none' }}>
          {TOOL_GROUPS.map(group=>(
            <React.Fragment key={group.label}>
              <div className="w-8 my-1" style={{ height:1,background:'rgba(255,255,255,0.06)' }}/>
              {group.items.map(t=>(
                <div key={t.id} className="cwb-tool">
                  <button
                    data-testid={(t as any).testid}
                    onClick={()=>{
                      if (!canDraw) { showToast('👁️ Viewers cannot draw — ask host to allow you','info'); return; }
                      if (t.id==='image') { fileInputRef.current?.click(); return; }
                      setTool(t.id as ToolType);
                    }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all"
                    style={
                      !canDraw
                        ? { background:'transparent', color:'rgba(255,255,255,0.18)', border:'1px solid transparent', cursor:'default' }
                        : tool===t.id
                          ? { background:'#00d4ff20', color:'#00d4ff', boxShadow:'0 0 12px #00d4ff25', border:'1px solid #00d4ff30' }
                          : { background:'transparent', color:'rgba(255,255,255,0.4)', border:'1px solid transparent' }
                    }
                    onMouseEnter={e=>{ if(!canDraw) return; if(tool!==t.id){ e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.color='white'; } }}
                    onMouseLeave={e=>{ if(!canDraw) return; if(tool!==t.id){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.4)'; } }}>
                    {t.icon}
                  </button>
                  {/* Tooltip — visible to ALL users including viewers */}
                  <span className="cwb-tip">
                    {t.label}
                    <span className="cwb-key">{t.key}</span>
                    {!canDraw && <span className="cwb-viewer-badge">view only</span>}
                  </span>
                </div>
              ))}
            </React.Fragment>
          ))}
          {canDraw && tool==='sticky' && (
            <>
              <div className="w-8 my-1" style={{ height:1,background:'rgba(255,255,255,0.06)' }}/>
              {STICKY_COLS.map(c=>(
                <button key={c} onClick={()=>setStickyColor(c)} className="w-6 h-6 rounded-full transition-all hover:scale-125 mb-0.5"
                  style={{ backgroundColor:c,border:`2px solid ${stickyColor===c?'white':'transparent'}` }}/>
              ))}
            </>
          )}
        </div>

        {/* ── Canvas ── */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ background:'#0c0c0f' }}>
          <Stage ref={stageRef} width={dimensions.width} height={dimensions.height}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onDblClick={handleDblClick}
            style={{ cursor:getCursor() }}>
            <Layer>
              {showGrid && renderGrid()}
              {objects.map(renderObj)}
              {renderLiveStroke()}
              {renderPreview()}
            </Layer>
          </Stage>

          {/* Images */}
          {objects.filter(o=>o.type==='image').map(obj=>{
            const img=obj as ImageShape;
            return <img key={img.id} src={img.src} alt="" style={{ position:'absolute',left:img.x,top:img.y,width:img.width,height:img.height,pointerEvents:'none',opacity:0.9 }}/>;
          })}

          {/* Remote cursors */}
          {Object.values(remoteCursors).map(c=>(
            <div key={c.userId} data-testid="remote-cursor"
              style={{ position:'absolute',left:c.x,top:c.y,pointerEvents:'none',transform:'translate(-4px,-4px)',zIndex:10,transition:'left 0.05s,top 0.05s' }}>
              <div className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
                style={{ backgroundColor:c.color,transform:c.isDrawing?'scale(1.5)':'scale(1)',transition:'transform 0.1s' }}/>
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md font-semibold whitespace-nowrap"
                style={{ background:`${c.color}25`,color:c.color,border:`1px solid ${c.color}40` }}>
                {c.isDrawing?'✏️ ':''}{c.name}
              </span>
            </div>
          ))}

          {/* Viewer banner */}
          {!canDraw && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full font-semibold pointer-events-none z-20 flex items-center gap-2 whitespace-nowrap"
              style={{ background:'rgba(0,212,255,0.1)',border:'1px solid rgba(0,212,255,0.3)',color:'#00d4ff',backdropFilter:'blur(10px)',fontSize:12 }}>
              👁️ Viewer Mode — Host controls who can draw
            </div>
          )}

          {/* ── Zoom bar — bottom left, always visible ── */}
          <div className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-xl overflow-hidden"
            style={{ background:'rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.09)',backdropFilter:'blur(12px)' }}>
            <button onClick={zoomOut} title="Zoom Out"
              className="px-3 py-1.5 text-base font-bold transition-all" style={{ color:'rgba(255,255,255,0.5)' }}
              onMouseEnter={e=>{ e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.5)'; e.currentTarget.style.background='transparent'; }}>−</button>
            <button onClick={resetZoom} title="Reset zoom"
              className="px-2 py-1.5 text-xs font-bold w-14 text-center transition-all"
              style={{ color:'rgba(255,255,255,0.7)',fontFamily:"'DM Mono',monospace" }}
              onMouseEnter={e=>e.currentTarget.style.color='#00d4ff'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'}>{zoom}%</button>
            <button onClick={zoomIn} title="Zoom In"
              className="px-3 py-1.5 text-base font-bold transition-all" style={{ color:'rgba(255,255,255,0.5)' }}
              onMouseEnter={e=>{ e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.5)'; e.currentTarget.style.background='transparent'; }}>+</button>
            <div style={{ width:1,height:20,background:'rgba(255,255,255,0.08)' }}/>
            <button onClick={zoomFit} title="Fit to screen"
              className="px-3 py-1.5 text-xs font-medium transition-all" style={{ color:'rgba(255,255,255,0.4)' }}
              onMouseEnter={e=>{ e.currentTarget.style.color='#00d4ff'; e.currentTarget.style.background='rgba(0,212,255,0.1)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.4)'; e.currentTarget.style.background='transparent'; }}>⊡ Fit</button>
            <div style={{ width:1,height:20,background:'rgba(255,255,255,0.08)' }}/>
            <span className="px-2 text-xs" style={{ color:'rgba(255,255,255,0.2)',fontFamily:"'DM Mono',monospace" }}>scroll to zoom</span>
          </div>

          {/* Share */}
          <button onClick={()=>{ navigator.clipboard.writeText(window.location.href); showToast('🔗 Link copied! Share with students','info'); }}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all z-10"
            style={{ background:'rgba(0,0,0,0.65)',borderColor:'rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.6)',backdropFilter:'blur(12px)',boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='rgba(0,212,255,0.15)'; e.currentTarget.style.borderColor='rgba(0,212,255,0.4)'; e.currentTarget.style.color='#00d4ff'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background='rgba(0,0,0,0.65)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; e.currentTarget.style.color='rgba(255,255,255,0.6)'; }}>
            🔗 Share Board
          </button>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-56 flex flex-col overflow-hidden flex-shrink-0 border-l"
          style={{ background:'rgba(10,10,12,0.98)',borderColor:'rgba(255,255,255,0.07)' }}>

          <div className="p-3 border-b" style={{ borderColor:'rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color:'rgba(255,255,255,0.3)' }}>
              👥 In this board ({roomUsers.length})
            </p>
            <div data-testid="user-list" className="space-y-2">
              {roomUsers.map(u=>(
                <div key={u.id} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.isDrawing?'animate-ping':'animate-pulse'}`} style={{ backgroundColor:u.color||'#00d4ff' }}/>
                    <span className="text-xs font-medium truncate" style={{ color:'rgba(255,255,255,0.7)' }}>{u.name}</span>
                    {u.isDrawing&&<span className="text-xs">✏️</span>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {isHost && u.id !== mySocketId && (
                      <button onClick={()=>toggleAllowUser(u.id, u.name)}
                        title={allowedUserIds.has(u.id)?'Revoke draw access':'Allow to draw'}
                        className="text-xs px-1.5 py-1 rounded-lg border font-semibold transition-all"
                        style={allowedUserIds.has(u.id)?{background:'rgba(81,207,102,0.15)',borderColor:'rgba(81,207,102,0.35)',color:'#51cf66'}:{background:'rgba(255,255,255,0.04)',borderColor:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.5)'}}>
                        {allowedUserIds.has(u.id)?'✏️ On':'Allow'}
                      </button>
                    )}
                    {u.id !== mySocketId && (
                      <button onClick={()=>{ if(followUserId===u.id){setFollowUserId(null);showToast('Stopped following','info');}else{setFollowUserId(u.id);showToast(`👁️ Following ${u.name}`,'info');} }}
                        className="text-xs px-1.5 py-1 rounded-lg border font-medium transition-all"
                        style={followUserId===u.id?{background:'rgba(251,191,36,0.15)',borderColor:'rgba(251,191,36,0.3)',color:'#fbbf24'}:{background:'rgba(255,255,255,0.04)',borderColor:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.4)'}}>
                        {followUserId===u.id?'👁️':'Follow'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {roomUsers.length===0&&<p className="text-xs italic" style={{ color:'rgba(255,255,255,0.2)' }}>No users yet</p>}
            </div>
          </div>

          <div className="flex flex-col flex-1 overflow-hidden">
            <button className="flex items-center justify-between px-3 py-2 border-b transition-colors"
              style={{ borderColor:'rgba(255,255,255,0.07)' }}
              onClick={()=>setShowChat(!showChat)}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'rgba(255,255,255,0.3)' }}>
                💬 Chat {chatMessages.length>0&&`(${chatMessages.length})`}
              </p>
              <span className="text-xs" style={{ color:'rgba(255,255,255,0.25)' }}>{showChat?'▾':'▸'}</span>
            </button>
            {showChat&&(
              <>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                  {chatMessages.length===0&&<p className="text-xs text-center py-6 italic" style={{ color:'rgba(255,255,255,0.2)' }}>No messages yet 👋</p>}
                  {chatMessages.map((msg,i)=>(
                    <div key={i}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color:msg.color }}>{msg.name}</span>
                        <span className="text-xs" style={{ color:'rgba(255,255,255,0.25)' }}>{msg.time}</span>
                      </div>
                      <p className="text-xs rounded-lg px-2 py-1.5 break-words" style={{ background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.75)' }}>{msg.text}</p>
                    </div>
                  ))}
                  {typingUsers.length>0&&<p className="text-xs italic" style={{ color:'rgba(255,255,255,0.25)' }}>{typingUsers.join(', ')} is typing…</p>}
                  <div ref={chatEndRef}/>
                </div>
                <div className="p-2 border-t flex gap-1" style={{ borderColor:'rgba(255,255,255,0.07)' }}>
                  <input value={chatInput} onChange={e=>{setChatInput(e.target.value);handleChatTyping();}}
                    onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Message…"
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none border transition-all"
                    style={{ background:'rgba(255,255,255,0.05)',borderColor:'rgba(255,255,255,0.08)',color:'white' }}
                    onFocus={e=>e.target.style.borderColor='rgba(0,212,255,0.35)'}
                    onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
                  <button onClick={sendChat} className="px-2 py-1.5 rounded-lg text-xs font-bold" style={{ background:'#00d4ff',color:'#0a0a0c' }}>↑</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════ PAGE TABS ══════════════════════════ */}
      <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto flex-shrink-0 border-t"
        style={{ background:'rgba(10,10,12,0.98)',borderColor:'rgba(255,255,255,0.07)' }}>
        <span className="text-xs mr-2 whitespace-nowrap" style={{ color:'rgba(255,255,255,0.25)' }}>Pages</span>
        {pages.map(page=>(
          <div key={page.id} className="flex items-center group">
            {renamingPageId===page.id?(
              <input value={pageNameVal} onChange={e=>setPageNameVal(e.target.value)}
                onBlur={()=>renamePage(page.id,pageNameVal)}
                onKeyDown={e=>{ if(e.key==='Enter')renamePage(page.id,pageNameVal); if(e.key==='Escape')setRenamingPageId(null); }}
                className="text-xs rounded-lg px-2 py-0.5 outline-none border w-24"
                style={{ background:'#111113',borderColor:'rgba(0,212,255,0.5)',color:'white' }} autoFocus/>
            ):(
              <button onClick={()=>setCurrentPageId(page.id)}
                onDoubleClick={()=>{ setRenamingPageId(page.id); setPageNameVal(page.name); }}
                title="Click to switch · Double-click to rename"
                className="px-3 py-1 rounded-l-lg text-xs font-medium transition-all whitespace-nowrap border"
                style={currentPageId===page.id?{background:'#00d4ff20',color:'#00d4ff',borderColor:'#00d4ff30'}:{background:'transparent',color:'rgba(255,255,255,0.4)',borderColor:'rgba(255,255,255,0.07)'}}>
                {page.name}
              </button>
            )}
            {pages.length>1&&(
              <button onClick={()=>deletePage(page.id)}
                className="px-1.5 py-1 rounded-r-lg text-xs transition-all opacity-0 group-hover:opacity-100 border-t border-b border-r"
                style={{ background:'transparent',borderColor:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.3)' }}
                onMouseEnter={e=>e.currentTarget.style.color='#f87171'}
                onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>×</button>
            )}
          </div>
        ))}
        <button onClick={addPage}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-all ml-1 whitespace-nowrap border border-dashed"
          style={{ background:'transparent',borderColor:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.3)' }}
          onMouseEnter={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.3)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; }}>
          + Page
        </button>
      </div>
    </div>
  );
};

export default Board;