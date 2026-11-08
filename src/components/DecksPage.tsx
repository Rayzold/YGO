import { isLegal } from '../lib/rules'
import { useStore } from '../state'

export function DecksPage(props: { onOpen: () => void }) {
  const { decks, deck: current, selectDeck, deleteDeck, duplicateDeck, newDeck, index, t, lang } = useStore()
  const fmt = new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div className="page">
      <section className="panel">
        <div className="deck-head">
          <h2>{t('decks.title')}</h2>
          <button
            type="button"
            onClick={() => {
              newDeck()
              props.onOpen()
            }}
          >
            {t('deck.new')}
          </button>
        </div>
        <ul className="deck-list">
          {decks.map((d) => {
            const legal = isLegal(d, index.byId)
            return (
              <li key={d.id} className={d.id === current.id ? 'current' : ''}>
                <div>
                  <strong>{d.name || t('deck.untitled')}</strong>{' '}
                  <span className={`legal ${legal ? 'ok' : 'bad'}`}>{legal ? t('deck.legal') : t('deck.notLegal')}</span>
                  <div className="muted">
                    {t('deck.main')}/{t('deck.extra')}/{t('deck.side')}:{' '}
                    {t('decks.counts', { main: d.main.length, extra: d.extra.length, side: d.side.length })} ·{' '}
                    {t('decks.updated', { date: fmt.format(new Date(d.updatedAt)) })}
                  </div>
                </div>
                <div className="toolbar">
                  <button
                    type="button"
                    onClick={() => {
                      selectDeck(d.id)
                      props.onOpen()
                    }}
                  >
                    {t('decks.open')}
                  </button>
                  <button type="button" onClick={() => duplicateDeck(d.id)}>
                    {t('decks.duplicate')}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => confirm(t('decks.deleteConfirm', { name: d.name })) && deleteDeck(d.id)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
