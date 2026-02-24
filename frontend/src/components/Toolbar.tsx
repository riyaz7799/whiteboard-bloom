import { useCanvasStore, type Tool } from '@/stores/canvasStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Pencil, Square, MousePointer, Eraser, Undo2, Redo2, Trash2, Save,
} from 'lucide-react';
import { motion } from 'framer-motion';

const COLORS = [
  '#22d3ee', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6',
  '#ec4899', '#f97316', '#eab308', '#ffffff', '#94a3b8',
];

interface ToolbarProps {
  onSave?: () => void;
  saving?: boolean;
}

const Toolbar = ({ onSave, saving }: ToolbarProps) => {
  const { tool, setTool, color, setColor, strokeWidth, setStrokeWidth, undo, redo, clearCanvas, undoStack, redoStack } = useCanvasStore();

  const tools: { id: Tool; icon: typeof Pencil; label: string; testId?: string }[] = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'rectangle', icon: Square, label: 'Rectangle', testId: 'tool-rectangle' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 glass rounded-xl px-3 py-2"
    >
      {/* Tools */}
      <div className="flex items-center gap-1">
        {tools.map(({ id, icon: Icon, label, testId }) => (
          <Button
            key={id}
            variant={tool === id ? 'default' : 'ghost'}
            size="icon"
            className="h-9 w-9"
            onClick={() => setTool(id)}
            title={label}
            data-testid={testId}
          >
            <Icon className="w-4 h-4" />
          </Button>
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${
              color === c ? 'border-foreground scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Stroke width */}
      <div className="flex items-center gap-2 min-w-[80px]">
        <Slider
          value={[strokeWidth]}
          onValueChange={(v) => setStrokeWidth(v[0])}
          min={1}
          max={20}
          step={1}
          className="w-20"
        />
        <span className="text-xs text-muted-foreground w-4">{strokeWidth}</span>
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={undo}
          disabled={undoStack.length === 0}
          data-testid="undo-button"
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={redo}
          disabled={redoStack.length === 0}
          data-testid="redo-button"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={clearCanvas}
          title="Clear"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        {onSave && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onSave}
            disabled={saving}
            title="Save"
          >
            <Save className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default Toolbar;
