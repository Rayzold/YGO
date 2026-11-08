import { useEffect } from 'react'
import { imageUrl } from '../lib/data'
import { useStore } from '../state'
import { frameClass, LimitBadge } from './CardTile'

export function CardDetail() {
  const { detail: c, showDetail, texts, t, collection, setOwned, addCard, meta } = useStore()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && showDetail(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showDetail])
  if (!c) return null
  const src = imageUrl(c)
  const owned = collection[c.id] ?? 0
  const stats = [
    c.attr,
    c.lvl !== undefined ? (c.line.includes('Xyz') ? `Rank ${c.lvl}` : `Level ${c.lvl}`) : null,
    c.link !== undefined ? `Link-${c.link}` : null,
    c.scale !== undefined ? `Scale ${c.scale}` : null,
    c.atk !== undefined ? `ATK ${c.atk}` : null,
    c.def !== undefined ? `DEF ${c.def}` : null,
  ].filter(Boolean)
  return (
    <div className="modal-back" onClick={() => showDetail(null)}>
      <div className="modal detail" role="dialog" aria-modal="true" aria-label={c.name} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" aria-label={t('common.close')} onClick={() => showDetail(null)}>
          ×
        </button>
        <div className={`detail-art ${frameClass(c)}`}>{src ? <img src={src} alt={c.name} /> : <span>{c.name}</span>}</div>
        <div className="detail-body">
          <h2>
            {c.name} <LimitBadge card={c} />
          </h2>
          <p className="muted">
            {c.type === 'Monster' ? `[${c.line}]` : `${c.prop ?? ''} ${c.type}`} {stats.join(' · ')}
          </p>
          <p>
            <strong>{t(`limit.${c.limit}`)}</strong>
            {c.next !== undefined && ` — ${t('limit.next', { status: t(`limit.${c.next}`), date: meta.upcoming ?? '' })}`}
          </p>
          {c.materials && <p className="materials">{c.materials}</p>}
          <h3>{t('detail.text')}</h3>
          <p className="card-text">{texts ? texts[c.id] : t('detail.loadingText')}</p>
          {c.series.length > 0 && (
            <p>
              <strong>{t('detail.archetypes')}:</strong> {c.series.join(', ')}
            </p>
          )}
          {c.tags.length > 0 && (
            <>
              <h3>{t('detail.mechanics')}</h3>
              <div className="chips">
                {c.tags.map((tag) => (
                  <span key={tag} className="chip">
                    {t(`tag.${tag}`)}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="detail-actions">
            <span>
              {t('detail.owned')}:{' '}
              <button type="button" aria-label="-1" onClick={() => setOwned(c.id, Math.max(0, owned - 1))}>
                −
              </button>{' '}
              <strong>{owned}</strong>{' '}
              <button type="button" aria-label="+1" onClick={() => setOwned(c.id, owned + 1)}>
                +
              </button>
            </span>
            <button type="button" onClick={() => addCard(c)}>
              {t('tile.add')}
            </button>
            <button type="button" onClick={() => addCard(c, 'side')}>
              {t('tile.side')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
