import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 bg-toolbar border-b border-border">
        <span className="text-2xl font-bold text-primary font-mono">CollabWhiteboard</span>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-white transition"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-8 py-24 text-center">
        <h1 className="text-6xl font-bold mb-6 leading-tight">
          Think together,{' '}
          <span className="text-primary">draw together</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          A real-time collaborative whiteboard for teams. Sketch ideas, draw diagrams,
          and brainstorm together — no matter where you are.
        </p>
        <button
          onClick={() => navigate('/auth')}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:opacity-90 transition"
        >
          Start Collaborating →
        </button>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: '✏️',
            title: 'Freehand Drawing',
            desc: 'Natural pen tool with adjustable brush size and colors',
          },
          {
            icon: '👥',
            title: 'Live Collaboration',
            desc: "See everyone's cursors and changes in real time",
          },
          {
            icon: '⚡',
            title: 'Instant Sync',
            desc: 'Changes propagate instantly to all connected users',
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-card border border-border rounded-2xl p-8 hover:border-primary transition"
          >
            <div className="text-4xl mb-4">{f.icon}</div>
            <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
            <p className="text-muted-foreground text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Index;