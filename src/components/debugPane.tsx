import { useEffect, useRef, useState } from "react";
import { Switch } from '@headlessui/react'
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { clsx } from "clsx";
import { config } from "@/utils/config";
import { XMarkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { IconCode, IconBug } from '@tabler/icons-react';

const TOTAL_ITEMS_TO_SHOW = 100;

function SwitchToggle({ enabled, set }: {
  enabled: boolean;
  set: (enabled: boolean) => void;
}) {
  return (
    <Switch
      className="group ml-1 relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-0"
      checked={enabled}
      onChange={set}
    >
      <span className="sr-only">Use setting</span>
      <span aria-hidden="true" className="pointer-events-none absolute h-full w-full rounded-md" />
      <span
        aria-hidden="true"
        className={clsx(
          enabled ? 'bg-emerald-500/50' : 'bg-white/20',
          'pointer-events-none absolute mx-auto h-3 w-7 rounded-full transition-colors duration-200 ease-in-out'
        )}
      />
      <span
        aria-hidden="true"
        className={clsx(
          enabled ? 'translate-x-4' : 'translate-x-0',
          'pointer-events-none absolute left-0 inline-block h-4 w-4 transform rounded-full border border-white/20 bg-white shadow ring-0 transition-transform duration-200 ease-in-out'
        )}
        />
    </Switch>
  )
}

export function DebugPane({ onClickClose }: {
  onClickClose: () => void
}) {
  const [typeDebugEnabled, setTypeDebugEnabled] = useState(false);
  const [typeInfoEnabled, setTypeInfoEnabled] = useState(true);
  const [typeWarnEnabled, setTypeWarnEnabled] = useState(true);
  const [typeErrorEnabled, setTypeErrorEnabled] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcut("Escape", onClickClose);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  }, []);

  function onClickCopy() {
    navigator.clipboard.writeText(JSON.stringify((window as any).error_handler_logs));
  }

  const logs = (window as any).error_handler_logs?.slice(-TOTAL_ITEMS_TO_SHOW).filter((log: any) => {
    if (log.type === 'debug' && !typeDebugEnabled) return false;
    if ((log.type === 'info' || log.type === 'log') && !typeInfoEnabled) return false;
    if (log.type === 'warn' && !typeWarnEnabled) return false;
    if (log.type === 'error' && !typeErrorEnabled) return false;
    
    const logStr = [...log.arguments].map((v: unknown) => 
      (typeof v === 'object') ? JSON.stringify(v) : String(v)
    ).join(" ");
    
    if (logStr.includes('i18next:') || 
        logStr.includes('missingKey') || 
        logStr.includes('languageChanged') ||
        logStr.includes('[Fast Refresh]') ||
        logStr.includes('[HMR]')) {
      return false;
    }
    
    return true;
  }) || [];

  return (
    <div 
      className={clsx(
        "fixed right-4 top-1/2 -translate-y-1/2 w-96 max-h-[70vh] z-40 flex flex-col",
        "bg-gradient-to-br from-slate-900/90 to-black/90 backdrop-blur-xl rounded-2xl border border-slate-500/30",
        "shadow-2xl shadow-black/40 transition-all duration-300"
      )}
      data-testid="panel-debug"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-500/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-500/20 rounded-lg">
            <IconBug className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Debug Console</h3>
            <p className="text-slate-400/60 text-[10px]">
              {config("chatbot_backend")} | {config("tts_backend")} | {config("stt_backend")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClickCopy}
            className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            title="Copy logs"
            data-testid="button-copy-logs"
          >
            <ClipboardDocumentIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onClickClose}
            className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            data-testid="button-close-debug"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-2 border-b border-slate-500/20 flex flex-wrap gap-2">
        <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
          <SwitchToggle enabled={typeDebugEnabled} set={setTypeDebugEnabled} />
          <span className="text-slate-500">debug</span>
        </label>
        <label className="flex items-center gap-1 text-[10px] text-green-400 cursor-pointer">
          <SwitchToggle enabled={typeInfoEnabled} set={setTypeInfoEnabled} />
          <span>info</span>
        </label>
        <label className="flex items-center gap-1 text-[10px] text-yellow-400 cursor-pointer">
          <SwitchToggle enabled={typeWarnEnabled} set={setTypeWarnEnabled} />
          <span>warn</span>
        </label>
        <label className="flex items-center gap-1 text-[10px] text-red-400 cursor-pointer">
          <SwitchToggle enabled={typeErrorEnabled} set={setTypeErrorEnabled} />
          <span>error</span>
        </label>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <IconCode className="w-8 h-8 text-slate-500/30 mb-2" />
            <p className="text-white/30 text-sm">No logs to display</p>
            <p className="text-white/20 text-xs mt-1">Enable filters above to see logs</p>
          </div>
        ) : (
          logs.map((log: any, idx: number) => (
            <div 
              key={log.ts+idx} 
              className={clsx(
                "p-2 rounded-lg text-[11px] font-mono break-all",
                log.type === 'error' ? 'bg-red-500/10 border border-red-500/20' : 
                log.type === 'warn' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                'bg-white/5 border border-white/5'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                { log.type === 'debug' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-500/30 text-slate-300">DBG</span>
                )}
                { (log.type === 'info' || log.type === 'log') && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-500/30 text-green-300">INF</span>
                )}
                { log.type === 'warn' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-yellow-500/30 text-yellow-300">WRN</span>
                )}
                { log.type === 'error' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/30 text-red-300">ERR</span>
                )}
                <span className="text-slate-500 text-[9px]">{new Date(log.ts).toLocaleTimeString()}</span>
              </div>
              <span className={clsx(
                "leading-relaxed",
                log.type === 'error' ? 'text-red-200' :
                log.type === 'warn' ? 'text-yellow-200' :
                'text-slate-300'
              )}>
                {[...log.arguments].map((v) =>
                  (typeof v === 'object') ? JSON.stringify(v) : v)
                  .join(" ").slice(0, 500)}
                {[...log.arguments].map((v) =>
                  (typeof v === 'object') ? JSON.stringify(v) : v)
                  .join(" ").length > 500 ? '...' : ''}
              </span>
            </div>
          ))
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
