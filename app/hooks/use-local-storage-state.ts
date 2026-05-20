import { useEffect, useState } from 'react'

export function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const initial = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore write errors (private mode, quota, etc.)
    }
  }, [key, value])

  return [value, setValue] as const
}

