"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { BookOpen, Clock } from "lucide-react"

export interface GlassBlogCardProps {
  title: string
  excerpt?: string
  image: string
  author?: {
    name: string
    avatar?: string
  }
  date?: string
  readTime?: string
  tags?: string[]
  className?: string
  href?: string
  actionLabel?: string
}

export function GlassBlogCard({
  title,
  excerpt,
  image,
  author,
  date,
  readTime,
  tags = [],
  className,
  href,
  actionLabel = "Ver",
}: GlassBlogCardProps) {
  const initial = author?.name?.trim().charAt(0) || title.trim().charAt(0) || "?"
  const body = (
    <Card className="group relative h-full gap-0 overflow-hidden rounded-2xl border-border/50 bg-card/30 py-0 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10">
      <div className="relative aspect-[16/9] overflow-hidden">
        <motion.img
          src={image}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-40" />

        {tags.length > 0 ? (
          <div className="absolute bottom-3 left-3 flex gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <motion.span
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25"
          >
            <BookOpen className="h-4 w-4" />
            {actionLabel}
          </motion.span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
            {title}
          </h3>
          {excerpt ? <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt}</p> : null}
        </div>

        {author || date || readTime ? (
          <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-8 w-8 border border-border/50">
                {author?.avatar ? <AvatarImage src={author.avatar} alt="" /> : null}
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col text-xs">
                <span className="truncate font-medium text-foreground">{author?.name ?? title}</span>
                {date ? <span className="truncate text-muted-foreground">{date}</span> : null}
              </div>
            </div>

            {readTime ? (
              <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{readTime}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("w-full max-w-[400px]", className)}
    >
      {href ? (
        <a href={href} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {body}
        </a>
      ) : (
        body
      )}
    </motion.div>
  )
}
