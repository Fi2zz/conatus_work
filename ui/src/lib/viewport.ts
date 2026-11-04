import { useEffect, useState } from 'react'

/** 视口宽度；窄窗口下工作台会自动收起任务列表，避免中栏被压成一条线。 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    function onResize(): void {
      setWidth(window.innerWidth)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}
