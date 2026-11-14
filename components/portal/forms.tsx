'use client'
import { useFormStatus } from 'react-dom'

export function SubmitButton({ children, pendingText = 'Saving…', className = 'pp-btn', ...rest }:
  { children: React.ReactNode; pendingText?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} {...rest}>
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
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending} {...rest}
      onClick={e => { if (!confirm(message)) e.preventDefault() }}>
      {pending ? '…' : children}
    </button>
  )
}
