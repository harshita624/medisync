"use client";

const BACKEND = process.env.NEXT_PUBLIC_API_URL?.replace("/api","") || "http://localhost:5000";

export default function SocialAuth({ label = "Continue" }) {
  const handleGoogle = () => {
    window.location.href = `${BACKEND}/api/auth/google`;
  };

  return (
    <div className="space-y-3">
      <button onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all font-medium text-slate-700 text-sm">
        {/* Google SVG */}
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.2 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 10-1.9 13.6-5.1l-6.3-5.2C29.5 35.5 26.9 36 24 36c-5.2 0-9.6-2.9-11.3-7L6 33.7C9.3 39.6 16.1 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.3 5.2C41.3 35.3 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
        </svg>
        {label} with Google
      </button>
    </div>
  );
}