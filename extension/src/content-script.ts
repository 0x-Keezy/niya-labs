// Niya Tools — content script
// Runs on DexScreener, PancakeSwap, Four.meme and GMGN. Detects the token
// contract address from the current URL (primary) or page DOM (fallback for
// GMGN) and pushes it to the background service worker.

import type { BgMessage, DetectedAddress, HostSite } from './lib/types';

const BSC_ADDRESS_RE = /0x[a-fA-F0-9]{40}/;

function detectSite(host: string): HostSite {
  if (host.endsWith('dexscreener.com')) return 'dexscreener';
  if (host.endsWith('pancakeswap.finance')) return 'pancakeswap';
  if (host.endsWith('four.meme')) return 'fourmeme';
  if (host.endsWith('gmgn.ai')) return 'gmgn';
  return 'unknown';
}

function extractCaFromUrl(url: URL, site: HostSite): string | null {
  if (site === 'dexscreener') {
    const pathMatch = url.pathname.match(BSC_ADDRESS_RE);
    if (pathMatch) return pathMatch[0].toLowerCase();
  }

  if (site === 'pancakeswap') {
    for (const param of ['outputCurrency', 'inputCurrency']) {
      const v = url.searchParams.get(param);
      if (v && BSC_ADDRESS_RE.test(v)) return v.toLowerCase();
    }
    const pathMatch = url.pathname.match(BSC_ADDRESS_RE);
    if (pathMatch) return pathMatch[0].toLowerCase();
  }

  if (site === 'fourmeme') {
    const pathMatch = url.pathname.match(BSC_ADDRESS_RE);
    if (pathMatch) return pathMatch[0].toLowerCase();
  }

  if (site === 'gmgn') {
    if (url.pathname.includes('/bsc/') || url.pathname.includes('/bnb/')) {
      const pathMatch = url.pathname.match(BSC_ADDRESS_RE);
      if (pathMatch) return pathMatch[0].toLowerCase();
    }
    // URL might not contain the address (GMGN SPA navigation); caller
    // falls through to DOM extraction.
    return null;
  }

  // Fallback: any 0x… found anywhere in the URL.
  const fallback = url.href.match(BSC_ADDRESS_RE);
  return fallback ? fallback[0].toLowerCase() : null;
}

/**
 * DOM-based fallback for GMGN. Searches for BSCScan links or the token
 * address displayed in the page header. Only called when URL extraction
 * fails (GMGN SPA navigation sometimes doesn't update the URL path).
 */
function extractCaFromDom(site: HostSite): string | null {
  if (site !== 'gmgn') return null;
  try {
    // 1. document.title — GMGN often puts the token address in the page title.
    const titleMatch = document.title.match(BSC_ADDRESS_RE);
    if (titleMatch) return titleMatch[0].toLowerCase();

    // 2. Copy buttons / data attributes that hold the full address.
    const copyEls = document.querySelectorAll(
      '[data-clipboard-text], [data-address], [data-copy], [data-value]',
    );
    for (const el of copyEls) {
      for (const attr of ['data-clipboard-text', 'data-address', 'data-copy', 'data-value']) {
        const val = el.getAttribute(attr) ?? '';
        const match = val.match(BSC_ADDRESS_RE);
        if (match) return match[0].toLowerCase();
      }
    }

    // 3. Links to any block explorer (*scan.com, 4scan, etc.)
    const links = document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="scan.com/token/0x"], a[href*="scan.com/address/0x"], a[href*="4scan"]',
    );
    for (const link of links) {
      const match = link.href.match(BSC_ADDRESS_RE);
      if (match) return match[0].toLowerCase();
    }

    // 4. Elements whose title or aria-label contain a full BSC address.
    const titled = document.querySelectorAll('[title*="0x"], [aria-label*="0x"]');
    for (const el of titled) {
      const val = el.getAttribute('title') ?? el.getAttribute('aria-label') ?? '';
      const match = val.match(BSC_ADDRESS_RE);
      if (match) return match[0].toLowerCase();
    }

    // 5. Broad scan — any element with short text that IS a BSC address.
    const candidates = document.querySelectorAll('span, div, a, p, button');
    for (const el of candidates) {
      const text = el.textContent?.trim() ?? '';
      if (text.length >= 42 && text.length <= 50) {
        const match = text.match(BSC_ADDRESS_RE);
        if (match) return match[0].toLowerCase();
      }
    }
  } catch {
    // DOM access can fail in edge cases; silently ignore.
  }
  return null;
}

function sendCa(ca: string, site: HostSite): void {
  const payload: DetectedAddress = {
    ca,
    source: site,
    detectedAt: Date.now(),
  };
  const msg: BgMessage = { type: 'ca-detected', payload };
  chrome.runtime.sendMessage(msg).catch((err) => {
    console.debug('[Niya Tools] sendMessage failed:', err);
  });
}

let lastCa: string | null = null;
let lastUrl = '';

function scan(): void {
  try {
    const currentUrl = window.location.href;
    const url = new URL(currentUrl);
    const site = detectSite(url.hostname);
    if (site === 'unknown') return;

    // When the URL changes, reset lastCa so we re-evaluate even if the
    // extracted CA happens to be the same (e.g. hash-only change).
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      lastCa = null;
    }

    let ca = extractCaFromUrl(url, site);

    // GMGN DOM fallback — SPA navigation often doesn't update the URL path.
    // Also prefer DOM-detected CA over URL CA because GMGN can show a
    // different token than what's in the URL after SPA navigation.
    if (site === 'gmgn') {
      const domCa = extractCaFromDom(site);
      if (domCa) ca = domCa;
    }

    if (!ca || ca === lastCa) return;

    lastCa = ca;
    console.log('[Niya Tools] CA detected:', ca, 'on', site);
    sendCa(ca, site);
  } catch (err) {
    console.debug('[Niya Tools] scan error:', err);
  }
}

// Initial detection when the content script loads.
scan();

// Re-scan on client-side route changes (pushState, replaceState, popstate).
const origPushState = history.pushState;
history.pushState = function (...args) {
  const ret = origPushState.apply(this, args);
  setTimeout(scan, 50);
  return ret;
};

const origReplaceState = history.replaceState;
history.replaceState = function (...args) {
  const ret = origReplaceState.apply(this, args);
  setTimeout(scan, 50);
  return ret;
};

window.addEventListener('popstate', () => setTimeout(scan, 50));
window.addEventListener('hashchange', () => setTimeout(scan, 50));

// Safety net: periodic scan (1s) for sites that mutate URL in unusual ways
// or where navigation doesn't trigger history events (GMGN SPA).
setInterval(scan, 1000);

// Title observer — GMGN updates the page title on SPA navigation, which
// is a reliable signal that the viewed token changed.
try {
  const titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(() => setTimeout(scan, 100)).observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
} catch {
  // MutationObserver not available or title element missing; ignore.
}
