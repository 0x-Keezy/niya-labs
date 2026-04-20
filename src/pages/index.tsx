// Niya Labs — landing page
//
// Port of the v5-zine Claude Design handoff: a scrapbook/zine aesthetic
// with washi tape, polaroids, hand-drawn stamps, handwritten accents,
// and paper textures. Brand tokens match the warm cream+tan+gold system
// already defined across the project.
//
// The "N" monogram in nav + footer has been replaced with the real
// favicon image (`/favicon.png`) per user request — the brand mark is
// the Niya logo, not a placeholder letter.

import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
import ChartPreview from "@/components/landing/ChartPreview";
import ZonesPreview from "@/components/landing/ZonesPreview";
import WaveformPreview from "@/components/landing/WaveformPreview";
import TypewriterText from "@/components/landing/TypewriterText";
import { SPRING, SPRING_SNAPPY, STAGGER_CONTAINER } from "@/components/landing/MotionSettings";

/* ─── Tiny primitives reused across sections ─────────────────── */

function Sparkle({
  top,
  left,
  right,
  size = 18,
  delay = 0,
  color,
}: {
  top: string;
  left?: string;
  right?: string;
  size?: number;
  delay?: number;
  color?: string;
}) {
  return (
    <svg
      className="zine-spark"
      style={{
        top,
        left,
        right,
        width: size,
        height: size,
        animationDelay: `${delay}s`,
        color,
      }}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 2l1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8z"
      />
    </svg>
  );
}

/** Favicon-as-brand-mark — replaces the placeholder "N" monogram. */
function BrandMark({ size = 44, rotate = -5 }: { size?: number; rotate?: number }) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}
    >
      <Image
        src="/favicon.png"
        alt="Niya Labs"
        width={size}
        height={size}
        priority
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: "50%",
          border: "2px solid #B8913F",
          background: "#F8EAC8",
          padding: 3,
          boxShadow: "0 2px 6px rgba(58,46,36,0.15)",
        }}
      />
    </div>
  );
}

/** Niya message row for the "a typical stream" chat transcript.
 *  Avatar pops in (bouncy spring), bubble scales from 0.9 on enter, and
 *  the message body types itself out via `TypewriterText` starting after
 *  `typeDelay` ms. All delays are cumulative from when the stream panel
 *  scrolls into view — tune per-row to choreograph the conversation. */
function NiyaChatRow({
  emotion,
  text,
  popDelay,
  typeDelay,
}: {
  emotion: string;
  text: string;
  popDelay: number;
  typeDelay: number;
}) {
  return (
    <div className="flex gap-3 items-start">
      <motion.div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          border: "1.5px dashed #B8913F",
          background: "#FFFBF5",
        }}
        initial={{ opacity: 0, scale: 0, rotate: -45 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 14,
          delay: popDelay,
        }}
      >
        <Image
          src="/favicon.png"
          alt="Niya"
          width={40}
          height={40}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </motion.div>
      <div className="flex-1">
        <motion.div
          className="font-mono-zine"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#7A6450",
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.3, delay: popDelay + 0.1 }}
        >
          <span style={{ color: "#3A2E24", fontWeight: 700 }}>Niya</span> ·
          voice: Yuki · emotion: {emotion}
        </motion.div>
        <motion.div
          className="font-hand mt-1"
          style={{
            fontSize: 22,
            color: "#3A2E24",
            lineHeight: 1.35,
            background: "#FFF3D6",
            padding: "10px 14px",
            borderRadius: "14px 14px 14px 4px",
            display: "inline-block",
            minHeight: 32,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 22,
            delay: popDelay + 0.2,
          }}
        >
          <TypewriterText text={text} speed={28} delay={typeDelay} />
        </motion.div>
      </div>
    </div>
  );
}

/** Fan-chat row — slides in from the left like a live-stream chat line,
 *  indented to align with Niya's bubble. No typewriter (fans drop lines
 *  all-at-once in real chat). */
function FanChatRow({
  handle,
  msg,
  delay,
}: {
  handle: string;
  msg: string;
  delay: number;
}) {
  return (
    <motion.div
      className="font-hand"
      style={{
        fontSize: 18,
        color: "#7A6450",
        marginLeft: 52,
      }}
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 22,
        delay,
      }}
    >
      <span style={{ color: "#3A2E24", fontWeight: 700 }}>{handle}</span> ·{" "}
      {msg}
    </motion.div>
  );
}

/** Marquee ticker — horizontal auto-scrolling BNB-chain ticker tape.
 *  Renders the pill list twice back-to-back and uses a seamless x:0 → x:-50%
 *  translate loop so the scroll never "jumps" at the wrap. */
function TickerMarquee() {
  const tickers = [
    { sym: "BNB", px: "620.94", chg: "+2.14%", up: true },
    { sym: "CAKE", px: "2.41", chg: "+3.82%", up: true },
    { sym: "ETH", px: "3,184", chg: "+1.08%", up: true },
    { sym: "WBTC", px: "98,210", chg: "-0.42%", up: false },
    { sym: "USDT·BNB", px: "1.0001", chg: "peg", up: true },
    { sym: "FOUR", px: "0.0082", chg: "+12.4%", up: true },
    { sym: "BTCB", px: "98,204", chg: "-0.39%", up: false },
    { sym: "XVS", px: "9.18", chg: "+4.02%", up: true },
  ];

  const row = (
    <>
      {tickers.map((t, i) => (
        <span
          key={`${t.sym}-${i}`}
          className="font-mono-zine"
          style={{
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#3A2E24",
            padding: "0 22px",
            borderRight: "1px dashed rgba(184,145,63,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          <b>{t.sym}</b>{" "}
          <span style={{ color: "#7A6450" }}>{t.px}</span>{" "}
          <span style={{ color: t.up ? "#16A34A" : "#C47070" }}>
            {t.up ? "▲" : "▼"} {t.chg}
          </span>
        </span>
      ))}
    </>
  );

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: "#F8EAC8",
        borderTop: "1.5px dashed #C9A86C",
        borderBottom: "1.5px dashed #C9A86C",
        padding: "10px 0",
      }}
      aria-hidden="true"
    >
      <motion.div
        className="flex"
        style={{ width: "max-content" }}
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {row}
        {row}
      </motion.div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function NiyaLabsLanding() {
  return (
    <>
      <Head>
        <title>Niya Labs — a VTuber &amp; an analyzer, on BNB</title>
        <meta
          name="description"
          content="Niya Labs: one AI VTuber, one BNB token analyzer, one brand. She streams. It reads. You decide. Four.meme AI Sprint · April 2026."
        />
        <meta property="og:title" content="Niya Labs" />
        <meta
          property="og:description"
          content="One AI VTuber, one BNB token analyzer, one brand. She streams. It reads. You decide."
        />
      </Head>

      <div className="zine-scope relative">
        {/* Scattered sparkles */}
        <Sparkle top="12vh"  left="6vw"   size={22} delay={0} />
        <Sparkle top="30vh"  right="8vw"  size={16} delay={2} />
        <Sparkle top="68vh"  left="4vw"   size={14} delay={3} />
        <Sparkle top="120vh" right="12vw" size={20} delay={1} color="#856292" />
        <Sparkle top="180vh" left="18vw"  size={18} delay={4} />

        {/* BRAND UTILITY STRIP — Niya Labs = the umbrella brand. Two
            products (Niya · the VTuber, Niya Tools · the extension) live
            under it. This thin strip makes that hierarchy obvious from
            frame one. */}
        <div
          className="relative"
          style={{
            background: "#3A2E24",
            color: "#FDF5E8",
            borderBottom: "1.5px solid #3A2E24",
          }}
        >
          <div className="mx-auto flex max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] items-center justify-between px-5 py-1.5 gap-4">
            <div
              className="font-mono-zine flex items-center gap-2"
              style={{
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              <span style={{ color: "#B8913F" }}>Niya Labs</span>
              <span style={{ color: "#9B8570" }}>·</span>
              <span style={{ color: "#FDF5E8" }}>two products</span>
              <span style={{ color: "#9B8570" }}>·</span>
              <span style={{ color: "#FDF5E8" }}>one brand</span>
            </div>
            <div
              className="hidden md:flex items-center gap-3 font-mono-zine"
              style={{
                fontSize: 9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#9B8570",
              }}
            >
              <Link
                href="/companion"
                style={{ color: "#FDF5E8" }}
                title="Niya — the VTuber"
              >
                01 · Niya
              </Link>
              <span>+</span>
              <Link
                href="/tools"
                style={{ color: "#FDF5E8" }}
                title="Niya Tools — the extension"
              >
                02 · Niya Tools
              </Link>
            </div>
          </div>
        </div>

        {/* NAV ─────────────────────────────────────────────────── */}
        <nav
          className="relative"
          style={{
            background: "#FFFBF5",
            borderBottom: "1.5px dashed #C9A86C",
          }}
        >
          <div className="mx-auto flex max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-3">
              <BrandMark />
              <div>
                <div
                  className="font-serif-zine"
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    color: "#3A2E24",
                  }}
                >
                  Niya Labs
                </div>
                <div
                  className="font-hand"
                  style={{ fontSize: 13, color: "#7A6450", lineHeight: 1, marginTop: -2 }}
                >
                  Niya's personal zine
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-1 text-sm md:gap-4">
              <Link
                href="/companion"
                className="hidden md:inline-flex flex-col items-center leading-none px-2"
                style={{ color: "#3A2E24" }}
                title="Niya — the VTuber"
              >
                <span className="font-hand" style={{ fontSize: 18 }}>
                  · live
                </span>
                <span
                  className="font-mono-zine"
                  style={{
                    fontSize: 8,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#B8913F",
                    marginTop: 2,
                  }}
                >
                  Niya
                </span>
              </Link>
              <Link
                href="/tools"
                className="hidden md:inline-flex flex-col items-center leading-none px-2"
                style={{ color: "#3A2E24" }}
                title="Niya Tools — the extension"
              >
                <span className="font-hand" style={{ fontSize: 18 }}>
                  · tools
                </span>
                <span
                  className="font-mono-zine"
                  style={{
                    fontSize: 8,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#B8913F",
                    marginTop: 2,
                  }}
                >
                  Niya Tools
                </span>
              </Link>
              <a
                href="https://x.com/NiyaAgent"
                target="_blank"
                rel="noreferrer noopener"
                className="hidden md:inline font-hand px-2"
                style={{ fontSize: 18, color: "#3A2E24" }}
              >
                · @niya
              </a>
              <a
                href="https://github.com/0x-Keezy/niya-labs"
                target="_blank"
                rel="noreferrer noopener"
                className="hidden md:inline font-hand px-2"
                style={{ fontSize: 18, color: "#3A2E24" }}
              >
                · github
              </a>
              <Link
                href="/tools"
                className="sticker"
                style={{ background: "#3A2E24", color: "#FDF5E8", borderColor: "#3A2E24" }}
              >
                try the analyzer →
              </Link>
            </div>
          </div>
        </nav>

        {/* TICKER TAPE — continuous BNB-chain price marquee */}
        <TickerMarquee />

        {/* COVER COLLAGE ─────────────────────────────── */}
        <section className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20">
          {/* Corner round stamp — subtle continuous wiggle so it feels
              "stuck on" rather than printed flat. */}
          <motion.div
            className="hidden md:block absolute"
            style={{ top: 32, right: 60 }}
            initial={{ opacity: 0, scale: 0, rotate: 40 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: [10, 14, 10],
            }}
            transition={{
              opacity: { duration: 0.6, delay: 0.4 },
              scale: {
                type: "spring",
                stiffness: 220,
                damping: 12,
                delay: 0.4,
              },
              rotate: {
                duration: 5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: 1,
              },
            }}
          >
            <div className="stamp-round">
              <span>
                Issue
                <br />№ 01
                <br />·2026·
              </span>
            </div>
          </motion.div>

          {/* Eyebrow strip */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="stamp">Four.meme AI Sprint</span>
            <span className="font-hand" style={{ fontSize: 18, color: "#7A6450" }}>
              april · MMXXVI
            </span>
            <span
              className="flex items-center gap-1.5 font-hand"
              style={{ fontSize: 18, color: "#C47070" }}
            >
              <motion.span
                className="h-2 w-2 rounded-full live-dot"
                style={{ background: "#C47070" }}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(196,112,112,0.55)",
                    "0 0 0 8px rgba(196,112,112,0)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
              on air
            </span>
          </div>

          {/* Hero title — staggered reveal on mount. Each line fades +
              slides up with spring physics. `useReducedMotion` fallback
              renders the final state instantly for accessibility. */}
          <motion.h1
            className="font-serif-zine relative mt-6"
            style={{
              fontSize: "clamp(58px,10.5vw,172px)",
              fontWeight: 900,
              lineHeight: 0.86,
              letterSpacing: "-0.04em",
              color: "#3A2E24",
            }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: STAGGER_CONTAINER },
            }}
          >
            <motion.span
              style={{ display: "inline-block" }}
              variants={{
                hidden: { opacity: 0, y: 18 },
                visible: { opacity: 1, y: 0, transition: SPRING },
              }}
            >
              a v
              <span style={{ color: "#B8913F", fontStyle: "italic" }}>tuber</span>
            </motion.span>
            <br />
            <motion.span
              style={{ display: "inline-block" }}
              variants={{
                hidden: { opacity: 0, y: 18 },
                visible: { opacity: 1, y: 0, transition: SPRING },
              }}
            >
              &amp; an <span className="doodle-under">analyzer</span>
            </motion.span>
            <br />
            <motion.span
              className="font-hand"
              style={{
                fontSize: "0.48em",
                color: "#7A6450",
                fontWeight: 400,
                letterSpacing: 0,
                display: "inline-block",
              }}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: SPRING },
              }}
            >
              (under one roof, on BNB)
            </motion.span>
          </motion.h1>

          {/* Under-title note + Inside TOC aside. Two-column grid: the
              elevator pitch sits on the left, the zine's table-of-contents
              polaroid sits on the right with a slight tilt and a gold
              washi-tape strip. Rows link to the in-page section anchors
              (#bio, #live, #tools) so readers can jump like flipping
              through the physical zine. */}
          <div className="relative mt-8 grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="md:col-span-7">
              <p style={{ color: "#3A2E24", lineHeight: 1.75, fontSize: 16 }}>
                <span
                  className="font-serif-zine"
                  style={{ fontWeight: 900, fontSize: 22 }}
                >
                  One AI VTuber,
                </span>{" "}
                one BNB token analyzer, one brand.{" "}
                <span className="hl">She streams.</span>{" "}
                <span className="hl-pink">It reads.</span>{" "}
                <span className="font-hand" style={{ fontSize: 22, color: "#B8913F" }}>
                  you decide.
                </span>
              </p>
              <p
                className="mt-3"
                style={{
                  fontSize: 14,
                  color: "#7A6450",
                  lineHeight: 1.7,
                  maxWidth: "58ch",
                }}
              >
                Inside this issue: a character sheet, a live transcript, and
                a plain-English rug-risk verdict —{" "}
                <em>plus the small print about how any of this actually works</em>.
              </p>
            </div>

            {/* Contents table — polaroid aside with tape + tilt */}
            <motion.aside
              className="md:col-span-5 relative"
              initial={{ opacity: 0, y: 32, rotate: 6, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0.6, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.3 }}
            >
              <div
                className="tape tape-gold"
                style={{ top: -14, left: 40, transform: "rotate(-3deg)" }}
              />
              <div className="paper p-5">
                <div
                  className="flex items-baseline justify-between"
                  style={{ borderBottom: "1.5px solid #3A2E24", paddingBottom: 4 }}
                >
                  <span
                    className="font-serif-zine"
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      letterSpacing: "-0.01em",
                      color: "#3A2E24",
                      fontStyle: "italic",
                    }}
                  >
                    Inside
                  </span>
                  <span
                    className="font-mono-zine"
                    style={{
                      fontSize: 9.5,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "#7A6450",
                    }}
                  >
                    pp. 01 — 04
                  </span>
                </div>
                <motion.ul
                  className="mt-2"
                  style={{ fontSize: 13, color: "#3A2E24" }}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={{
                    hidden: {},
                    visible: {
                      transition: { staggerChildren: 0.08, delayChildren: 0.5 },
                    },
                  }}
                >
                  {[
                    { n: "01", label: "cover · Niya Labs", href: "#top", page: "p. 01" },
                    { n: "02", label: "Niya · character sheet", href: "#bio", page: "p. 02" },
                    { n: "03", label: "Niya · a live stream", href: "#live", page: "p. 03" },
                    { n: "04", label: "Niya Tools · rug-risk scan", href: "#tools", page: "p. 04" },
                  ].map((row) => (
                    <motion.li
                      key={row.n}
                      className="flex items-baseline gap-2 py-1"
                      variants={{
                        hidden: { opacity: 0, x: -8 },
                        visible: {
                          opacity: 1,
                          x: 0,
                          transition: { type: "spring", stiffness: 240, damping: 22 },
                        },
                      }}
                    >
                      <span
                        className="font-mono-zine"
                        style={{ fontSize: 11, color: "#B8913F", width: 28 }}
                      >
                        {row.n}
                      </span>
                      <a
                        href={row.href}
                        className="font-hand"
                        style={{ fontSize: 18, color: "#3A2E24" }}
                      >
                        {row.label}
                      </a>
                      <span
                        className="flex-1 mx-1"
                        style={{ borderBottom: "1.5px dotted #C9A86C" }}
                      />
                      <span
                        className="font-mono-zine"
                        style={{ fontSize: 10, color: "#7A6450" }}
                      >
                        {row.page}
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            </motion.aside>
          </div>

          {/* Collage grid */}
          <div className="relative mt-14 grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6">
            {/* Polaroid 1 — Niya portrait. Enters with bouncy spring then
                breathes continuously (subtle float + rotate sway) so the
                cover photo feels alive rather than pinned dead-still. */}
            <motion.div
              className="relative md:col-span-5"
              initial={{ opacity: 0, y: 80, rotate: -18, scale: 0.85 }}
              animate={{
                opacity: 1,
                y: [0, -6, 0, 4, 0],
                rotate: [-3, -2, -3.5, -2.5, -3],
                scale: 1,
              }}
              transition={{
                opacity: { duration: 0.5, delay: 0.2 },
                scale: {
                  type: "spring",
                  stiffness: 140,
                  damping: 14,
                  delay: 0.2,
                },
                y: {
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.2,
                },
                rotate: {
                  duration: 7,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.2,
                },
              }}
            >
              <div
                className="tape"
                style={{
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%) rotate(-2deg)",
                }}
              />
              <div className="polaroid">
                <div
                  className="relative overflow-hidden"
                  style={{
                    aspectRatio: "1 / 1",
                    background: "linear-gradient(160deg,#FFF3D6 0%,#FFE8B8 100%)",
                  }}
                >
                  <Image
                    src="/niya-logo.png"
                    alt="Niya — candy-loving VTuber"
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    style={{ objectFit: "contain", padding: "4%" }}
                  />
                  <div
                    className="absolute top-3 left-3 sticker"
                    style={{ padding: "4px 9px", fontSize: 11 }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full live-dot"
                        style={{ background: "#C47070" }}
                        animate={{
                          boxShadow: [
                            "0 0 0 0 rgba(196,112,112,0.55)",
                            "0 0 0 6px rgba(196,112,112,0)",
                          ],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeOut",
                        }}
                      />
                      on air
                    </span>
                  </div>
                </div>
                <div
                  className="font-hand mt-3 text-center"
                  style={{ fontSize: 24, color: "#3A2E24" }}
                >
                  ~ <span style={{ color: "#B8913F" }}>niya</span>, candy-obsessed ~
                </div>
              </div>
            </motion.div>

            {/* Card 2 — hand-written bio. Slides in from the right with a
                little extra rotation, then settles on +1.5°. */}
            <motion.div
              className="relative md:col-span-4 md:mt-10"
              initial={{ opacity: 0, x: 60, rotate: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, rotate: 1.5, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 130,
                damping: 16,
                delay: 0.5,
              }}
            >
              <div
                className="tape tape-pink"
                style={{ top: -14, left: 20, transform: "rotate(-6deg)" }}
              />
              <div
                className="tape tape-pink"
                style={{ top: -14, right: 30, transform: "rotate(8deg)" }}
              />
              <div
                className="paper-y p-6"
                style={{ border: "1px dashed rgba(184,145,63,0.45)" }}
              >
                <div
                  className="font-hand"
                  style={{ fontSize: 26, color: "#B8913F", lineHeight: 1 }}
                >
                  not a cat.
                </div>
                <div
                  className="font-hand"
                  style={{ fontSize: 26, color: "#B8913F", lineHeight: 1, marginTop: 2 }}
                >
                  not a nekomata.
                </div>
                <div
                  className="font-hand"
                  style={{ fontSize: 26, color: "#B8913F", lineHeight: 1, marginTop: 2 }}
                >
                  definitely not just a vtuber.
                </div>
                <div
                  style={{
                    borderTop: "1.5px dashed #C9A86C",
                    marginTop: 14,
                    paddingTop: 12,
                  }}
                >
                  <p style={{ color: "#3A2E24", lineHeight: 1.65, fontSize: 13 }}>
                    Golden hair. Fluffy <span className="hl">hamster ears</span>.
                    Pastel yellow dress. Lives on BNB Chain. Seven chat providers,
                    four voice engines, fourteen emotion shapes &mdash; fine print
                    on the back cover.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="sticker">golden hair</span>
                  <span className="sticker" style={{ background: "#FFE6D8" }}>
                    yellow dress
                  </span>
                  <span className="sticker" style={{ background: "#E7DDEF" }}>
                    BNB chain
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Card 3 — big CTA. Enters last, drops from above with a
                spring bounce so the "~8s" number lands last and the eye
                catches it. */}
            <motion.div
              className="relative md:col-span-3 md:mt-4"
              initial={{ opacity: 0, y: -60, rotate: -18, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, rotate: -1.5, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 140,
                damping: 14,
                delay: 0.8,
              }}
            >
              <div
                className="tape tape-gold"
                style={{
                  top: -14,
                  left: "50%",
                  transform: "translateX(-50%) rotate(3deg)",
                }}
              />
              <div className="paper p-6 text-center">
                <div
                  className="font-hand"
                  style={{ fontSize: 22, color: "#7A6450" }}
                >
                  psst —
                </div>
                <div
                  className="font-serif-zine mt-1"
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    lineHeight: 0.95,
                    letterSpacing: "-0.03em",
                    color: "#3A2E24",
                    fontStyle: "italic",
                  }}
                >
                  read
                  <br />onchain in
                </div>
                <motion.div
                  className="font-serif-zine"
                  style={{
                    fontSize: 96,
                    fontWeight: 900,
                    lineHeight: 0.9,
                    letterSpacing: "-0.06em",
                    color: "#B8913F",
                    fontStyle: "italic",
                    transformOrigin: "center",
                  }}
                  animate={{
                    scale: [1, 1.06, 1],
                    textShadow: [
                      "0 0 0 rgba(184,145,63,0)",
                      "0 0 12px rgba(184,145,63,0.28)",
                      "0 0 0 rgba(184,145,63,0)",
                    ],
                  }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  ~8s
                </motion.div>
                <Link
                  href="/tools"
                  className="sticker mt-3 inline-block"
                  style={{
                    background: "#3A2E24",
                    color: "#FDF5E8",
                    borderColor: "#3A2E24",
                    fontSize: 15,
                  }}
                >
                  paste an address →
                </Link>
              </div>
            </motion.div>

            {/* Ticket stub */}
            <div className="relative md:col-span-12 md:mt-2">
              <div
                className="relative mx-auto"
                style={{ maxWidth: 900, transform: "rotate(-0.4deg)" }}
              >
                <div className="tape tape-violet" style={{ top: -14, left: 40 }} />
                <div
                  className="flex flex-col sm:flex-row"
                  style={{
                    background: "#F8EAC8",
                    border: "1.5px dashed #B8913F",
                    position: "relative",
                  }}
                >
                  <div
                    className="hidden sm:block"
                    style={{
                      position: "absolute",
                      left: "66%",
                      top: 0,
                      bottom: 0,
                      borderLeft: "1.5px dashed #B8913F",
                    }}
                  />
                  <div className="p-5 sm:w-2/3">
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#7A6450",
                      }}
                    >
                      Admit one · niyaagent.com
                    </div>
                    <div
                      className="font-serif-zine mt-1"
                      style={{
                        fontSize: 34,
                        fontWeight: 900,
                        letterSpacing: "-0.02em",
                        color: "#3A2E24",
                        lineHeight: 1.05,
                      }}
                    >
                      come watch Niya{" "}
                      <em style={{ color: "#B8913F", fontStyle: "italic" }}>trade.</em>
                    </div>
                    <div
                      className="mt-2 font-hand"
                      style={{ fontSize: 20, color: "#7A6450" }}
                    >
                      she streams with a BNB market HUD wired to a Binance WebSocket.
                      no polling, no drift.
                    </div>
                  </div>
                  <div
                    className="p-5 sm:w-1/3 text-center"
                    style={{ background: "#FFE6C4" }}
                  >
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#7A6450",
                      }}
                    >
                      Live · on BNB
                    </div>
                    <motion.div
                      className="font-serif-zine"
                      style={{
                        fontSize: 54,
                        fontWeight: 900,
                        color: "#B8913F",
                        fontStyle: "italic",
                        lineHeight: 1,
                        transformOrigin: "center",
                      }}
                      animate={{
                        scale: [1, 1.04, 1],
                        textShadow: [
                          "0 0 0 rgba(184,145,63,0)",
                          "0 0 12px rgba(184,145,63,0.35)",
                          "0 0 0 rgba(184,145,63,0)",
                        ],
                      }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      LIVE
                    </motion.div>
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#7A6450",
                      }}
                    >
                      niyaagent.com
                    </div>
                    <Link
                      href="/companion"
                      className="sticker mt-3 inline-block"
                      style={{
                        background: "#3A2E24",
                        color: "#FDF5E8",
                        borderColor: "#3A2E24",
                        padding: "10px 20px",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Join live →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ─── CHARACTER NOTEBOOK — meet Niya. candy hamster. ─────── */}
        <section
          id="bio"
          className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20"
        >
          {/* Sponsor post-it — stuck to the page like a real reader note.
              Pulled out of the standalone "Powered by DGrid" section so the
              bounty info lives inline with the character she powers, not
              in its own marketing slab. */}
          <motion.div
            className="hidden md:block absolute z-20"
            style={{
              top: 24,
              right: 40,
              width: 220,
              padding: "14px 16px 20px",
              background: "#FFF27C",
              backgroundImage:
                "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 30%)",
              boxShadow:
                "3px 4px 12px rgba(58,46,36,0.28), 0 1px 0 rgba(0,0,0,0.08)",
              transformOrigin: "top center",
            }}
            initial={{ opacity: 0, y: -40, rotate: -20, scale: 0.6 }}
            whileInView={{ opacity: 1, y: 0, rotate: -4, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              type: "spring",
              stiffness: 180,
              damping: 14,
              delay: 0.3,
            }}
            whileHover={{ rotate: -2, scale: 1.03 }}
          >
            <div
              className="tape tape-pink"
              style={{
                top: -10,
                left: "50%",
                transform: "translateX(-50%) rotate(-3deg)",
                width: 80,
                height: 20,
              }}
            />
            <div
              className="font-mono-zine"
              style={{
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: "#7A6450",
                fontWeight: 700,
              }}
            >
              § sponsor note
            </div>
            <div
              className="font-serif-zine mt-1"
              style={{
                fontSize: 22,
                fontWeight: 900,
                fontStyle: "italic",
                color: "#3A2E24",
                lineHeight: 1,
                letterSpacing: "-0.015em",
              }}
            >
              powered by{" "}
              <span style={{ color: "#B8913F" }}>DGrid</span>
            </div>
            <p
              className="font-hand mt-2"
              style={{ fontSize: 15, color: "#3A2E24", lineHeight: 1.35 }}
            >
              Four.meme × DGrid bounty sponsor. 200+ LLMs on one API key —
              swap Grok, Claude, Gemini live via dropdown.{" "}
              <b>$0.002/analysis</b>.
            </p>
            <a
              href="https://dgrid.ai"
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono-zine inline-block mt-2"
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#3A2E24",
                fontWeight: 700,
                borderBottom: "1.5px solid #3A2E24",
                paddingBottom: 1,
              }}
            >
              dgrid.ai →
            </a>
          </motion.div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  color: "#B8913F",
                  fontWeight: 700,
                }}
              >
                § Niya · character sheet
              </span>
              <h2
                className="font-serif-zine mt-2"
                style={{
                  fontSize: "clamp(42px,6vw,86px)",
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: "-0.03em",
                  color: "#3A2E24",
                }}
              >
                meet Niya.{" "}
                <span style={{ color: "#B8913F", fontStyle: "italic" }}>
                  candy hamster.
                </span>
              </h2>
            </div>
            <div
              className="font-hand text-right"
              style={{ fontSize: 22, color: "#7A6450" }}
            >
              — from the studio journal
              <br />
              <span style={{ fontSize: 16 }}>specs, scribbles, etc.</span>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-6">
            {/* Left: character sheet "page" */}
            <motion.div
              className="relative md:col-span-5"
              initial={{ opacity: 0, y: 56, rotate: -4, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, rotate: -0.7, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0 }}
            >
              <div className="tape" style={{ top: -14, left: 30 }} />
              <div className="tape tape-gold" style={{ top: -14, right: 40 }} />
              <div
                className="paper-y p-6"
                style={{ border: "1.5px dashed #C9A86C", minHeight: 520 }}
              >
                <div
                  className="font-mono-zine"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: "#7A6450",
                  }}
                >
                  Character sheet · draft 3
                </div>
                <div
                  className="font-serif-zine mt-2"
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    color: "#3A2E24",
                    fontStyle: "italic",
                  }}
                >
                  Niya
                </div>
                <div
                  className="font-hand"
                  style={{ fontSize: 20, color: "#B8913F", marginTop: -2 }}
                >
                  · candy hamster ·
                </div>

                <dl className="mt-6" style={{ borderTop: "1.5px solid #C9A86C" }}>
                  {[
                    { k: "species", v: "candy hamster" },
                    { k: "hair", v: "golden blonde ✦" },
                    {
                      k: "dress",
                      v: (
                        <>
                          pastel yellow,{" "}
                          <span style={{ color: "#C47070" }}>non-negotiable</span>
                        </>
                      ),
                    },
                    { k: "lives on", v: "BNB chain" },
                    { k: "voice", v: "ElevenLabs · Yuki" },
                    { k: "brain", v: "DGrid AI Gateway" },
                    { k: "debut", v: "04 / 2026" },
                  ].map((row, i, arr) => (
                    <div
                      key={row.k}
                      className="grid gap-3 py-2.5"
                      style={{
                        gridTemplateColumns: "7rem 1fr",
                        borderBottom:
                          i === arr.length - 1 ? "none" : "1px dashed #C9A86C",
                      }}
                    >
                      <dt
                        className="font-mono-zine"
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#7A6450",
                        }}
                      >
                        {row.k}
                      </dt>
                      <dd
                        className="font-hand"
                        style={{ fontSize: 20, color: "#3A2E24" }}
                      >
                        {row.v}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* Reject stamp */}
                <div className="mt-6 flex items-end justify-between">
                  <div
                    className="stamp stamp-red"
                    style={{ transform: "rotate(-4deg)" }}
                  >
                    Hard rule
                  </div>
                  <div
                    className="font-hand text-right"
                    style={{ fontSize: 20, color: "#C47070", lineHeight: 1.1 }}
                  >
                    ✕ not a cat
                    <br />
                    ✕ not nekomata
                    <br />
                    ✕ not fire-tipped
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right: stack of small cards */}
            <div className="md:col-span-7 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Brain card */}
              <motion.div
                className="relative"
                initial={{ opacity: 0, y: 48, rotate: 6, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, rotate: 1.2, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ type: "spring", stiffness: 120, damping: 15, delay: 0.15 }}
              >
                <div className="tape tape-gold" style={{ top: -14, left: 30 }} />
                <div className="paper p-5">
                  <div className="flex items-baseline justify-between">
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#B8913F",
                        fontWeight: 700,
                      }}
                    >
                      § the brain
                    </div>
                    <div
                      className="font-hand"
                      style={{ fontSize: 18, color: "#7A6450" }}
                    >
                      200+ models
                    </div>
                  </div>
                  <h3
                    className="font-serif-zine mt-2"
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      lineHeight: 1.05,
                      letterSpacing: "-0.01em",
                      color: "#3A2E24",
                    }}
                  >
                    <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                      DGrid Gateway
                    </em>{" "}
                    leads.
                    <br />
                    200+ swap behind her.
                  </h3>
                  <ul
                    className="mt-3"
                    style={{ fontSize: 13, color: "#3A2E24" }}
                  >
                    <li className="flex items-center justify-between py-1">
                      <span>DGrid AI Gateway · GPT-4o mini</span>
                      <span
                        className="font-mono-zine"
                        style={{ fontSize: 10, color: "#6B8E7F" }}
                      >
                        PRIMARY
                      </span>
                    </li>
                    <li
                      className="flex items-center justify-between py-1"
                      style={{ borderTop: "1px dashed #C9A86C" }}
                    >
                      <span>Grok 3 · Claude · Gemini · Qwen</span>
                      <span
                        className="font-mono-zine"
                        style={{ fontSize: 10, color: "#7A6450" }}
                      >
                        swappable
                      </span>
                    </li>
                    <li
                      className="flex items-center justify-between py-1"
                      style={{ borderTop: "1px dashed #C9A86C" }}
                    >
                      <span>OpenRouter · DeepSeek · xAI</span>
                      <span
                        className="font-mono-zine"
                        style={{ fontSize: 10, color: "#7A6450" }}
                      >
                        fallback
                      </span>
                    </li>
                    <li
                      className="flex items-center justify-between py-1"
                      style={{ borderTop: "1px dashed #C9A86C" }}
                    >
                      <span>Ollama · LLaMA.cpp · KoboldCpp</span>
                      <span
                        className="font-mono-zine"
                        style={{ fontSize: 10, color: "#7A6450" }}
                      >
                        local
                      </span>
                    </li>
                  </ul>
                </div>
              </motion.div>

              {/* Voice card */}
              <motion.div
                className="relative"
                initial={{ opacity: 0, y: 48, rotate: -8, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, rotate: -1.6, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ type: "spring", stiffness: 120, damping: 15, delay: 0.3 }}
              >
                <div
                  className="tape"
                  style={{ top: -14, right: 20, transform: "rotate(6deg)" }}
                />
                <div className="paper p-5">
                  <div className="flex items-baseline justify-between">
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#B8913F",
                        fontWeight: 700,
                      }}
                    >
                      § the voice
                    </div>
                    <div
                      className="font-hand"
                      style={{ fontSize: 18, color: "#7A6450" }}
                    >
                      4 engines
                    </div>
                  </div>
                  <h3
                    className="font-serif-zine mt-2"
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      lineHeight: 1.05,
                      letterSpacing: "-0.01em",
                      color: "#3A2E24",
                    }}
                  >
                    Yuki first. Lip sync by{" "}
                    <em style={{ color: "#B8913F", fontStyle: "italic" }}>FFT</em>.
                  </h3>
                  {/* animated waveform (14 bars — heights from v5-zine source) */}
                  <WaveformPreview />
                  <div
                    className="mt-2 font-hand"
                    style={{ fontSize: 16, color: "#7A6450" }}
                  >
                    Yuki · OpenAI · Coqui · Piper
                  </div>
                </div>
              </motion.div>

              {/* Body card */}
              <motion.div
                className="relative md:col-span-2"
                initial={{ opacity: 0, y: 48, rotate: 3, scale: 0.92 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0.4, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ type: "spring", stiffness: 120, damping: 15, delay: 0.45 }}
              >
                <div
                  className="tape tape-violet"
                  style={{ top: -14, left: 40 }}
                />
                <div className="paper p-5">
                  <div className="flex items-baseline justify-between">
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#B8913F",
                        fontWeight: 700,
                      }}
                    >
                      § the body · VRM ‖ Live2D
                    </div>
                    <div
                      className="font-hand"
                      style={{ fontSize: 18, color: "#7A6450" }}
                    >
                      14 emotion shapes
                    </div>
                  </div>
                  <h3
                    className="font-serif-zine mt-2"
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1,
                      letterSpacing: "-0.015em",
                      color: "#3A2E24",
                    }}
                  >
                    two renderers, one body.{" "}
                    <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                      synced through SSE
                    </em>
                    .
                  </h3>
                  <p
                    className="mt-2"
                    style={{ fontSize: 13, color: "#3A2E24", lineHeight: 1.6 }}
                  >
                    Every viewer hears the same audio, reads the same subtitle,
                    sees the same chat — synced through an{" "}
                    <span className="hl">
                      SSE pipeline with per-client deduplication
                    </span>
                    , so nobody gets the previous line twice.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[
                      "happy",
                      "wink",
                      "pout",
                      "surprise",
                      "calm",
                      "shy",
                      "cheer",
                      "smirk",
                      "think",
                      "focus",
                      "warn",
                      "cool",
                      "soft",
                      "sleepy",
                    ].map((em) => (
                      <motion.span
                        key={em}
                        className="sticker"
                        style={{ fontSize: 12, padding: "2px 9px" }}
                        whileHover={{
                          scale: 1.08,
                          transition: {
                            type: "spring",
                            stiffness: 260,
                            damping: 22,
                          },
                        }}
                      >
                        {em}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>


        {/* ─── ON AIR — a typical stream ────────────────────────────── */}
        <section
          id="live"
          className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
            <motion.div
              className="md:col-span-4"
              initial={{ opacity: 0, x: -48 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 110, damping: 18, delay: 0 }}
            >
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  color: "#B8913F",
                  fontWeight: 700,
                }}
              >
                § Niya · on air
              </span>
              <h2
                className="font-serif-zine mt-3"
                style={{
                  fontSize: "clamp(38px,5.4vw,72px)",
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: "-0.025em",
                  color: "#3A2E24",
                }}
              >
                Niya reads BNB.{" "}
                <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                  you react.
                </em>
              </h2>
              <p
                className="font-hand mt-4"
                style={{ fontSize: 22, color: "#7A6450", lineHeight: 1.45 }}
              >
                BNB ticks up 2%. Niya notices. She drafts the tweet. You ship
                it. total human effort:{" "}
                <span
                  style={{
                    color: "#3A2E24",
                    background: "rgba(232,212,168,0.6)",
                  }}
                >
                  one click.
                </span>
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span
                  className="sticker"
                  style={{
                    background: "#3A2E24",
                    color: "#FDF5E8",
                    borderColor: "#3A2E24",
                  }}
                >
                  zero signatures
                </span>
                <span className="sticker">Binance WebSocket HUD</span>
                <span className="sticker">SSE · dedupe</span>
              </div>
            </motion.div>

            <motion.div
              className="md:col-span-8 relative"
              initial={{ opacity: 0, y: 56, rotate: 3, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0.5, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 110, damping: 16, delay: 0.15 }}
            >
              <div className="tape" style={{ top: -14, left: 40 }} />
              <div
                className="tape tape-pink"
                style={{ top: -14, right: 60, transform: "rotate(-4deg)" }}
              />
              <div
                className="paper-graph p-6"
                style={{ border: "1.5px dashed #C9A86C" }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{
                    borderBottom: "1.5px dashed #C9A86C",
                    paddingBottom: 10,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <motion.span
                      className="h-2 w-2 rounded-full live-dot"
                      style={{ background: "#C47070" }}
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(196,112,112,0.7)",
                          "0 0 0 8px rgba(196,112,112,0)",
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                    <span
                      className="font-mono-zine"
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#3A2E24",
                        fontWeight: 700,
                      }}
                    >
                      LIVE · 00:14:38
                    </span>
                  </div>
                  <span
                    className="font-hand"
                    style={{ fontSize: 18, color: "#7A6450" }}
                  >
                    niyaagent.com · 1,248 watching
                  </span>
                </div>

                {/* Transcript — live-chat style. HUD ticker fires first,
                    then Niya and fans interleave in a natural conversation
                    about BNB's tick up. Niya's messages type themselves
                    character-by-character; fans slide in instantly like a
                    real stream chat. */}
                <div className="mt-5 space-y-3">
                  <div className="flex gap-3">
                    <span
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#9B8570",
                        minWidth: 56,
                        paddingTop: 4,
                      }}
                    >
                      HUD
                    </span>
                    <motion.div
                      className="sticker font-mono-zine"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      initial={{ opacity: 0, scale: 0.6, x: -20 }}
                      whileInView={{ opacity: 1, scale: 1, x: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.3 }}
                    >
                      BNB 620.94{" "}
                      <motion.span
                        style={{ color: "#16A34A", display: "inline-block" }}
                        animate={{ y: [0, -2, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        ▲ 2.14%
                      </motion.span>{" "}
                      tick
                    </motion.div>
                  </div>

                  {/* Niya — message 1 */}
                  <NiyaChatRow
                    emotion="cheer"
                    text="chat — BNB just popped two percent. nya. 🐹"
                    popDelay={0.5}
                    typeDelay={800}
                  />

                  {/* fan reactions */}
                  <FanChatRow handle="@dave" msg="CAKE is moving too 👀" delay={2.3} />
                  <FanChatRow handle="@mo" msg="$628 or bust" delay={2.7} />

                  {/* Niya — message 2 */}
                  <NiyaChatRow
                    emotion="think"
                    text="@mo that's the ceiling from tuesday. watch it."
                    popDelay={3.2}
                    typeDelay={3500}
                  />

                  {/* fan reactions */}
                  <FanChatRow handle="@cake.maxi" msg="call the top niya 🐹" delay={5.1} />
                  <FanChatRow handle="@leo.bnb" msg="she doesn't do TA pls" delay={5.5} />

                  {/* Niya — message 3 */}
                  <NiyaChatRow
                    emotion="soft"
                    text="leo ty. I just read the numbers ✦"
                    popDelay={6.1}
                    typeDelay={6400}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>





        {/* ─── TWO PRODUCTS DIVIDER — Niya → Niya Tools transition ──── */}
        <section className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-6">
          <motion.div
            className="relative flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6"
            style={{
              padding: "18px 24px",
              borderTop: "2px dashed #C9A86C",
              borderBottom: "2px dashed #C9A86C",
            }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex items-center gap-3">
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                  color: "#B8913F",
                  fontWeight: 700,
                }}
              >
                01 · Niya
              </span>
              <span
                className="font-hand"
                style={{ fontSize: 18, color: "#7A6450" }}
              >
                the VTuber who streams
              </span>
            </div>

            <motion.span
              className="font-mono-zine"
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.28em",
                color: "#3A2E24",
                fontWeight: 700,
              }}
              animate={{ x: [0, 4, 0] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              ↓ next product ↓
            </motion.span>

            <div className="flex items-center gap-3">
              <span
                className="font-hand"
                style={{ fontSize: 18, color: "#7A6450" }}
              >
                the extension + web tool
              </span>
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                  color: "#B8913F",
                  fontWeight: 700,
                }}
              >
                02 · Niya Tools
              </span>
            </div>
          </motion.div>
        </section>


        {/* ─── NIYA TOOLS · how it works ──────────────────────────── */}
        <section className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  color: "#B8913F",
                  fontWeight: 700,
                }}
              >
                § Niya Tools · how it works
              </span>
              <h2
                className="font-serif-zine mt-2"
                style={{
                  fontSize: "clamp(38px,5.4vw,72px)",
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: "-0.025em",
                  color: "#3A2E24",
                }}
              >
                paste, scan, read,{" "}
                <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                  ask.
                </em>
              </h2>
            </div>
            <div
              className="font-hand text-right"
              style={{ fontSize: 22, color: "#7A6450", maxWidth: "28ch" }}
            >
              the extension sideloads in Chrome; the web version runs at
              /tools. same brain, two surfaces.
            </div>
          </div>

          {/* 4-step pipeline — each step a polaroid card with a gold
              connector arrow between them (hidden on mobile). Cards
              drop-in with spring + stagger so the pipeline "builds" as
              the user scrolls. */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-3 relative">
            {[
              {
                n: "01",
                title: "paste a CA",
                verb: "you",
                body:
                  "drop a 0x address on /tools or click the Nyla icon on DexScreener, Four.meme or PancakeSwap.",
                hint: "auto-detects from the URL",
                rotate: -1.2,
                tape: "left",
                tapeColor: "tape-gold",
              },
              {
                n: "02",
                title: "scan onchain",
                verb: "Niya Tools",
                body:
                  "parallel pulls from Moralis (holders, top-1 custody), GoPlus (honeypot, taxes, LP lock), GMGN (behavioural tags), BscScan (wallet age).",
                hint: "5 APIs, ~8s median",
                rotate: 0.6,
                tape: "right",
                tapeColor: "",
              },
              {
                n: "03",
                title: "read the verdict",
                verb: "Niya Tools",
                body:
                  "a rug-risk score 0–10 + plain-English call. microstructure ledger shows every number the score was built from.",
                hint: "no TA · no price calls",
                rotate: -0.4,
                tape: "center",
                tapeColor: "tape-pink",
              },
              {
                n: "04",
                title: "ask follow-ups",
                verb: "you",
                body:
                  "free-text questions route through DGrid — swap between GPT-4o mini, Grok 3, Claude Haiku, Gemini, Qwen, DeepSeek live via dropdown.",
                hint: "via DGrid Gateway",
                rotate: 0.8,
                tape: "left",
                tapeColor: "tape-violet",
              },
            ].map((step, i) => (
              <motion.div
                key={step.n}
                className="relative"
                initial={{ opacity: 0, y: 48, rotate: step.rotate * 6, scale: 0.88 }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                  rotate: step.rotate,
                  scale: 1,
                }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  type: "spring",
                  stiffness: 130,
                  damping: 15,
                  delay: 0.1 + i * 0.15,
                }}
              >
                <div
                  className={`tape ${step.tapeColor}`}
                  style={{
                    top: -12,
                    ...(step.tape === "left"
                      ? { left: 24 }
                      : step.tape === "right"
                      ? { right: 24, transform: "rotate(6deg)" }
                      : {
                          left: "50%",
                          transform: "translateX(-50%) rotate(-3deg)",
                        }),
                  }}
                />
                <div className="paper p-5" style={{ minHeight: 220 }}>
                  <div className="flex items-baseline justify-between">
                    <span
                      className="font-serif-zine"
                      style={{
                        fontSize: 40,
                        fontWeight: 900,
                        fontStyle: "italic",
                        color: "#B8913F",
                        lineHeight: 0.9,
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {step.n}
                    </span>
                    <span
                      className="font-mono-zine"
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color:
                          step.verb === "you" ? "#C47070" : "#6B8E7F",
                        fontWeight: 700,
                        border: `1.2px solid ${
                          step.verb === "you" ? "#C47070" : "#6B8E7F"
                        }`,
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {step.verb}
                    </span>
                  </div>
                  <h3
                    className="font-serif-zine mt-2"
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      lineHeight: 1.1,
                      letterSpacing: "-0.015em",
                      color: "#3A2E24",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mt-2 font-hand"
                    style={{ fontSize: 17, color: "#3A2E24", lineHeight: 1.35 }}
                  >
                    {step.body}
                  </p>
                  <div
                    className="font-mono-zine mt-3 pt-2"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#7A6450",
                      borderTop: "1px dashed rgba(184,145,63,0.4)",
                    }}
                  >
                    {step.hint}
                  </div>
                </div>

                {/* Arrow connector to next step (hidden on mobile + last) */}
                {i < 3 && (
                  <div
                    className="hidden md:block absolute"
                    style={{
                      top: "50%",
                      right: -18,
                      transform: "translateY(-50%)",
                      color: "#B8913F",
                      fontSize: 28,
                      fontWeight: 900,
                      zIndex: 5,
                    }}
                    aria-hidden="true"
                  >
                    →
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Footer hint — what each verb color means */}
          <div
            className="mt-8 flex flex-wrap gap-4 font-mono-zine"
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#7A6450",
            }}
          >
            <span>
              <span
                style={{
                  color: "#C47070",
                  border: "1.2px solid #C47070",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontWeight: 700,
                  marginRight: 6,
                }}
              >
                you
              </span>
              = what the user does
            </span>
            <span>
              <span
                style={{
                  color: "#6B8E7F",
                  border: "1.2px solid #6B8E7F",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontWeight: 700,
                  marginRight: 6,
                }}
              >
                Niya Tools
              </span>
              = what the tool does
            </span>
          </div>
        </section>


        {/* ─── NIYA TOOLS · where it lives — web + extension ───────── */}
        <section className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  color: "#B8913F",
                  fontWeight: 700,
                }}
              >
                § Niya Tools · where it lives
              </span>
              <h2
                className="font-serif-zine mt-2"
                style={{
                  fontSize: "clamp(38px,5.4vw,72px)",
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: "-0.025em",
                  color: "#3A2E24",
                }}
              >
                web app &amp;{" "}
                <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                  chrome extension.
                </em>
              </h2>
            </div>
            <div
              className="font-hand text-right"
              style={{ fontSize: 22, color: "#7A6450", maxWidth: "26ch" }}
            >
              one verdict engine · two places to meet it.
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card A — web app */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: -32, rotate: -4, scale: 0.92 }}
              whileInView={{ opacity: 1, x: 0, rotate: -1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ type: "spring", stiffness: 130, damping: 15, delay: 0.1 }}
            >
              <div className="tape tape-gold" style={{ top: -12, left: 28 }} />
              <div className="paper p-6">
                <div
                  className="font-mono-zine"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: "#B8913F",
                    fontWeight: 700,
                  }}
                >
                  surface 01
                </div>
                <h3
                  className="font-serif-zine mt-2"
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    fontStyle: "italic",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: "#3A2E24",
                  }}
                >
                  the web app.
                </h3>
                <p
                  className="mt-3 font-hand"
                  style={{ fontSize: 19, color: "#3A2E24", lineHeight: 1.4 }}
                >
                  paste a contract at <b>/tools</b>, get the full dossier —
                  chart, microstructure ledger, Ask Niya panel. no install.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/tools"
                    className="sticker"
                    style={{
                      background: "#3A2E24",
                      color: "#FDF5E8",
                      borderColor: "#3A2E24",
                    }}
                  >
                    niyaagent.com/tools →
                  </Link>
                  <span className="sticker">zero install</span>
                </div>
              </div>
            </motion.div>

            {/* Card B — extension */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 32, rotate: 4, scale: 0.92 }}
              whileInView={{ opacity: 1, x: 0, rotate: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ type: "spring", stiffness: 130, damping: 15, delay: 0.25 }}
            >
              <div
                className="tape tape-violet"
                style={{ top: -12, right: 28, transform: "rotate(4deg)" }}
              />
              <div className="paper p-6">
                <div
                  className="font-mono-zine"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: "#856292",
                    fontWeight: 700,
                  }}
                >
                  surface 02
                </div>
                <h3
                  className="font-serif-zine mt-2"
                  style={{
                    fontSize: 34,
                    fontWeight: 900,
                    fontStyle: "italic",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: "#3A2E24",
                  }}
                >
                  the extension.
                </h3>
                <p
                  className="mt-3 font-hand"
                  style={{ fontSize: 19, color: "#3A2E24", lineHeight: 1.4 }}
                >
                  pins to your browser. reads the page you&apos;re on. same
                  brain, right where you trade.
                </p>

                {/* "it knows the token you're on" — compact differentiator
                    inline in the extension card (used to be its own section,
                    now folded in so it reads as one of the extension's
                    defining traits rather than a separate story). */}
                <div
                  className="mt-4 pt-3"
                  style={{ borderTop: "1.5px dashed #C9A86C" }}
                >
                  <div
                    className="font-serif-zine"
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      lineHeight: 1.1,
                      letterSpacing: "-0.015em",
                      color: "#3A2E24",
                    }}
                  >
                    it{" "}
                    <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                      knows
                    </em>{" "}
                    the token you&apos;re on.
                  </div>
                  <div
                    className="mt-1 font-hand"
                    style={{ fontSize: 16, color: "#7A6450", lineHeight: 1.35 }}
                  >
                    reads the CA straight from the URL on →
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className="sticker"
                      style={{ background: "#FFE6C4", fontSize: 12 }}
                    >
                      dexscreener
                    </span>
                    <span
                      className="sticker"
                      style={{
                        background: "#E7DDEF",
                        fontSize: 12,
                        borderColor: "#856292",
                      }}
                    >
                      four.meme · native
                    </span>
                    <span
                      className="sticker"
                      style={{ background: "#FFE6D8", fontSize: 12 }}
                    >
                      pancakeswap
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className="sticker"
                    style={{ background: "#E7DDEF" }}
                  >
                    Chrome MV3
                  </span>
                  <span className="sticker">side panel</span>
                  <span className="sticker">sideload · .crx</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>


        {/* ─── NIYA TOOLS · Analyst Mode — centerpiece (ZonesPreview) ── */}
        <section className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  color: "#856292",
                  fontWeight: 700,
                }}
              >
                § Niya Tools · Analyst Mode · tier-gated
              </span>
              <h2
                className="font-serif-zine mt-2"
                style={{
                  fontSize: "clamp(44px,6.4vw,94px)",
                  fontWeight: 900,
                  lineHeight: 0.9,
                  letterSpacing: "-0.035em",
                  color: "#3A2E24",
                }}
              >
                zones, drawn on{" "}
                <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                  your chart.
                </em>
              </h2>
            </div>
            <div
              className="font-hand text-right"
              style={{ fontSize: 22, color: "#7A6450", maxWidth: "28ch" }}
            >
              floors, ceilings, trendlines, entry zones — overlaid live on
              the page you&apos;re already watching.
            </div>
          </div>

          {/* Centerpiece polaroid card */}
          <motion.div
            className="relative mx-auto mt-10"
            style={{ maxWidth: 880, transform: "rotate(-0.3deg)" }}
            initial={{ opacity: 0, y: 48, rotate: -5, scale: 0.92 }}
            whileInView={{ opacity: 1, y: 0, rotate: -0.3, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.1 }}
          >
            <div className="tape tape-violet" style={{ top: -14, left: 40 }} />
            <div
              className="tape tape-gold"
              style={{ top: -14, right: 80, transform: "rotate(5deg)" }}
            />
            {/* "analyst mode" stamp top-right */}
            <div
              className="absolute"
              style={{
                top: 18,
                right: -10,
                zIndex: 5,
                transform: "rotate(-4deg)",
              }}
            >
              <div
                className="stamp"
                style={{
                  background: "#FDF5E8",
                  borderColor: "#856292",
                  color: "#856292",
                  fontSize: 10,
                  padding: "5px 12px",
                }}
              >
                analyst mode
              </div>
            </div>

            <div className="paper p-6 md:p-8">
              {/* Animated preview */}
              <div className="relative">
                <ZonesPreview />
                {/* margin-note callouts (hidden on mobile) */}
                <div
                  className="hidden md:block absolute font-hand"
                  style={{
                    top: "-8px",
                    left: "-6px",
                    fontSize: 16,
                    color: "#856292",
                    transform: "rotate(-4deg)",
                  }}
                >
                  purple bands = Zone 2
                </div>
                <div
                  className="hidden md:block absolute font-hand"
                  style={{
                    top: "42%",
                    right: "-2px",
                    fontSize: 16,
                    color: "#B8913F",
                    transform: "rotate(3deg)",
                  }}
                >
                  gold line = price path
                </div>
                <div
                  className="hidden md:block absolute font-hand"
                  style={{
                    bottom: "-10px",
                    left: "2%",
                    fontSize: 15,
                    color: "#7A6450",
                  }}
                >
                  solid = boundary · dashed = midline
                </div>
              </div>

              {/* Pull quote */}
              <p
                className="mt-8 font-serif-zine"
                style={{
                  fontSize: 22,
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: "#3A2E24",
                  lineHeight: 1.4,
                  borderLeft: "4px solid #856292",
                  padding: "6px 14px",
                }}
              >
                &ldquo;not indicators. <span className="hl">interest.</span>{" "}
                where size showed up, where size defended, where it gave
                up.&rdquo;
              </p>

              {/* 5-factor grid with real numbers from ta.ts */}
              <div
                className="mt-6"
                style={{ borderTop: "1.5px dashed #C9A86C", paddingTop: 18 }}
              >
                <div
                  className="font-mono-zine"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: "#7A6450",
                  }}
                >
                  interest score · 5 factors · cap 89
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: "Zone 2 hit", pts: "+30", color: "#856292" },
                    { label: "Dave filter", pts: "+20", color: "#B8913F" },
                    { label: "Cheap side", pts: "+10", color: "#6B8E7F" },
                    { label: "Round №", pts: "+10", color: "#C47070" },
                    { label: "Volume spike", pts: "+10", color: "#856292" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="font-mono-zine text-center"
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: f.color,
                        border: `1.5px solid ${f.color}`,
                        borderRadius: 6,
                        padding: "6px 4px",
                        fontWeight: 700,
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 900 }}>
                        {f.pts}
                      </div>
                      <div style={{ marginTop: 2 }}>{f.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Host stickers */}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span
                  className="font-mono-zine"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.22em",
                    color: "#7A6450",
                  }}
                >
                  live overlay on →
                </span>
                <span className="sticker" style={{ background: "#FFE6C4" }}>
                  dexscreener
                </span>
                <span className="sticker" style={{ background: "#E7DDEF" }}>
                  four.meme
                </span>
                <span className="sticker" style={{ background: "#FFE6D8" }}>
                  pancakeswap
                </span>
              </div>

              {/* Honest gate footnote */}
              <div
                className="mt-4 font-mono-zine"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#9B8570",
                  borderTop: "1px dashed rgba(184,145,63,0.3)",
                  paddingTop: 10,
                }}
              >
                tier-gated · liquidity ≥ $50k · age ≥ 48h · no signals on
                fresh tokens
              </div>
            </div>
          </motion.div>
        </section>


        {/* TOOLS LEDGER SCRAPBOOK ─────────────────────── */}
        <section
          id="tools"
          className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span
                className="font-mono-zine"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  color: "#B8913F",
                  fontWeight: 700,
                }}
              >
                § Niya Tools · sample verdict · CAKE F-4
              </span>
              <h2
                className="font-serif-zine mt-2"
                style={{
                  fontSize: "clamp(44px,6.4vw,94px)",
                  fontWeight: 900,
                  lineHeight: 0.9,
                  letterSpacing: "-0.035em",
                  color: "#3A2E24",
                }}
              >
                Rug{" "}
                <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                  Risk.
                </em>
              </h2>
            </div>
            <div
              className="font-hand text-right"
              style={{ fontSize: 22, color: "#7A6450", maxWidth: "26ch" }}
            >
              same scan the extension runs, pulled out so you can see the
              ledger.
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Big verdict card */}
            <div
              className="relative md:col-span-7"
              style={{ transform: "rotate(-0.3deg)" }}
            >
              <div className="tape" style={{ top: -14, left: 40 }} />
              <div
                className="tape tape-gold"
                style={{ top: -14, right: 80, transform: "rotate(4deg)" }}
              />
              <div
                className="paper p-6"
                style={{ border: "1.5px dashed #C9A86C" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#B8913F",
                        fontWeight: 700,
                      }}
                    >
                      niya.tools · filing F-4
                    </div>
                    <div
                      className="font-hand mt-1"
                      style={{ fontSize: 22, color: "#3A2E24" }}
                    >
                      CA · 0x0e09…ce82 · CAKE
                    </div>
                  </div>
                  <motion.div
                    className="stamp"
                    style={{
                      borderColor: "#16A34A",
                      color: "#16A34A",
                      transformOrigin: "center",
                    }}
                    initial={{ scale: 0, rotate: 14, opacity: 0 }}
                    whileInView={{ scale: 1, rotate: 4, opacity: 1 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 14,
                      delay: 0.2,
                    }}
                  >
                    verified · ~8s
                  </motion.div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[160px_1fr]">
                  {/* Score */}
                  <div className="text-center md:text-left">
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#7A6450",
                      }}
                    >
                      rug risk
                    </div>
                    <div
                      className="font-serif-zine"
                      style={{
                        fontSize: "clamp(64px, 20vw, 148px)",
                        fontWeight: 900,
                        fontStyle: "italic",
                        lineHeight: 0.86,
                        letterSpacing: "-0.06em",
                        color: "#3A2E24",
                      }}
                    >
                      <AnimatedCounter target={8} duration={2.2} />
                    </div>
                    <div
                      className="font-hand"
                      style={{ fontSize: 22, color: "#16A34A", marginTop: -6 }}
                    >
                      · low risk ·
                    </div>
                    <div
                      className="mt-2"
                      style={{
                        height: 6,
                        borderRadius: 99,
                        background:
                          "linear-gradient(90deg,#22C55E 0%,#D9B160 50%,#E89B8B 100%)",
                        position: "relative",
                      }}
                    >
                      {/* Risk marker slides from 0% → 8% on scroll-into-view
                          — pairs with the counter above so the "8" number
                          and the position on the gradient bar animate in
                          sync. Spring easing gives it a slight overshoot. */}
                      <motion.span
                        initial={{ left: "0%", opacity: 0 }}
                        whileInView={{ left: "8%", opacity: 1 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          position: "absolute",
                          top: -5,
                          width: 3,
                          height: 16,
                          background: "#3A2E24",
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>

                  {/* Ledger rows */}
                  <div>
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#7A6450",
                        borderBottom: "1.5px solid #3A2E24",
                        paddingBottom: 4,
                      }}
                    >
                      microstructure ledger
                    </div>
                    {/* Ledger rows fill in one by one on scroll-into-view,
                        like a printer ticking out the report. Stagger
                        container + children variants so the children
                        inherit the parent's viewport trigger. */}
                    <motion.ul
                      className="mt-2"
                      style={{ color: "#3A2E24", fontSize: 13 }}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: "-40px" }}
                      variants={{
                        hidden: {},
                        visible: {
                          transition: {
                            staggerChildren: 0.12,
                            delayChildren: 0.3,
                          },
                        },
                      }}
                    >
                      {[
                        { k: "top-10 holders",      v: "2.6%",        tail: <span style={{ color: "#16A34A" }}>·</span> },
                        { k: "top-1 · Binance cold", v: "91.4%",       tail: <span style={{ color: "#B8913F" }}>custody</span> },
                        { k: "LP · 0xdead burn",    v: "locked 95%" },
                        { k: "honeypot · tax",      v: "no · 0/0" },
                        { k: "GMGN tags",           v: <span className="font-mono-zine" style={{ fontSize: 11 }}>whale · cex · smart</span>, last: true },
                      ].map((row, idx) => (
                        <motion.li
                          key={idx}
                          className="flex items-center justify-between py-1.5"
                          style={{
                            borderBottom: row.last ? undefined : "1px dashed #C9A86C",
                          }}
                          variants={{
                            hidden: { opacity: 0, x: -8 },
                            visible: {
                              opacity: 1,
                              x: 0,
                              transition: { duration: 0.4, ease: "easeOut" },
                            },
                          }}
                        >
                          <span className="font-hand" style={{ fontSize: 18 }}>
                            {row.k}
                          </span>
                          <span>
                            <b>{row.v}</b>
                            {row.tail && <> {row.tail}</>}
                          </span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </div>
                </div>

                {/* Ask Niya quote */}
                <div
                  className="mt-6 relative"
                  style={{
                    borderLeft: "4px solid #B8913F",
                    padding: "8px 14px",
                    background: "#FFF3D6",
                  }}
                >
                  <div
                    className="font-mono-zine"
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "#B8913F",
                      fontWeight: 700,
                    }}
                  >
                    ask niya · via DGrid
                  </div>
                  <p
                    className="mt-1 font-serif-zine"
                    style={{
                      fontSize: 18,
                      fontStyle: "italic",
                      fontWeight: 700,
                      color: "#3A2E24",
                      lineHeight: 1.5,
                    }}
                  >
                    &ldquo;CAKE is the PancakeSwap token. LP is 95% burned —
                    inert. Top-1 holder is Binance cold storage: custody, not
                    concentration. Rug probability: under 5%.&rdquo;
                  </p>
                </div>

                {/* Bottom stickers — bounce in one by one on scroll. Spring
                    physics gives a satisfying "stamped onto the page" feel
                    instead of a bland fade. */}
                <motion.div
                  className="mt-5 flex flex-wrap gap-2"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={{
                    hidden: {},
                    visible: {
                      transition: { staggerChildren: 0.08, delayChildren: 0.9 },
                    },
                  }}
                >
                  {[
                    { text: "Moralis · holders", bg: undefined },
                    { text: "GoPlus · honeypot", bg: "#E7DDEF" },
                    { text: "GMGN · tags", bg: "#FFE6D8" },
                    { text: "~8s median", bg: undefined },
                    { text: "Chrome MV3", bg: undefined },
                  ].map((s, i) => (
                    <motion.span
                      key={i}
                      className="sticker"
                      style={s.bg ? { background: s.bg } : undefined}
                      variants={{
                        hidden: { opacity: 0, scale: 0.6, rotate: -8 },
                        visible: {
                          opacity: 1,
                          scale: 1,
                          rotate: 0,
                          transition: {
                            type: "spring",
                            stiffness: 380,
                            damping: 18,
                          },
                        },
                      }}
                    >
                      {s.text}
                    </motion.span>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Right column: three feature notes */}
            <div className="md:col-span-5 grid grid-cols-1 gap-5">
              {/* Alerts */}
              <div className="relative" style={{ transform: "rotate(1.3deg)" }}>
                <div className="pin" style={{ top: -5, left: 28 }} />
                <div className="paper p-5">
                  <div className="flex items-baseline justify-between">
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#B8913F",
                        fontWeight: 700,
                      }}
                    >
                      § Alerts
                    </div>
                    <div
                      className="font-hand"
                      style={{ fontSize: 16, color: "#7A6450" }}
                    >
                      natural-language rules
                    </div>
                  </div>
                  <h3
                    className="font-serif-zine mt-1"
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      lineHeight: 1.05,
                      letterSpacing: "-0.015em",
                      color: "#3A2E24",
                    }}
                  >
                    type a rule.{" "}
                    <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                      niya watches.
                    </em>
                  </h3>
                  <ul className="mt-3" style={{ color: "#3A2E24", fontSize: 12 }}>
                    {[
                      { t: "ping me if top holder sells > 20%", s: "ACTIVE", c: "#6B8E7F" },
                      { t: "ping me if rug risk > 70", s: "ACTIVE", c: "#6B8E7F" },
                      { t: "ping me if LP lock drops < 50%", s: "PAUSED", c: "#9B8570", last: true },
                    ].map((r, i, arr) => (
                      <li
                        key={i}
                        className="flex items-center justify-between py-1.5"
                        style={{
                          borderBottom: r.last ? undefined : "1px dashed #C9A86C",
                        }}
                      >
                        <span className="font-hand" style={{ fontSize: 17 }}>
                          {r.t}
                        </span>
                        <span
                          className="font-mono-zine"
                          style={{ fontSize: 9, color: r.c, fontWeight: 700 }}
                        >
                          {r.s}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Analyst */}
              <div className="relative" style={{ transform: "rotate(-1deg)" }}>
                <div className="pin pin-gold" style={{ top: -5, right: 28 }} />
                <div className="paper-graph p-5">
                  <div className="flex items-baseline justify-between">
                    <div
                      className="font-mono-zine"
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#B8913F",
                        fontWeight: 700,
                      }}
                    >
                      § Analyst
                    </div>
                    <div
                      className="font-hand"
                      style={{ fontSize: 16, color: "#7A6450" }}
                    >
                      classical TA
                    </div>
                  </div>
                  <h3
                    className="font-serif-zine mt-1"
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      lineHeight: 1.05,
                      letterSpacing: "-0.015em",
                      color: "#3A2E24",
                    }}
                  >
                    floors, ceilings, trendlines — auto-drawn.
                  </h3>
                  <div style={{ marginTop: 8 }}>
                    <ChartPreview />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* BACK COVER ────────────────────────────────── */}
        <section className="relative mx-auto max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] px-5 py-14 md:py-20">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="md:col-span-7">
              <div className="relative" style={{ transform: "rotate(-0.4deg)" }}>
                <div className="tape tape-gold" style={{ top: -14, left: 60 }} />
                <div
                  className="paper-y p-8 md:p-12"
                  style={{ border: "1.5px dashed #C9A86C" }}
                >
                  <span
                    className="font-mono-zine"
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.22em",
                      color: "#B8913F",
                      fontWeight: 700,
                    }}
                  >
                    § back cover
                  </span>
                  <h2
                    className="font-serif-zine mt-4"
                    style={{
                      fontSize: "clamp(44px,6.4vw,100px)",
                      fontWeight: 900,
                      lineHeight: 0.88,
                      letterSpacing: "-0.035em",
                      color: "#3A2E24",
                    }}
                  >
                    come meet{" "}
                    <em style={{ color: "#B8913F", fontStyle: "italic" }}>
                      Niya.
                    </em>
                  </h2>
                  <p
                    className="font-hand mt-5"
                    style={{ fontSize: 28, color: "#7A6450", lineHeight: 1.3 }}
                  >
                    watch her stream · paste a token · read the source.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href="/companion"
                      className="sticker"
                      style={{
                        background: "#3A2E24",
                        color: "#FDF5E8",
                        borderColor: "#3A2E24",
                        fontSize: 15,
                        padding: "10px 18px",
                      }}
                    >
                      watch the stream →
                    </Link>
                    <Link
                      href="/tools"
                      className="sticker"
                      style={{ fontSize: 15, padding: "10px 18px" }}
                    >
                      analyze a token
                    </Link>
                    <a
                      href="https://github.com/0x-Keezy/niya-labs"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="sticker"
                      style={{ fontSize: 15, padding: "10px 18px" }}
                    >
                      source on GitHub
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="md:col-span-5 relative"
              style={{ transform: "rotate(1.4deg)" }}
            >
              <div
                className="tape"
                style={{ top: -14, left: 30, transform: "rotate(-5deg)" }}
              />
              <div className="polaroid">
                <div
                  className="relative overflow-hidden"
                  style={{
                    aspectRatio: "16 / 10",
                    background: "linear-gradient(160deg,#FFF3D6 0%,#FFE8B8 100%)",
                  }}
                >
                  <Image
                    src="/images/app-screenshot.png"
                    alt="Niya live on stream — BNB market HUD, chat, and avatar"
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div
                  className="font-hand mt-3 text-center"
                  style={{ fontSize: 24, color: "#3A2E24" }}
                >
                  see you on <span style={{ color: "#B8913F" }}>niyaagent.com</span> ✦
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER ─────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: "1.5px dashed #C9A86C",
            background: "#FFFBF5",
          }}
        >
          <div className="mx-auto flex max-w-[92rem] 2xl:max-w-[110rem] 3xl:max-w-[130rem] flex-col items-start justify-between gap-4 px-5 py-8 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <BrandMark size={34} rotate={-5} />
              <div>
                <div
                  className="font-serif-zine"
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    color: "#3A2E24",
                  }}
                >
                  Niya Labs
                </div>
                <div
                  className="font-hand"
                  style={{ fontSize: 13, color: "#7A6450", lineHeight: 1 }}
                >
                  made with 🔥 by the niya team
                </div>
              </div>
            </div>
            <div
              className="font-mono-zine flex flex-wrap items-center gap-x-5 gap-y-2"
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: "#7A6450",
              }}
            >
              <a
                href="https://x.com/NiyaAgent"
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: "#3A2E24" }}
              >
                @NiyaAgent
              </a>
              <a
                href="https://github.com/0x-Keezy/niya-labs"
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: "#3A2E24" }}
              >
                GitHub
              </a>
              <Link href="/tools" style={{ color: "#3A2E24" }}>
                niyaagent.com
              </Link>
              <span>© 2026 · not financial advice</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
