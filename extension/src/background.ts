// Niya Tools — background service worker (MV3)
// Responsibilities:
//   1. Open the side panel when the toolbar action is clicked.
//   2. Receive ca-detected messages from the content script and cache the
//      last known address per tab.
//   3. Respond to get-current-ca requests from the side panel so it can
//      display the CA the user is currently looking at.
//
// As of Day 7.6 there is no wallet bridge — the side panel asks the user to
// paste their address directly. See WalletConnect.tsx.

import type { BgMessage, DetectedAddress, HostSite } from './lib/types';

// BSC address regex — mirrored from content-script.ts. Kept duplicated on
// purpose: the service worker cannot import content-script code, and a
// third "shared" module would just be 20 lines of ceremony around one regex.
// If you change this, change content-script.ts too. See Día 7.9.
const BSC_ADDRESS_RE = /0x[a-fA-F0-9]{40}/;

function detectSiteFromHost(host: string): HostSite {
  if (host.endsWith('dexscreener.com')) return 'dexscreener';
  if (host.endsWith('pancakeswap.finance')) return 'pancakeswap';
  if (host.endsWith('four.meme')) return 'fourmeme';
  if (host.endsWith('gmgn.ai')) return 'gmgn';
  return 'unknown';
}

/**
 * Derive a DetectedAddress directly from a tab URL. Used as a fallback in
 * `get-current-ca` when the content script has not yet scanned (it runs at
 * document_idle, which can lag 1-3 seconds behind side panel open on heavy
 * SPAs like DexScreener and GMGN). This eliminates the "first token of a
 * session looks empty" race without changing the preferred live-update path
 * (content script → `ca-detected` → broadcast). See Día 7.9.
 */
function extractCaFromTabUrl(tabUrl: string | undefined): DetectedAddress | null {
  if (!tabUrl) return null;
  let url: URL;
  try {
    url = new URL(tabUrl);
  } catch {
    return null;
  }
  const site = detectSiteFromHost(url.hostname);
  if (site === 'unknown') return null;

  // GMGN mixes BSC / Solana / Ethereum under the same host. Only /bsc/ paths
  // are in-scope for this extension — addresses on other chains look like
  // BSC hex strings but belong to different networks.
  if (site === 'gmgn' && !url.pathname.startsWith('/bsc/')) return null;

  // PancakeSwap exposes the token via query params on the swap page.
  if (site === 'pancakeswap') {
    for (const param of ['outputCurrency', 'inputCurrency']) {
      const v = url.searchParams.get(param);
      if (v && BSC_ADDRESS_RE.test(v)) {
        return { ca: v.toLowerCase(), source: site, detectedAt: Date.now() };
      }
    }
  }

  const pathMatch = url.pathname.match(BSC_ADDRESS_RE);
  if (pathMatch) {
    return { ca: pathMatch[0].toLowerCase(), source: site, detectedAt: Date.now() };
  }
  return null;
}

// Open the side panel on action click.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[Niya Tools] setPanelBehavior failed:', err));

// Per-tab cache of the last detected address. We key by tab id because a user
// may have DexScreener and PancakeSwap open in two tabs looking at different
// tokens — the side panel should show whichever is active.
const tabCa: Map<number, DetectedAddress> = new Map();

chrome.runtime.onMessage.addListener(
  (msg: BgMessage, sender, sendResponse) => {
    if (msg.type === 'ca-detected') {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        tabCa.set(tabId, msg.payload);
        console.log(
          '[Niya Tools bg] cached CA for tab',
          tabId,
          msg.payload.ca,
          '(' + msg.payload.source + ')',
        );
      }
      // Broadcast to any open side panel so it can refresh live when the
      // user navigates inside the same tab. Without this, the side panel
      // only learns of new CAs via the initial `get-current-ca` (on mount)
      // or the `tabs.onActivated` handler (tab switch) — so same-tab SPA
      // navigations were silently dropped. Fixes GMGN + latent bug on all
      // hosts. See Día 7.8.
      chrome.runtime
        .sendMessage({ type: 'current-ca', payload: msg.payload } satisfies BgMessage)
        .catch(() => {
          // No side panel open — fine, ignore.
        });
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'get-current-ca') {
      // The side panel asks which CA the currently active tab is on.
      chrome.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => {
          const tab = tabs[0];
          if (!tab?.id) {
            sendResponse({ type: 'current-ca', payload: null } satisfies BgMessage);
            return;
          }

          // 1. Cache hit — the content script has already scanned this tab.
          const cached = tabCa.get(tab.id);
          if (cached) {
            sendResponse({ type: 'current-ca', payload: cached } satisfies BgMessage);
            return;
          }

          // 2. Cache miss — derive the CA directly from the tab URL. Fixes
          // the race where the side panel opens before content-script scan()
          // has run on first load. Also warms the cache so subsequent reads
          // (and the broadcast path) agree on the same value. See Día 7.9.
          const fallback = extractCaFromTabUrl(tab.url);
          if (fallback) {
            tabCa.set(tab.id, fallback);
            console.log(
              '[Niya Tools bg] tab.url fallback detected CA',
              fallback.ca,
              'for tab',
              tab.id,
              '(' + fallback.source + ')',
            );
          }
          sendResponse({ type: 'current-ca', payload: fallback } satisfies BgMessage);
        })
        .catch((err) => {
          console.error('[Niya Tools bg] get-current-ca failed:', err);
          sendResponse({ type: 'current-ca', payload: null } satisfies BgMessage);
        });
      return true; // keep the message channel open for async sendResponse
    }

    return false;
  },
);

// Evict tab cache entries when a tab is closed.
chrome.tabs.onRemoved.addListener((tabId) => {
  tabCa.delete(tabId);
});

// Also push a fresh update to the side panel when the active tab changes
// so the panel reflects whatever the user switched to.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  const payload = tabCa.get(tabId) ?? null;
  chrome.runtime
    .sendMessage({ type: 'current-ca', payload } satisfies BgMessage)
    .catch(() => {
      // No side panel open — that's fine, ignore.
    });
});

console.log('[Niya Tools bg] service worker booted');
