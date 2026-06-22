import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo'

export const alt = SITE_NAME
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 100px',
          background: 'linear-gradient(135deg, #0f0705 0%, #2d1810 100%)',
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 700, color: '#c9906a', letterSpacing: -1 }}>
          Sensarè
        </div>
        <div
          style={{
            fontSize: 30,
            color: '#faf0e4',
            marginTop: 28,
            lineHeight: 1.4,
            maxWidth: 880,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
        <div
          style={{
            fontSize: 22,
            color: '#c9906a',
            marginTop: 40,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          Aphrodisiac Dark Chocolate · Davao Cacao
        </div>
      </div>
    ),
    { ...size }
  )
}
