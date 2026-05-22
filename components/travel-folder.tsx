import React from 'react'
import { motion } from 'framer-motion'
import { Folder, ChevronRight, File } from 'lucide-react'

interface FolderItem {
  id: string
  name: string
  type: 'folder' | 'file'
  count?: number
  date?: string
}

interface TravelFolderProps {
  name: string
  items: FolderItem[]
  onItemClick?: (item: FolderItem) => void
  icon?: React.ReactNode
}

export function TravelFolder({
  name,
  items,
  onItemClick,
  icon,
}: TravelFolderProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)

  return (
    <div className="border border-border rounded overflow-hidden bg-card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </motion.div>
        {icon || <Folder className="w-4 h-4 text-muted-foreground" />}
        <span className="flex-1 text-sm font-medium text-foreground">
          {name}
        </span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {items.length}
        </span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: isExpanded ? 'auto' : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="border-t border-border divide-y divide-border">
          {items.map((item, idx) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onItemClick?.(item)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left text-xs"
            >
              {item.type === 'folder' ? (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {item.name}
                </p>
                {item.date && (
                  <p className="text-xs text-muted-foreground">
                    {item.date}
                  </p>
                )}
              </div>
              {item.count !== undefined && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {item.count}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
