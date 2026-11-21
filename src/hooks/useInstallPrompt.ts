import { useEffect, useState } from 'react'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
}

export function useInstallPrompt(): InstallPrompt | null {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  return prompt
}
