"use client"

import Link from "next/link"
import Image from "next/image"

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const scrollToFeatures = () => {
    const secondVideoElement = document.querySelector(".relative.z-40.isolate")
    if (secondVideoElement) {
      secondVideoElement.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <footer className="my-8 px-4 max-w-5xl mx-auto">
      <div className="relative bg-white rounded-3xl max-w-5xl mx-auto px-4 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4 md:gap-10 px-2 md:px-8 flex-1">
          <div className="flex flex-col items-start gap-2">
            <Link href="/" className="flex flex-row gap-1 items-center justify-start">
              <Image
                src="/nekoformsleeping.png"
                alt="Niya sleeping cat"
                width={120}
                height={80}
                className="object-contain"
              />
            </Link>
            <p className="text-gray-600 font-medium text-base w-full md:w-4/5">
              A VTuber who streams, trades, and reads tokens on BNB. Nya~
            </p>
          </div>

          <div className="flex flex-col md:mx-4 md:flex-row gap-2 md:gap-20 items-start md:items-start">
            <div className="flex flex-col gap-1 md:gap-4">
              <h4 className="uppercase font-bold text-md text-gray-600">Links</h4>
              <div className="flex flex-wrap md:flex-col gap-2 text-sm items-start">
                <button
                  onClick={scrollToTop}
                  className="text-gray-600 whitespace-nowrap font-medium hover:text-black text-left"
                >
                  Home
                </button>
                <button
                  onClick={scrollToFeatures}
                  className="text-gray-600 whitespace-nowrap font-medium hover:text-black text-left"
                >
                  Features
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 md:gap-4">
              <h4 className="uppercase font-bold text-md text-gray-600">Social</h4>
              <div className="flex flex-col gap-2 text-sm items-start">
                <Link
                  className="text-gray-600 whitespace-nowrap font-medium hover:text-black"
                  href="https://x.com/NiyaAgent"
                  target="_blank"
                  rel="noreferrer nofollow noopener"
                >
                  Twitter
                </Link>
                <Link
                  className="text-gray-600 whitespace-nowrap font-medium hover:text-black"
                  href="https://twitch.tv"
                  target="_blank"
                  rel="noreferrer nofollow noopener"
                >
                  Twitch
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="my-3 px-4 md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm text-gray-600">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-8 items-start sm:items-center">
          <p className="whitespace-nowrap text-white">&copy;{currentYear} Niya. All rights reserved.</p>
          <div className="flex flex-row gap-4">
            <Link href="/privacy" className="hover:text-black text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-black text-white">
              Terms
            </Link>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <a
            href="https://x.com/NiyaAgent"
            target="_blank"
            rel="noreferrer nofollow noopener"
            aria-label="X (Twitter)"
            className="hover:opacity-80 transition-opacity"
          >
            <Image src="/xlogo.png" alt="X (Twitter)" width={20} height={20} className="object-contain" />
          </a>
        </div>
      </div>
    </footer>
  )
}
