const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const Auth = () => {
  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google`;
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-6 shadow-2xl w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary font-mono mb-2">CollabWhiteboard</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to start collaborating on whiteboards in real-time.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl hover:bg-gray-100 transition shadow-lg"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>

        <p className="text-xs text-muted-foreground text-center">
          By signing in, you agree to collaborate responsibly.
        </p>
      </div>
    </div>
  );
};

export default Auth;