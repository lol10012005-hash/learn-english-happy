import { useEffect, useRef } from 'react'
import { GOOGLE_CLIENT_ID } from '../config'

type Props = {
  onCredential: (credential: string) => void
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export default function GoogleSignIn({ onCredential }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onCredential)

  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    function init() {
      if (!window.google || !buttonRef.current) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => callbackRef.current(response.credential),
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        locale: 'vi',
        width: 280,
      })
    }

    if (window.google) {
      init()
      return
    }

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    )
    if (!script) {
      script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', init)
    return () => script?.removeEventListener('load', init)
  }, [])

  return <div ref={buttonRef} />
}