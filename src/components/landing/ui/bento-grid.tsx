"use client"

import type React from "react"
import { motion } from "framer-motion"
import { clsx } from "clsx"

interface BentoGridProps {
  className?: string
  children?: React.ReactNode
}

export const BentoGrid = ({ className, children }: BentoGridProps) => {
  return (
    <div className={clsx("grid md:auto-rows-[14rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto", className)}>
      {children}
    </div>
  )
}

interface BentoGridItemProps {
  className?: string
  title?: string | React.ReactNode
  description?: string | React.ReactNode
  header?: React.ReactNode
  icon?: React.ReactNode
}

export const BentoGridItem = ({ className, title, description, header, icon }: BentoGridItemProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={clsx(
        "row-span-1 rounded-xl group/bento hover:shadow-xl transition duration-200 shadow-input bg-white border border-gray-200 justify-between flex flex-col space-y-4 p-4",
        className,
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-2 transition duration-200">
        {icon}
        <div className="font-sans font-bold text-black mb-2 mt-2">{title}</div>
        <div className="font-sans font-normal text-gray-600 text-xs">{description}</div>
      </div>
    </motion.div>
  )
}
