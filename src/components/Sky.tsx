// Full-page background: ice-blue magic on the left, arcane purple on the right, rune circles and lightning.
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'

function RuneCircle({ cx, cy, r, color, cls, idp }: { cx: number; cy: number; r: number; color: string; cls: string; idp: string }) {
  const ring = (rr: number) => `M ${cx - rr} ${cy} a ${rr} ${rr} 0 1 1 ${rr * 2} 0 a ${rr} ${rr} 0 1 1 ${-rr * 2} 0`
  return (
    <g className={cls} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <path id={`${idp}-a`} d={ring(r - 16)} fill="none" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="2" opacity=".55" />
      <circle cx={cx} cy={cy} r={r - 30} fill="none" stroke={color} strokeWidth="1.2" opacity=".45" />
      <circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke={color} strokeWidth="1" strokeDasharray="6 8" opacity=".5" />
      <text fill={color} opacity=".55" fontSize="22" letterSpacing="9" fontFamily="'Segoe UI Symbol', 'Noto Sans Runic', serif">
        <textPath href={`#${idp}-a`}>{RUNES.repeat(3)}</textPath>
      </text>
      {/* hexagram inside */}
      {[0, 60].map((rot) => (
        <polygon
          key={rot}
          transform={`rotate(${rot} ${cx} ${cy})`}
          points={[0, 120, 240].map((a) => {
            const t = ((a - 90) * Math.PI) / 180
            return `${cx + r * 0.55 * Math.cos(t)},${cy + r * 0.55 * Math.sin(t)}`
          }).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          opacity=".45"
        />
      ))}
    </g>
  )
}

function Bolt({ d, color, w = 2.5 }: { d: string; color: string; w?: number }) {
  return (
    <g className="bolt">
      <path d={d} stroke={color} strokeWidth={w * 4} fill="none" opacity=".18" strokeLinejoin="round" />
      <path d={d} stroke="#fff" strokeWidth={w} fill="none" opacity=".85" strokeLinejoin="round" />
    </g>
  )
}

export function Sky() {
  return (
    <div className="sky" aria-hidden>
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="sky-l" cx=".18" cy=".38" r=".55">
            <stop offset="0" stopColor="#3fa8ff" stopOpacity=".85" />
            <stop offset=".45" stopColor="#1544b8" stopOpacity=".55" />
            <stop offset="1" stopColor="#070a1c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sky-r" cx=".82" cy=".38" r=".55">
            <stop offset="0" stopColor="#b25cff" stopOpacity=".85" />
            <stop offset=".45" stopColor="#4a1a9a" stopOpacity=".55" />
            <stop offset="1" stopColor="#070a1c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sky-seam" x1="0" y1="0" x2="1" y2="0">
            <stop offset=".42" stopColor="#ffffff" stopOpacity="0" />
            <stop offset=".5" stopColor="#c9b8ff" stopOpacity=".18" />
            <stop offset=".58" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1600" height="1000" fill="#070a1c" />
        <rect width="1600" height="1000" fill="url(#sky-l)" />
        <rect width="1600" height="1000" fill="url(#sky-r)" />
        <rect width="1600" height="1000" fill="url(#sky-seam)" />
        <RuneCircle cx={330} cy={360} r={300} color="#7fdcff" cls="spin-slow" idp="rc-l" />
        <RuneCircle cx={1270} cy={360} r={300} color="#d2a8ff" cls="spin-rev" idp="rc-r" />
        <Bolt color="#5fd0ff" d="M120 40 L210 170 L170 190 L300 360 L250 380 L360 560" />
        <Bolt color="#5fd0ff" w={1.6} d="M40 520 L160 600 L130 640 L290 720" />
        <Bolt color="#b07cff" d="M1500 30 L1400 180 L1450 200 L1310 380 L1360 400 L1240 590" />
        <Bolt color="#b07cff" w={1.6} d="M1580 560 L1450 640 L1490 670 L1320 760" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 397) % 1600}
            cy={(i * 241) % 1000}
            r={(i % 3) + 0.8}
            fill={i % 2 ? '#bfe9ff' : '#e2ccff'}
            opacity={0.25 + (i % 4) * 0.12}
          />
        ))}
      </svg>
    </div>
  )
}
