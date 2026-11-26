import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Globe,
  HelpCircle,
  Layers,
  Music,
  Settings,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ALL_CARDS } from './data/cards';
import { NPCS_BY_ID } from './data/opponents';
import { REGIONS, SPECIAL_RULE_INFO, TRADE_RULE_INFO } from './data/regions';
import { soundEngine } from './audio/soundEngine';
import { buildNpcHand, createMatch } from './engine/engine';
import {
  applyDominanceAndDegeneration,
  applyQueenTradeInfluence,
  applyStudentRuleReset,
  resolveRuleMixOutcome,
} from './engine/regionalRules';
import {
  applyTradeToProfile,
  getActiveDeck,
  getEffectiveCollection,
  getUniqueCollectedCount,
  loadProfile,
  resetProfile,
  saveProfile,
  setActiveDeckInProfile,
  updateDeckInProfile,
  updateStatsAfterMatch,
} from './state/profileStore';
import type {
  AiTier,
  MatchState,
  NpcDefinition,
  ProfileState,
  RegionId,
  SpecialRule,
  TradeResolution,
  TradeRule,
} from './types/tripleTriad';
import { AtriumHome } from './components/AtriumHome';
import { CardBinder } from './components/CardBinder';
import { CustomMatchScreen } from './components/CustomMatchScreen';
import { DeckBuilder } from './components/DeckBuilder';
import { HandSelectModal } from './components/HandSelectModal';
import { MatchScreen } from './components/MatchScreen';
import { MobileSheet } from './components/MobileSheet';
import { WorldTourScreen } from './components/WorldTourScreen';

type ActiveTab = 'atrium' | 'world' | 'decks' | 'custom' | 'binder';

const LIVE_ARCADE_HUB_URL = 'https://christoctavianus-0000.github.io/Mini-Game/';

function getArcadeHubUrl(): string {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]') &&
    /\/dist(\/|$)/i.test(window.location.pathname)
  ) {
    return '../../index.html';
  }
  return LIVE_ARCADE_HUB_URL;
}

interface PendingChallenge {
  mode: 'campaign' | 'custom';
  npc: NpcDefinition | null;
  regionId: RegionId | null;
  opponentName: string;
  opponentTitle: string;
  aiTier: AiTier;
  deckLevels: number[];
  rules: SpecialRule[];
  tradeRule: TradeRule;
  mixRules: boolean;
  sandbox: boolean;
  victoryLine: string;
  defeatLine: string;
}

export const App: React.FC = () => {
  const [profile, setProfile] = useState<ProfileState>(() => loadProfile());
  const [tab, setTab] = useState<ActiveTab>('atrium');
  const [worldFocusRegion, setWorldFocusRegion] = useState<RegionId | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
  const [activeMatch, setActiveMatch] = useState<{
    match: MatchState;
    challenge: PendingChallenge;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    soundEngine.setEnabled(profile.settings.soundEnabled);
    soundEngine.setBgmEnabled(profile.settings.bgmEnabled);
  }, [profile.settings.soundEnabled, profile.settings.bgmEnabled]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const effectiveCollection = useMemo(() => getEffectiveCollection(profile), [profile]);
  const uniqueOwnedCount = useMemo(
    () => getUniqueCollectedCount(profile.collection),
    [profile.collection],
  );
  const arcadeHubUrl = useMemo(() => getArcadeHubUrl(), []);

  const handleChallengeNpc = useCallback(
    (npc: NpcDefinition, mixRules: boolean, declinedCarry: boolean) => {
      const regionId = npc.isQueenOfCards ? profile.queenRegionId : npc.regionId;
      const regionState = profile.regions[regionId];

      let nextProfile = profile;
      const notices: string[] = [];

      if (npc.isRuleResetter) {
        // Balamb Student Skipping Class immediately wipes Balamb rules and carries none
        nextProfile = {
          ...nextProfile,
          regions: applyStudentRuleReset(nextProfile.regions),
          carriedRegionId: 'balamb',
          carriedRules: [],
        };
        notices.push('Balamb special rules were cleared by the Student Skipping Class!');
      } else if (declinedCarry) {
        nextProfile = {
          ...nextProfile,
          carriedRegionId: regionId,
          carriedRules: [...regionState.specialRules],
        };
      }

      // Queen of Cards + Dominance/Degeneration trade checks happen when challenge is accepted
      let effectiveTradeRule = regionState.tradeRule;
      if (!npc.isRuleResetter) {
        const queenInfluence = applyQueenTradeInfluence({
          challengedRegionId: regionId,
          regionTradeRule: effectiveTradeRule,
          queenRegionId: nextProfile.queenRegionId,
          queenTradeRule: nextProfile.queenTradeRule,
          isQueenMatch: Boolean(npc.isQueenOfCards),
          relocateQueen: Boolean(npc.isQueenOfCards),
        });
        effectiveTradeRule = queenInfluence.regionTradeRule;

        const nextRegions = {
          ...nextProfile.regions,
          [regionId]: {
            ...nextProfile.regions[regionId],
            tradeRule: effectiveTradeRule,
          },
        };

        const domRes = applyDominanceAndDegeneration({
          regions: nextRegions,
          challengedRegionId: regionId,
          dominanceRegionId: nextProfile.dominanceRegionId,
          dominanceLevel: nextProfile.dominanceLevel,
          degenerationCounter: nextProfile.degenerationCounter,
        });

        // Rule Mix Spread / Abolish resolution
        let updatedRegionRules = [...domRes.regions[regionId].specialRules];
        const matchRules = npc.isRuleResetter
          ? []
          : mixRules
            ? Array.from(new Set([...updatedRegionRules, ...nextProfile.carriedRules]))
            : [...updatedRegionRules];

        if (mixRules) {
          const outcome = resolveRuleMixOutcome(nextProfile.carriedRules, updatedRegionRules);
          updatedRegionRules = outcome.updatedRegionRules;
          domRes.regions[regionId] = {
            ...domRes.regions[regionId],
            specialRules: updatedRegionRules,
          };
          if (outcome.kind !== 'none') {
            notices.push(outcome.message);
          }
        }

        nextProfile = {
          ...nextProfile,
          regions: domRes.regions,
          dominanceRegionId: domRes.dominanceRegionId,
          dominanceLevel: domRes.dominanceLevel,
          degenerationCounter: domRes.degenerationCounter,
          queenTradeRule: queenInfluence.queenTradeRule,
          queenRegionId: queenInfluence.queenMovedToRegionId ?? nextProfile.queenRegionId,
          carriedRegionId: regionId,
          carriedRules: updatedRegionRules,
        };

        notices.push(...queenInfluence.announcements, ...domRes.announcements);

        if (nextProfile !== profile) {
          setProfile(nextProfile);
        }
        if (notices.length > 0) {
          setToast(notices[0]);
        }

        setPendingChallenge({
          mode: 'campaign',
          npc,
          regionId,
          opponentName: npc.name,
          opponentTitle: `${REGIONS[regionId].name} · ${npc.title}`,
          aiTier: npc.aiTier,
          deckLevels: npc.deckLevels,
          rules: matchRules,
          tradeRule: npc.isQueenOfCards ? 'one' : effectiveTradeRule,
          mixRules,
          sandbox: nextProfile.settings.sandboxMode,
          victoryLine: npc.victoryLine,
          defeatLine: npc.defeatLine,
        });
        return;
      }

      setProfile(nextProfile);
      if (notices.length > 0) setToast(notices[0]);

      setPendingChallenge({
        mode: 'campaign',
        npc,
        regionId,
        opponentName: npc.name,
        opponentTitle: `${REGIONS[regionId].name} · ${npc.title}`,
        aiTier: npc.aiTier,
        deckLevels: npc.deckLevels,
        rules: [],
        tradeRule: regionState.tradeRule,
        mixRules: false,
        sandbox: nextProfile.settings.sandboxMode,
        victoryLine: npc.victoryLine,
        defeatLine: npc.defeatLine,
      });
    },
    [profile],
  );

  const handleLaunchCustomMatch = useCallback(
    (config: {
      aiTier: AiTier;
      deckLevels: number[];
      rules: SpecialRule[];
      tradeRule: TradeRule;
      sandbox: boolean;
    }) => {
      setPendingChallenge({
        mode: 'custom',
        npc: null,
        regionId: null,
        opponentName: `Skirmish ${config.aiTier.toUpperCase()}`,
        opponentTitle: 'Custom Rules Match',
        aiTier: config.aiTier,
        deckLevels: config.deckLevels,
        rules: config.rules,
        tradeRule: config.tradeRule,
        mixRules: false,
        sandbox: config.sandbox,
        victoryLine: 'Sharp tactics across the custom grid!',
        defeatLine: 'Well fought—adjust your ranks and strike back!',
      });
    },
    [],
  );

  const handleStartMatch = useCallback(
    (playerHand: string[]) => {
      if (!pendingChallenge) return;
      const opponentHand = pendingChallenge.npc
        ? buildNpcHand(pendingChallenge.npc, ALL_CARDS, profile.rareCardHolders)
        : buildNpcHand(
            {
              id: 'custom-ai',
              name: pendingChallenge.opponentName,
              title: pendingChallenge.opponentTitle,
              regionId: 'balamb',
              location: 'Custom Arena',
              deckLevels: pendingChallenge.deckLevels,
              rareCardIds: [],
              aiTier: pendingChallenge.aiTier,
              greeting: '',
              victoryLine: '',
              defeatLine: '',
            },
            ALL_CARDS,
            profile.rareCardHolders,
          );

      const match = createMatch({
        playerHand,
        opponentHand,
        rules: pendingChallenge.rules,
        tradeRule: pendingChallenge.tradeRule,
      });

      setProfile((prev) => ({
        ...prev,
        lastDeckIds: playerHand,
      }));
      setActiveMatch({ match, challenge: pendingChallenge });
      setPendingChallenge(null);
    },
    [pendingChallenge, profile.rareCardHolders],
  );

  const handleFinishMatch = useCallback(
    (finalMatch: MatchState, trade: TradeResolution) => {
      const challenge = activeMatch?.challenge;
      const skipCollection = Boolean(challenge?.sandbox);
      const npcId = challenge?.npc?.id ?? null;

      let resultMeta = {
        protectedCardIds: [] as string[],
        queenForgeMessages: [] as string[],
        extraMessages: [] as string[],
      };

      setProfile((prev) => {
        const traded = applyTradeToProfile(prev, trade, npcId, skipCollection);
        const withStats = updateStatsAfterMatch(traded.profile, finalMatch, npcId);
        resultMeta = {
          protectedCardIds: traded.appliedTrade.protectedCardIds,
          queenForgeMessages: traded.queenForgeMessages,
          extraMessages: [],
        };

        if (
          finalMatch.winner === 'player' &&
          npcId &&
          NPCS_BY_ID[npcId]?.isCcMember &&
          withStats.ccGroupStage > prev.ccGroupStage
        ) {
          resultMeta.extraMessages.push(
            `CC Group Rank Advanced (${withStats.ccGroupStage}/7)!`,
          );
        }
        return withStats;
      });

      return resultMeta;
    },
    [activeMatch],
  );

  const handleQuickDuel = useCallback(() => {
    const starterNpc = NPCS_BY_ID['balamb-gatekeeper'];
    if (starterNpc) {
      handleChallengeNpc(starterNpc, false, false);
    } else {
      setTab('world');
    }
  }, [handleChallengeNpc]);

  return (
    <div className="tt-shell">
      {/* 1. TOP NAVIGATION ("Garden Directory Bar") */}
      <header className="tt-window tt-topbar bg-directory-bar">
        <div className="bg-brand-group">
          {!activeMatch && !pendingChallenge && (
            <a
              href={arcadeHubUrl}
              className="bg-hub-link"
              onClick={() => soundEngine.playCursor()}
              title="Back to Mini Game Arcade Hub"
              aria-label="Back to Mini Game Arcade Hub"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span className="bg-hub-link__label">Arcade</span>
            </a>
          )}
          <button
            type="button"
            className="tt-brand bg-brand-btn"
            onClick={() => {
              soundEngine.playCursor();
              setActiveMatch(null);
              setPendingChallenge(null);
              setTab('atrium');
            }}
          >
            <svg className="bg-crest-logo" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="18" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="13" fill="none" stroke="#3B82A6" strokeWidth="1.4" />
              <polygon points="20,6 28,20 20,34 12,20" fill="none" stroke="#C89D54" strokeWidth="1.8" />
              <circle cx="20" cy="20" r="3" fill="#14243B" />
            </svg>
            <div>
              <h1>Balamb Garden</h1>
              <span className="tt-brand-sub">TRIPLE TRIAD // SEED TERMINAL</span>
            </div>
          </button>
        </div>

        {!activeMatch && !pendingChallenge && (
          <nav className="bg-dir-links" aria-label="Garden sectors">
            {(
              [
                { id: 'atrium', label: 'Atrium' },
                { id: 'world', label: 'World Tour' },
                { id: 'decks', label: 'Deck Builder' },
                { id: 'custom', label: 'Custom Match' },
                { id: 'binder', label: `Album ${uniqueOwnedCount}/110` },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`bg-dir-link ${tab === item.id ? 'is-active' : ''}`}
                onClick={() => {
                  soundEngine.playCursor();
                  setTab(item.id);
                }}
              >
                <span className="bg-ptr" aria-hidden="true">▶</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="tt-topbar-actions">
          <button
            type="button"
            className={`tt-icon-btn ${profile.settings.soundEnabled ? 'is-active' : ''}`}
            aria-label={profile.settings.soundEnabled ? 'Mute SFX' : 'Unmute SFX'}
            title={profile.settings.soundEnabled ? 'Mute SFX' : 'Unmute SFX'}
            onClick={() =>
              setProfile((p) => ({
                ...p,
                settings: { ...p.settings, soundEnabled: !p.settings.soundEnabled },
              }))
            }
          >
            {profile.settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            className={`tt-icon-btn ${profile.settings.bgmEnabled ? 'is-active' : ''}`}
            aria-label="Toggle Balamb Garden BGM"
            title="Toggle Balamb Garden BGM"
            onClick={() =>
              setProfile((p) => ({
                ...p,
                settings: { ...p.settings, bgmEnabled: !p.settings.bgmEnabled },
              }))
            }
          >
            <Music size={16} />
          </button>
          <button
            type="button"
            className="tt-icon-btn"
            aria-label="Rules Guide"
            title="Triple Triad Rules Guide"
            onClick={() => setGuideOpen(true)}
          >
            <HelpCircle size={16} />
          </button>
          <button
            type="button"
            className="tt-icon-btn"
            aria-label="Settings"
            title="Settings"
            onClick={() => {
              setConfirmReset(false);
              setSettingsOpen(true);
            }}
          >
            <Settings size={16} />
          </button>
          {!activeMatch && !pendingChallenge && (
            <button
              type="button"
              className="tt-btn tt-btn--gold tt-btn--sm bg-dir-cta"
              onClick={() => {
                soundEngine.playConfirm();
                handleQuickDuel();
              }}
            >
              <span className="bg-ptr" aria-hidden="true">▶</span>
              Quick Duel
            </button>
          )}
        </div>
      </header>

      {toast && (
        <div className="tt-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Primary View Content */}
      <main className="tt-main-content">
        {activeMatch ? (
          <MatchScreen
            initialMatch={activeMatch.match}
            opponentName={activeMatch.challenge.opponentName}
            opponentTitle={activeMatch.challenge.opponentTitle}
            aiTier={activeMatch.challenge.aiTier}
            showHints={profile.settings.showHints}
            sandboxMode={activeMatch.challenge.sandbox}
            victoryLine={activeMatch.challenge.victoryLine}
            defeatLine={activeMatch.challenge.defeatLine}
            onFinishAndReturn={handleFinishMatch}
            onAbortMatch={() => setActiveMatch(null)}
          />
        ) : pendingChallenge ? (
          <HandSelectModal
            opponentName={pendingChallenge.opponentName}
            opponentTitle={pendingChallenge.opponentTitle}
            aiTier={pendingChallenge.aiTier}
            rules={pendingChallenge.rules}
            tradeRule={pendingChallenge.tradeRule}
            collection={
              pendingChallenge.sandbox ? getEffectiveCollection({ ...profile, settings: { ...profile.settings, sandboxMode: true } }) : effectiveCollection
            }
            initialHand={getActiveDeck(profile).cards}
            savedDecks={profile.decks}
            activeDeckId={profile.activeDeckId}
            sandboxMode={pendingChallenge.sandbox}
            onStartMatch={handleStartMatch}
            onCancel={() => setPendingChallenge(null)}
          />
        ) : (
          <>
            {tab !== 'atrium' && (
              <nav className="tt-nav-tabs" aria-label="Main sections">
                <button
                  type="button"
                  className={`tt-nav-tab ${tab === 'world' ? 'is-active' : ''}`}
                  onClick={() => {
                    soundEngine.playCursor();
                    setTab('world');
                  }}
                >
                  <Globe size={16} /> World Tour
                </button>
                <button
                  type="button"
                  className={`tt-nav-tab ${tab === 'decks' ? 'is-active' : ''}`}
                  onClick={() => {
                    soundEngine.playCursor();
                    setTab('decks');
                  }}
                >
                  <Layers size={16} /> Deck Builder
                </button>
                <button
                  type="button"
                  className={`tt-nav-tab ${tab === 'custom' ? 'is-active' : ''}`}
                  onClick={() => {
                    soundEngine.playCursor();
                    setTab('custom');
                  }}
                >
                  <Sliders size={16} /> Custom Match
                </button>
                <button
                  type="button"
                  className={`tt-nav-tab ${tab === 'binder' ? 'is-active' : ''}`}
                  onClick={() => {
                    soundEngine.playCursor();
                    setTab('binder');
                  }}
                >
                  <BookOpen size={16} /> Card Album ({uniqueOwnedCount}/110)
                </button>
              </nav>
            )}

            {tab === 'atrium' && (
              <AtriumHome
                profile={profile}
                onNavigate={(target) => setTab(target)}
                onQuickDuel={handleQuickDuel}
              />
            )}
            {tab === 'world' && (
              <WorldTourScreen
                profile={profile}
                initialRegionId={worldFocusRegion}
                onChallengeNpc={handleChallengeNpc}
              />
            )}
            {tab === 'decks' && (
              <DeckBuilder
                profile={profile}
                onUpdateDeck={(deckId, name, cards) =>
                  setProfile((p) => updateDeckInProfile(p, deckId, name, cards))
                }
                onSelectActiveDeck={(deckId) =>
                  setProfile((p) => setActiveDeckInProfile(p, deckId))
                }
              />
            )}
            {tab === 'custom' && (
              <CustomMatchScreen
                sandboxMode={profile.settings.sandboxMode}
                onToggleSandbox={(enabled) =>
                  setProfile((p) => ({
                    ...p,
                    settings: { ...p.settings, sandboxMode: enabled },
                  }))
                }
                onLaunchCustomMatch={handleLaunchCustomMatch}
              />
            )}
            {tab === 'binder' && (
              <CardBinder
                profile={profile}
                onJumpToRegion={(rid) => {
                  setWorldFocusRegion(rid);
                  setTab('world');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Settings Dialog */}
      <MobileSheet
        open={settingsOpen}
        title="Settings & Save Data"
        subtitle="Preferences and campaign options"
        onClose={() => setSettingsOpen(false)}
      >
        <div className="tt-settings-list">
          <label className="tt-setting-row">
            <div>
              <strong>Sound Effects</strong>
              <p className="tt-muted">Classic cursor blips, card flips, and fanfares</p>
            </div>
            <input
              type="checkbox"
              checked={profile.settings.soundEnabled}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  settings: { ...p.settings, soundEnabled: e.target.checked },
                }))
              }
            />
          </label>

          <label className="tt-setting-row">
            <div>
              <strong>Balamb Garden BGM</strong>
              <p className="tt-muted">Serene acoustic courtyard arpeggio &amp; flute theme</p>
            </div>
            <input
              type="checkbox"
              checked={profile.settings.bgmEnabled}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  settings: { ...p.settings, bgmEnabled: e.target.checked },
                }))
              }
            />
          </label>

          <label className="tt-setting-row">
            <div>
              <strong>Classic Rule Spread &amp; Abolish</strong>
              <p className="tt-muted">Carry rules between regions with Mixed Rules offers</p>
            </div>
            <input
              type="checkbox"
              checked={profile.settings.ruleSpreadEnabled}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  settings: { ...p.settings, ruleSpreadEnabled: e.target.checked },
                }))
              }
            />
          </label>

          <label className="tt-setting-row">
            <div>
              <strong>Capture Preview Hints</strong>
              <p className="tt-muted">Show +Flip / Same / Plus previews on empty cells</p>
            </div>
            <input
              type="checkbox"
              checked={profile.settings.showHints}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  settings: { ...p.settings, showHints: e.target.checked },
                }))
              }
            />
          </label>

          <label className="tt-setting-row">
            <div>
              <strong>Sandbox Mode (All 110 Cards)</strong>
              <p className="tt-muted">Unlock every card for deckbuilding without altering campaign save</p>
            </div>
            <input
              type="checkbox"
              checked={profile.settings.sandboxMode}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  settings: { ...p.settings, sandboxMode: e.target.checked },
                }))
              }
            />
          </label>

          <div className="tt-setting-reset">
            {!confirmReset ? (
              <button
                type="button"
                className="tt-btn tt-btn--danger"
                onClick={() => setConfirmReset(true)}
              >
                Reset Campaign Save
              </button>
            ) : (
              <div className="tt-btn-row">
                <button
                  type="button"
                  className="tt-btn tt-btn--danger"
                  onClick={() => {
                    const fresh = resetProfile();
                    setProfile(fresh);
                    setActiveMatch(null);
                    setPendingChallenge(null);
                    setConfirmReset(false);
                    setSettingsOpen(false);
                    setToast('Campaign save reset to Balamb starter deck.');
                  }}
                >
                  Confirm Wipe Save
                </button>
                <button
                  type="button"
                  className="tt-btn tt-btn--ghost"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </MobileSheet>

      {/* Complete Triple Triad Rules Guide */}
      <MobileSheet
        open={guideOpen}
        title="How to Play Triple Triad"
        subtitle="1:1 Final Fantasy VIII Rules Reference"
        onClose={() => setGuideOpen(false)}
        wide
      >
        <div className="tt-rules-ref">
          <div className="tt-rule-ref-item">
            <h4>Core Gameplay</h4>
            <p>
              Each player holds 5 cards (10 total points). Place cards onto the 3×3 grid. If your
              placed card’s touching rank is strictly greater than an adjacent opponent card’s
              touching rank (A = 10), that card flips to your color. Highest total after 9 turns
              wins!
            </p>
          </div>
          {Object.entries(SPECIAL_RULE_INFO).map(([key, info]) => (
            <div key={key} className="tt-rule-ref-item">
              <h4>Special — {info.label}</h4>
              <p>{info.detail}</p>
            </div>
          ))}
          {Object.entries(TRADE_RULE_INFO).map(([key, info]) => (
            <div key={key} className="tt-rule-ref-item">
              <h4>Trade — {info.label}</h4>
              <p>{info.shortDesc}</p>
            </div>
          ))}
        </div>
      </MobileSheet>
    </div>
  );
};
