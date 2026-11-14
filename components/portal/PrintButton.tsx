'use client'
export default function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return <button type="button" className="pp-btn pp-btn-ghost pp-btn-sm no-print" onClick={() => window.print()}>{label}</button>
}
