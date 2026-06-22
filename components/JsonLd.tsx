// Renders a JSON-LD structured-data script. Server component — safe to embed
// the serialized data directly since it comes from our own trusted sources.
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
