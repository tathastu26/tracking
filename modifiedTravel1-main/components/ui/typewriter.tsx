import React from 'react'

export default function Typewriter({ text, speed = 35 }: { text: string; speed?: number }) {
  const [idx, setIdx] = React.useState(0)

  React.useEffect(() => {
    setIdx(0)
    if (!text) return
    const id = window.setInterval(() => {
      setIdx((i) => {
        if (i >= text.length) {
          clearInterval(id)
          return i
        }
        return i + 1
      })
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])

  return <span>{text.slice(0, idx)}</span>
}
