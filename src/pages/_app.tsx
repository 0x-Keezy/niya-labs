import '@/i18n';

import "@/styles/globals.css";
import "@charcoal-ui/icons";
import { useEffect } from "react";
import type { AppProps } from "next/app";
import LoadingScreen from "@/components/niya/LoadingScreenNiya";

export default function App({ Component, pageProps }: AppProps) {
  // App-wide suppressor for the "Object is disposed" error that
  // lightweight-charts throws from its internal fancy-canvas
  // ResizeObserver AFTER chart.remove() runs on /tools unmount.
  //
  // Installed at the root so it survives route changes. Previously this
  // lived inside Chart.tsx and auto-removed itself on unmount — which
  // happens a few ms BEFORE the race-condition paint fires, so the
  // listener was gone by the time it was needed and the Next.js dev
  // overlay ended up catching the throw. Moving it here keeps a single
  // listener active for the entire SPA lifetime.
  //
  // Production users never see Next.js overlays; this exists purely as
  // dev-quality-of-life. The filter is intentionally narrow — any other
  // error message propagates normally.
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = event.error?.message ?? event.message ?? "";
      if (msg.includes("Object is disposed")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? "");
      if (msg.includes("Object is disposed")) {
        event.preventDefault();
      }
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <>
      <LoadingScreen />
      <Component {...pageProps} />
    </>
  );
}
