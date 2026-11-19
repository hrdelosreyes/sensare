# Brand

**Audience:** women — romantic gifting, intimacy, self-care. Grown-up and sensual, not "girly" (no bubblegum pink).

## Typography
| Use | Font |
|-----|------|
| Wordmark "Sensarè" | Oleo Script (700) |
| Script accents ("Begin the Ritual", "The Collection") | Allura |
| Headings and body | Playfair Display |

## Colour
Current site (until changed): monochromatic warm brown/rose gold (hue 12–33°) on near-black. Owner finds it too dark.

Applied 2026-11-19 (review: https://claude.ai/artifact/8CvmHXVMANuVi2u7xGmCXf). Tokens live in `app/globals.css` (`--bg`, `--fg`, `--accent`, `--berry`, `--sage`…; old names like `--cream`/`--rose-gold` are mapped onto them). Wrap dark image bands and the footer in `className="on-dark"`. Emails (`lib/email-layout.ts`) and the share image (`app/opengraph-image.tsx`) use the light palette too.
analogous rose-gold (24°) → rose/berry (~345°) family + split-complementary sage-eucalyptus (171°); 60/30/10.

| Role | Hex |
|------|-----|
| Page background (blush ivory) | #FCF5F2 |
| Sections (petal) | #F8E7E2 |
| Cards | #FFFCFB |
| Main text (plum cocoa) | #3B2026 |
| Secondary text | #6E4E55 |
| Buttons/links (rose copper) / hover | #A4523F / #8A4232 |
| Signature rose gold (wordmark, script, lines; text only on dark) | #C9906A |
| Dark bands (hero, ritual feature, footer) | #33191F |
| Dusty rose (decorative) / tint | #C98A96 / #F6E1E5 |
| Berry (sale, gift, hearts) | #8E3B54 |
| Sage-eucalyptus (botanicals, success) / tint | #476B66 / #E3EEEC |

All text pairings pass WCAG AA. Rose gold fails as text on light (2.5:1) — decorative only there.
