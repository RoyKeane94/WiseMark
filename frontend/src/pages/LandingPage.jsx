import { Link } from 'react-router-dom';
import { text, bg, border, btnPrimary } from '../lib/theme';

export default function LandingPage() {
  return (
    <div className={`min-h-screen ${bg.page} ${text.body}`}>
      <nav
        className={`fixed top-0 left-0 right-0 z-10 h-[52px] px-6 flex items-center justify-between border-b ${border.default} ${bg.surface}`}
      >
        <div className={`flex items-center gap-2 text-sm font-semibold ${text.heading}`}>
          <div
            className={`w-5 h-5 rounded-md ${bg.primary} flex items-center justify-center text-[10px] font-bold text-white`}
          >
            W
          </div>
          WiseMark
        </div>
        <Link
          to="/login"
          className={`${btnPrimary} no-underline text-sm py-1.5 px-3.5 rounded-md`}
        >
          Request access
        </Link>
      </nav>

      <section className="landing-hero pt-[200px] pb-40 px-6 max-w-[680px] mx-auto text-center">
        <h1
          className={`text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight tracking-tight ${text.heading} mb-5`}
        >
          Never read the
          <br />
          same page <em className="landing-twice">twice</em>
        </h1>
        <p
          className={`text-base leading-relaxed max-w-[400px] mx-auto mb-9 ${text.muted}`}
        >
          PDF annotations for private equity. Highlight once, find it forever — without your deal docs ever leaving your device.
        </p>
        <Link
          to="/register"
          className={`${btnPrimary} inline-flex items-center gap-2 py-2.5 px-5 rounded-lg text-sm font-semibold no-underline hover:opacity-90`}
        >
          Get early access
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </Link>
      </section>

      <section
        className={`landing-features max-w-[560px] mx-auto px-6 pb-40 flex flex-col border-t ${border.default}`}
      >
        {[
          {
            label: 'Highlight and comment',
            desc: 'Colour-coded annotations with notes, right on the original PDF',
          },
          {
            label: 'Organise by deal',
            desc: 'Group documents by project so nothing gets lost between deals',
          },
          {
            label: 'Search every annotation',
            desc: 'Across every deal, every document, in seconds',
          },
          {
            label: 'Export everything',
            desc: 'Notes and excerpts as structured Word docs or PDFs',
          },
          {
            label: 'NDA & GDPR compliant',
            desc: 'Your PDFs never touch a server. Only your notes sync',
          },
        ].map(({ label, desc }) => (
          <div
            key={label}
            className={`flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 py-5 border-b ${border.default}`}
          >
            <span className={`text-sm font-medium ${text.heading}`}>{label}</span>
            <span className={`text-sm sm:text-right sm:max-w-[240px] ${text.muted}`}>
              {desc}
            </span>
          </div>
        ))}
      </section>

      <footer
        className={`py-6 px-6 border-t ${border.default} text-center text-xs ${text.muted}`}
      >
        &copy; 2026 WiseMark
      </footer>

      <style>{`
        @keyframes landingFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-hero { animation: landingFade 0.8s ease both; }
        .landing-features { animation: landingFade 0.8s ease 0.2s both; }
        .landing-twice {
          font-style: italic;
          background: linear-gradient(135deg, #475569 0%, #2563eb 50%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </div>
  );
}
