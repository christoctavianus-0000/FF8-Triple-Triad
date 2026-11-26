import React, { useMemo, useState } from 'react';
import { getCardById } from '../data/cards';
import { REGION_ORDER, REGIONS, SPECIAL_RULE_INFO, TRADE_RULE_INFO } from '../data/regions';
import { getVisibleRules } from '../engine/regionalRules';
import { getActiveDeck, getUniqueCollectedCount } from '../state/profileStore';
import { soundEngine } from '../audio/soundEngine';
import type { ProfileState, SpecialRule } from '../types/tripleTriad';
import { CardView } from './CardView';

export type AtriumTargetTab = 'world' | 'decks' | 'custom' | 'binder';

interface AtriumHomeProps {
  profile: ProfileState;
  onNavigate: (tab: AtriumTargetTab) => void;
  onQuickDuel: () => void;
}

const RULE_KEYS: readonly SpecialRule[] = [
  'open',
  'same',
  'sameWall',
  'plus',
  'elemental',
  'random',
  'suddenDeath',
];

export const AtriumHome: React.FC<AtriumHomeProps> = ({
  profile,
  onNavigate,
  onQuickDuel,
}) => {
  const [terminalTab, setTerminalTab] = useState<'sectors' | 'deck' | 'rules'>('sectors');
  const [selectedRule, setSelectedRule] = useState<SpecialRule>('same');

  const uniqueOwned = useMemo(
    () => getUniqueCollectedCount(profile.collection),
    [profile.collection],
  );
  const activeDeck = useMemo(() => getActiveDeck(profile), [profile]);
  const deckPower = useMemo(() => {
    return activeDeck.cards.reduce((sum, cid) => {
      const c = getCardById(cid);
      return sum + c.ranks.top + c.ranks.right + c.ranks.bottom + c.ranks.left;
    }, 0);
  }, [activeDeck]);

  const albumPct = Math.round((uniqueOwned / 110) * 100);

  return (
    <div className="bg-atrium-flow">
      {/* 2. HERO ("The Main Atrium") */}
      <section className="tt-window bg-hero" aria-label="The Main Atrium">
        <div className="bg-hero__copy">
          <div className="bg-status-row">
            <span className="bg-status-pill">
              <span className="bg-status-dot" aria-hidden="true" />
              SYSTEM: ONLINE
            </span>
            <span className="bg-status-pill is-cyan">SECTOR: MAIN ATRIUM // QUAD</span>
          </div>

          <h2 className="bg-hero__title">
            Triple Triad, reimagined inside Balamb Garden.
          </h2>
          <p className="bg-hero__sub">
            Sunlit tactics across a 3×3 grid. Collect all 110 cards, master regional rules
            from Balamb to Lunar Orbit, and build your 5-card SeeD hand inside a calm,
            architectural terminal interface.
          </p>

          <div className="bg-hero__actions">
            <button
              type="button"
              className="tt-btn tt-btn--gold bg-cta-btn"
              onClick={() => {
                soundEngine.playConfirm();
                onNavigate('world');
              }}
            >
              <span className="bg-ptr" aria-hidden="true">▶</span>
              Enter World Tour
            </button>
            <button
              type="button"
              className="tt-btn tt-btn--ghost bg-cta-btn"
              onClick={() => {
                soundEngine.playCursor();
                onNavigate('decks');
              }}
            >
              <span className="bg-ptr" aria-hidden="true">▶</span>
              Open Deck Builder
            </button>
          </div>

          <dl className="bg-hero__telemetry">
            <div>
              <dt>ALBUM SYNC</dt>
              <dd>{uniqueOwned} / 110</dd>
            </div>
            <div>
              <dt>CC GROUP</dt>
              <dd>RANK {profile.ccGroupStage} / 7</dd>
            </div>
            <div>
              <dt>ACTIVE DECK</dt>
              <dd>{activeDeck.name}</dd>
            </div>
          </dl>
        </div>

        {/* Interactive Garden Directory Terminal */}
        <aside className="bg-terminal" aria-label="Garden Directory Terminal">
          <div className="bg-terminal__top">
            <span className="bg-mono-tag">GARDEN DIRECTORY // TERMINAL 01</span>
            <span className="bg-terminal__badge">STATUS: LIVE</span>
          </div>

          <div className="bg-terminal__tabs" role="tablist" aria-label="Terminal views">
            {(
              [
                { id: 'sectors', label: 'SECTORS' },
                { id: 'deck', label: 'DECK' },
                { id: 'rules', label: 'RULES' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={terminalTab === item.id}
                className={`bg-terminal__tab ${terminalTab === item.id ? 'is-active' : ''}`}
                onClick={() => {
                  soundEngine.playCursor();
                  setTerminalTab(item.id);
                }}
              >
                <span className="bg-ptr" aria-hidden="true">▶</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="bg-terminal__body">
            {terminalTab === 'sectors' && (
              <div className="bg-term-sectors">
                <div className="bg-term-note">
                  <span>QUEEN OF CARDS LOCATION</span>
                  <strong>{REGIONS[profile.queenRegionId].name}</strong>
                </div>
                <ul className="bg-term-list">
                  {REGION_ORDER.slice(0, 5).map((rid) => {
                    const reg = REGIONS[rid];
                    const rState = profile.regions[rid];
                    const rules = getVisibleRules(rState.specialRules);
                    return (
                      <li key={rid}>
                        <span className="bg-term-reg">{reg.name}</span>
                        <span className="bg-term-rules">
                          {rules.length === 0
                            ? 'Classic'
                            : rules.map((r) => SPECIAL_RULE_INFO[r].label).join(', ')}
                        </span>
                        <span className="bg-term-trade">
                          {TRADE_RULE_INFO[rState.tradeRule].label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  className="tt-btn tt-btn--primary tt-btn--sm bg-term-go"
                  onClick={() => {
                    soundEngine.playConfirm();
                    onNavigate('world');
                  }}
                >
                  <span className="bg-ptr" aria-hidden="true">▶</span>
                  View All 8 Regions
                </button>
              </div>
            )}

            {terminalTab === 'deck' && (
              <div className="bg-term-deck">
                <div className="bg-term-note">
                  <span>{activeDeck.name}</span>
                  <strong>POWER {deckPower}</strong>
                </div>
                <div className="bg-term-cards">
                  {activeDeck.cards.map((cid, idx) => (
                    <div key={`${cid}-${idx}`} className="bg-term-card-slot">
                      <CardView cardId={cid} owner="player" compact />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="tt-btn tt-btn--primary tt-btn--sm bg-term-go"
                  onClick={() => {
                    soundEngine.playConfirm();
                    onNavigate('decks');
                  }}
                >
                  <span className="bg-ptr" aria-hidden="true">▶</span>
                  Edit Presets in Deck Builder
                </button>
              </div>
            )}

            {terminalTab === 'rules' && (
              <div className="bg-term-rules-pane">
                <div className="bg-term-rule-pills">
                  {RULE_KEYS.map((rk) => (
                    <button
                      key={rk}
                      type="button"
                      className={`tt-tab ${selectedRule === rk ? 'is-active' : ''}`}
                      onClick={() => {
                        soundEngine.playCursor();
                        setSelectedRule(rk);
                      }}
                    >
                      {SPECIAL_RULE_INFO[rk].label}
                    </button>
                  ))}
                </div>
                <div className="bg-term-rule-card">
                  <span className="bg-mono-tag">PROTOCOL // {SPECIAL_RULE_INFO[selectedRule].label.toUpperCase()}</span>
                  <p>{SPECIAL_RULE_INFO[selectedRule].detail}</p>
                </div>
                <button
                  type="button"
                  className="tt-btn tt-btn--primary tt-btn--sm bg-term-go"
                  onClick={() => {
                    soundEngine.playConfirm();
                    onNavigate('custom');
                  }}
                >
                  <span className="bg-ptr" aria-hidden="true">▶</span>
                  Test in Custom Skirmish
                </button>
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* 3. FEATURE MODULES ("Campus Sectors") */}
      <section className="bg-sectors" aria-label="Campus Sectors">
        <div className="bg-section-head">
          <span className="bg-mono-tag">CAMPUS SECTORS // NAVIGATION DIRECTORY</span>
          <h3>Three wings engineered for complete PS1 Triple Triad mastery</h3>
        </div>

        <div className="bg-bento">
          {/* Primary Wide Sector Card */}
          <article className="tt-window bg-bento-card bg-bento-card--wide">
            <div className="bg-bento-card__top">
              <span className="bg-mono-tag">SECTOR 01 // WORLD TOUR &amp; CC GROUP</span>
              <svg className="bg-geo-icon" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#3B82A6" strokeWidth="1.6" />
                <circle cx="18" cy="18" r="7" fill="none" stroke="#C89D54" strokeWidth="1.6" />
                <line x1="4" y1="18" x2="32" y2="18" stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1="18" y1="4" x2="18" y2="32" stroke="#CBD5E1" strokeWidth="1.2" />
              </svg>
            </div>
            <h4>Eight Authentic Regions, Rule Spread &amp; Rare Reclamation</h4>
            <p>
              Challenge iconic NPCs from Balamb Harbor to Lunar Gate. Carry regional rules,
              reset Balamb via the Student Skipping Class, climb the 7-tier Card Club, and
              complete the Queen of Cards forging quest—with full rare card reclamation from
              whichever opponent holds your card.
            </p>
            <div className="bg-bento-card__foot">
              <span className="bg-mono-meta">8 REGIONS · 30+ CHALLENGERS</span>
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                onClick={() => {
                  soundEngine.playConfirm();
                  onNavigate('world');
                }}
              >
                <span className="bg-ptr" aria-hidden="true">▶</span> Open Sector 01
              </button>
            </div>
          </article>

          {/* Companion Sector Card 02 */}
          <article className="tt-window bg-bento-card">
            <div className="bg-bento-card__top">
              <span className="bg-mono-tag">SECTOR 02 // DECK BUILDER</span>
              <svg className="bg-geo-icon" viewBox="0 0 36 36" aria-hidden="true">
                <rect x="6" y="8" width="14" height="20" rx="3" fill="none" stroke="#3B82A6" strokeWidth="1.6" />
                <rect x="16" y="6" width="14" height="20" rx="3" fill="none" stroke="#C89D54" strokeWidth="1.6" />
              </svg>
            </div>
            <h4>5-Slot Tactical Presets</h4>
            <p>
              Save up to five named 5-card lineups with live Directional Rank Averages,
              Elemental coverage, Same Wall A-rank alerts, and automatic post-trade repair.
            </p>
            <div className="bg-bento-card__foot">
              <span className="bg-mono-meta">5 PRESETS · AUTO-REPAIR</span>
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                onClick={() => {
                  soundEngine.playConfirm();
                  onNavigate('decks');
                }}
              >
                <span className="bg-ptr" aria-hidden="true">▶</span> Open Sector 02
              </button>
            </div>
          </article>

          {/* Companion Sector Card 03 */}
          <article className="tt-window bg-bento-card">
            <div className="bg-bento-card__top">
              <span className="bg-mono-tag">SECTOR 03 // ARCHIVE &amp; SKIRMISH</span>
              <svg className="bg-geo-icon" viewBox="0 0 36 36" aria-hidden="true">
                <polygon points="18,4 32,12 32,24 18,32 4,24 4,12" fill="none" stroke="#3B82A6" strokeWidth="1.6" />
                <circle cx="18" cy="18" r="4" fill="#C89D54" />
              </svg>
            </div>
            <h4>110 Cards &amp; Custom Ruleset Lab</h4>
            <p>
              Browse all 110 canonical cards with Card Mod notes and live world holder
              tracking, or toggle Sandbox Mode to test Same, Plus, Combo, and Master AI.
            </p>
            <div className="bg-bento-card__foot">
              <span className="bg-mono-meta">110 CARDS · SANDBOX READY</span>
              <button
                type="button"
                className="tt-btn tt-btn--ghost tt-btn--sm"
                onClick={() => {
                  soundEngine.playConfirm();
                  onNavigate('binder');
                }}
              >
                <span className="bg-ptr" aria-hidden="true">▶</span> Open Album
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* 4. HIGHLIGHT / SOCIAL PROOF ("SeeD Briefing") */}
      <section className="bg-briefing" aria-label="SeeD Briefing">
        <div className="bg-briefing__stats">
          <span className="bg-mono-tag is-light">SEED BRIEFING // ACADEMY TELEMETRY</span>
          <h3>Engineered to exact 1999 PlayStation specifications</h3>
          <div className="bg-stat-grid">
            <div className="bg-stat-box">
              <strong>110</strong>
              <span>Canonical Cards (Lv 1–10)</span>
            </div>
            <div className="bg-stat-box">
              <strong>7 + 4</strong>
              <span>Special &amp; Trade Rules</span>
            </div>
            <div className="bg-stat-box">
              <strong>{albumPct}%</strong>
              <span>Your Album Progress</span>
            </div>
            <div className="bg-stat-box">
              <strong>{profile.stats.wins}–{profile.stats.losses}–{profile.stats.draws}</strong>
              <span>Career Match Record</span>
            </div>
          </div>
        </div>

        <blockquote className="bg-debrief-card">
          <div className="bg-debrief-card__head">
            <span className="bg-mono-tag is-gold">DEBRIEF // SEED-08</span>
            <span className="bg-mono-tag is-light">CLEARANCE: CC KING</span>
          </div>
          <p>
            “True Triple Triad mastery isn’t brute force—it’s reading Same Wall corners,
            respecting Elemental ±1 shifts, and keeping your cool when Sudden Death resets the
            board. Every rule in this terminal runs pure and uncompromised.”
          </p>
          <footer>
            <strong>Instructor Quistis Trepe</strong>
            <span>Balamb Garden Faculty · Founder, Card Club</span>
          </footer>
        </blockquote>
      </section>

      {/* 5. FINAL CTA & FOOTER ("Commencement") */}
      <section className="tt-window bg-commencement" aria-label="Commencement">
        <div className="bg-commencement__copy">
          <span className="bg-mono-tag">COMMENCEMENT // BALAMB QUAD</span>
          <h3>Report for your SeeD Card Evaluation</h3>
          <p>
            Step straight onto the sunlit 3×3 mat against the Balamb Gatekeeper, or configure a
            custom ruleset with Master-tier AI.
          </p>
        </div>
        <div className="bg-commencement__actions">
          <button
            type="button"
            className="tt-btn tt-btn--gold bg-cta-btn"
            onClick={() => {
              soundEngine.playConfirm();
              onQuickDuel();
            }}
          >
            <span className="bg-ptr" aria-hidden="true">▶</span>
            Quick Duel (Balamb)
          </button>
          <button
            type="button"
            className="tt-btn tt-btn--ghost bg-cta-btn"
            onClick={() => {
              soundEngine.playCursor();
              onNavigate('custom');
            }}
          >
            <span className="bg-ptr" aria-hidden="true">▶</span>
            Custom Skirmish
          </button>
        </div>
      </section>

      <footer className="bg-footer">
        <div className="bg-footer__col">
          <span className="bg-mono-tag">BALAMB GARDEN // DIRECTORY</span>
          <p>
            SeeD Cadet Card Training &amp; Tactical Archive. Faithful 1:1 Final Fantasy VIII
            Triple Triad recreation.
          </p>
        </div>

        <div className="bg-footer__col">
          <span className="bg-mono-tag">GARDEN SECTORS</span>
          <div className="bg-footer__links">
            <button type="button" onClick={() => onNavigate('world')}>▶ World Tour</button>
            <button type="button" onClick={() => onNavigate('decks')}>▶ Deck Builder</button>
            <button type="button" onClick={() => onNavigate('custom')}>▶ Custom Match</button>
            <button type="button" onClick={() => onNavigate('binder')}>▶ Card Album</button>
          </div>
        </div>

        <div className="bg-footer__col">
          <span className="bg-mono-tag">ACADEMY STATUS</span>
          <div className="bg-footer__status">
            <span>SYSTEM: ONLINE</span>
            <span>SECTOR: BALAMB QUAD</span>
            <span>BEST STREAK: {profile.stats.bestStreak} WINS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
