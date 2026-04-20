"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"

interface LoadingScreenProps {
  isVisible?: boolean
  onFadeComplete?: () => void
}

function LoadingCard() {
  return (
    <div className="relative">
      <div 
        className="relative rounded-2xl p-1.5"
        style={{
          background: "linear-gradient(135deg, #C9A86C 0%, #E8D4A8 50%, #C9A86C 100%)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
        }}
      >
        <div 
          className="rounded-xl p-1"
          style={{
            background: "#FFFEF9",
            border: "2px dashed #C9A86C"
          }}
        >
          <div 
            className="flex flex-col items-center justify-center px-16 py-10 rounded-lg"
            style={{ background: "#FFFEF9" }}
          >
            <div className="flex gap-2 mb-4">
              <span 
                className="w-3 h-3 rounded-full animate-bounce"
                style={{ 
                  backgroundColor: "#C9A86C",
                  animationDelay: "0ms",
                  animationDuration: "1s"
                }}
              />
              <span 
                className="w-3 h-3 rounded-full animate-bounce"
                style={{ 
                  backgroundColor: "#D4A853",
                  animationDelay: "150ms",
                  animationDuration: "1s"
                }}
              />
              <span 
                className="w-3 h-3 rounded-full animate-bounce"
                style={{ 
                  backgroundColor: "#E8C77B",
                  animationDelay: "300ms",
                  animationDuration: "1s"
                }}
              />
            </div>
            <h2 
              className="text-2xl font-semibold tracking-wide"
              style={{ color: "#C9A86C" }}
            >
              Loading...
            </h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LoadingScreenOverlay({ isVisible = true, onFadeComplete }: LoadingScreenProps) {
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [opacity, setOpacity] = useState(0)
  const initialMountRef = useRef(true)

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true)
      if (initialMountRef.current) {
        initialMountRef.current = false
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setOpacity(1)
          })
        })
      } else {
        requestAnimationFrame(() => {
          setOpacity(1)
        })
      }
    } else {
      setOpacity(0)
      const timer = setTimeout(() => {
        setShouldRender(false)
        onFadeComplete?.()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onFadeComplete])

  if (!shouldRender) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ 
        backgroundImage: "url('/images/backvtber.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity,
        transition: "opacity 500ms ease-in-out",
        pointerEvents: isVisible ? "auto" : "none"
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(255, 248, 231, 0.3)" }} />
      <div className="relative z-10">
        <LoadingCard />
      </div>
    </div>
  )
}

const isCompanionPath = (url: string) =>
  url === "/companion" ||
  url === "/companion/" ||
  url.startsWith("/companion?")

export default function LoadingScreen() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Fix #1a: el 500ms fade-complete se escapaba de clearTimers antes.
  // Trackeado en ref ahora para que una nueva navegación lo cancele.
  const fadeCompleteTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Fix #1b: source-of-truth para detectar cambios de ruta aun cuando
  // `routeChangeStart` no dispare (back button / popstate). Comparamos
  // `pathname` (no `asPath`) para que cambios de query-string — como
  // el `?ca=0x…` que escribe /tools al analizar un token con
  // `router.replace({ shallow: true })` — NO disparen el splash.
  const prevPathRef = useRef<string>(router.pathname)
  // Guarda la ruta viva para los event handlers (evita closures stale).
  // `pathnameRef` para decisiones de splash; `asPathRef` por si algún
  // handler futuro necesita la URL completa.
  const pathnameRef = useRef<string>(router.pathname)
  pathnameRef.current = router.pathname
  const asPathRef = useRef<string>(router.asPath)
  asPathRef.current = router.asPath

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = null
    }
    if (fadeCompleteTimerRef.current) {
      clearTimeout(fadeCompleteTimerRef.current)
      fadeCompleteTimerRef.current = null
    }
  }

  const startFadeOut = () => {
    clearTimers()
    setIsFadingOut(true)
    fadeCompleteTimerRef.current = setTimeout(() => {
      setIsLoading(false)
      setIsFadingOut(false)
      fadeCompleteTimerRef.current = null
    }, 500)
  }

  // Fix #1b: safety-net sobre `router.pathname`. Dispara en back-button,
  // popstate y cualquier transición donde `routeChangeStart` falle.
  // Hard-reset del state + arma un timer agresivo si seguimos cargando.
  //
  // Usar `pathname` y no `asPath` es crítico: `asPath` incluye el query
  // string (`/tools?ca=0x…`), por lo que una navegación shallow que sólo
  // cambia el query (el "Analyze" de /tools) dispararía este safety net
  // y mostraría splash sin razón.
  useEffect(() => {
    if (prevPathRef.current === router.pathname) return
    prevPathRef.current = router.pathname
    clearTimers()
    setIsFadingOut(false)
    // Si llegamos aquí con isLoading=true sin timers activos, armar uno.
    // Si no estamos cargando, este timer es no-op (startFadeOut is idempotent).
    const ms = isCompanionPath(router.pathname) ? 3000 : 1200
    safetyTimeoutRef.current = setTimeout(startFadeOut, ms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname])

  useEffect(() => {
    // Show the splash on every route transition so the jump between
    // landing / /tools / /companion feels intentional. Heavy route
    // (/companion) waits for a `NIYA_READY` postMessage from the VTuber
    // or falls back after 2.5s; light routes fade out after 800ms.
    //
    // Robustness layers (see also Fix #1a/b/c in plan):
    //  1. `routeChangeError` — navegación abortada cae en el mismo fade.
    //  2. Absolute safety timeout — tope duro por encima de todo evento.
    //  3. PostMessage origin + source check estricto + scope guard a
    //     `/companion` (evita NIYA_READY fantasma desde subscribe leaks).

    const scheduleFadeOut = (url: string) => {
      clearTimers()
      const fallbackMs = isCompanionPath(url) ? 2500 : 800
      timeoutRef.current = setTimeout(startFadeOut, fallbackMs)
      const safetyMs = isCompanionPath(url) ? 5000 : 2000
      safetyTimeoutRef.current = setTimeout(startFadeOut, safetyMs)
    }

    // Fix #1b: extraer pathname de una URL entrante (Next.js pasa el
     // `asPath` al handler, con query + hash). Si el pathname destino es
     // el mismo que el actual, es shallow nav (sólo cambia query) → no
     // mostrar splash.
    const pathnameOf = (url: string | undefined) =>
      (url ?? "").split("?")[0].split("#")[0]

    const handleRouteChangeStart = (url: string) => {
      const incomingPath = pathnameOf(url)
      if (incomingPath && incomingPath === pathnameRef.current) {
        // Shallow query-only nav (ej. /tools → /tools?ca=0x…). No hay
        // contenido nuevo que cargar — no mostramos splash.
        return
      }
      clearTimers()
      setIsLoading(true)
      setIsFadingOut(false)
      const destination = incomingPath || pathnameRef.current
      const safetyMs = isCompanionPath(destination) ? 5000 : 2000
      safetyTimeoutRef.current = setTimeout(startFadeOut, safetyMs)
    }

    const handleRouteChangeComplete = (url: string) => {
      const incomingPath = pathnameOf(url)
      if (incomingPath && incomingPath === pathnameRef.current) {
        // Shallow query-only nav — no iniciamos un fade (tampoco se
        // inició un splash en Start). No-op.
        return
      }
      scheduleFadeOut(incomingPath || url)
    }

    const handleRouteChangeError = () => {
      scheduleFadeOut(pathnameRef.current)
    }

    const handleNiyaReady = (event: MessageEvent) => {
      // Fix #1c: AND estricto (el `||` previo tenía paréntesis mal y
      // aceptaba mensajes con origin válido pero source != window, o
      // viceversa). Además scope-guard: NIYA_READY sólo es válido
      // en `/companion`. Mata fantasmas residuales de subscribe leaks.
      const isOwnWindow =
        event.source === window &&
        (typeof window === "undefined" ||
          event.origin === window.location.origin)
      if (!isOwnWindow) return
      if (
        event.data?.type === "NIYA_READY" &&
        isCompanionPath(pathnameRef.current)
      ) {
        startFadeOut()
      }
    }

    router.events.on("routeChangeStart", handleRouteChangeStart)
    router.events.on("routeChangeComplete", handleRouteChangeComplete)
    router.events.on("routeChangeError", handleRouteChangeError)
    window.addEventListener("message", handleNiyaReady)

    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart)
      router.events.off("routeChangeComplete", handleRouteChangeComplete)
      router.events.off("routeChangeError", handleRouteChangeError)
      window.removeEventListener("message", handleNiyaReady)
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  if (!isLoading) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ 
        backgroundImage: "url('/images/backvtber.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: isFadingOut ? 0 : 1,
        transition: "opacity 500ms ease-in-out",
        pointerEvents: isFadingOut ? "none" : "auto"
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(255, 248, 231, 0.3)" }} />
      <div className="relative z-10">
        <LoadingCard />
      </div>
    </div>
  )
}
