import React, { useMemo, useState } from 'react';
import { Crown, MapPin, RefreshCw, ShieldCheck, Sparkles, Swords } from 'lucide-react';
import { CARDS_BY_ID } from '../data/cards';
import { NPCS, QUEEN_QUEST_STEPS } from '../data/opponents';
import { REGION_ORDER, REGIONS, SPECIAL_RULE_INFO, TRADE_RULE_INFO } from '../data/regions';
import { soundEngine } from '../audio/soundEngine';
import { canOfferRuleMix, getVisibleRules } from '../engine/regionalRules';
import type { NpcDefinition, ProfileState, RegionId } from '../types/tripleTriad';
import { Ff8Cursor } from './Ff8Cursor';

interface WorldTourScreenProps {
  profile: ProfileState;
  onChallengeNpc: (npc: NpcDefinition, mixRules: boolean, declinedCarry: boolean) => void;
}

export const WorldTourScreen: React.FC<WorldTourScreenProps> = ({
  profile,
  onChallengeNpc,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<RegionId>(
    profile.carriedRegionId ?? 'balamb',
  );
  const [mixPromptNpc, setMixPromptNpc] = useState<NpcDefinition | null>(null);
  const [declinedAttempts, setDeclinedAttempts] = useState(0);

  const regionDef = REGIONS[selectedRegion];
  const regionState = profile.regions[selectedRegion];
  const visibleRegionRules = useMemo(
    () => getVisibleRules(regionState.specialRules),
    [regionState.specialRules],
  );
  const visibleCarriedRules = useMemo(
    () => getVisibleRules(profile.carriedRules),
    [profile.carriedRules],
  );

  const npcsInRegion = useMemo(() => {
    return NPCS.filter((npc) => {
      if (npc.isQueenOfCards) {
        return profile.queenRegionId === selectedRegion;
      }
      return npc.regionId === selectedRegion;
    });
  }, [selectedRegion, profile.queenRegionId]);

  const isNpcUnlocked = (npc: NpcDefinition): boolean => {
    if (!npc.unlockRequirement) return true;
    if (
      npc.unlockRequirement.ccStageMin !== undefined &&
      profile.ccGroupStage < npc.unlockRequirement.ccStageMin
    ) {
      return false;
    }
    if (
      npc.unlockRequirement.defeatedNpcIds &&
      !npc.unlockRequirement.defeatedNpcIds.every((id) => profile.defeatedNpcIds.includes(id))
    ) {
      return false;
    }
    return true;
  };

  const handleClickChallenge = (npc: NpcDefinition) => {
    soundEngine.playConfirm();
    if (npc.isRuleResetter) {
      // Student Skipping Class plays with no special rules and wipes Balamb rules
      onChallengeNpc(npc, false, false);
      return;
    }
    const shouldMix =
      profile.settings.ruleSpreadEnabled &&
      canOfferRuleMix(profile.carriedRules, regionState.specialRules);
    if (shouldMix) {
      setDeclinedAttempts(0);
      setMixPromptNpc(npc);
      return;
    }
    onChallengeNpc(npc, false, false);
  };

  return (
    <div className="tt-world">
      {/* World Region Selector */}
      <section className="tt-window tt-region-bar" aria-label="FF8 World Regions">
        <div className="tt-panel-head">
          <h2>
            <MapPin size={17} /> World Tour — 8 Regions
          </h2>
          <div className="tt-carried-badge">
            <span className="tt-muted">Carrying from {profile.carriedRegionId ? REGIONS[profile.carriedRegionId].name : 'None'}:</span>
            {visibleCarriedRules.length === 0 ? (
              <span className="tt-pill tt-pill--sm">None</span>
            ) : (
              visibleCarriedRules.map((r) => (
                <span key={r} className="tt-pill tt-pill--sm tt-pill--rule">
                  {SPECIAL_RULE_INFO[r].label}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="tt-region-grid">
          {REGION_ORDER.map((rid) => {
            const def = REGIONS[rid];
            const state = profile.regions[rid];
            const hasQueen = profile.queenRegionId === rid;
            const regionNpcs = NPCS.filter((n) => (n.isQueenOfCards ? hasQueen : n.regionId === rid));
            const remainingRares = regionNpcs.flatMap((n) =>
              n.rareCardIds.filter((cid) => profile.rareCardHolders[cid] === `npc:${n.id}`),
            );

            return (
              <button
                key={rid}
                type="button"
                className={`tt-region-card ${selectedRegion === rid ? 'is-selected' : ''}`}
                style={{ '--region-accent': def.accentColor } as React.CSSProperties}
                onClick={() => {
                  soundEngine.playCursor();
                  setSelectedRegion(rid);
                }}
              >
                <div className="tt-region-card-top">
                  <strong>{def.name}</strong>
                  {hasQueen && (
                    <span className="tt-pill tt-pill--gold" title="Queen of Cards is currently here">
                      <Crown size={11} /> Queen
                    </span>
                  )}
                </div>
                <span className="tt-region-trade">Trade: {TRADE_RULE_INFO[state.tradeRule].label}</span>
                {remainingRares.length > 0 && (
                  <span className="tt-region-rares">★ {remainingRares.length} Rare(s)</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Region Detail & NPCs */}
      <div className="tt-world-split">
        <section className="tt-window tt-region-detail">
          <div className="tt-region-detail-head">
            <div>
              <h2>{regionDef.name}</h2>
              <p className="tt-muted">{regionDef.subtitle}</p>
            </div>
            <span className="tt-pill tt-pill--trade">
              Trade: {TRADE_RULE_INFO[regionState.tradeRule].label}
            </span>
          </div>
          <p className="tt-region-desc">{regionDef.description}</p>

          <div className="tt-region-rules-box">
            <span className="tt-label">ACTIVE SPECIAL RULES</span>
            <div className="tt-pill-row">
              {visibleRegionRules.length === 0 ? (
                <span className="tt-pill">None (Pure Classic)</span>
              ) : (
                visibleRegionRules.map((r) => (
                  <span key={r} className="tt-pill tt-pill--rule" title={SPECIAL_RULE_INFO[r].detail}>
                    {SPECIAL_RULE_INFO[r].label}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="tt-npc-list">
            {npcsInRegion.map((npc) => {
              const unlocked = isNpcUnlocked(npc);
              const defeated = profile.defeatedNpcIds.includes(npc.id);
              const heldRares = npc.rareCardIds.filter(
                (cid) => profile.rareCardHolders[cid] === `npc:${npc.id}`,
              );

              return (
                <article
                  key={npc.id}
                  className={`tt-npc-card ${!unlocked ? 'is-locked' : ''} ${defeated ? 'is-defeated' : ''}`}
                >
                  <div className="tt-npc-info">
                    <div className="tt-npc-title-row">
                      <h3>{npc.name}</h3>
                      <span className={`tt-tier-badge is-${npc.aiTier}`}>{npc.aiTier}</span>
                      {defeated && (
                        <span className="tt-pill tt-pill--sm tt-pill--ok">
                          <ShieldCheck size={12} /> Cleared
                        </span>
                      )}
                      {npc.isRuleResetter && (
                        <span className="tt-pill tt-pill--sm tt-pill--gold">
                          <RefreshCw size={12} /> Clears Balamb Rules
                        </span>
                      )}
                    </div>
                    <p className="tt-muted">
                      {npc.title} · {npc.location} · Deck Lv {Math.min(...npc.deckLevels)}–
                      {Math.max(...npc.deckLevels)}
                    </p>
                    <p className="tt-npc-greeting">“{npc.greeting}”</p>
                    {heldRares.length > 0 && (
                      <div className="tt-npc-bounties">
                        {heldRares.map((cid) => (
                          <span key={cid} className="tt-pill tt-pill--gold">
                            ★ Holds {CARDS_BY_ID[cid]?.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {!unlocked && (
                      <p className="tt-notice tt-notice--info">
                        Locked: Defeat earlier CC Group members first (Stage {profile.ccGroupStage}/7).
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="tt-btn tt-btn--primary"
                    disabled={!unlocked}
                    onClick={() => handleClickChallenge(npc)}
                  >
                    <Ff8Cursor size={15} />
                    <Swords size={15} />
                    Challenge
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Side Quests Panel: CC Group + Queen of Cards */}
        <aside className="tt-quests-col">
          <div className="tt-window tt-quest-panel">
            <h3>
              <Sparkles size={16} /> Balamb Card Club (CC Group)
            </h3>
            <p className="tt-muted">
              Challenge CC members across Balamb Garden in order from Jack to King.
            </p>
            <div className="tt-progress-track">
              <div
                className="tt-progress-fill"
                style={{ width: `${(profile.ccGroupStage / 7) * 100}%` }}
              />
            </div>
            <p className="tt-quest-stat">Progress: {profile.ccGroupStage} / 7 Defeated</p>
          </div>

          <div className="tt-window tt-quest-panel">
            <h3>
              <Crown size={16} /> Queen of Cards Quest
            </h3>
            <p className="tt-muted">
              Currently in <strong>{REGIONS[profile.queenRegionId].name}</strong> · Personal Trade Rule:{' '}
              <strong>{TRADE_RULE_INFO[profile.queenTradeRule].label}</strong>
            </p>
            <ul className="tt-queen-steps">
              {QUEEN_QUEST_STEPS.map((step) => {
                const forged = profile.queenForgedCardIds.includes(step.forgedCardId);
                const owned = (profile.collection[step.forgedCardId] ?? 0) > 0;
                return (
                  <li key={step.step} className={forged ? 'is-forged' : ''}>
                    <span className="tt-queen-badge">
                      {owned ? '★ Won' : forged ? 'Forged' : `Step ${step.step + 1}`}
                    </span>
                    <span>{step.description}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>

      {/* Mixed Rules Dialog */}
      {mixPromptNpc && (
        <div className="tt-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Mixed Rules Offer">
          <div className="tt-window tt-mix-modal">
            <h3>Mixed Rules Challenge</h3>
            <p>
              <strong>{mixPromptNpc.name}</strong> notices you know rules unfamiliar to{' '}
              <strong>{regionDef.name}</strong>:
            </p>
            <div className="tt-pill-row">
              {visibleCarriedRules
                .filter((r) => !regionState.specialRules.includes(r))
                .map((r) => (
                  <span key={r} className="tt-pill tt-pill--rule">
                    + {SPECIAL_RULE_INFO[r].label}
                  </span>
                ))}
            </div>
            <p className="tt-muted">
              Play with <strong>Mixed Rules</strong> (may spread or abolish a rule after the match),
              or decline until they drop the offer ({declinedAttempts}/2 declines).
            </p>
            <div className="tt-prematch-actions">
              <button
                type="button"
                className="tt-btn tt-btn--ghost"
                onClick={() => {
                  soundEngine.playCancel();
                  if (declinedAttempts >= 1) {
                    const target = mixPromptNpc;
                    setMixPromptNpc(null);
                    onChallengeNpc(target, false, true);
                  } else {
                    setDeclinedAttempts((n) => n + 1);
                  }
                }}
              >
                {declinedAttempts >= 1 ? 'Decline Again (Play Regional Only)' : 'No, Decline Mix'}
              </button>
              <button
                type="button"
                className="tt-btn tt-btn--primary"
                onClick={() => {
                  soundEngine.playConfirm();
                  const target = mixPromptNpc;
                  setMixPromptNpc(null);
                  onChallengeNpc(target, true, false);
                }}
              >
                <Ff8Cursor size={15} /> Accept Mixed Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
