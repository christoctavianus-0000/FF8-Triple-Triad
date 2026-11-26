class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private bgmEnabled = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  private getContext(): AudioContext | null {
    if (!this.enabled && !this.bgmEnabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    if (enabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.08,
    delay = 0,
    freqEnd?: number,
  ): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + duration);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playCursor(): void {
    this.playTone(920, 0.045, 'triangle', 0.05, 0, 1120);
  }

  playConfirm(): void {
    this.playTone(660, 0.06, 'sine', 0.07, 0);
    this.playTone(990, 0.09, 'sine', 0.08, 0.05);
  }

  playCancel(): void {
    this.playTone(340, 0.08, 'triangle', 0.07, 0, 210);
  }

  playCardDeal(): void {
    this.playTone(420, 0.05, 'sine', 0.04, 0, 680);
  }

  playCardPlace(): void {
    this.playTone(220, 0.08, 'triangle', 0.11, 0, 140);
    this.playTone(540, 0.05, 'sine', 0.05, 0.02);
  }

  playCardFlip(step = 0): void {
    const base = 440 * Math.pow(1.12, Math.min(step, 8));
    this.playTone(base, 0.11, 'triangle', 0.09, 0, base * 1.35);
  }

  playSpecialRule(kind: 'same' | 'sameWall' | 'plus' | 'combo'): void {
    if (kind === 'combo') {
      this.playTone(523.25, 0.09, 'square', 0.05, 0);
      this.playTone(659.25, 0.09, 'square', 0.05, 0.06);
      this.playTone(783.99, 0.14, 'square', 0.06, 0.12);
      return;
    }
    this.playTone(587.33, 0.08, 'sawtooth', 0.045, 0);
    this.playTone(880, 0.14, 'triangle', 0.08, 0.07);
  }

  playSuddenDeath(): void {
    this.playTone(330, 0.14, 'sawtooth', 0.06, 0);
    this.playTone(311, 0.14, 'sawtooth', 0.06, 0.15);
    this.playTone(440, 0.25, 'sawtooth', 0.07, 0.3);
  }

  playVictory(): void {
    const notes = [523.25, 523.25, 523.25, 659.25, 587.33, 659.25, 783.99];
    const times = [0, 0.12, 0.24, 0.36, 0.54, 0.68, 0.84];
    notes.forEach((n, idx) => {
      this.playTone(n, idx === notes.length - 1 ? 0.35 : 0.1, 'triangle', 0.08, times[idx]);
    });
  }

  playDefeat(): void {
    this.playTone(392, 0.16, 'triangle', 0.07, 0);
    this.playTone(349.23, 0.16, 'triangle', 0.07, 0.18);
    this.playTone(293.66, 0.32, 'triangle', 0.07, 0.36);
  }

  playDraw(): void {
    this.playTone(440, 0.14, 'sine', 0.06, 0);
    this.playTone(440, 0.18, 'sine', 0.06, 0.18);
  }

  private startBgm(): void {
    if (typeof window === 'undefined' || this.bgmTimer !== null) return;

    // Serene Balamb Garden courtyard theme: warm Gmaj7 -> Em9 -> Cmaj7 -> D6 -> Bm7 -> Em7 -> Am9 -> D
    // 8 bars x 8 eighth-note steps = 64 steps at ~86 BPM (348ms/step)
    const arpeggioNotes = [
      // Bar 1: Gmaj7 (G3, D4, F#4, B4, D4, F#4, G4, D4)
      196.0, 293.66, 369.99, 493.88, 293.66, 369.99, 392.0, 293.66,
      // Bar 2: Em9 (E3, B3, F#4, G4, B3, F#4, G4, B3)
      164.81, 246.94, 369.99, 392.0, 246.94, 369.99, 392.0, 246.94,
      // Bar 3: Cmaj7 (C3, G3, B3, E4, G3, B3, E4, G3)
      130.81, 196.0, 246.94, 329.63, 196.0, 246.94, 329.63, 196.0,
      // Bar 4: D6 (D3, A3, B3, F#4, A3, D4, F#4, A3)
      146.83, 220.0, 246.94, 369.99, 220.0, 293.66, 369.99, 220.0,
      // Bar 5: Bm7 (B2, F#3, A3, D4, F#3, A3, D4, F#3)
      123.47, 185.0, 220.0, 293.66, 185.0, 220.0, 293.66, 185.0,
      // Bar 6: Em7 (E3, B3, D4, G4, B3, D4, G4, B3)
      164.81, 246.94, 293.66, 392.0, 246.94, 293.66, 392.0, 246.94,
      // Bar 7: Am9 (A2, E3, B3, C4, E3, B3, E4, B3)
      110.0, 164.81, 246.94, 261.63, 164.81, 246.94, 329.63, 246.94,
      // Bar 8: Dsus4 -> D (D3, A3, D4, G4, F#4, D4, A3, D4)
      146.83, 220.0, 293.66, 392.0, 369.99, 293.66, 220.0, 293.66,
    ];

    const bassRoots: Readonly<Record<number, number>> = {
      0: 98.0,   // G2
      8: 82.41,  // E2
      16: 65.41, // C2
      24: 73.42, // D2
      32: 123.47,// B2
      40: 82.41, // E2
      48: 110.0, // A2
      56: 73.42, // D2
    };

    // Airy flute melody floating softly across bars 1-8 (0 = rest)
    const fluteMelody: Readonly<Record<number, number>> = {
      2: 783.99,  // G5
      4: 739.99,  // F#5
      6: 587.33,  // D5
      10: 659.25, // E5
      14: 493.88, // B4
      18: 523.25, // C5
      20: 587.33, // D5
      22: 659.25, // E5
      26: 739.99, // F#5
      34: 587.33, // D5
      36: 659.25, // E5
      38: 739.99, // F#5
      42: 783.99, // G5
      46: 659.25, // E5
      50: 523.25, // C5
      52: 493.88, // B4
      54: 440.0,  // A4
      58: 587.33, // D5
      60: 739.99, // F#5
    };

    this.bgmTimer = window.setInterval(() => {
      if (!this.bgmEnabled) return;
      const ctx = this.getContext();
      if (!ctx) return;

      const step = this.bgmStep % arpeggioNotes.length;
      const now = ctx.currentTime;
      this.bgmStep += 1;

      // 1. Warm acoustic plucked arpeggio (lowpass-filtered triangle)
      const arpFreq = arpeggioNotes[step];
      if (arpFreq > 0) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(arpFreq, now);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1450, now);
        filter.frequency.exponentialRampToValueAtTime(620, now + 0.55);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(step % 8 === 0 ? 0.036 : 0.025, now + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.66);
      }

      // 2. Soft sub-bass pedal on bar downbeats & beat 3
      const rootFreq = bassRoots[step] ?? (step % 8 === 4 ? bassRoots[step - 4] : undefined);
      if (rootFreq) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(rootFreq, now);
        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.linearRampToValueAtTime(0.028, now + 0.04);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 1.2);
      }

      // 3. Gentle flute counter-melody
      const fluteFreq = fluteMelody[step];
      if (fluteFreq) {
        const fOsc = ctx.createOscillator();
        const fGain = ctx.createGain();
        fOsc.type = 'sine';
        fOsc.frequency.setValueAtTime(fluteFreq, now);
        fGain.gain.setValueAtTime(0.0001, now);
        fGain.gain.linearRampToValueAtTime(0.018, now + 0.08);
        fGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
        fOsc.connect(fGain);
        fGain.connect(ctx.destination);
        fOsc.start(now);
        fOsc.stop(now + 0.9);
      }
    }, 348);
  }

  private stopBgm(): void {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.bgmStep = 0;
  }
}

export const soundEngine = new SoundEngine();
