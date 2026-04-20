// Niya Tools — web port of the Chrome extension side panel.
//
// The extension's side panel auto-detects CAs from DexScreener/PancakeSwap/
// Four.meme/GMGN URLs via a content script. On the web we don't have that
// affordance, so we expose a manual input (paste a token address) plus a
// URL query param (`?ca=0x…&source=fourmeme`) that deep-links from the
// landing or external references.
//
// This page goes through the same taste-skill design pass as the landing:
//   - Outfit display font for the H1 (loaded globally in _document.tsx)
//   - Warm brown text (niya.ink = #6B5344) instead of cold black
//   - Tan/gold accent instead of coral
//   - Signature multi-layer Frame wrap on the analyzer card
//   - Asymmetric 7/5 hero — input on the left, trust/stats on the right
//   - Editorial whitespace (py-12 instead of py-6)
//   - Ambient sparkles + slow motion to match the landing's mood

import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { HostSite } from "@/components/niyaTools/lib/types";

// The full side-panel UI ships lightweight-charts (~300 KB). Load it only
// on the client so the initial paint is fast.
const NiyaToolsApp = dynamic(
  () => import("@/components/niyaTools/sidepanel/App"),
  { ssr: false, loading: () => <AppLoading /> },
);

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const VALID_SOURCES: HostSite[] = [
  "dexscreener",
  "pancakeswap",
  "fourmeme",
  "gmgn",
  "unknown",
];

// Local brand tokens. Kept here so the page is self-contained and can be
// read without jumping to index.tsx — palette matches the landing.
const BRAND = {
  cream: "#FDF5E8",
  bone: "#FFFBF5",
  tanFill: "#E8D4A8",
  tanDeep: "#C9A86C",
  text: "#6B5344",
  textMuted: "#7A6450",
  textSubtle: "#9B8570",
  goldDeep: "#B8913F",
};

/* Multi-layer Frame — mirrors `Frame` in index.tsx. Outer tan fill with
   rounded corners + inner cream layer with gold dashed border. This is
   the signature card treatment across the whole site. */
function Frame({
  children,
  rounded = "22px",
  innerRounded = "18px",
  className = "",
}: {
  children: React.ReactNode;
  rounded?: string;
  innerRounded?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: BRAND.tanFill,
        borderRadius: rounded,
        padding: 6,
      }}
    >
      <div
        className="h-full"
        style={{
          background: BRAND.bone,
          borderRadius: innerRounded,
          border: `2px dashed ${BRAND.tanDeep}`,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* Ambient gold sparkles in the background — same treatment as the
   landing's AmbientBackdrop but lighter (6 sparkles, no blobs). Uses the
   `.niya-sparkle` CSS class already defined in globals.css. */
function AmbientSparkles() {
  const sparkles = [
    { top: "8%",  left: "6%",  size: 12, delay: "0s"    },
    { top: "22%", left: "88%", size: 10, delay: "1.5s"  },
    { top: "45%", left: "3%",  size: 14, delay: "3s"    },
    { top: "68%", left: "92%", size: 9,  delay: "4.5s"  },
    { top: "82%", left: "10%", size: 11, delay: "6s"    },
    { top: "35%", left: "50%", size: 8,  delay: "7.5s"  },
  ];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="niya-sparkle"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animation: `niya-sparkle-drift ${14 + i * 2}s ease-in-out infinite`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

function AppLoading() {
  return (
    <div
      className="flex h-full items-center justify-center p-10 text-sm"
      style={{ color: BRAND.textMuted }}
    >
      Loading analyzer…
    </div>
  );
}

export default function NiyaToolsPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [ca, setCa] = useState<string | null>(null);
  const [source, setSource] = useState<HostSite>("unknown");
  const [inputError, setInputError] = useState<string | null>(null);

  // Read initial CA + source from the URL (?ca=0x..&source=fourmeme).
  // Runs once router is ready so we don't clobber user input on nav.
  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.ca;
    const rawSource = router.query.source;
    const caStr = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
    const srcStr =
      typeof rawSource === "string"
        ? rawSource
        : Array.isArray(rawSource)
          ? rawSource[0]
          : null;
    if (caStr && ADDRESS_RE.test(caStr)) {
      setCa(caStr.toLowerCase());
      setInput(caStr);
    }
    if (srcStr && (VALID_SOURCES as string[]).includes(srcStr)) {
      setSource(srcStr as HostSite);
    }
  }, [router.isReady, router.query.ca, router.query.source]);

  const handleAnalyze = () => {
    setInputError(null);
    const trimmed = input.trim();
    if (!trimmed) {
      setInputError("Paste a token address first.");
      return;
    }
    if (!ADDRESS_RE.test(trimmed)) {
      setInputError(
        "That doesn't look like a BNB Chain address (expected 0x + 40 hex characters).",
      );
      return;
    }
    const normalized = trimmed.toLowerCase();
    setCa(normalized);
    // Keep the URL in sync so users can share the analysis link.
    void router.replace(
      { pathname: "/tools", query: { ca: normalized, ...(source !== "unknown" ? { source } : {}) } },
      undefined,
      { shallow: true },
    );
  };

  return (
    <>
      <Head>
        <title>Niya Tools — BNB Chain microstructure analyzer</title>
        <meta
          name="description"
          content="Paste a BNB Chain token address and Niya tells you the rug risk — holders, LP lock, snipers, honeypot flags — narrated as readable sentences."
        />
        <meta property="og:title" content="Niya Tools" />
        <meta
          property="og:description"
          content="Memecoin microstructure analyzer for BNB Chain. No install, no sign-up."
        />
      </Head>

      <div
        className="relative min-h-[100dvh]"
        style={{ backgroundColor: BRAND.cream }}
      >
        <AmbientSparkles />

        {/* ── Top strip: breadcrumb back to landing ────────────────── */}
        <div
          className="relative z-10 border-b"
          style={{
            borderColor: `${BRAND.tanFill}80`,
            backgroundColor: BRAND.bone,
          }}
        >
          <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[110rem] 3xl:max-w-[130rem] items-center justify-between px-4 py-3 md:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm transition-colors"
              style={{ color: BRAND.textMuted }}
            >
              <span aria-hidden>←</span>
              <span className="font-body font-semibold">Niya Labs</span>
            </Link>
            <Link
              href="/companion"
              className="text-xs transition-colors"
              style={{ color: BRAND.textSubtle }}
            >
              Meet Niya →
            </Link>
          </div>
        </div>

        {/* ── Asymmetric hero: 7-col input / 5-col trust card ─────── */}
        <section className="relative z-10 mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-4 pt-12 md:px-6 md:pt-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
            {/* Left column: display H1 + input bar */}
            <div className="md:col-span-7">
              <span
                className="font-body text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: BRAND.textSubtle }}
              >
                Niya Tools · BNB Chain
              </span>
              <h1
                className="font-display mt-3 text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
                style={{
                  fontWeight: 700,
                  lineHeight: 1.02,
                  letterSpacing: "-0.035em",
                  color: BRAND.text,
                }}
              >
                Paste. Wait 8 seconds.<br />
                <span style={{ color: BRAND.textMuted }}>
                  Decide.
                </span>
              </h1>
              <p
                className="mt-5 max-w-[52ch] text-sm md:text-base"
                style={{ color: BRAND.textMuted, lineHeight: 1.65 }}
              >
                A BNB Chain microstructure read you can actually read. Holders,
                LP lock, sniper count, honeypot flags, GMGN behavioural tags —
                merged from three sources into one call.
              </p>

              {/* Input bar wrapped in signature Frame */}
              <div className="mt-8">
                <Frame>
                  <div className="p-5 md:p-7">
                    <label
                      htmlFor="ca-input"
                      className="block font-body text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: BRAND.textSubtle }}
                    >
                      Paste a BNB Chain token address
                    </label>
                    <div className="mt-3 flex flex-col gap-3 md:flex-row">
                      <input
                        id="ca-input"
                        type="text"
                        value={input}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82"
                        onChange={(e) => {
                          setInput(e.target.value);
                          setInputError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAnalyze();
                        }}
                        className="flex-1 rounded-xl border bg-white px-4 py-3 font-mono text-sm outline-none transition-colors"
                        style={{
                          borderColor: BRAND.tanFill,
                          color: BRAND.text,
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAnalyze}
                        className="rounded-xl px-6 py-3 font-body text-sm font-bold transition-transform hover:-translate-y-0.5 active:scale-95"
                        style={{
                          background: BRAND.tanFill,
                          color: BRAND.text,
                          border: `2px solid ${BRAND.tanDeep}`,
                          boxShadow: "0 2px 6px rgba(122,91,54,0.18)",
                        }}
                      >
                        Analyze →
                      </button>
                    </div>

                    {inputError && (
                      <p
                        className="mt-2 font-body text-xs"
                        style={{ color: "#E67080" }}
                      >
                        {inputError}
                      </p>
                    )}

                    <div
                      className="mt-4 flex flex-col gap-2 text-xs md:flex-row md:items-center md:justify-between"
                      style={{ color: BRAND.textSubtle }}
                    >
                      <span>
                        Try:{" "}
                        {[
                          { label: "CAKE", ca: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82" },
                          { label: "WBNB", ca: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" },
                          { label: "BUSD", ca: "0xe9e7cea3dedca5984780bafc599bd69add087d56" },
                        ].map((t, i, arr) => (
                          <span key={t.label}>
                            <button
                              type="button"
                              onClick={() => {
                                setInput(t.ca);
                                setInputError(null);
                              }}
                              className="font-mono underline decoration-dotted"
                              style={{ color: BRAND.textMuted }}
                            >
                              {t.label}
                            </button>
                            {i < arr.length - 1 && " · "}
                          </span>
                        ))}
                      </span>
                      <span className="italic">
                        Read-only — we never sign or move funds.
                      </span>
                    </div>
                  </div>
                </Frame>
              </div>
            </div>

            {/* Right column: trust stats card */}
            <aside className="md:col-span-5">
              <Frame>
                <div className="flex h-full flex-col p-5 md:p-7">
                  <span
                    className="font-body text-[10px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: BRAND.textSubtle }}
                  >
                    Why this works
                  </span>
                  <h2
                    className="font-display mt-2 text-xl md:text-2xl"
                    style={{
                      fontWeight: 700,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                      color: BRAND.text,
                    }}
                  >
                    Three sources, one read.
                  </h2>
                  <ul className="mt-4 space-y-3 text-sm">
                    {[
                      {
                        k: "Moralis",
                        v: "Top-10 holder concentration, token age, sniper wallets from transfer logs.",
                      },
                      {
                        k: "GoPlus",
                        v: "Honeypot flag, buy/sell tax, LP locked share, ownership status.",
                      },
                      {
                        k: "GMGN",
                        v: "Per-holder behavioural tags — whale, cex, smart money, sniper, bundler.",
                      },
                    ].map((row) => (
                      <li
                        key={row.k}
                        className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-dashed pb-3 last:border-b-0 last:pb-0"
                        style={{ borderColor: `${BRAND.tanFill}AA` }}
                      >
                        <span
                          className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: BRAND.goldDeep }}
                        >
                          {row.k}
                        </span>
                        <span style={{ color: BRAND.textMuted, lineHeight: 1.55 }}>
                          {row.v}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div
                    className="mt-5 flex items-center gap-2 text-[11px]"
                    style={{ color: BRAND.textSubtle }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: BRAND.goldDeep }}
                    />
                    <span className="italic">
                      No install. No wallet signature. Shareable URL.
                    </span>
                  </div>
                </div>
              </Frame>
            </aside>
          </div>
        </section>

        {/* ── Main analyzer — wrapped in Frame ─────────────────────── */}
        <section className="relative z-10 mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-4 py-12 md:px-6 md:py-16">
          {ca ? (
            <Frame>
              <div className="overflow-hidden">
                <NiyaToolsApp ca={ca} source={source} />
              </div>
            </Frame>
          ) : (
            <Frame>
              <div className="p-10 text-center md:p-16">
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                  style={{ backgroundColor: BRAND.tanFill }}
                >
                  <span aria-hidden style={{ color: BRAND.text }}>◆</span>
                </div>
                <h2
                  className="font-display text-xl font-bold md:text-2xl"
                  style={{ color: BRAND.text }}
                >
                  No token loaded yet
                </h2>
                <p
                  className="mx-auto mt-2 max-w-md text-sm"
                  style={{ color: BRAND.textMuted }}
                >
                  Paste a BNB Chain contract address above and Niya will pull
                  microstructure data — top holders, LP lock, honeypot flags,
                  sniper counts, GMGN behavioural tags — in a few seconds.
                </p>
              </div>
            </Frame>
          )}
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer
          className="relative z-10 mt-8 border-t"
          style={{
            borderColor: `${BRAND.tanFill}80`,
            backgroundColor: BRAND.bone,
          }}
        >
          <div
            className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[110rem] 3xl:max-w-[130rem] flex-col items-start justify-between gap-3 px-4 py-6 text-xs md:flex-row md:items-center md:px-6"
            style={{ color: BRAND.textSubtle }}
          >
            <span>
              Data from{" "}
              <span className="font-semibold" style={{ color: BRAND.textMuted }}>Moralis</span>,{" "}
              <span className="font-semibold" style={{ color: BRAND.textMuted }}>GoPlus</span> and{" "}
              <span className="font-semibold" style={{ color: BRAND.textMuted }}>GMGN</span> · Narrated by{" "}
              <span className="font-semibold" style={{ color: BRAND.textMuted }}>Grok-3-mini</span>
            </span>
            <span>
              <Link href="/" style={{ color: BRAND.textSubtle }}>Niya Labs</Link>
              {" · "}
              <Link href="/companion" style={{ color: BRAND.textSubtle }}>Niya Companion</Link>
              {" · "}
              <a
                href="https://x.com/NiyaAgent"
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: BRAND.textSubtle }}
              >
                @NiyaAgent
              </a>
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
