"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Rewind, FastForward, Play, Pause, Volume2, VolumeX } from "lucide-react"

export interface CarouselItem {
  id: number
  title: string
  audioUrl?: string
}

const createInfiniteItems = (originalItems: CarouselItem[]) => {
  const items: { id: string; title: string; audioUrl?: string; originalIndex: number }[] = []
  for (let i = 0; i < 3; i++) {
    originalItems.forEach((item, index) => {
      items.push({
        ...item,
        id: `${i}-${item.id}`,
        originalIndex: index,
      })
    })
  }
  return items
}

const RulerLines = ({
  top = true,
  totalLines = 100,
}: {
  top?: boolean
  totalLines?: number
}) => {
  const lines = []
  const lineSpacing = 100 / (totalLines - 1)

  for (let i = 0; i < totalLines; i++) {
    const isFifth = i % 5 === 0
    const isCenter = i === Math.floor(totalLines / 2)

    let height = "h-1.5"
    let color = "bg-gray-400"

    if (isCenter) {
      height = "h-4"
      color = "bg-black"
    } else if (isFifth) {
      height = "h-2"
      color = "bg-black"
    }

    const positionClass = top ? "" : "bottom-0"

    lines.push(
      <div
        key={i}
        className={`absolute w-0.5 ${height} ${color} ${positionClass}`}
        style={{ left: `${i * lineSpacing}%` }}
      />,
    )
  }

  return <div className="relative w-full h-4 px-4">{lines}</div>
}

export function RulerCarousel({
  originalItems,
}: {
  originalItems: CarouselItem[]
}) {
  const infiniteItems = createInfiniteItems(originalItems)
  const itemsPerSet = originalItems.length
  const itemWidth = 400
  const itemGap = 100

  const [activeIndex, setActiveIndex] = useState(itemsPerSet + 5)
  const [isResetting, setIsResetting] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [volume, setVolume] = useState(0.3)
  const [isMuted, setIsMuted] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const currentItem = originalItems[activeIndex % itemsPerSet]

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  const handleItemClick = (newIndex: number) => {
    if (isResetting) return
    setHasInteracted(true)

    const targetOriginalIndex = newIndex % itemsPerSet

    const possibleIndices = [
      targetOriginalIndex,
      targetOriginalIndex + itemsPerSet,
      targetOriginalIndex + itemsPerSet * 2,
    ]

    let closestIndex = possibleIndices[0]
    let smallestDistance = Math.abs(possibleIndices[0] - activeIndex)

    for (const index of possibleIndices) {
      const distance = Math.abs(index - activeIndex)
      if (distance < smallestDistance) {
        smallestDistance = distance
        closestIndex = index
      }
    }

    setActiveIndex(closestIndex)
  }

  const handlePrevious = () => {
    if (isResetting) return
    setHasInteracted(true)
    setActiveIndex((prev) => prev - 1)
  }

  const handleNext = () => {
    if (isResetting) return
    setHasInteracted(true)
    setActiveIndex((prev) => prev + 1)
  }

  const togglePlayPause = () => {
    setHasInteracted(true)
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  useEffect(() => {
    if (audioRef.current && currentItem.audioUrl) {
      audioRef.current.src = currentItem.audioUrl
      audioRef.current.volume = volume
      audioRef.current.load()

      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch(() => {
          setIsPlaying(false)
        })
    }
  }, [])

  useEffect(() => {
    if (audioRef.current && currentItem.audioUrl && hasInteracted) {
      audioRef.current.pause()
      audioRef.current.src = currentItem.audioUrl
      audioRef.current.load()

      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch(() => {
          setIsPlaying(false)
        })
    }
  }, [activeIndex, currentItem.audioUrl, hasInteracted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => {
      setActiveIndex((prev) => prev + 1)
    }

    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  useEffect(() => {
    if (isResetting) return

    if (activeIndex < itemsPerSet) {
      setIsResetting(true)
      setTimeout(() => {
        setActiveIndex(activeIndex + itemsPerSet)
        setIsResetting(false)
      }, 0)
    } else if (activeIndex >= itemsPerSet * 2) {
      setIsResetting(true)
      setTimeout(() => {
        setActiveIndex(activeIndex - itemsPerSet)
        setIsResetting(false)
      }, 0)
    }
  }, [activeIndex, itemsPerSet, isResetting])

  const totalItemWidth = itemWidth + itemGap
  const centerOffset = containerWidth / 2 - itemWidth / 2
  const targetX = centerOffset - activeIndex * totalItemWidth

  const currentPage = (activeIndex % itemsPerSet) + 1
  const totalPages = itemsPerSet

  return (
    <div className="w-full pt-8 flex flex-col items-center justify-center bg-white relative z-0">
      <audio ref={audioRef} />

      <div ref={containerRef} className="w-full h-[120px] flex flex-col justify-center relative">
        <div className="flex items-center justify-center">
          <RulerLines top />
        </div>
        <div className="flex items-center justify-center w-full h-full relative overflow-hidden">
          <motion.div
            className="flex items-center absolute left-0"
            style={{ gap: `${itemGap}px` }}
            animate={{
              x: targetX,
            }}
            transition={
              isResetting
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    mass: 1,
                  }
            }
          >
            {infiniteItems.map((item, index) => {
              const isActive = index === activeIndex

              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleItemClick(index)}
                  className={`text-2xl md:text-4xl font-bold whitespace-nowrap cursor-pointer flex items-center justify-center ${
                    isActive
                      ? "text-black"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  animate={{
                    scale: isActive ? 1 : 0.75,
                    opacity: isActive ? 1 : 0.4,
                  }}
                  transition={
                    isResetting
                      ? { duration: 0 }
                      : {
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }
                  }
                  style={{
                    width: `${itemWidth}px`,
                    flexShrink: 0,
                  }}
                >
                  {item.title}
                </motion.button>
              )
            })}
          </motion.div>
        </div>

        <div className="flex items-center justify-center">
          <RulerLines top={false} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mt-4 w-full max-w-4xl px-4 pr-24">
        <div className="flex items-center gap-2">
          {currentItem.audioUrl ? (
            <>
              <button
                onClick={toggleMute}
                className="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-black transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </>
          ) : (
            <div className="w-32" />
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevious}
            disabled={isResetting}
            className="flex items-center justify-center cursor-pointer"
            aria-label="Previous item"
          >
            <Rewind className="w-5 h-5 text-black/80" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">{currentPage}</span>
            <span className="text-sm text-gray-500">/</span>
            <span className="text-sm font-medium text-gray-600">{totalPages}</span>
          </div>

          <button
            onClick={handleNext}
            disabled={isResetting}
            className="flex items-center justify-center cursor-pointer"
            aria-label="Next item"
          >
            <FastForward className="w-5 h-5 text-black/80" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentItem.audioUrl ? (
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center text-black hover:text-gray-700 transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>
      </div>
    </div>
  )
}
