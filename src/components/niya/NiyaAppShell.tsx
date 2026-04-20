"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

type NiyaAppShellProps = {
  stream: React.ReactNode;
  chat?: React.ReactNode;
  bottom: React.ReactNode;
  contentReady?: boolean;
  fontClasses?: string;
  showBackLink?: boolean;
};

export function NiyaAppShell({
  stream,
  chat,
  bottom,
  contentReady = true,
  fontClasses = "",
  showBackLink = true,
}: NiyaAppShellProps) {
  return (
    <div
      className={clsx(fontClasses, "min-h-[100dvh] text-[#6B5344] relative")}
      style={{
        backgroundImage: `url('/images/backvtber.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        opacity: contentReady ? 1 : 0,
        transition: "opacity 500ms ease-in-out",
      }}
    >
      {/* Overlay suave como en v0 */}
      <div className="absolute inset-0 bg-[#FFF8E7]/20" />

      <div className="relative z-10">
        {/* Header — safe-area padding keeps the BACK link clear of the iPhone
            notch when the device is rotated to landscape. */}
        {showBackLink && (
          <div
            className="p-4 md:p-6"
            style={{
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
              paddingTop: "max(1rem, env(safe-area-inset-top))",
            }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#6B5344]/80 hover:text-[#6B5344] transition-colors text-lg"
              data-testid="link-back"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="font-medium">BACK</span>
            </Link>
          </div>
        )}

        {/* Main Content — same safe-area insets so the stream/chat frames do
            not slide under the notch in landscape. */}
        <div
          className="px-4 md:px-6 pb-10 max-w-[1600px] 2xl:max-w-[1760px] 3xl:max-w-[2080px] mx-auto"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          {/* Stream + Chat Section */}
          {chat ? (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* STREAM (frame v0) */}
              <div className="flex-1 min-w-0 relative min-h-[400px] md:min-h-[520px] lg:min-h-[650px]">
                <div className="absolute -inset-3 bg-[#E8D4A8] rounded-[2rem] border-4 border-[#C9A86C]" />
                <div
                  className="absolute -inset-1 bg-[#FFF8E7] rounded-[1.5rem] border-2 border-[#E8D4A8]"
                  style={{
                    borderStyle: "dashed",
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(232, 212, 168, 0.2) 10px, rgba(232, 212, 168, 0.2) 20px)",
                  }}
                />
                <div className="relative rounded-2xl overflow-hidden bg-white h-full border-2 border-[#E8D4A8]">
                  {stream}
                </div>
              </div>
              
              {/* CHAT (frame v0) */}
              <div className="w-full lg:w-[340px] shrink-0 relative min-h-[320px] md:min-h-[420px] lg:min-h-[650px]">
                <div className="absolute -inset-3 bg-[#E8D4A8] rounded-[2rem] border-4 border-[#C9A86C]" />
                <div
                  className="absolute -inset-1 bg-[#FFF8E7] rounded-[1.5rem] border-2 border-[#E8D4A8]"
                  style={{ borderStyle: "dashed" }}
                />
                <div className="relative rounded-2xl border-2 border-[#E8D4A8] bg-[#FFFEF9] flex flex-col h-full overflow-hidden shadow-lg">
                  {chat}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-[400px] md:min-h-[500px] lg:min-h-[600px]">
              <div className="absolute -inset-3 bg-[#E8D4A8] rounded-[2rem] border-4 border-[#C9A86C]" />
              <div
                className="absolute -inset-1 bg-[#FFF8E7] rounded-[1.5rem] border-2 border-[#E8D4A8]"
                style={{
                  borderStyle: "dashed",
                  backgroundImage:
                    "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(232, 212, 168, 0.2) 10px, rgba(232, 212, 168, 0.2) 20px)",
                }}
              />
              <div className="relative rounded-2xl overflow-hidden bg-white h-full border-2 border-[#E8D4A8]">
                {stream}
              </div>
            </div>
          )}

          {/* BOTTOM INFO (frame v0) */}
          <div className="mt-10 relative">
            <div className="absolute -inset-3 bg-[#E8D4A8] rounded-[2rem] border-4 border-[#C9A86C]" />
            <div
              className="absolute -inset-1 bg-[#FFF8E7] rounded-[1.5rem] border-2 border-[#E8D4A8]"
              style={{ borderStyle: "dashed" }}
            />
            <div className="relative p-6 md:p-8 rounded-2xl border-2 border-[#E8D4A8] bg-[#FFFEF9] shadow-lg">
              {bottom}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
