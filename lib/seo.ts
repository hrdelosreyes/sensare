// Canonical site configuration for SEO.
// Canonical host is the non-www apex domain: https://mysensare.com
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://mysensare.com').replace(/\/$/, '')
export const SITE_NAME = 'Sensarè Chocolates'
export const SITE_DESCRIPTION =
  'Artisanal dark chocolate infused with ancient botanicals — crafted for couples to awaken desire, elevate intimacy, and deepen connection.'

export function absoluteUrl(path = ''): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

// Organization / brand structured data — rendered once in the root layout.
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl('/logo-sensare.png'),
  description: SITE_DESCRIPTION,
  email: 'hello@mysensare.com',
  areaServed: 'PH',
  sameAs: [] as string[],
}
