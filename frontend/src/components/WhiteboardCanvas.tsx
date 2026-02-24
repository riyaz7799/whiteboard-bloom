import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Image as KonvaImage } from 'react-konva';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface DrawLine {
  id: string;
  type: 'line';
  points: number[];
  color: string;
  strokeWidth: number;
}

interface RectShape {
  id: string;
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

type CanvasObject = DrawLine | RectShape;

interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
}

interface RoomUser {
  id: string;
  name: string;
}

export default function Whiteboard() {
  const { boardId } = useParams<{ boardId: string }>();
  const socketRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const currentLineRef = useRef<number[]>([]);

  const [tool, setTool] = useState<'pen' | 'rectangle'>('pen');
  const [color, setColor] = useState('#00d4ff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [undoStack, setUndoStack] = useState<CanvasObject[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasObject[][]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingRect, setDrawingRect] = useState<RectShape | null>(null);

  // Expose getCanvasAsJSON on window for testing
  useEffect(() => {
    (window as any).getCanvasAsJSON = () => {
      return JSON.parse(JSON.stringify(objects));
    };
  }, [objects]);

  // Setup socket
  useEffect(() => {
    if (!boardId) return;

    const socket = io(BACKEND_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinRoom', { boardId });
    });

    socket.on('roomUsers', ({ users }: { users: RoomUser[] }) => {
      setRoomUsers(users);
    });

    socket.on('cursorUpdate', ({ userId, x, y }: RemoteCursor) => {
      setRemoteCursors(prev => ({ ...prev, [userId]: { userId, x, y } }));
    });

    socket.on('drawUpdate', (data: DrawLine) => {
      setObjects(prev => [...prev, data]);
    });

    socket.on('objectAdded', (data: RectShape) => {
      setObjects(prev => [...prev, data]);
    });

    // Load board from API
    fetch(`${BACKEND_URL}/api/boards/${boardId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.objects) setObjects(data.objects);
      })
      .catch(() => {});

    return () => {
      socket.disconnect();
    };
  }, [boardId]);

  const saveToUndoStack = useCallback((currentObjects: CanvasObject[]) => {
    setUndoStack(prev => [...prev, currentObjects]);
    setRedoStack([]);
  }, []);

  const handleUndo = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const lastState = newStack.pop()!;
      setRedoStack(r => [...r, objects]);
      setObjects(lastState);
      return newStack;
    });
  };

  const handleRedo = () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const nextState = newStack.pop()!;
      setUndoStack(u => [...u, objects]);
      setObjects(nextState);
      return newStack;
    });
  };

  const handleMouseDown = (e: any) => {
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;

    if (tool === 'pen') {
      isDrawingRef.current = true;
      currentLineRef.current = [pos.x, pos.y];
    } else if (tool === 'rectangle') {
      setRectStart(pos);
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Emit cursor position
    socketRef.current?.emit('cursorMove', { x: pos.x, y: pos.y });

    if (tool === 'pen' && isDrawingRef.current) {
      currentLineRef.current = [...currentLineRef.current, pos.x, pos.y];

      const lineData: DrawLine = {
        id: `line-${Date.now()}`,
        type: 'line',
        points: currentLineRef.current,
        color,
        strokeWidth,
      };

      socketRef.current?.emit('draw', lineData);
    }

    if (tool === 'rectangle' && rectStart) {
      setDrawingRect({
        id: 'drawing-rect',
        type: 'rectangle',
        x: Math.min(pos.x, rectStart.x),
        y: Math.min(pos.y, rectStart.y),
        width: Math.abs(pos.x - rectStart.x),
        height: Math.abs(pos.y - rectStart.y),
        fill: color,
      });
    }
  };

  const handleMouseUp = (e: any) => {
    const pos = e.target.getStage().getPointerPosition();

    if (tool === 'pen' && isDrawingRef.current) {
      isDrawingRef.current = false;
      const newLine: DrawLine = {
        id: `line-${Date.now()}`,
        type: 'line',
        points: currentLineRef.current,
        color,
        strokeWidth,
      };
      saveToUndoStack(objects);
      setObjects(prev => [...prev, newLine]);
      socketRef.current?.emit('draw', newLine);
      currentLineRef.current = [];
    }

    if (tool === 'rectangle' && rectStart && pos) {
      const newRect: RectShape = {
        id: `rect-${Date.now()}`,
        type: 'rectangle',
        x: Math.min(pos.x, rectStart.x),
        y: Math.min(pos.y, rectStart.y),
        width: Math.abs(pos.x - rectStart.x),
        height: Math.abs(pos.y - rectStart.y),
        fill: color,
      };
      saveToUndoStack(objects);
      setObjects(prev => [...prev, newRect]);
      socketRef.current?.emit('addObject', newRect);
      setRectStart(null);
      setDrawingRect(null);
    }
  };

  const handleSave = async () => {
    if (!boardId) return;
    await fetch(`${BACKEND_URL}/api/boards/${boardId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ objects }),
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 bg-gray-800 border-b border-gray-700">
        <span className="text-cyan-400 font-bold text-lg">CollabBoard</span>

        <button
          data-testid="tool-pen"
          onClick={() => setTool('pen')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${tool === 'pen' ? 'bg-cyan-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          ✏️ Pen
        </button>

        <button
          data-testid="tool-rectangle"
          onClick={() => setTool('rectangle')}
          className={`px-3 py-1.5 rounded text-sm font-medium ${tool === 'rectangle' ? 'bg-cyan-500 text-black' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          ▭ Rectangle
        </button>

        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
          title="Color"
        />

        <input
          type="range"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={e => setStrokeWidth(Number(e.target.value))}
          className="w-24"
          title="Brush size"
        />

        <button
          data-testid="undo-button"
          onClick={handleUndo}
          className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600"
        >
          ↩ Undo
        </button>

        <button
          data-testid="redo-button"
          onClick={handleRedo}
          className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600"
        >
          ↪ Redo
        </button>

        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded text-sm bg-cyan-600 hover:bg-cyan-500 ml-auto"
        >
          💾 Save
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <Stage
            width={window.innerWidth - 200}
            height={window.innerHeight - 60}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ background: '#1a1a2e', cursor: 'crosshair' }}
          >
            <Layer>
              {objects.map((obj) => {
                if (obj.type === 'line') {
                  return (
                    <Line
                      key={obj.id}
                      points={obj.points}
                      stroke={obj.color}
                      strokeWidth={obj.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                    />
                  );
                }
                if (obj.type === 'rectangle') {
                  return (
                    <Rect
                      key={obj.id}
                      x={obj.x}
                      y={obj.y}
                      width={obj.width}
                      height={obj.height}
                      fill={obj.fill}
                      opacity={0.7}
                    />
                  );
                }
                return null;
              })}

              {/* Drawing rectangle preview */}
              {drawingRect && (
                <Rect
                  x={drawingRect.x}
                  y={drawingRect.y}
                  width={drawingRect.width}
                  height={drawingRect.height}
                  fill={drawingRect.fill}
                  opacity={0.5}
                />
              )}
            </Layer>
          </Stage>

          {/* Remote cursors */}
          {Object.values(remoteCursors).map(cursor => (
            <div
              key={cursor.userId}
              data-testid="remote-cursor"
              style={{
                position: 'absolute',
                left: cursor.x,
                top: cursor.y,
                pointerEvents: 'none',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-3 h-3 bg-pink-500 rounded-full border-2 border-white" />
              <span className="text-xs text-pink-400 bg-gray-900 px-1 rounded">
                {cursor.userId.substring(0, 4)}
              </span>
            </div>
          ))}
        </div>

        {/* Sidebar - Users */}
        <div className="w-48 bg-gray-800 border-l border-gray-700 p-3">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Active Users</h3>
          <div data-testid="user-list" className="space-y-1">
            {roomUsers.map(user => (
              <div key={user.id} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-gray-300 truncate">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}