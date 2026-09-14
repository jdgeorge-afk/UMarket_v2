// Placeholder sponsored ads — shown when no real ads exist in the database.
// Logos are inline SVGs so there are zero external dependencies / CORS issues.

const logo = {
  burton: `<svg viewBox="0 0 220 70" xmlns="http://www.w3.org/2000/svg">
    <text x="110" y="50" font-family="Arial Black,Impact,sans-serif" font-size="48" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="2">BURTON</text>
  </svg>`,

  salomon: `<svg viewBox="0 0 220 70" xmlns="http://www.w3.org/2000/svg">
    <text x="110" y="50" font-family="Arial Black,Impact,sans-serif" font-size="40" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="3">SALOMON</text>
  </svg>`,

  snowbird: `<svg viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(110,26)">
      <path d="M0-20 C8-10 20 0 0 16 C-20 0-8-10 0-20Z" fill="#c0392b"/>
      <path d="M-18-6 C-8-2 0 2 0 16 C-12 10-22 4-18-6Z" fill="#e74c3c"/>
      <path d="M18-6 C8-2 0 2 0 16 C12 10 22 4 18-6Z" fill="#c0392b"/>
    </g>
    <text x="110" y="66" font-family="Arial Black,Impact,sans-serif" font-size="22" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="3">SNOWBIRD</text>
  </svg>`,

  smith: `<svg viewBox="0 0 220 70" xmlns="http://www.w3.org/2000/svg">
    <text x="110" y="50" font-family="Arial Black,Impact,sans-serif" font-size="52" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="2">SMITH</text>
  </svg>`,

  alta: `<svg viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(110,28)" stroke="#1a3fc4" stroke-width="3" stroke-linecap="round">
      <line x1="0" y1="-20" x2="0" y2="20"/>
      <line x1="-20" y1="0" x2="20" y2="0"/>
      <line x1="-14" y1="-14" x2="14" y2="14"/>
      <line x1="14" y1="-14" x2="-14" y2="14"/>
      <line x1="-6" y1="-15" x2="0" y2="-20"/><line x1="6" y1="-15" x2="0" y2="-20"/>
      <line x1="-6" y1="15" x2="0" y2="20"/><line x1="6" y1="15" x2="0" y2="20"/>
      <line x1="15" y1="-6" x2="20" y2="0"/><line x1="15" y1="6" x2="20" y2="0"/>
      <line x1="-15" y1="-6" x2="-20" y2="0"/><line x1="-15" y1="6" x2="-20" y2="0"/>
    </g>
    <text x="110" y="72" font-family="Arial Black,Impact,sans-serif" font-size="24" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="6">ALTA</text>
  </svg>`,

  dakine: `<svg viewBox="0 0 220 70" xmlns="http://www.w3.org/2000/svg">
    <text x="110" y="50" font-family="Arial Black,Impact,sans-serif" font-size="46" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="2">DAKINE</text>
  </svg>`,
}

export const FAKE_ADS = [
  {
    id: 'fake-burton',
    company_name: 'Burton Snowboards',
    tagline: '20% off for students — shop now.',
    website_url: 'https://www.burton.com',
    cta: 'Shop the Deal',
    logoSvg: logo.burton,
    gradient: 'linear-gradient(145deg, #0f0f0f 0%, #1c1c2e 100%)',
  },
  {
    id: 'fake-salomon',
    company_name: 'Salomon',
    tagline: 'End-of-season gear — up to 50% off.',
    website_url: 'https://www.salomon.com',
    cta: 'Check Out This Deal',
    logoSvg: logo.salomon,
    gradient: 'linear-gradient(145deg, #111827 0%, #1f2d1e 100%)',
  },
  {
    id: 'fake-snowbird',
    company_name: 'Snowbird',
    tagline: 'Student season passes from $649. Ride more.',
    website_url: 'https://www.snowbird.com',
    cta: 'Get Your Pass',
    logoSvg: logo.snowbird,
    gradient: 'linear-gradient(145deg, #7f1d1d 0%, #991b1b 100%)',
  },
  {
    id: 'fake-smith',
    company_name: 'Smith Optics',
    tagline: 'New ChromaPop goggles — see every line.',
    website_url: 'https://www.smithoptics.com',
    cta: 'Shop Goggles',
    logoSvg: logo.smith,
    gradient: 'linear-gradient(145deg, #92400e 0%, #b45309 100%)',
  },
  {
    id: 'fake-alta',
    company_name: 'Alta Ski Area',
    tagline: '500+ inches of powder. Come get some.',
    website_url: 'https://www.alta.com',
    cta: 'Buy Lift Tickets',
    logoSvg: logo.alta,
    gradient: 'linear-gradient(145deg, #1e3a5f 0%, #1d4ed8 100%)',
  },
  {
    id: 'fake-dakine',
    company_name: 'Dakine',
    tagline: 'Free shipping on orders over $50.',
    website_url: 'https://www.dakine.com',
    cta: 'Shop Dakine',
    logoSvg: logo.dakine,
    gradient: 'linear-gradient(145deg, #0c4a6e 0%, #0369a1 100%)',
  },
]

// ── Full-width banner placeholders ────────────────────────────────────────────

export const FAKE_HOUSING_BANNER = {
  id: 'fake-banner-housing',
  company_name: 'The Standard at Salt Lake',
  headline: 'Student housing steps from campus.',
  tagline: 'Fully furnished studios, 1BR & 2BR — leases starting this fall.',
  website_url: '#',
  cta: 'View Availability',
  ctaColor: '#CC0000',
  gradient: 'linear-gradient(145deg, #1e3a5f 0%, #1d4ed8 50%, #3b82f6 100%)',
  logoSvg: `<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
    <text x="100" y="42" font-family="Arial Black,Impact,sans-serif" font-size="18" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="1">THE STANDARD</text>
  </svg>`,
  illustrationSvg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 90 L10 45 L50 15 L90 45 L90 90 Z"/>
    <rect x="38" y="62" width="24" height="28" rx="2"/>
    <rect x="20" y="55" width="16" height="14" rx="2"/>
    <rect x="64" y="55" width="16" height="14" rx="2"/>
    <path d="M50 15 L50 8"/>
  </svg>`,
}

export const FAKE_MARKETPLACE_BANNER = {
  id: 'fake-banner-marketplace',
  company_name: 'The Pie Pizzeria',
  headline: '20% off for U of U students.',
  tagline: 'Show your student ID at any location — dine in or order online.',
  website_url: '#',
  cta: 'Order Now',
  ctaColor: '#CC0000',
  gradient: 'linear-gradient(145deg, #ff6b35 0%, #f59e0b 100%)',
  logoSvg: `<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
    <text x="100" y="42" font-family="Arial Black,Impact,sans-serif" font-size="22" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="1">THE PIE</text>
  </svg>`,
  illustrationSvg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50" cy="50" r="38"/>
    <path d="M50 12 L50 50 L82 66"/>
    <path d="M50 50 L18 66"/>
    <circle cx="40" cy="38" r="4" fill="white" stroke="none"/>
    <circle cx="60" cy="42" r="4" fill="white" stroke="none"/>
    <circle cx="48" cy="62" r="4" fill="white" stroke="none"/>
  </svg>`,
}
