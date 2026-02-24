import { motion } from 'framer-motion';

interface RemoteCursor {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

interface ActiveUsersProps {
  users: RemoteCursor[];
}

const CURSOR_COLORS = [
  '#22d3ee', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6',
  '#ec4899', '#f97316', '#eab308',
];

export const getCursorColor = (index: number) => CURSOR_COLORS[index % CURSOR_COLORS.length];

const ActiveUsers = ({ users }: ActiveUsersProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 right-4 z-20 glass rounded-xl p-3"
      data-testid="user-list"
    >
      <p className="text-xs text-muted-foreground mb-2 font-medium">Online ({users.length})</p>
      <div className="space-y-1.5">
        {users.map((u) => (
          <div key={u.userId} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: u.color }}
            />
            <span className="text-xs text-foreground/80 truncate max-w-[100px]">{u.name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default ActiveUsers;

export const RemoteCursors = ({ cursors }: { cursors: RemoteCursor[] }) => {
  return (
    <>
      {cursors.map((cursor) => (
        <motion.div
          key={cursor.userId}
          className="absolute pointer-events-none z-30"
          data-testid="remote-cursor"
          animate={{ x: cursor.x, y: cursor.y }}
          transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <path
              d="M0 0L16 12H6L0 20V0Z"
              fill={cursor.color}
            />
          </svg>
          <span
            className="absolute top-5 left-3 text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
            style={{ backgroundColor: cursor.color, color: '#000' }}
          >
            {cursor.name}
          </span>
        </motion.div>
      ))}
    </>
  );
};
