import { useEffect, useState } from 'react';
import WalletConnect from '../common/WalletConnect';

/**
 * Resolve the logo URL. Inside a Chrome extension runtime we need
 * `chrome.runtime.getURL`; in Vite dev mode we fall back to `/niya-logo.png`.
 */
function useLogoUrl(): string {
  const [url, setUrl] = useState('/niya-logo.png');

  useEffect(() => {
    try {
      if (chrome?.runtime?.getURL) {
        setUrl(chrome.runtime.getURL('niya-logo.png'));
      }
    } catch {
      // Not running inside an extension context (Vite dev); keep fallback.
    }
  }, []);

  return url;
}

export default function TopBar() {
  const logoUrl = useLogoUrl();

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
            <span style={{ color: '#D67A67' }}>Tools</span>
          </span>
        </div>
      </div>

      {/* -------- RIGHT: tier chip -------- */}
      <WalletConnect />
    </header>
  );
}
