// Shop shipping fees (used by the checkout form and the checkout API).
//  - Metro Manila ₱100, everywhere else ₱150
//  - Free for orders of ₱1,000+ and for products marked free_shipping (e.g. The Ritual Bundle)

export const METRO_MANILA = 'Metro Manila'
export const FEE_METRO_MANILA = 100
export const FEE_PROVINCIAL = 150
export const FREE_SHIPPING_FROM = 1000

export const PROVINCES = [
  METRO_MANILA,
  'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique', 'Apayao', 'Aurora',
  'Basilan', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan',
  'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes', 'Cavite', 'Cebu',
  'Cotabato', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental',
  'Dinagat Islands', 'Eastern Samar', 'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo',
  'Isabela', 'Kalinga', 'La Union', 'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'Leyte',
  'Maguindanao del Norte', 'Maguindanao del Sur', 'Marinduque', 'Masbate', 'Misamis Occidental',
  'Misamis Oriental', 'Mountain Province', 'Negros Occidental', 'Negros Oriental', 'Northern Samar',
  'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Pampanga',
  'Pangasinan', 'Quezon', 'Quirino', 'Rizal', 'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon',
  'South Cotabato', 'Southern Leyte', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur',
  'Tarlac', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay',
] as const

export function isProvince(v: string) {
  return (PROVINCES as readonly string[]).includes(v)
}

/** Shipping fee in pesos for one order. */
export function shippingFee({ subtotal, province, freeShipping }: { subtotal: number; province: string; freeShipping?: boolean }) {
  if (freeShipping || subtotal >= FREE_SHIPPING_FROM) return 0
  return province === METRO_MANILA ? FEE_METRO_MANILA : FEE_PROVINCIAL
}
