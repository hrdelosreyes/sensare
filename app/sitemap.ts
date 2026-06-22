import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { absoluteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/shop'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/pages/the-sensare-ritual'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/faq'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/contact'), lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: absoluteUrl('/shipping'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  let productRoutes: MetadataRoute.Sitemap = []
  try {
    const { data } = await supabaseAdmin()
      .from('sensare_products')
      .select('slug, updated_at')
      .eq('is_active', true)
    productRoutes = (data || []).map((p: { slug: string; updated_at?: string }) => ({
      url: absoluteUrl(`/shop/${p.slug}`),
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))
  } catch {
    // If the DB is unreachable at build/request time, still return static routes.
  }

  return [...staticRoutes, ...productRoutes]
}
