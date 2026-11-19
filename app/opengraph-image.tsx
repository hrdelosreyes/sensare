import { ImageResponse } from 'next/og'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo'

export const alt = SITE_NAME
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Share preview in the site palette: blush base, plum text, rose-copper and rose-gold accents.
export default async function Image() {
  const pub = (f: string) => join(process.cwd(), 'public', f)
  const [logo, playfair, playfairItalic, allura] = await Promise.all([
    readFile(pub('logo-sensare.png'), 'base64'),
    readFile(pub('fonts/PlayfairDisplay-Bold.ttf')),
    readFile(pub('fonts/PlayfairDisplay-Italic.ttf')),
    readFile(pub('fonts/Allura-Regular.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'linear-gradient(135deg, #FCF5F2 0%, #F8E7E2 55%, #F6E1E5 100%)',
          fontFamily: 'Playfair',
        }}
      >
        {/* soft decorative circles */}
        <div style={{ position: 'absolute', right: -140, top: -160, width: 520, height: 520, borderRadius: 520, background: 'rgba(201,138,150,0.18)', display: 'flex' }} />
        <div style={{ position: 'absolute', left: -120, bottom: -200, width: 420, height: 420, borderRadius: 420, background: 'rgba(71,107,102,0.08)', display: 'flex' }} />
        {/* inner rose-gold frame */}
        <div style={{ position: 'absolute', left: 28, top: 28, right: 28, bottom: 28, border: '2px solid rgba(201,144,106,0.55)', display: 'flex' }} />

        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 120px',
          }}
        >
          <img src={`data:image/png;base64,${logo}`} width={190} height={190} alt="" />
          <div style={{ fontFamily: 'Allura', fontSize: 52, color: '#A4523F', marginTop: 4 }}>Two Hearts. One Indulgence.</div>
          <div style={{ fontFamily: 'PlayfairItalic', fontSize: 28, color: '#6E4E55', marginTop: 14, lineHeight: 1.4, maxWidth: 900, display: 'flex', justifyContent: 'center' }}>
            {SITE_DESCRIPTION}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 34, fontSize: 20, letterSpacing: 4, textTransform: 'uppercase', color: '#3B2026' }}>
            <span>Dark Chocolate for Couples</span>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: '#C9906A', margin: '0 18px', display: 'flex' }} />
            <span>Davao Cacao</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Playfair', data: playfair, weight: 700, style: 'normal' },
        { name: 'PlayfairItalic', data: playfairItalic, weight: 400, style: 'italic' },
        { name: 'Allura', data: allura, weight: 400, style: 'normal' },
      ],
    }
  )
}
