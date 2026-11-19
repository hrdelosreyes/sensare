import 'server-only'
import { revalidatePath } from 'next/cache'

// The home, shop and product pages are cached and rebuilt at most once a minute
// (see `revalidate` in those pages). Call this after stock or product changes so
// shoppers see the new numbers right away instead of up to a minute later.
export function refreshShopPages() {
  revalidatePath('/')
  revalidatePath('/shop')
  revalidatePath('/shop/[slug]', 'page')
}
