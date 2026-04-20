"use client"

import React, { useEffect, useRef, useState } from "react"
import { clsx } from "clsx"

type TOverflowType = "x" | "y" | "both"

interface ScrollerProps {
  children: React.ReactNode
  overflow: TOverflowType
  height?: number | string
  width?: number | string
  withButtons?: boolean
  childrenContainerClassName?: string
}

const ArrowLeft = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.5 14.0607L9.96966 13.5303L5.14644 8.7071C4.75592 8.31658 4.75592 7.68341 5.14644 7.29289L9.96966 2.46966L10.5 1.93933L11.5607 2.99999L11.0303 3.53032L6.56065 7.99999L11.0303 12.4697L11.5607 13L10.5 14.0607Z"
    />
  </svg>
)

const ArrowRight = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.50001 1.93933L6.03034 2.46966L10.8536 7.29288C11.2441 7.68341 11.2441 8.31657 10.8536 8.7071L6.03034 13.5303L5.50001 14.0607L4.43935 13L4.96968 12.4697L9.43935 7.99999L4.96968 3.53032L4.43935 2.99999L5.50001 1.93933Z"
    />
  </svg>
)

export const Scroller = ({
  children,
  overflow,
  height = "100%",
  width = "100%",
  withButtons,
  childrenContainerClassName,
}: ScrollerProps) => {
  const items = React.Children.toArray(children)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showLeftOverlay, setShowLeftOverlay] = useState(false)
  const [showRightOverlay, setShowRightOverlay] = useState(false)
  const itemsRef = useRef<(HTMLDivElement | null)[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)

  const scrollToIndex = (index: number) => {
    if (index >= 0 && index < itemsRef.current.length && containerRef.current) {
      setCurrentIndex(index)
      const item = itemsRef.current[index]
      if (item) {
        containerRef.current.scrollTo({
          left: item.offsetLeft,
          behavior: "smooth",
        })
      }
    }
  }

  const handleButtonClick = (direction: "next" | "prev") => {
    const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1
    scrollToIndex(newIndex)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = containerRef.current
        setShowLeftOverlay((overflow === "x" || overflow === "both") && scrollLeft > 0)
        setShowRightOverlay((overflow === "x" || overflow === "both") && scrollLeft + clientWidth < scrollWidth - 5)
      }
    }

    handleScroll()
    const element = containerRef.current
    element?.addEventListener("scroll", handleScroll)
    return () => element?.removeEventListener("scroll", handleScroll)
  }, [overflow])

  return (
    <div className="relative overflow-hidden flex flex-col gap-2" style={{ width, height }}>
      <div
        className={clsx(
          "flex relative hide-scrollbar overflow-auto",
          overflow === "x" ? "flex-row" : "flex-col",
          childrenContainerClassName,
        )}
        ref={containerRef}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((child, index) => (
          <div key={index} ref={(el) => { itemsRef.current[index] = el }}>
            {child}
          </div>
        ))}
      </div>
      {withButtons && overflow === "x" && (
        <div className="flex justify-center gap-2 m-[1px] z-10">
          <button
            aria-label="scroll left"
            onClick={() => handleButtonClick("prev")}
            disabled={currentIndex === 0}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-black"
          >
            <ArrowLeft />
          </button>
          <button
            aria-label="scroll right"
            onClick={() => handleButtonClick("next")}
            disabled={currentIndex === itemsRef.current.length - 1}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-black"
          >
            <ArrowRight />
          </button>
        </div>
      )}
      <div
        className={clsx(
          "absolute top-0 bottom-0 w-10 h-full bg-gradient-to-r from-amber-500 to-transparent duration-300 pointer-events-none",
          showLeftOverlay ? "left-0" : "-left-10",
        )}
      />
      <div
        className={clsx(
          "absolute top-0 bottom-0 w-10 h-full bg-gradient-to-l from-amber-500 to-transparent duration-300 pointer-events-none",
          showRightOverlay ? "right-0" : "-right-10",
        )}
      />
    </div>
  )
}
