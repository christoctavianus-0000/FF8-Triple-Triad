import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit3, Info, Search, Sparkles, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { ALL_CARDS, CARDS_BY_ID, getCardById } from '../data/cards';
import { formatRank } from '../engine/rules';
import { useViewportMode } from '../hooks/useViewportMode';
import { getEffectiveCollection } from '../state/profileStore';
import type { CardCategory, ElementType, ProfileState } from '../types/tripleTriad';
import { CardView } from './CardView';
import { MobileSheet } from './MobileSheet';

export interface DeckBuilderProps {
  profile: ProfileState;
  onUpdateDeck: (deckId: string, name: string, cards: string[]) => void;
  onSelectActiveDeck: (deckId: string) => void;
}

const CATEGORIES: readonly ('all' | CardCategory)[] = [
  'all',
  'monster',
  'boss',
  'gf',
  'character',
];

const ELEMENTS: readonly ('all' | ElementType)[] = [
  'all',
  'none',
  'earth',
  'fire',
  'ice',
  'poison',
  'thunder',
  'water',
  'wind',
  'holy',
];

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  profile,
  onUpdateDeck,
  onSelectActiveDeck,
}) => {
  const viewport = useViewportMode();
  const isMobile = viewport !== 'desktop';

  const [editingDeckId, setEditingDeckId] = useState<string>(profile.activeDeckId);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | CardCategory>('all');
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [elemFilter, setElemFilter] = useState<'all' | ElementType>('all');
  const [inspectedId, setInspectedId] = useState<string>('geezard');
  const [showInspectorSheet, setShowInspectorSheet] = useState(false);
  const [showSynergyDetail, setShowSynergyDetail] = useState(false);

  const effectiveCollection = useMemo(() => getEffectiveCollection(profile), [profile]);

  const currentDeck = useMemo(
    () => profile.decks.find((d) => d.id === editingDeckId) ?? profile.decks[0],
    [profile.decks, editingDeckId],
  );

  const [deckNameInput, setDeckNameInput] = useState(currentDeck.name);

  useEffect(() => {
    setDeckNameInput(currentDeck.name);
  }, [currentDeck.id, currentDeck.name]);

  const handleSelectDeckTab = (id: string) => {
    soundEngine.playCursor();
    setEditingDeckId(id);
    const found = profile.decks.find((d) => d.id === id);
    if (found) setDeckNameInput(found.name);
    setSelectedSlotIdx(0);
  };

  const deckUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cid of currentDeck.cards) {
      counts[cid] = (counts[cid] ?? 0) + 1;
    }
    return counts;
  }, [currentDeck.cards]);

  const filteredCollection = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_CARDS.filter((card) => {
      if ((effectiveCollection[card.id] ?? 0) <= 0) return false;
      if (catFilter !== 'all' && card.category !== catFilter) return false;
      if (levelFilter !== 'all' && card.level !== levelFilter) return false;
      if (elemFilter !== 'all' && card.element !== elemFilter) return false;
      if (q) {
        const hay = `#${card.index} ${card.name} ${card.cardMod} ${card.category} ${card.element}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const sumA = a.ranks.top + a.ranks.right + a.ranks.bottom + a.ranks.left;
      const sumB = b.ranks.top + b.ranks.right + b.ranks.bottom + b.ranks.left;
      return b.level - a.level || sumB - sumA || a.index - b.index;
    });
  }, [effectiveCollection, catFilter, levelFilter, elemFilter, search]);

  const handleAssignCardToSlot = (cardId: string) => {
    const owned = effectiveCollection[cardId] ?? 0;
    const currentCardAtSlot = currentDeck.cards[selectedSlotIdx];
    const usedElsewhere =
      (deckUsageCounts[cardId] ?? 0) - (currentCardAtSlot === cardId ? 1 : 0);

    if (usedElsewhere >= owned) return;

    soundEngine.playConfirm();
    const nextCards = [...currentDeck.cards];
    nextCards[selectedSlotIdx] = cardId;
    onUpdateDeck(currentDeck.id, currentDeck.name, nextCards);
    setInspectedId(cardId);
    setSelectedSlotIdx((prev) => (prev + 1) % 5);
  };

  const handleAutoBest = () => {
    soundEngine.playConfirm();
    const sorted = [...ALL_CARDS]
      .filter((c) => (effectiveCollection[c.id] ?? 0) > 0)
      .sort((a, b) => {
        const sumA = a.ranks.top + a.ranks.right + a.ranks.bottom + a.ranks.left;
        const sumB = b.ranks.top + b.ranks.right + b.ranks.bottom + b.ranks.left;
        return b.level - a.level || sumB - sumA || a.index - b.index;
      });
    const next: string[] = [];
    const used: Record<string, number> = {};
    for (const c of sorted) {
      const avail = effectiveCollection[c.id] ?? 0;
      while ((used[c.id] ?? 0) < avail && next.length < 5) {
        next.push(c.id);
        used[c.id] = (used[c.id] ?? 0) + 1;
      }
      if (next.length === 5) break;
    }
    if (next.length === 5) {
      onUpdateDeck(currentDeck.id, currentDeck.name, next);
    }
  };

  const synergyNotes = useMemo(() => {
    const cards = currentDeck.cards.map((id) => getCardById(id));
    let totalRank = 0;
    let sumTop = 0;
    let sumRight = 0;
    let sumBottom = 0;
    let sumLeft = 0;
    let aceCount = 0;
    let rareCount = 0;
    const elems = new Set<ElementType>();

    for (const c of cards) {
      totalRank += c.ranks.top + c.ranks.right + c.ranks.bottom + c.ranks.left;
      sumTop += c.ranks.top;
      sumRight += c.ranks.right;
      sumBottom += c.ranks.bottom;
      sumLeft += c.ranks.left;
      if (
        c.ranks.top === 10 ||
        c.ranks.right === 10 ||
        c.ranks.bottom === 10 ||
        c.ranks.left === 10
      ) {
        aceCount += 1;
      }
      if (c.isRare) rareCount += 1;
      if (c.element !== 'none') elems.add(c.element);
    }

    const notes: string[] = [
      `Total Rank Power: ${totalRank} (Avg T ${(sumTop / 5).toFixed(1)} · R ${(sumRight / 5).toFixed(1)} · B ${(sumBottom / 5).toFixed(1)} · L ${(sumLeft / 5).toFixed(1)})${rareCount > 0 ? ` · ★ ${rareCount}/5 Rare` : ''}`,
    ];

    const weakSides: string[] = [];
    if (sumTop / 5 < 4) weakSides.push('Top');
    if (sumRight / 5 < 4) weakSides.push('Right');
    if (sumBottom / 5 < 4) weakSides.push('Bottom');
    if (sumLeft / 5 < 4) weakSides.push('Left');
    if (weakSides.length > 0) {
      notes.push(`Flank Watch: Average ${weakSides.join('/')} rank is below 4.0 — protect those edges in corners.`);
    }
    if (aceCount >= 2) {
      notes.push(`Same Wall Ready: ${aceCount} cards hold rank A (10) to trigger Same Wall plays.`);
    }
    if (elems.size > 0) {
      notes.push(
        `Elemental Coverage: ${Array.from(elems)
          .map((e) => e.charAt(0).toUpperCase() + e.slice(1))
          .join(', ')}.`,
      );
    } else {
      notes.push('No elemental cards — all cards take -1 on Elemental tiles.');
    }

    return notes;
  }, [currentDeck.cards]);

  const inspectedCard = CARDS_BY_ID[inspectedId] ?? ALL_CARDS[0];
  const selectedSlotCard = CARDS_BY_ID[currentDeck.cards[selectedSlotIdx]] ?? ALL_CARDS[0];
  const inspectedOwned = effectiveCollection[inspectedCard.id] ?? 0;
  const inspectedInDeck = deckUsageCounts[inspectedCard.id] ?? 0;
  const inspectedExhausted =
    inspectedInDeck - (currentDeck.cards[selectedSlotIdx] === inspectedCard.id ? 1 : 0) >=
    inspectedOwned;

  const commitName = () => {
    const clean = deckNameInput.trim() || 'Custom Deck';
    setDeckNameInput(clean);
    onUpdateDeck(currentDeck.id, clean, currentDeck.cards);
  };

  return (
    <div className={`tt-deckbuilder ${isMobile ? 'is-mobile' : ''}`}>
      {/* 5 Saved Deck Tabs */}
      <div className={`tt-deck-tabs ${isMobile ? 'is-scroll-row' : ''}`}>
        {profile.decks.map((d) => {
          const isEditing = d.id === currentDeck.id;
          const isEquipped = d.id === profile.activeDeckId;
          return (
            <button
              key={d.id}
              type="button"
              className={`tt-deck-tab ${isEditing ? 'is-editing' : ''}`}
              onClick={() => handleSelectDeckTab(d.id)}
            >
              <span>{d.name}</span>
              {isEquipped && <small className="tt-equipped-pill">EQUIPPED</small>}
            </button>
          );
        })}
      </div>

      {isMobile ? (
        <>
          <div className="tt-m-deck-controls">
            <div className="tt-deck-rename">
              <Edit3 size={14} />
              <input
                type="text"
                value={deckNameInput}
                maxLength={24}
                enterKeyHint="done"
                onChange={(e) => setDeckNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                aria-label="Deck Name"
              />
            </div>
            <button
              type="button"
              className="tt-btn tt-btn--ghost tt-btn--sm"
              onClick={handleAutoBest}
            >
              <Sparkles size={13} /> Best
            </button>
            <button
              type="button"
              className={`tt-btn tt-btn--sm ${
                currentDeck.id === profile.activeDeckId ? 'tt-btn--ghost' : 'tt-btn--gold'
              }`}
              onClick={() => {
                soundEngine.playConfirm();
                onSelectActiveDeck(currentDeck.id);
              }}
            >
              <Check size={14} />
              {currentDeck.id === profile.activeDeckId ? 'Equipped' : 'Equip'}
            </button>
          </div>

          <section className="tt-window tt-m-deck-dock" aria-label="Deck Slots">
            <div className="tt-m-deck-dock__slots">
              {currentDeck.cards.map((cid, idx) => {
                const card = getCardById(cid);
                const activeSlot = idx === selectedSlotIdx;
                return (
                  <button
                    key={`${idx}_${cid}`}
                    type="button"
                    className={`tt-m-slot ${activeSlot ? 'is-target' : ''}`}
                    onClick={() => {
                      soundEngine.playCursor();
                      setSelectedSlotIdx(idx);
                      setInspectedId(cid);
                    }}
                    aria-label={`Slot ${idx + 1}: ${card.name}`}
                  >
                    <img src={card.imagePath} alt={card.name} draggable={false} />
                    <span className="tt-m-slot__num">{idx + 1}</span>
                    <span className="tt-m-slot__lvl">L{card.level}</span>
                  </button>
                );
              })}
            </div>

            <div className="tt-m-deck-dock__bar">
              <span className="tt-m-deck-dock__slotname">
                Slot {selectedSlotIdx + 1}: <strong>{selectedSlotCard.name}</strong>
              </span>
              <div className="tt-btn-row">
                <button
                  type="button"
                  className={`tt-tab ${showSynergyDetail ? 'is-active' : ''}`}
                  onClick={() => setShowSynergyDetail((v) => !v)}
                >
                  <Sparkles size={12} /> Stats
                </button>
                <button
                  type="button"
                  className="tt-btn tt-btn--ghost tt-btn--sm"
                  onClick={() => {
                    soundEngine.playCursor();
                    setInspectedId(selectedSlotCard.id);
                    setShowInspectorSheet(true);
                  }}
                >
                  <Info size={13} /> Inspect
                </button>
              </div>
            </div>

            {showSynergyDetail && (
              <div className="tt-m-synergy-list">
                {synergyNotes.map((n, i) => (
                  <div key={i}>{n}</div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="tt-window tt-deck-stage">
          <div className="tt-deck-stage__header">
            <div className="tt-deck-rename">
              <Edit3 size={15} />
              <input
                type="text"
                value={deckNameInput}
                maxLength={24}
                enterKeyHint="done"
                onChange={(e) => setDeckNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                aria-label="Deck Name"
              />
            </div>

            <div className="tt-btn-row">
              {profile.settings.sandboxMode && (
                <span className="tt-pill tt-pill--gold">Sandbox: All 110 Cards</span>
              )}
              <button
                type="button"
                className="tt-btn tt-btn--ghost"
                onClick={handleAutoBest}
              >
                <Sparkles size={15} /> Auto-Best 5
              </button>
              <button
                type="button"
                className={`tt-btn ${
                  currentDeck.id === profile.activeDeckId ? 'tt-btn--ghost' : 'tt-btn--gold'
                }`}
                onClick={() => {
                  soundEngine.playConfirm();
                  onSelectActiveDeck(currentDeck.id);
                }}
              >
                <Check size={16} />
                {currentDeck.id === profile.activeDeckId
                  ? 'Active Match Deck'
                  : 'Set as Active Match Deck'}
              </button>
            </div>
          </div>

          <p className="tt-muted">
            Select a slot (1–5) below, then click any owned card in your collection to swap it in.
          </p>

          <div className="tt-deck-slots">
            {currentDeck.cards.map((cid, idx) => {
              const card = getCardById(cid);
              const activeSlot = idx === selectedSlotIdx;
              return (
                <div
                  key={`${idx}_${cid}`}
                  className={`tt-deck-slot ${activeSlot ? 'is-target-slot' : ''}`}
                >
                  <div className="tt-deck-slot__num">Slot {idx + 1}</div>
                  <CardView
                    cardId={card.id}
                    owner="player"
                    selected={activeSlot}
                    onClick={() => {
                      soundEngine.playCursor();
                      setSelectedSlotIdx(idx);
                      setInspectedId(cid);
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="tt-synergy-bar">
            <Sparkles size={16} className="tt-text-gold" />
            <div className="tt-synergy-lines">
              {synergyNotes.map((n, i) => (
                <div key={i}>{n}</div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Collection Picker + Card Inspector */}
      <div className="tt-builder-lower">
        <div className="tt-window tt-collection-panel">
          <div className="tt-binder-filters">
            <div className="tt-search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search owned cards by name, #, element, or Card Mod…"
                enterKeyHint="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.length > 0 && (
                <button
                  type="button"
                  className="tt-icon-btn"
                  aria-label="Clear card search"
                  onClick={() => setSearch('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              className="tt-select"
              aria-label="Filter by element"
              value={elemFilter}
              onChange={(e) => setElemFilter(e.target.value as 'all' | ElementType)}
            >
              {ELEMENTS.map((el) => (
                <option key={el} value={el}>
                  {el === 'all'
                    ? 'All Elements'
                    : el === 'none'
                      ? 'Non-Elemental'
                      : el.charAt(0).toUpperCase() + el.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="tt-binder-filters">
            <div className={`tt-level-tabs ${isMobile ? 'is-scroll-row' : ''}`}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`tt-tab ${catFilter === cat ? 'is-active' : ''}`}
                  onClick={() => setCatFilter(cat)}
                >
                  {cat === 'all' ? 'All Types' : cat.toUpperCase()}
                </button>
              ))}
            </div>

            <div className={`tt-level-tabs ${isMobile ? 'is-scroll-row' : ''}`}>
              <button
                type="button"
                className={`tt-tab ${levelFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setLevelFilter('all')}
              >
                All Lv
              </button>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`tt-tab ${levelFilter === lvl ? 'is-active' : ''}`}
                  onClick={() => setLevelFilter(lvl)}
                >
                  L{lvl}
                </button>
              ))}
            </div>
          </div>

          {filteredCollection.length === 0 ? (
            <div className="tt-empty-state">
              <p className="tt-muted">No owned cards match your current filters.</p>
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                onClick={() => {
                  setSearch('');
                  setCatFilter('all');
                  setLevelFilter('all');
                  setElemFilter('all');
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="tt-collection-grid">
              {filteredCollection.map((card) => {
                const owned = effectiveCollection[card.id] ?? 0;
                const inDeck = deckUsageCounts[card.id] ?? 0;
                const currentSlotCard = currentDeck.cards[selectedSlotIdx];
                const exhausted =
                  inDeck - (currentSlotCard === card.id ? 1 : 0) >= owned;
                const remaining = Math.max(0, owned - inDeck);

                return (
                  <div
                    key={card.id}
                    className={`tt-collection-tile ${exhausted ? 'is-exhausted' : ''}`}
                  >
                    <CardView
                      cardId={card.id}
                      owner="player"
                      compact
                      onMouseEnter={() => setInspectedId(card.id)}
                      onClick={() => {
                        setInspectedId(card.id);
                        if (!exhausted) {
                          handleAssignCardToSlot(card.id);
                        } else if (isMobile) {
                          setShowInspectorSheet(true);
                        }
                      }}
                    />
                    <div className="tt-collection-tile__meta">
                      <span>Lv{card.level}</span>
                      <strong>{exhausted ? 'In Use' : `×${remaining}`}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Side Card Inspector */}
        {!isMobile && (
          <aside className="tt-window tt-deck-inspector">
            <span className="tt-label">CARD INSPECTOR</span>
            <h3>
              #{inspectedCard.index} {inspectedCard.name}
            </h3>
            <p className="tt-muted">
              Level {inspectedCard.level} {inspectedCard.category.toUpperCase()} ·{' '}
              {inspectedCard.element === 'none'
                ? 'Non-Elemental'
                : inspectedCard.element.toUpperCase()}
            </p>
            <div className="tt-deck-inspector__preview">
              <CardView cardId={inspectedCard.id} owner="player" />
            </div>
            <div className="tt-deck-inspector__stats">
              <p>
                <strong>Ranks:</strong> T {formatRank(inspectedCard.ranks.top)} · R{' '}
                {formatRank(inspectedCard.ranks.right)} · B{' '}
                {formatRank(inspectedCard.ranks.bottom)} · L{' '}
                {formatRank(inspectedCard.ranks.left)}
              </p>
              <p>
                <strong>Card Mod:</strong> {inspectedCard.cardMod}
              </p>
              <p>
                <strong>Available:</strong> {Math.max(0, inspectedOwned - inspectedInDeck)} /{' '}
                {inspectedOwned}
              </p>
            </div>
            <button
              type="button"
              className="tt-btn tt-btn--primary"
              disabled={inspectedExhausted}
              onClick={() => handleAssignCardToSlot(inspectedCard.id)}
            >
              {inspectedExhausted
                ? 'All Owned Copies Used'
                : `Assign to Slot ${selectedSlotIdx + 1}`}
            </button>
          </aside>
        )}
      </div>

      {/* Mobile Inspector Sheet */}
      {isMobile && (
        <MobileSheet
          open={showInspectorSheet}
          title={`#${inspectedCard.index} ${inspectedCard.name}`}
          subtitle={`Level ${inspectedCard.level} ${inspectedCard.category.toUpperCase()}`}
          onClose={() => setShowInspectorSheet(false)}
        >
          <div className="tt-inspector">
            <div className="tt-inspector-card">
              <CardView cardId={inspectedCard.id} owner="player" />
            </div>
            <div className="tt-inspector-details">
              <p>
                <strong>Ranks:</strong> T {formatRank(inspectedCard.ranks.top)} · R{' '}
                {formatRank(inspectedCard.ranks.right)} · B{' '}
                {formatRank(inspectedCard.ranks.bottom)} · L{' '}
                {formatRank(inspectedCard.ranks.left)}
              </p>
              <p>
                <strong>Element:</strong>{' '}
                {inspectedCard.element === 'none'
                  ? 'None'
                  : inspectedCard.element.toUpperCase()}
              </p>
              <p>
                <strong>Card Mod:</strong> {inspectedCard.cardMod}
              </p>
              <p>
                <strong>Remaining Copies:</strong>{' '}
                {Math.max(0, inspectedOwned - inspectedInDeck)} / {inspectedOwned}
              </p>
              <button
                type="button"
                className="tt-btn tt-btn--gold"
                disabled={inspectedExhausted}
                onClick={() => {
                  handleAssignCardToSlot(inspectedCard.id);
                  setShowInspectorSheet(false);
                }}
              >
                {inspectedExhausted
                  ? 'All Owned Copies Used'
                  : `Assign to Slot ${selectedSlotIdx + 1}`}
              </button>
            </div>
          </div>
        </MobileSheet>
      )}
    </div>
  );
};
