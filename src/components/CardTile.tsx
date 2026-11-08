import { useState } from 'react'
import { imageUrl } from '../lib/data'
import type { Card } from '../lib/types'
import { useStore } from '../state'

export function frameClass(c: Card): string {
  if (c.type === 'Spell') return 'f-spell'
  if (c.type === 'Trap') return 'f-trap'
  for (const f of ['Link', 'Xyz', 'Synchro', 'Fusion', 'Ritual']) if (c.line.includes(f)) return `f-${f.toLowerCase()}`
  return c.line.includes('Effect') ? 'f-effect' : 'f-normal'
}

export function LimitBadge({ card }: { card: Card }) {
  const { t, meta } = useStore()
  const label = card.limit === 0 ? '✕' : String(card.limit)
  return (
    <>
      {card.limit < 3 && (
        <span className={`limit l${card.limit}`} title={t(`limit.${card.limit}`)}>
          {label}
        </span>
      )}
      {card.next !== undefined && (
        <span
          className="limit next"
          title={t('limit.next', { status: t(`limit.${card.next}`), date: meta.upcoming ?? '' })}
        >
          →{card.next === 0 ? '✕' : card.next === 3 ? '∞' : card.next}
        </span>
      )}
    </>
  )
}

interface Action {
  label: string
  title: string
  onClick: () => void
}

export function CardTile(props: {
  card: Card
  onClick?: () => void
  actions?: Action[]
  owned?: number
  count?: number
  small?: boolean
}) {
  const { card } = props
  const { showDetail, t } = useStore()
  const [broken, setBroken] = useState(false)
  const src = imageUrl(card)
  return (
    <div className={`tile ${props.small ? 'small' : ''}`}>
      <button
        type="button"
        className={`tile-face ${frameClass(card)}`}
        onClick={props.onClick ?? (() => showDetail(card))}
        title={card.name}
      >
        {src && !broken ? (
          <img src={src} alt={card.name} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className="tile-text">
            <strong>{card.name}</strong>
            <small>{card.type === 'Monster' ? card.line.split(' / ')[0] : `${card.prop ?? ''} ${card.type}`}</small>
          </span>
        )}
        <span className="badges">
          <LimitBadge card={card} />
        </span>
        {props.count !== undefined && props.count > 1 && <span className="count">×{props.count}</span>}
        {props.owned !== undefined && props.owned > 0 && <span className="owned">{props.owned}</span>}
      </button>
      <div className="tile-actions">
        {props.actions?.map((a) => (
          <button key={a.label} type="button" title={a.title} aria-label={a.title} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
        <button type="button" title={t('tile.info')} aria-label={t('tile.info')} onClick={() => showDetail(card)}>
          i
        </button>
      </div>
    </div>
  )
}
