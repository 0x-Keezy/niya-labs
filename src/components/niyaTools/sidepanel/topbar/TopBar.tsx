import clsx from 'clsx';
import WalletConnect from '../common/WalletConnect';
import { useNiyaStore } from '../store';
import type { Tier } from '../../lib/types';

// Web port: the Next.js app serves the logo from /public directly. No need
// for chrome.runtime.getURL fallback since this never runs inside the
// extension runtime.
const LOGO_URL = '/niya-logo.png';

// Full labels en md+, iniciales en mobile para que el selector siga
// siendo usable en phones sin ocupar ancho de cliff.
const TIER_OPTIONS: { value: Tier; short: string; label: string }[] = [
  { value: 'scout',   short: 'S', label: 'Scout' },
  { value: 'analyst', short: 'A', label: 'Analyst' },
  { value: 'pro',     short: 'P', label: 'Pro' },
];

/* Tier selector — web-only demo affordance. Lets users (and hackathon
   judges) flip between the three disclosure tiers to see what each
   unlocks. In production this mirrors what a real wallet-age lookup
   would compute, so it works as both a debug tool and a pitch asset.

   Responsive: labels iniciales en mobile (`S`/`A`/`P`), completas en md+. */
function TierSelector() {
  const { tier, setTier } = useNiyaStore();
  return (
    <div
      className="flex items-center gap-0.5 rounded-full border p-0.5"
      style={{
        borderColor: '#EACDA0',
        backgroundColor: '#FFFBF5',
      }}
      title="Preview each progressive-disclosure tier"
    >
      {TIER_OPTIONS.map((opt) => {
        const active = tier === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTier(opt.value)}
            title={opt.label}
            className={clsx(
              'rounded-full px-2 md:px-2.5 py-1 text-[9px] md:text-[9px] font-bold uppercase tracking-[0.14em] transition-colors',
              active
                ? 'text-white'
                : 'text-niya-ink-3 hover:text-niya-ink',
            )}
            style={
              active
                ? { backgroundColor: '#856292' }
                : undefined
            }
          >
            <span className="md:hidden">{opt.short}</span>
            <span className="hidden md:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TopBar() {
  const logoUrl = LOGO_URL;

  return (
    <header
      className="flex items-center justify-between"
      style={{
        padding: '16px 20px',
        borderBottom: '1.5px dashed #F0D9B0',
        background: 'linear-gradient(180deg, #FFF5E8 0%, #FFFBF5 100%)',
      }}
    >
      {/* -------- LEFT: brand mark + wordmark -------- */}
      <div className="flex items-center gap-3">
        {/* brand mark */}
        <div
          className="relative shrink-0 flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
          }}
        >
          <img
            src={logoUrl}
            alt="Niya"
            className="pointer-events-none select-none"
            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 14 }}
          />

          {/* tiny tan dot — top-right corner */}
          <span
            className="absolute"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#F5DCB8',
              border: '1.5px solid #E8C899',
              top: -3,
              right: -3,
            }}
          />
        </div>

        {/* wordmark stack */}
        <div className="flex flex-col justify-center" style={{ gap: 1 }}>
          <span
            className="font-body text-niya-ink-3 uppercase select-none"
            style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', lineHeight: 1.2 }}
          >
            Niya Labs
          </span>
          <span
            className="font-display text-niya-ink select-none"
            style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}
          >
            Niya{' '}
            <span style={{ color: '#C9A86C' }}>Tools</span>
          </span>
        </div>
      </div>

      {/* -------- RIGHT: tier selector + wallet chip -------- */}
      <div className="flex items-center gap-3">
        <TierSelector />
        <WalletConnect />
      </div>
    </header>
  );
}
