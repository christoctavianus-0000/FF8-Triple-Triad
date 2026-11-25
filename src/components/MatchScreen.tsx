import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, HelpCircle, ScrollText, Sparkles, Trophy } from 'lucide-react';
import { CARDS_BY_ID } from '../data/cards';
import { SPECIAL_RULE_INFO, TRADE_RULE_INFO } from '../data/regions';
import { soundEngine } from '../audio/soundEngine';
import { chooseAiMove, chooseAiTradeCards } from '../engine/ai';
import {
  applyMove,
  createAiPerceivedState,
  resolveTrade,
  startSuddenDeathRound,
} from '../engine/engine';
import { getVisibleRules } from '../engine/regionalRules';
import { getElementalModifier, resolvePlacement } from '../engine/rules';
import { useCardDrag } from '../hooks/useCardDrag';
import { useViewportMode } from '../hooks/useViewportMode';
import type {
  AiTier,
  ElementType,
  MatchState,
  TradeResolution,
} from '../types/tripleTriad';
import { CardView } from './CardView';
import { Ff8Cursor } from './Ff8Cursor';
import { MobileSheet } from './MobileSheet';

interface MatchScreenProps {
  initialMatch: MatchState;
  opponentName: string;
  opponentTitle: string;
  aiTier: AiTier;
  showHints: boolean;
  sandboxMode: boolean;
  victoryLine: string;
  defeatLine: string;
  onFinishAndReturn: (finalMatch: MatchState, trade: TradeResolution) => {
    protectedCardIds: string[];
    queenForgeMessages: string[];
    extraMessages: string[];
  };
  onAbortMatch: () => void;
}

const ELEMENT_LABEL: Readonly<Record<ElementType, string>> = {
  none: '',
  earth: 'Earth',
  fire: 'Fire',
  ice: 'Ice',
  poison: 'Poison',
  thunder: 'Thunder',
  water: 'Water',
  wind: 'Wind',
  holy: 'Holy',
};

export const MatchScreen: React.FC<MatchScreenProps> = ({
  initialMatch,
  opponentName,
  opponentTitle,
  aiTier,
  showHints,
  sandboxMode,
  victoryLine,
  defeatLine,
  onFinishAndReturn,
  onAbortMatch,
}) => {
  const viewport = useViewportMode();
  const [match, setMatch] = useState<MatchState>(initialMatch);
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  const [flippedIndices, setFlippedIndices] = useState<Set<number>>(new Set());
  const [ruleBanner, setRuleBanner] = useState<string | null>(null);
  const [hintsEnabled, setHintsEnabled] = useState(showHints);
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Post-match trade state
  const [selectedTradeIndices, setSelectedTradeIndices] = useState<number[]>([]);
  const [tradeApplied, setTradeApplied] = useState<{
    trade: TradeResolution;
    protectedCardIds: string[];
    queenForgeMessages: string[];
    extraMessages: string[];
  } | null>(null);

  const aiTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const autoTradeHandledRef = useRef(false);

  const visibleRules = useMemo(() => getVisibleRules(match.rules), [match.rules]);

  const triggerBanner = useCallback((text: string) => {
    setRuleBanner(text);
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setRuleBanner(null);
    }, 1700);
  }, []);

  useEffect(() => {
    return () => {
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current);
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const announceTurnEffects = useCallback(
    (nextState: MatchState) => {
      soundEngine.playCardPlace();
      const last = nextState.lastTurn;
      if (!last) return;

      if (last.triggeredRules.includes('sameWall')) {
        soundEngine.playSpecialRule('sameWall');
        triggerBanner('SAME WALL!');
      } else if (last.triggeredRules.includes('same')) {
        soundEngine.playSpecialRule('same');
        triggerBanner('SAME!');
      } else if (last.triggeredRules.includes('plus')) {
        soundEngine.playSpecialRule('plus');
        triggerBanner('PLUS!');
      }

      if (last.triggeredRules.includes('combo')) {
        window.setTimeout(() => {
          soundEngine.playSpecialRule('combo');
          triggerBanner('COMBO!');
        }, 260);
      }

      if (last.flips.length > 0) {
        const flipped = new Set(last.flips.map((f) => f.flippedIndex));
        setFlippedIndices(flipped);
        last.flips.forEach((f, idx) => {
          window.setTimeout(() => soundEngine.playCardFlip(f.wave + idx * 0.35), 90 + idx * 110);
        });
        window.setTimeout(() => setFlippedIndices(new Set()), 650);
      }

      if (nextState.phase === 'suddenDeathPending') {
        window.setTimeout(() => {
          soundEngine.playSuddenDeath();
          triggerBanner('SUDDEN DEATH!');
        }, 420);
      } else if (nextState.phase === 'finished') {
        window.setTimeout(() => {
          if (nextState.winner === 'player') soundEngine.playVictory();
          else if (nextState.winner === 'opponent') soundEngine.playDefeat();
          else soundEngine.playDraw();
        }, 420);
      }
    },
    [triggerBanner],
  );

  // Opponent AI turn execution
  useEffect(() => {
    if (match.phase !== 'playing' || match.currentTurn !== 'opponent') return;
    const delay = match.turnNumber === 1 ? 750 : 620;
    aiTimerRef.current = window.setTimeout(() => {
      const perceived = createAiPerceivedState(match);
      const move = chooseAiMove(perceived, aiTier);
      const next = applyMove(match, move);
      setMatch(next);
      announceTurnEffects(next);
    }, delay);

    return () => {
      if (aiTimerRef.current !== null) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [match, aiTier, announceTurnEffects]);

  // Sudden Death round auto-advance after dramatic pause
  useEffect(() => {
    if (match.phase !== 'suddenDeathPending') return;
    const t = window.setTimeout(() => {
      soundEngine.playCardDeal();
      setMatch((prev) =>
        prev.phase === 'suddenDeathPending' ? startSuddenDeathRound(prev) : prev,
      );
    }, 1500);
    return () => window.clearTimeout(t);
  }, [match.phase]);

  // Auto-resolve trade when AI wins or Direct/All/Draw occurs
  useEffect(() => {
    if (match.phase !== 'finished' || !match.tradeSummary || tradeApplied || autoTradeHandledRef.current) {
      return;
    }
    const summary = match.tradeSummary;

    // Player picks manually ONLY when winner === 'player' and rule is 'one' or 'diff'
    const playerNeedsToPick =
      summary.winner === 'player' &&
      (summary.tradeRule === 'one' || summary.tradeRule === 'diff') &&
      summary.cardsToPick > 0;

    if (playerNeedsToPick) return;

    autoTradeHandledRef.current = true;
    let chosen: string[] = [];
    if (summary.winner === 'opponent' && summary.cardsToPick > 0) {
      chosen = chooseAiTradeCards(summary.playerPoolIds, summary.cardsToPick);
    } else if (summary.winner === 'player' && summary.tradeRule === 'all') {
      chosen = [...summary.opponentPoolIds];
    }

    const trade = resolveTrade(summary, chosen);
    const result = onFinishAndReturn(match, trade);
    setTradeApplied({
      trade,
      protectedCardIds: result.protectedCardIds,
      queenForgeMessages: result.queenForgeMessages,
      extraMessages: result.extraMessages,
    });
  }, [match, tradeApplied, onFinishAndReturn]);

  const canPlayerAct = match.phase === 'playing' && match.currentTurn === 'player';

  const handlePlaceAtCell = useCallback(
    (handIndex: number, cellIndex: number) => {
      if (!canPlayerAct) return;
      if (handIndex < 0 || handIndex >= match.playerHand.length) return;
      if (match.board[cellIndex].placed !== null) return;

      const next = applyMove(match, { actor: 'player', handIndex, cellIndex });
      setSelectedHandIdx(null);
      setMatch(next);
      announceTurnEffects(next);
    },
    [canPlayerAct, match, announceTurnEffects],
  );

  const { drag, beginDrag } = useCardDrag(canPlayerAct, handlePlaceAtCell);

  // Preview tactical outcomes for selected card (or dragged card)
  const previewByCell = useMemo(() => {
    const activeIdx = drag.active ? drag.handIndex : selectedHandIdx;
    if (!hintsEnabled || !canPlayerAct || activeIdx === null) return null;
    const cardId = match.playerHand[activeIdx];
    const card = cardId ? CARDS_BY_ID[cardId] : null;
    if (!card) return null;

    const map = new Map<
      number,
      { flips: number; tags: Array<'same' | 'sameWall' | 'plus' | 'combo'> }
    >();
    for (let i = 0; i < 9; i += 1) {
      if (match.board[i].placed !== null) continue;
      const res = resolvePlacement(match.board, i, card, 'player', match.rules, CARDS_BY_ID);
      if (res.flipEvents.length > 0) {
        map.set(i, { flips: res.flipEvents.length, tags: res.triggeredRules });
      }
    }
    return map;
  }, [hintsEnabled, canPlayerAct, drag.active, drag.handIndex, selectedHandIdx, match]);

  const handleToggleTradeIndex = (idx: number) => {
    const needed = match.tradeSummary?.cardsToPick ?? 0;
    soundEngine.playCursor();
    setSelectedTradeIndices((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= needed) return [...prev.slice(1), idx];
      return [...prev, idx];
    });
  };

  const handleConfirmPlayerTrade = () => {
    if (!match.tradeSummary || tradeApplied) return;
    const chosenIds = selectedTradeIndices
      .map((i) => match.tradeSummary!.opponentPoolIds[i])
      .filter(Boolean);
    soundEngine.playConfirm();
    const trade = resolveTrade(match.tradeSummary, chosenIds);
    const result = onFinishAndReturn(match, trade);
    setTradeApplied({
      trade,
      protectedCardIds: result.protectedCardIds,
      queenForgeMessages: result.queenForgeMessages,
      extraMessages: result.extraMessages,
    });
  };

  const isOpen = match.rules.includes('open');
  const elementalActive = match.rules.includes('elemental');
  const layoutClass =
    viewport === 'mobile-landscape'
      ? 'tt-arena--landscape'
      : viewport === 'mobile-portrait'
        ? 'tt-arena--portrait'
        : 'tt-arena--desktop';

  return (
    <div className={`tt-arena ${layoutClass}`}>
      {/* Top Match HUD */}
      <header className="tt-window tt-match-hud">
        <button
          type="button"
          className="tt-btn tt-btn--ghost tt-btn--sm"
          onClick={() => {
            soundEngine.playCancel();
            onAbortMatch();
          }}
        >
          <ArrowLeft size={15} /> Quit
        </button>

        <div className="tt-score-strip">
          <div className={`tt-score-side is-opp ${match.currentTurn === 'opponent' && match.phase === 'playing' ? 'is-turn' : ''}`}>
            <span className="tt-score-name">{opponentName}</span>
            <strong className="tt-score-num">{match.scores.opponent}</strong>
          </div>
          <span className="tt-score-vs">
            {match.suddenDeathRound > 1 ? `SD #${match.suddenDeathRound}` : 'VS'}
          </span>
          <div className={`tt-score-side is-ply ${match.currentTurn === 'player' && match.phase === 'playing' ? 'is-turn' : ''}`}>
            <strong className="tt-score-num">{match.scores.player}</strong>
            <span className="tt-score-name">You</span>
          </div>
        </div>

        <div className="tt-hud-actions">
          <button
            type="button"
            className={`tt-icon-btn ${hintsEnabled ? 'is-active' : ''}`}
            title="Toggle capture preview hints"
            aria-label="Toggle capture preview hints"
            onClick={() => setHintsEnabled((v) => !v)}
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            className="tt-icon-btn"
            title="Match Log"
            aria-label="Match Log"
            onClick={() => setLogOpen(true)}
          >
            <ScrollText size={16} />
          </button>
          <button
            type="button"
            className="tt-icon-btn"
            title="Active Rules"
            aria-label="Active Rules"
            onClick={() => setRulesOpen(true)}
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </header>

      {/* Active Rules Bar */}
      <div className="tt-rules-strip">
        {visibleRules.length === 0 ? (
          <span className="tt-pill tt-pill--sm">Classic Rules</span>
        ) : (
          visibleRules.map((r) => (
            <span key={r} className="tt-pill tt-pill--sm tt-pill--rule">
              {SPECIAL_RULE_INFO[r].label}
            </span>
          ))
        )}
        <span className="tt-pill tt-pill--sm tt-pill--trade">
          Trade: {TRADE_RULE_INFO[match.tradeRule].label}
        </span>
        <span className="tt-turn-status">
          {match.phase === 'playing' ? (
            match.currentTurn === 'player' ? (
              <>
                <Ff8Cursor size={14} /> Your Turn — Pick a card &amp; place
              </>
            ) : (
              `${opponentName} is thinking…`
            )
          ) : match.phase === 'suddenDeathPending' ? (
            '5–5 Draw! Preparing Sudden Death…'
          ) : match.winner === 'player' ? (
            'YOU WIN!'
          ) : match.winner === 'opponent' ? (
            'YOU LOSE…'
          ) : (
            'DRAW GAME'
          )}
        </span>
      </div>

      {/* Main Playfield: Opponent Hand | 3x3 Board | Player Hand */}
      <div className="tt-playfield">
        <aside className="tt-hand-col tt-hand-col--opp" aria-label="Opponent hand">
          <div className="tt-hand-label">
            <span>{opponentName}</span>
            <span className="tt-muted">{opponentTitle}</span>
          </div>
          <div className="tt-hand-cards">
            {match.opponentHand.map((cid, idx) => (
              <div key={`opp-${idx}-${cid}`} className="tt-hand-slot">
                <CardView
                  cardId={isOpen ? cid : null}
                  owner="opponent"
                  faceDown={!isOpen}
                  compact
                />
              </div>
            ))}
          </div>
        </aside>

        <main className="tt-board-wrap">
          {ruleBanner && (
            <div className="tt-rule-banner" role="status" aria-live="polite">
              {ruleBanner}
            </div>
          )}

          <div className="tt-board" role="grid" aria-label="Triple Triad 3 by 3 board">
            {match.board.map((cell) => {
              const preview = previewByCell?.get(cell.index);
              const isDropHover = drag.active && drag.hoveredCellIndex === cell.index && !cell.placed;
              const canTapPlace =
                canPlayerAct && selectedHandIdx !== null && cell.placed === null;
              const placedCard = cell.placed ? CARDS_BY_ID[cell.placed.cardId] : null;
              const elemMod =
                placedCard && cell.placed
                  ? getElementalModifier(placedCard.element, cell.element, elementalActive)
                  : 0;

              return (
                <div
                  key={cell.index}
                  data-cell-index={cell.index}
                  className={[
                    'tt-cell',
                    canTapPlace ? 'is-placeable' : '',
                    isDropHover ? 'is-drop-hover' : '',
                    preview ? 'has-preview' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (canTapPlace && selectedHandIdx !== null) {
                      handlePlaceAtCell(selectedHandIdx, cell.index);
                    }
                  }}
                >
                  {cell.element !== 'none' && !cell.placed && (
                    <div className="tt-cell-element" title={`${ELEMENT_LABEL[cell.element]} Tile (+1 ${ELEMENT_LABEL[cell.element]} / -1 others)`}>
                      <img
                        src={`./assets/elements/${cell.element}.png`}
                        alt={ELEMENT_LABEL[cell.element]}
                        className="tt-cell-element-img"
                      />
                      <span>{ELEMENT_LABEL[cell.element]}</span>
                    </div>
                  )}

                  {cell.placed && (
                    <CardView
                      cardId={cell.placed.cardId}
                      owner={cell.placed.owner}
                      justFlipped={flippedIndices.has(cell.index)}
                      elementalMod={elemMod}
                    />
                  )}

                  {preview && !cell.placed && (
                    <div className="tt-cell-preview">
                      <span>+{preview.flips}</span>
                      {preview.tags.length > 0 && (
                        <small>{preview.tags[0].toUpperCase()}</small>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        <aside className="tt-hand-col tt-hand-col--player" aria-label="Your hand">
          <div className="tt-hand-label">
            <span>Your Hand</span>
            {canPlayerAct && selectedHandIdx !== null && (
              <span className="tt-accent">Tap an empty tile</span>
            )}
          </div>
          <div className="tt-hand-cards">
            {match.playerHand.map((cid, idx) => (
              <div
                key={`ply-${idx}-${cid}`}
                className={`tt-hand-slot ${drag.active && drag.handIndex === idx ? 'is-dragging-source' : ''}`}
              >
                <CardView
                  cardId={cid}
                  owner="player"
                  compact
                  selected={selectedHandIdx === idx}
                  disabled={!canPlayerAct}
                  onClick={() => {
                    if (!canPlayerAct) return;
                    soundEngine.playCursor();
                    setSelectedHandIdx((prev) => (prev === idx ? null : idx));
                  }}
                  onPointerDown={(e) => beginDrag(idx, cid, e)}
                />
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Floating GPU Drag Ghost */}
      {drag.active && drag.cardId && (
        <div
          className="tt-drag-ghost"
          style={{
            transform: `translate3d(${drag.x}px, ${drag.y}px, 0) translate(-50%, -50%) scale(1.06)`,
          }}
        >
          <CardView cardId={drag.cardId} owner="player" compact />
        </div>
      )}

      {/* Post-Match Result & Trade Overlay */}
      {match.phase === 'finished' && match.tradeSummary && (
        <div className="tt-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Match Result">
          <div className="tt-window tt-result-modal">
            <div className="tt-result-head">
              <Trophy
                size={26}
                className={
                  match.winner === 'player'
                    ? 'tt-text-gold'
                    : match.winner === 'opponent'
                      ? 'tt-text-red'
                      : 'tt-text-blue'
                }
              />
              <div>
                <h2>
                  {match.winner === 'player'
                    ? 'VICTORY!'
                    : match.winner === 'opponent'
                      ? 'DEFEAT'
                      : 'DRAW'}
                </h2>
                <p className="tt-muted">
                  Final Score: You {match.scores.player} — {match.scores.opponent} {opponentName} · Trade Rule:{' '}
                  <strong>{TRADE_RULE_INFO[match.tradeRule].label}</strong>
                </p>
              </div>
            </div>

            <blockquote className="tt-npc-quote">
              “{match.winner === 'player' ? victoryLine : defeatLine}” — {opponentName}
            </blockquote>

            {!tradeApplied ? (
              <div className="tt-trade-picker">
                <p>
                  Select{' '}
                  <strong>
                    {match.tradeSummary.cardsToPick}{' '}
                    {match.tradeSummary.cardsToPick === 1 ? 'card' : 'cards'}
                  </strong>{' '}
                  to claim from {opponentName}’s hand ({selectedTradeIndices.length}/
                  {match.tradeSummary.cardsToPick}):
                </p>
                <div className="tt-trade-cards">
                  {match.tradeSummary.opponentPoolIds.map((cid, idx) => (
                    <div key={`${cid}-${idx}`} className="tt-trade-card-slot">
                      <CardView
                        cardId={cid}
                        owner="opponent"
                        selected={selectedTradeIndices.includes(idx)}
                        onClick={() => handleToggleTradeIndex(idx)}
                      />
                    </div>
                  ))}
                </div>
                <div className="tt-prematch-actions">
                  <button
                    type="button"
                    className="tt-btn tt-btn--primary"
                    disabled={selectedTradeIndices.length !== match.tradeSummary.cardsToPick}
                    onClick={handleConfirmPlayerTrade}
                  >
                    <Ff8Cursor size={16} /> Claim Selected Cards
                  </button>
                </div>
              </div>
            ) : (
              <div className="tt-trade-summary">
                {sandboxMode && (
                  <p className="tt-pill tt-pill--gold">
                    Sandbox Mode: Campaign collection unchanged.
                  </p>
                )}

                {tradeApplied.trade.gainedByPlayer.length > 0 && (
                  <div className="tt-trade-group">
                    <span className="tt-label tt-text-blue">CARDS GAINED</span>
                    <div className="tt-trade-cards">
                      {tradeApplied.trade.gainedByPlayer.map((cid, i) => (
                        <div key={`g-${cid}-${i}`} className="tt-trade-card-slot">
                          <CardView cardId={cid} owner="player" compact />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tradeApplied.trade.lostByPlayer.length > 0 && (
                  <div className="tt-trade-group">
                    <span className="tt-label tt-text-red">CARDS LOST</span>
                    <div className="tt-trade-cards">
                      {tradeApplied.trade.lostByPlayer.map((cid, i) => (
                        <div key={`l-${cid}-${i}`} className="tt-trade-card-slot">
                          <CardView cardId={cid} owner="opponent" compact />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tradeApplied.trade.gainedByPlayer.length === 0 &&
                  tradeApplied.trade.lostByPlayer.length === 0 && (
                    <p className="tt-muted">No cards changed hands.</p>
                  )}

                {tradeApplied.protectedCardIds.length > 0 && (
                  <p className="tt-notice tt-notice--info">
                    5-Card Softlock Guard spared {tradeApplied.protectedCardIds.length} card(s) so
                    your deck never drops below 5 playable cards.
                  </p>
                )}

                {tradeApplied.queenForgeMessages.map((msg, i) => (
                  <p key={i} className="tt-notice tt-notice--gold">
                    <Sparkles size={15} /> {msg}
                  </p>
                ))}

                {tradeApplied.extraMessages.map((msg, i) => (
                  <p key={`x-${i}`} className="tt-notice tt-notice--info">
                    {msg}
                  </p>
                ))}

                <div className="tt-prematch-actions">
                  <button
                    type="button"
                    className="tt-btn tt-btn--primary"
                    onClick={() => {
                      soundEngine.playConfirm();
                      onAbortMatch();
                    }}
                  >
                    <Ff8Cursor size={16} /> Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Match Log Sheet */}
      <MobileSheet
        open={logOpen}
        title="Match Log"
        subtitle={`${match.history.length} moves played`}
        onClose={() => setLogOpen(false)}
      >
        {match.history.length === 0 ? (
          <p className="tt-muted">No cards placed yet.</p>
        ) : (
          <ol className="tt-log-list">
            {match.history.map((entry) => {
              const card = CARDS_BY_ID[entry.cardId];
              const row = Math.floor(entry.cellIndex / 3) + 1;
              const col = (entry.cellIndex % 3) + 1;
              return (
                <li key={entry.turnNumber} className="tt-log-item">
                  <strong>
                    #{entry.turnNumber} {entry.actor === 'player' ? 'You' : opponentName}:
                  </strong>{' '}
                  {card?.name} → R{row}C{col}
                  {entry.triggeredRules.length > 0 && (
                    <span className="tt-log-tags">
                      {' '}
                      [{entry.triggeredRules.map((t) => t.toUpperCase()).join(' + ')}]
                    </span>
                  )}
                  {entry.flips.length > 0 && (
                    <span className="tt-muted"> ({entry.flips.length} flipped)</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </MobileSheet>

      {/* Active Rules Reference Sheet */}
      <MobileSheet
        open={rulesOpen}
        title="Active Match Rules"
        subtitle={`Trade Rule: ${TRADE_RULE_INFO[match.tradeRule].label}`}
        onClose={() => setRulesOpen(false)}
      >
        <div className="tt-rules-ref">
          <div className="tt-rule-ref-item">
            <h4>Trade — {TRADE_RULE_INFO[match.tradeRule].label}</h4>
            <p>{TRADE_RULE_INFO[match.tradeRule].shortDesc}</p>
          </div>
          {visibleRules.length === 0 ? (
            <p className="tt-muted">No special rules active — pure rank comparison.</p>
          ) : (
            visibleRules.map((r) => (
              <div key={r} className="tt-rule-ref-item">
                <h4>{SPECIAL_RULE_INFO[r].label}</h4>
                <p>{SPECIAL_RULE_INFO[r].detail}</p>
              </div>
            ))
          )}
        </div>
      </MobileSheet>
    </div>
  );
};
