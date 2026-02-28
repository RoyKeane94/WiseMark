export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#2d3a52' }}>
      <div
        className="w-full max-w-[400px] bg-white rounded-xl p-12 pb-11"
        style={{ animation: 'fadeUp 0.4s ease both', fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="flex items-center gap-2 mb-9">
          <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-white text-xs font-semibold shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            W
          </div>
          <span className="text-[1.05rem] font-medium text-[#1a1f2e]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            WiseMark
          </span>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
