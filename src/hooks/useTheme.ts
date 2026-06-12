import { useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'

/** Applies the chosen theme to <html data-theme>. 'system' follows the OS
    setting live via prefers-color-scheme. */
export function useTheme(): void {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')

    function apply() {
      const resolved =
        theme === 'system' ? (media.matches ? 'light' : 'dark') : theme
      document.documentElement.dataset.theme = resolved
    }

    apply()

    if (theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
  }, [theme])
}
