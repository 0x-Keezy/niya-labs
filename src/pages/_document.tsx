import { useEffect, useState } from "react";
import { buildUrl } from "@/utils/buildUrl";
import { Html, Head, Main, NextScript } from "next/document";
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script'

export default function Document() {
  const title = "Niya Labs — AI VTuber + Token Analyzer on BNB";
  const description = "Niya Labs: an AI VTuber and BNB token analyzer—both powered by DGrid AI Gateway. She streams. It reads. You decide.";
  // Base URL drives both the canonical link and the OG/Twitter image URL so
  // preview/staging deploys don't leak a production URL into social cards.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://niyaagent.com';
  const canonicalUrl = baseUrl;
  const imageUrl = `${baseUrl}/og/niya-og.png`;

  return (
    <Html lang="en">
      <Head>
        {/* Viewport meta — explicit so mobile zoom + safe-area work even
            when a page-level <Head> might otherwise suppress Next's
            auto-injected tag. `viewport-fit=cover` unlocks notch safe
            areas on iPhone X+. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />

        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
        <meta name="apple-mobile-web-app-title" content={title} />
        <meta name="application-name" content={title} />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {/* Fontshare — hosts Cabinet Grotesk, used by the .font-serif-zine
            class for landing display titles. Preconnect first so the font
            request overlaps with Google Fonts' download. Weights 400/500/700
            /800 cover nav (regular) through hero display (bold). */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=M+PLUS+2&family=Montserrat:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Caveat:wght@400;600;700&family=Kalam:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <Script
          src="/debugLogger.js"
          strategy="beforeInteractive"
        />
        <Script
          src="/ammo.wasm.js"
          strategy="beforeInteractive"
        />
        {/* Live2D Cubism Core - only cubismcore needed for pixi-live2d-display */}
        <Script
          src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"
          strategy="beforeInteractive"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
      {/* GA defaults OFF — set NEXT_PUBLIC_GA_ENABLED=true only after shipping a cookie consent banner. */}
      {process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_GA_ENABLED === "true" && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID!} />
      )}
    </Html>
  );
}
