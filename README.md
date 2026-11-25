# Final Fantasy VIII — Triple Triad

A faithful standalone 1:1 browser remake of **Triple Triad** from *Final Fantasy VIII*, built with React 18, TypeScript, Vite, Vitest, and procedural Web Audio API sound synthesis.

**Live App:** [https://christoctavianus-0000.github.io/FF8-Triple-Triad/](https://christoctavianus-0000.github.io/FF8-Triple-Triad/)

## Features
- **110 Canonical Cards & Artwork (Levels 1–10):** Complete FF8 card catalog with printed ranks (`1`–`A`), elements, Card Mod trivia, and wiki card/element sprites.
- **1:1 PS1 Rules Engine:** Basic captures, `Open`, `Random`, `Elemental` (`±1`), `Same`, `Same Wall` (wall = `A`, inert without `Same`), `Plus`, automatic multi-hop `Combo` cascades, `Sudden Death` color-preserving rematches, and `One` / `Diff` / `Direct` / `All` Trade Rules.
- **8-Region World Tour:** Play iconic NPCs across Balamb, Galbadia, Dollet, FH, Trabia, Centra, Esthar, and Lunar with Mixed Rules Spread/Abolish, Balamb's *Student Skipping Class* rule resetter, the 7-stage Balamb CC Group chain, and the 5-step Queen of Cards forging quest.
- **Custom Skirmish & Sandbox Mode:** Pick any ruleset and 3-tier AI (`novice`, `standard`, `master` with strict `Open` information hiding), or enable Sandbox Mode to test all 110 cards without touching your campaign save.
- **Responsive UI & Audio:** Classic FF8 slate-blue windows, pointing-glove cursor, 3D card flips, drag-and-drop + 2-tap placement, capture preview hints, 5-card softlock protection, and procedural Web Audio SFX + toggleable synth groove.

## Local Development & Verification
```powershell
npm.cmd install
npm.cmd run dev
npx.cmd tsc --noEmit
npx.cmd vitest run
npm.cmd run build
```
