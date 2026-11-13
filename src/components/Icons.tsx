// Hand-drawn SVG icons for the YGO Assistant theme. Our own art: no Konami logos, characters or card art.
import { useId } from 'react'

type P = { size?: number; className?: string }

/** gradient/filter ids must be unique per instance */
function useIds(...names: string[]) {
  const base = useId().replace(/:/g, '')
  return Object.fromEntries(names.map((n) => [n, `${base}-${n}`])) as Record<string, string>
}

export function Crown({ size = 30, className }: P) {
  const id = useIds('g', 'glow')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id.g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".45" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#9a6a16" />
        </linearGradient>
        <filter id={id.glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${id.glow})`}>
        <path d="M8 46 L4 18 L20 32 L32 10 L44 32 L60 18 L56 46 Z" fill={`url(#${id.g})`} stroke="#5a3a06" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="8" y="47" width="48" height="8" rx="2" fill={`url(#${id.g})`} stroke="#5a3a06" strokeWidth="1.5" />
        <circle cx="32" cy="10" r="4" fill="#5fd0ff" stroke="#fff" strokeWidth="1" />
        <circle cx="4" cy="18" r="3" fill="#b07cff" />
        <circle cx="60" cy="18" r="3" fill="#b07cff" />
        <circle cx="32" cy="38" r="4" fill="#d23a4a" stroke="#fff3" />
      </g>
    </svg>
  )
}

/** Two fanned card backs (Deck Builder). */
export function CardsIcon({ size = 76, className }: P) {
  const id = useIds('back', 'rim', 'glow')
  const back = (rot: number, x: number) => (
    <g transform={`rotate(${rot} 50 60) translate(${x} 0)`}>
      <rect x="26" y="18" width="48" height="68" rx="4" fill={`url(#${id.rim})`} />
      <rect x="29" y="21" width="42" height="62" rx="2.5" fill={`url(#${id.back})`} />
      <ellipse cx="50" cy="52" rx="13" ry="18" fill="none" stroke="#f2c14e" strokeWidth="1.6" />
      <ellipse cx="50" cy="52" rx="7" ry="10" fill="#f2c14e" opacity=".35" />
      <path d="M50 38 L54 52 L50 66 L46 52 Z" fill="#ffe08a" />
      <path d="M33 25 h34 M33 79 h34" stroke="#f2c14e" strokeWidth="1" opacity=".6" />
    </g>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={id.back} cx=".5" cy=".5" r=".7">
          <stop offset="0" stopColor="#8a4a14" />
          <stop offset=".6" stopColor="#4a220a" />
          <stop offset="1" stopColor="#1f0c04" />
        </radialGradient>
        <linearGradient id={id.rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset=".5" stopColor="#c8902a" />
          <stop offset="1" stopColor="#6e4610" />
        </linearGradient>
        <filter id={id.glow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f2c14e" floodOpacity=".55" />
        </filter>
      </defs>
      <g filter={`url(#${id.glow})`}>
        {back(-12, -8)}
        {back(10, 8)}
      </g>
    </svg>
  )
}

/** Shield with crossed swords (Counter Deck). */
export function ShieldIcon({ size = 76, className }: P) {
  const id = useIds('face', 'rim', 'blade', 'glow')
  const sword = (rot: number) => (
    <g transform={`rotate(${rot} 50 52)`}>
      <path d="M48.5 16 L51.5 16 L52.5 70 L50 76 L47.5 70 Z" fill={`url(#${id.blade})`} stroke="#2a3a60" strokeWidth=".8" />
      <rect x="40" y="70" width="20" height="4" rx="2" fill="#f2c14e" stroke="#5a3a06" strokeWidth=".8" />
      <rect x="48" y="74" width="4" height="10" rx="1" fill="#6b4a1a" />
      <circle cx="50" cy="86" r="3" fill="#f2c14e" />
    </g>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={id.face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f7cff" />
          <stop offset=".55" stopColor="#1b3a9a" />
          <stop offset="1" stopColor="#0d1d55" />
        </linearGradient>
        <linearGradient id={id.rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9f6ff" />
          <stop offset=".5" stopColor="#9fb6d8" />
          <stop offset="1" stopColor="#4b5d80" />
        </linearGradient>
        <linearGradient id={id.blade} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9fb6d8" />
        </linearGradient>
        <filter id={id.glow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#5fd0ff" floodOpacity=".7" />
        </filter>
      </defs>
      <g filter={`url(#${id.glow})`}>
        <path d="M50 8 L84 20 C84 52 72 76 50 92 C28 76 16 52 16 20 Z" fill={`url(#${id.rim})`} />
        <path d="M50 14 L78 24 C78 52 68 72 50 85 C32 72 22 52 22 24 Z" fill={`url(#${id.face})`} />
        <path d="M50 14 L50 85" stroke="#5fd0ff" strokeWidth=".8" opacity=".5" />
        {sword(-38)}
        {sword(38)}
      </g>
    </svg>
  )
}

/** Magnifying glass over a card (Card Search). */
export function SearchIcon({ size = 76, className }: P) {
  const id = useIds('card', 'lens', 'rim', 'glow')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={id.card} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a6dff" />
          <stop offset="1" stopColor="#1a1f6e" />
        </linearGradient>
        <radialGradient id={id.lens} cx=".35" cy=".35" r=".8">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset=".4" stopColor="#7fdcff" stopOpacity=".25" />
          <stop offset="1" stopColor="#5fd0ff" stopOpacity=".1" />
        </radialGradient>
        <linearGradient id={id.rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f8ff" />
          <stop offset="1" stopColor="#7d8fb3" />
        </linearGradient>
        <filter id={id.glow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#7f9cff" floodOpacity=".7" />
        </filter>
      </defs>
      <g filter={`url(#${id.glow})`}>
        <g transform="rotate(-10 40 50)">
          <rect x="14" y="16" width="44" height="64" rx="4" fill="#c9d6ff" />
          <rect x="17" y="19" width="38" height="58" rx="2.5" fill={`url(#${id.card})`} />
          <rect x="21" y="25" width="30" height="24" rx="1" fill="#0b1240" stroke="#7fdcff" strokeWidth=".8" />
          <path d="M21 56 h30 M21 61 h26 M21 66 h28" stroke="#9fb6ff" strokeWidth="1.4" opacity=".7" />
        </g>
        <path d="M66 66 L86 88" stroke="#4b3a1a" strokeWidth="10" strokeLinecap="round" />
        <path d="M66 66 L86 88" stroke="#c8902a" strokeWidth="6" strokeLinecap="round" />
        <circle cx="56" cy="54" r="19" fill={`url(#${id.lens})`} stroke={`url(#${id.rim})`} strokeWidth="5" />
        <path d="M45 46 a13 13 0 0 1 10 -6" stroke="#fff" strokeWidth="2" fill="none" opacity=".8" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Four-point star (Combos). */
export function StarIcon({ size = 76, className }: P) {
  const id = useIds('g', 'glow')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={id.g} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".35" stopColor="#d9c2ff" />
          <stop offset="1" stopColor="#7a3cff" />
        </radialGradient>
        <filter id={id.glow} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#b07cff" floodOpacity=".9" />
        </filter>
      </defs>
      <g filter={`url(#${id.glow})`}>
        <circle cx="50" cy="50" r="30" fill="none" stroke="#5fd0ff" strokeWidth="1.2" strokeDasharray="3 4" opacity=".7" />
        <path d="M50 8 C54 38 62 46 92 50 C62 54 54 62 50 92 C46 62 38 54 8 50 C38 46 46 38 50 8 Z" fill={`url(#${id.g})`} />
        <path d="M74 22 C75 30 78 33 86 34 C78 35 75 38 74 46 C73 38 70 35 62 34 C70 33 73 30 74 22 Z" fill="#ffe08a" />
      </g>
    </svg>
  )
}

/** Red "BANLIST" stamp. */
export function BanlistIcon({ size = 64, className }: P) {
  const id = useIds('g')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={id.g} cx=".5" cy=".5" r=".7">
          <stop offset="0" stopColor="#5a0a12" />
          <stop offset="1" stopColor="#1e0306" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id.g})`} />
      <g transform="rotate(-12 50 50)">
        <rect x="8" y="34" width="84" height="32" rx="3" fill="none" stroke="#ff4a5c" strokeWidth="3.5" />
        <rect x="12" y="38" width="76" height="24" rx="2" fill="none" stroke="#ff4a5c" strokeWidth="1.2" />
        <text x="50" y="57" textAnchor="middle" fontFamily="Impact, 'Arial Black', sans-serif" fontSize="19" fill="#ff5a6a" letterSpacing="1">
          BANLIST
        </text>
      </g>
      <circle cx="18" cy="22" r="1.5" fill="#ff4a5c" opacity=".6" />
      <circle cx="84" cy="80" r="2" fill="#ff4a5c" opacity=".5" />
    </svg>
  )
}

/** Card with a glowing frame (card database). */
export function CardFrameIcon({ size = 64, className }: P) {
  const id = useIds('bg', 'art')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={id.bg} cx=".5" cy=".4" r=".8">
          <stop offset="0" stopColor="#1d4fa8" />
          <stop offset="1" stopColor="#06122e" />
        </radialGradient>
        <linearGradient id={id.art} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bfe9ff" />
          <stop offset="1" stopColor="#3a6dd8" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id.bg})`} />
      <rect x="28" y="12" width="44" height="76" rx="3" fill="#d8e6ff" />
      <rect x="31" y="15" width="38" height="70" rx="2" fill="#203a8a" />
      <rect x="34" y="22" width="32" height="30" fill={`url(#${id.art})`} />
      <path d="M38 46 L46 34 L52 42 L58 30 L64 46 Z" fill="#fff" opacity=".7" />
      <path d="M34 58 h32 M34 63 h28 M34 68 h30 M34 73 h22" stroke="#9fb6ff" strokeWidth="1.6" opacity=".8" />
      <path d="M30 17 h4 M66 17 h4" stroke="#f2c14e" strokeWidth="2" />
    </svg>
  )
}

/** Golden scales (deck legality). */
export function ScalesIcon({ size = 64, className }: P) {
  const id = useIds('bg', 'gold')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={id.bg} cx=".5" cy=".5" r=".75">
          <stop offset="0" stopColor="#2a1a4a" />
          <stop offset="1" stopColor="#0c0718" />
        </radialGradient>
        <linearGradient id={id.gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".5" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#9a6a16" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id.bg})`} />
      <g stroke={`url(#${id.gold})`} fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M50 18 V80" />
        <path d="M22 30 H78" />
        <path d="M22 30 L12 56 M22 30 L32 56 M78 30 L68 56 M78 30 L88 56" strokeWidth="1.5" />
      </g>
      <path d="M10 56 Q22 68 34 56 Z" fill={`url(#${id.gold})`} />
      <path d="M66 56 Q78 68 90 56 Z" fill={`url(#${id.gold})`} />
      <path d="M36 84 H64 L58 78 H42 Z" fill={`url(#${id.gold})`} />
      <circle cx="50" cy="16" r="4" fill={`url(#${id.gold})`} />
    </svg>
  )
}

/** Purple "TCG" badge. */
export function TcgIcon({ size = 64, className }: P) {
  const id = useIds('bg', 'gem')
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={id.bg} cx=".5" cy=".5" r=".75">
          <stop offset="0" stopColor="#3a1680" />
          <stop offset="1" stopColor="#0f0626" />
        </radialGradient>
        <linearGradient id={id.gem} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2ccff" />
          <stop offset=".5" stopColor="#9b5cf0" />
          <stop offset="1" stopColor="#4a1a9a" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id.bg})`} />
      <path d="M50 12 L84 30 V70 L50 88 L16 70 V30 Z" fill={`url(#${id.gem})`} stroke="#f0e2ff" strokeWidth="2" />
      <path d="M50 20 L77 34 V66 L50 80 L23 66 V34 Z" fill="none" stroke="#fff" strokeWidth=".8" opacity=".5" />
      <text x="50" y="59" textAnchor="middle" fontFamily="'Arial Black', Impact, sans-serif" fontSize="22" fill="#fff" stroke="#3a0d80" strokeWidth=".8">
        TCG
      </text>
    </svg>
  )
}

export function Megaphone({ size = 26, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M4 13 h5 l13 -7 v20 l-13 -7 h-5 z" fill="#f2c14e" stroke="#7a5310" strokeWidth="1" strokeLinejoin="round" />
      <path d="M9 19 l2 8 h4 l-2 -8" fill="#c8902a" />
      <path d="M25 11 q3 5 0 10" stroke="#f2c14e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Calendar({ size = 13, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5 h13 M5 1.5 v3 M11 1.5 v3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function Star({ size = 22, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2 l2.9 6.3 6.9 .8 -5.1 4.7 1.4 6.8 L12 17.2 5.9 20.6 7.3 13.8 2.2 9.1 9.1 8.3 Z" fill="#f2c14e" stroke="#7a5310" strokeWidth=".8" />
    </svg>
  )
}
