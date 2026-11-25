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
    // Playful upbeat 8-bar Triple Triad inspired synth bass + clap groove
    const bassPattern = [146.83, 0, 146.83, 174.61, 196.0, 0, 220.0, 174.61];
    const leadPattern = [587.33, 0, 698.46, 0, 783.99, 698.46, 587.33, 523.25];

    this.bgmTimer = window.setInterval(() => {
      if (!this.bgmEnabled) return;
      const ctx = this.getContext();
      if (!ctx) return;

      const step = this.bgmStep % bassPattern.length;
      this.bgmStep += 1;

      const bass = bassPattern[step];
      if (bass > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bass, ctx.currentTime);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.19);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }

      const lead = leadPattern[step];
      if (lead > 0 && Math.floor(this.bgmStep / 8) % 2 === 1) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(lead, ctx.currentTime);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
      }
    }, 230);
  }

  private stopBgm(): void {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
