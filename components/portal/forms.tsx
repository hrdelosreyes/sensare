'use client'
import { createContext, useContext, useTransition } from 'react'
import { useFormStatus } from 'react-dom'

const PendingContext = createContext(false)

/**
 * A form for Server Actions that keeps what the user typed when the action
 * returns an error. (React 19 resets a <form action={fn}> after every
 * submission, which would wipe a long form on a simple validation error.)
 * `beforeSubmit` can cancel the submission, e.g. to ask for confirmation.
 */
export function ActionForm({ action, beforeSubmit, children, ...rest }: {
  action: (fd: FormData) => void
  beforeSubmit?: (submitter: HTMLElement | null) => boolean
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'>) {
  const [pending, start] = useTransition()
  return (
    <PendingContext.Provider value={pending}>
      <form {...rest} onSubmit={e => {
        e.preventDefault()
        if (pending) return
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
        if (beforeSubmit && !beforeSubmit(submitter)) return
        const fd = new FormData(e.currentTarget, submitter)
        start(() => action(fd))
      }}>
        {children}
      </form>
    </PendingContext.Provider>
  )
}

function usePending() {
  const { pending } = useFormStatus()
  const ctxPending = useContext(PendingContext)
  return pending || ctxPending
}

export function SubmitButton({ children, pendingText = 'Saving…', className = 'pp-btn', ...rest }:
  { children: React.ReactNode; pendingText?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const pending = usePending()
  return (
    <button type="submit" className={className} {...rest} disabled={pending || rest.disabled}>
      {pending ? pendingText : children}
    </button>
  )
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (!state) return null
  if (state.error) return <div className="pp-alert pp-alert-error" role="alert">{state.error}</div>
  if (state.ok) return <div className="pp-alert pp-alert-ok" role="status">{state.ok}</div>
  return null
}

// Button that asks for confirmation before submitting its form.
export function ConfirmButton({ message, children, className = 'pp-btn pp-btn-sm', ...rest }:
  { message: string; children: React.ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const pending = usePending()
  return (
    <button type="submit" className={className} disabled={pending} {...rest}
      onClick={e => { if (!confirm(message)) e.preventDefault() }}>
      {pending ? '…' : children}
    </button>
  )
}
