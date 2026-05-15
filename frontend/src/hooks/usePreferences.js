/**
 * Client-side UI preferences (font family, etc.) — persisted in localStorage.
 *
 * These differ from the server-side "user preferences" memories (which live
 * on the backend and influence the LLM's responses). These ones just control
 * how the app looks.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'wealth_ui_prefs'

export const FONT_OPTIONS = [
  { id: 'inter',         label: 'Inter',              stack: "'Inter', system-ui, -apple-system, sans-serif",            sample: 'The quick brown fox' },
  { id: 'jakarta',       label: 'Plus Jakarta Sans',  stack: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",       sample: 'The quick brown fox' },
  { id: 'source-sans',   label: 'Source Sans 3',      stack: "'Source Sans 3', 'Inter', system-ui, sans-serif",           sample: 'The quick brown fox' },
  { id: 'roboto',        label: 'Roboto',             stack: "'Roboto', system-ui, sans-serif",                           sample: 'The quick brown fox' },
  { id: 'system',        label: 'System',             stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif", sample: 'The quick brown fox' },
  { id: 'lora',          label: 'Lora (serif)',       stack: "'Lora', Georgia, 'Times New Roman', serif",                 sample: 'The quick brown fox' },
  { id: 'mono',          label: 'JetBrains Mono',     stack: "'JetBrains Mono', 'SF Mono', Menlo, monospace",             sample: 'The quick brown fox' },
]

const DEFAULTS = { font: 'inter' }

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}

function write(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

function applyFont(fontId) {
  const opt = FONT_OPTIONS.find(f => f.id === fontId) || FONT_OPTIONS[0]
  document.documentElement.style.setProperty('--font', opt.stack)
}

export function usePreferences() {
  const [prefs, setPrefs] = useState(read)

  useEffect(() => { applyFont(prefs.font) }, [prefs.font])

  const update = useCallback((patch) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      write(next)
      return next
    })
  }, [])

  return { prefs, update, fontOptions: FONT_OPTIONS }
}

// Apply persisted font on initial module load so there is no flash of default font.
applyFont(read().font)
