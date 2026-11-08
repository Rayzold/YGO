import { useState } from 'react'
import { sendMagicLink } from '../lib/sync'
import { useStore } from '../state'

export function AuthModal(props: { onClose: () => void }) {
  const { t } = useStore()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    try {
      await sendMagicLink(email.trim())
      setState('sent')
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : String(err) })
    }
  }
  return (
    <div className="modal-back" onClick={props.onClose}>
      <form className="modal auth" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="close" aria-label={t('common.close')} onClick={props.onClose}>
          ×
        </button>
        <h2>{t('auth.title')}</h2>
        <p className="muted">{t('auth.body')}</p>
        {state === 'sent' ? (
          <p className="ok-text">{t('auth.sent')}</p>
        ) : (
          <>
            <label>
              {t('auth.email')}
              <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button type="submit" disabled={state === 'sending'}>
              {t('auth.send')}
            </button>
            {typeof state === 'object' && <p className="err-text">{state.error}</p>}
          </>
        )}
      </form>
    </div>
  )
}
