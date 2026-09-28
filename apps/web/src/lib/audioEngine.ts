/**
 * WinDaq Central Sound & Haptic Engine
 * 
 * Features:
 * - 100% Procedural Web Audio API synthesis (0 network latency, 0 external assets, 0 404s)
 * - 10 Core Sound Events: click, bet, accepted, countdown, card, win, loss, jackpot, roundStart, roundEnd
 * - Mobile Haptic Feedback with tailored vibration rhythms via Navigator.vibrate
 * - Automatic Browser Autoplay unlock & AudioContext lifecycle handling
 * - Accessibility & Reduced Motion adaptation (gentle haptics and softened transients)
 * - Independent Volume, Mute, and Haptic state synchronization
 */

export type SoundEvent = 
  | 'click'
  | 'bet'
  | 'accepted'
  | 'countdown'
  | 'card'
  | 'cardSlide'
  | 'cardFlip'
  | 'rouletteWheel'
  | 'rouletteBall'
  | 'diceShake'
  | 'diceBounce'
  | 'lottoPop'
  | 'chipDrop'
  | 'reelSpin'
  | 'reelStop'
  | 'win'
  | 'loss'
  | 'jackpot'
  | 'roundStart'
  | 'roundEnd';

export interface SoundEngineOptions {
  volume?: number;         // 0.0 to 1.0
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  reducedMotion?: boolean;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.7;
  private soundEnabled: boolean = true;
  private hapticsEnabled: boolean = true;
  private reducedMotion: boolean = false;
  private isUnlocked: boolean = false;
  private listenersAttached: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initReducedMotionListener();
      this.setupAutoplayUnlock();
    }
  }

  /**
   * Initializes or gets the AudioContext lazily.
   */
  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.getEffectiveVolume(), this.ctx.currentTime);
        // Gentle limiter so overlapping sounds never clip on phone speakers.
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -14;
        limiter.knee.value = 12;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.2;
        const makeup = this.ctx.createGain();
        makeup.gain.value = 1.8;
        this.masterGain.connect(makeup);
        makeup.connect(limiter);
        limiter.connect(this.ctx.destination);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Effective volume calculation factoring in mute and reduced motion.
   */
  private getEffectiveVolume(): number {
    if (!this.soundEnabled) return 0;
    const base = Math.max(0, Math.min(1, this.volume));
    return this.reducedMotion ? base * 0.7 : base;
  }

  /**
   * Listen for user gestures to unlock AudioContext compliant with autoplay restrictions.
   */
  private setupAutoplayUnlock(): void {
    if (this.listenersAttached || typeof window === 'undefined') return;
    this.listenersAttached = true;

    const unlock = () => {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.isUnlocked = true;
        }).catch(() => {});
      } else if (ctx && ctx.state === 'running') {
        this.isUnlocked = true;
      }

      // Remove listeners once unlocked
      ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
        window.removeEventListener(evt, unlock);
      });
    };

    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });
  }

  /**
   * Listen for user OS reduced-motion preferences.
   */
  private initReducedMotionListener(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mq.matches;
      mq.addEventListener?.('change', (e) => {
        this.reducedMotion = e.matches;
        this.updateMasterVolume();
      });
    } catch {
      // Fallback
    }
  }

  /**
   * Update master gain node volume.
   */
  private updateMasterVolume(): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.getEffectiveVolume(), this.ctx.currentTime);
    }
  }

  // --- Configuration Mutators ---

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.updateMasterVolume();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.updateMasterVolume();
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setHapticsEnabled(enabled: boolean): void {
    this.hapticsEnabled = enabled;
  }

  public isHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.updateMasterVolume();
  }

  public isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  // --- Haptic Feedback Engine ---

  /**
   * Triggers haptic pulse on supported mobile/touch devices.
   */
  public vibrate(pattern: number | number[]): void {
    if (!this.hapticsEnabled || typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (!('vibrate' in navigator)) return;

    try {
      if (this.reducedMotion) {
        // In reduced motion, soften vibrations to gentle micro-taps
        const softened = Array.isArray(pattern) ? [Math.min(pattern[0] || 10, 15)] : Math.min(pattern, 15);
        navigator.vibrate(softened);
      } else {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore vibration errors
    }
  }

  // --- Procedural sound design ---
  //
  // Physical sounds (chips, cards, dice, balls) are built from short band-passed noise bursts plus
  // a few inharmonic partials, which reads as a real object far better than a bare oscillator.
  // Musical cues use soft bell tones. Everything passes through a small room reverb and a
  // compressor so nothing clicks or clips. (Randomness here is cosmetic audio variation only.)

  private noiseBuffer: AudioBuffer | null = null;
  private reverbSend: GainNode | null = null;

  /** One second of cached white noise; bursts start at a random offset for natural variation. */
  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /** Lazily builds a short, soft room reverb (generated impulse) fed by a send bus. */
  private getReverbSend(ctx: AudioContext, destination: AudioNode): AudioNode {
    if (this.reverbSend) return this.reverbSend;
    const seconds = 1.1;
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200;
    const send = ctx.createGain();
    send.gain.value = 0.22;
    send.connect(convolver);
    convolver.connect(tone);
    tone.connect(destination);
    this.reverbSend = send;
    return send;
  }

  /** Band-limited noise burst with a fast attack and exponential decay. */
  private noise(ctx: AudioContext, out: AudioNode, o: {
    at?: number; dur: number; type?: BiquadFilterType; freq: number; freqEnd?: number; q?: number; gain: number; attack?: number;
  }): void {
    const start = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = o.type || 'bandpass';
    filter.frequency.setValueAtTime(o.freq, start);
    if (o.freqEnd) filter.frequency.exponentialRampToValueAtTime(o.freqEnd, start + o.dur);
    filter.Q.value = o.q ?? 1;
    const gain = ctx.createGain();
    const attack = o.attack ?? 0.002;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(o.gain, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(start, Math.random() * 0.8, o.dur + 0.05);
  }

  /** Single decaying partial (sine by default), optionally gliding in pitch. */
  private tone(ctx: AudioContext, out: AudioNode, o: {
    at?: number; freq: number; freqEnd?: number; dur: number; gain: number; attack?: number; type?: OscillatorType;
  }): void {
    const start = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, start);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, start + o.dur);
    const gain = ctx.createGain();
    const attack = o.attack ?? 0.003;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(o.gain, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + o.dur + 0.02);
  }

  /** Soft bell / marimba note: a fundamental plus quickly fading inharmonic partials. */
  private bell(ctx: AudioContext, out: AudioNode, freq: number, at: number, dur: number, gain: number): void {
    this.tone(ctx, out, { at, freq, dur, gain, attack: 0.004 });
    this.tone(ctx, out, { at, freq: freq * 2.76, dur: dur * 0.35, gain: gain * 0.28 });
    this.tone(ctx, out, { at, freq: freq * 5.4, dur: dur * 0.15, gain: gain * 0.12 });
  }

  /** Clay chip hitting another chip: a bright click with a short ceramic ring. */
  private chipHit(ctx: AudioContext, out: AudioNode, at: number, level: number): void {
    const pitch = 0.92 + Math.random() * 0.16;
    this.noise(ctx, out, { at, dur: 0.03, freq: 3600 * pitch, q: 6, gain: 0.55 * level });
    this.tone(ctx, out, { at, freq: 3150 * pitch, dur: 0.05, gain: 0.12 * level });
    this.tone(ctx, out, { at, freq: 4870 * pitch, dur: 0.035, gain: 0.07 * level });
  }

  private synthClick(ctx: AudioContext, out: AudioNode): void {
    this.noise(ctx, out, { dur: 0.012, type: 'highpass', freq: 2800, gain: 0.25 });
    this.tone(ctx, out, { freq: 1900, freqEnd: 1300, dur: 0.02, gain: 0.05 });
  }

  private synthBet(ctx: AudioContext, out: AudioNode): void {
    this.chipHit(ctx, out, 0, 1);
    this.chipHit(ctx, out, 0.045 + Math.random() * 0.015, 0.45);
  }

  private synthChipDrop(ctx: AudioContext, out: AudioNode): void {
    // A small stack settling: three to four hits, each quieter and closer together.
    const hits = 3 + (Math.random() < 0.5 ? 1 : 0);
    let t = 0;
    for (let i = 0; i < hits; i++) {
      this.chipHit(ctx, out, t, 1 - i * 0.22);
      t += 0.05 - i * 0.008 + Math.random() * 0.01;
    }
  }

  private synthAccepted(ctx: AudioContext, out: AudioNode, wet: AudioNode): void {
    this.bell(ctx, out, 880, 0, 0.35, 0.12);
    this.bell(ctx, out, 1318.5, 0.07, 0.45, 0.1);
    this.bell(ctx, wet, 1318.5, 0.07, 0.45, 0.06);
  }

  private synthCountdown(ctx: AudioContext, out: AudioNode, isUrgent = false): void {
    // Wooden clock tick; the last seconds are a touch higher and firmer.
    this.noise(ctx, out, { dur: 0.018, freq: isUrgent ? 2600 : 1900, q: 5, gain: isUrgent ? 0.5 : 0.32 });
    this.tone(ctx, out, { freq: isUrgent ? 1250 : 950, dur: 0.04, gain: isUrgent ? 0.1 : 0.06 });
  }

  private synthCard(ctx: AudioContext, out: AudioNode): void {
    // Flick off the shoe, then the card landing on felt.
    this.noise(ctx, out, { dur: 0.06, freq: 5200, freqEnd: 1800, q: 1.4, gain: 0.32, attack: 0.004 });
    this.noise(ctx, out, { at: 0.05, dur: 0.035, type: 'lowpass', freq: 900, gain: 0.3 });
    this.tone(ctx, out, { at: 0.05, freq: 150, freqEnd: 80, dur: 0.04, gain: 0.12 });
  }

  private synthCardSlide(ctx: AudioContext, out: AudioNode): void {
    // Card sliding across cloth: soft, slightly longer friction.
    this.noise(ctx, out, { dur: 0.13, freq: 2600, freqEnd: 1300, q: 0.8, gain: 0.16, attack: 0.03 });
  }

  private synthCardFlip(ctx: AudioContext, out: AudioNode): void {
    // Paper snap: two tight bursts as the card bends and turns over.
    this.noise(ctx, out, { dur: 0.018, freq: 4300, q: 2, gain: 0.35 });
    this.noise(ctx, out, { at: 0.022, dur: 0.03, freq: 2400, q: 1.5, gain: 0.28 });
    this.tone(ctx, out, { at: 0.022, freq: 210, freqEnd: 110, dur: 0.03, gain: 0.07 });
  }

  private synthRouletteWheel(ctx: AudioContext, out: AudioNode): void {
    // Wheel rumble with the ball rolling on the rim above it.
    this.noise(ctx, out, { dur: 0.42, type: 'lowpass', freq: 240, gain: 0.35, attack: 0.08 });
    this.noise(ctx, out, { dur: 0.4, freq: 5200, q: 3, gain: 0.05, attack: 0.1 });
  }

  private synthRouletteBall(ctx: AudioContext, out: AudioNode): void {
    // Ivory ball striking a metal fret.
    this.noise(ctx, out, { dur: 0.014, freq: 4800, q: 8, gain: 0.45 });
    this.tone(ctx, out, { freq: 5300 + Math.random() * 400, dur: 0.03, gain: 0.05 });
  }

  private synthDiceShake(ctx: AudioContext, out: AudioNode): void {
    // Dice knocking inside a cup: irregular, slightly muffled clicks.
    for (let i = 0; i < 7; i++) {
      this.noise(ctx, out, { at: i * 0.03 + Math.random() * 0.02, dur: 0.02, freq: 2200 + Math.random() * 1800, q: 5, gain: 0.22 + Math.random() * 0.12 });
    }
    this.noise(ctx, out, { dur: 0.24, type: 'lowpass', freq: 500, gain: 0.08, attack: 0.03 });
  }

  private synthDiceBounce(ctx: AudioContext, out: AudioNode): void {
    // Die landing on the tray: a hard click with a short woody body.
    this.noise(ctx, out, { dur: 0.02, freq: 2600, q: 4, gain: 0.4 });
    this.tone(ctx, out, { freq: 190, freqEnd: 75, dur: 0.06, gain: 0.2 });
  }

  private synthLottoPop(ctx: AudioContext, out: AudioNode): void {
    // Ball puffed up the tube: a soft air pop.
    this.noise(ctx, out, { dur: 0.08, type: 'lowpass', freq: 1400, freqEnd: 400, gain: 0.22 });
    this.tone(ctx, out, { freq: 320, freqEnd: 760, dur: 0.07, gain: 0.12, attack: 0.01 });
  }

  private synthReelSpin(ctx: AudioContext, out: AudioNode): void {
    this.noise(ctx, out, { dur: 0.24, freq: 700, freqEnd: 1500, q: 2, gain: 0.4, attack: 0.05 });
  }

  private synthReelStop(ctx: AudioContext, out: AudioNode): void {
    // Reel catching its detent.
    this.noise(ctx, out, { dur: 0.018, freq: 2200, q: 3, gain: 0.35 });
    this.tone(ctx, out, { freq: 150, freqEnd: 60, dur: 0.07, gain: 0.2 });
  }

  private synthWin(ctx: AudioContext, out: AudioNode, wet: AudioNode): void {
    // Warm rising bell arpeggio, with a little air on the top note.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.bell(ctx, out, f, i * 0.085, 0.9, 0.13);
      this.bell(ctx, wet, f, i * 0.085, 0.9, 0.08);
    });
    this.noise(ctx, out, { at: 0.26, dur: 0.5, type: 'highpass', freq: 7000, gain: 0.03, attack: 0.05 });
  }

  private synthLoss(ctx: AudioContext, out: AudioNode, wet: AudioNode): void {
    // Calm, soft two-note fall: acknowledges the result without a harsh buzz.
    this.tone(ctx, out, { freq: 392, dur: 0.35, gain: 0.08, attack: 0.02 });
    this.tone(ctx, out, { at: 0.16, freq: 329.63, dur: 0.55, gain: 0.08, attack: 0.02 });
    this.tone(ctx, wet, { at: 0.16, freq: 329.63, dur: 0.55, gain: 0.05, attack: 0.02 });
  }

  private synthJackpot(ctx: AudioContext, out: AudioNode, wet: AudioNode): void {
    // Soft chord swell underneath, bell arpeggio on top, then scattered coin chimes.
    [261.63, 329.63, 392].forEach((f) => this.tone(ctx, wet, { freq: f, dur: 1.6, gain: 0.05, attack: 0.25, type: 'triangle' }));
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.bell(ctx, out, f, i * 0.09, 1.1, 0.12);
      this.bell(ctx, wet, f, i * 0.09, 1.1, 0.07);
    });
    for (let i = 0; i < 9; i++) {
      this.bell(ctx, wet, 2000 + Math.random() * 1600, 0.45 + i * 0.1 + Math.random() * 0.04, 0.25, 0.05);
    }
  }

  private synthRoundStart(ctx: AudioContext, out: AudioNode, wet: AudioNode): void {
    this.bell(ctx, out, 880, 0, 0.6, 0.09);
    this.bell(ctx, wet, 880, 0, 0.6, 0.07);
  }

  private synthRoundEnd(ctx: AudioContext, out: AudioNode, wet: AudioNode): void {
    this.bell(ctx, out, 1046.5, 0, 0.35, 0.07);
    this.bell(ctx, out, 783.99, 0.1, 0.5, 0.07);
    this.bell(ctx, wet, 783.99, 0.1, 0.5, 0.05);
  }

  // --- Main Play Dispatcher ---

  /**
   * Plays a sound event and fires the corresponding haptic vibration pattern.
   */
  public play(event: SoundEvent, extraParams?: { urgent?: boolean }): void {
    // 1. Fire Haptics
    switch (event) {
      case 'click':
        this.vibrate(10);
        break;
      case 'bet':
      case 'chipDrop':
        this.vibrate(25);
        break;
      case 'accepted':
        this.vibrate([15, 30, 20]);
        break;
      case 'countdown':
        this.vibrate(extraParams?.urgent ? 45 : 25);
        break;
      case 'card':
      case 'cardSlide':
        this.vibrate(15);
        break;
      case 'cardFlip':
        this.vibrate([10, 20]);
        break;
      case 'rouletteWheel':
        this.vibrate(12);
        break;
      case 'rouletteBall':
        this.vibrate(18);
        break;
      case 'diceShake':
        this.vibrate([15, 20, 15]);
        break;
      case 'diceBounce':
        this.vibrate(30);
        break;
      case 'lottoPop':
        this.vibrate(22);
        break;
      case 'reelSpin':
        this.vibrate(20);
        break;
      case 'reelStop':
        this.vibrate(28);
        break;
      case 'win':
        this.vibrate([40, 40, 60, 40, 100]);
        break;
      case 'loss':
        this.vibrate(70);
        break;
      case 'jackpot':
        this.vibrate([50, 50, 50, 50, 100, 50, 150]);
        break;
      case 'roundStart':
        this.vibrate([30, 20, 30]);
        break;
      case 'roundEnd':
        this.vibrate(40);
        break;
    }

    // 2. Synthesize Audio
    if (!this.soundEnabled || this.volume <= 0) return;

    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const wet = this.getReverbSend(ctx, this.masterGain);
      switch (event) {
        case 'click':
          this.synthClick(ctx, this.masterGain);
          break;
        case 'bet':
          this.synthBet(ctx, this.masterGain);
          break;
        case 'chipDrop':
          this.synthChipDrop(ctx, this.masterGain);
          break;
        case 'accepted':
          this.synthAccepted(ctx, this.masterGain, wet);
          break;
        case 'countdown':
          this.synthCountdown(ctx, this.masterGain, extraParams?.urgent);
          break;
        case 'card':
          this.synthCard(ctx, this.masterGain);
          break;
        case 'cardSlide':
          this.synthCardSlide(ctx, this.masterGain);
          break;
        case 'cardFlip':
          this.synthCardFlip(ctx, this.masterGain);
          break;
        case 'rouletteWheel':
          this.synthRouletteWheel(ctx, this.masterGain);
          break;
        case 'rouletteBall':
          this.synthRouletteBall(ctx, this.masterGain);
          break;
        case 'diceShake':
          this.synthDiceShake(ctx, this.masterGain);
          break;
        case 'diceBounce':
          this.synthDiceBounce(ctx, this.masterGain);
          break;
        case 'lottoPop':
          this.synthLottoPop(ctx, this.masterGain);
          break;
        case 'reelSpin':
          this.synthReelSpin(ctx, this.masterGain);
          break;
        case 'reelStop':
          this.synthReelStop(ctx, this.masterGain);
          break;
        case 'win':
          this.synthWin(ctx, this.masterGain, wet);
          break;
        case 'loss':
          this.synthLoss(ctx, this.masterGain, wet);
          break;
        case 'jackpot':
          this.synthJackpot(ctx, this.masterGain, wet);
          break;
        case 'roundStart':
          this.synthRoundStart(ctx, this.masterGain, wet);
          break;
        case 'roundEnd':
          this.synthRoundEnd(ctx, this.masterGain, wet);
          break;
      }
    } catch {
      // Audio errors safely caught without interrupting game flow
    }
  }
}

// Global Singleton Instance
export const audioEngine = new AudioEngine();

// Mobile Haptics Engine
export const haptic = {
  click: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(10); } catch {}
    }
  },
  bet: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([15, 20, 15]); } catch {}
    }
  },
  deal: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(20); } catch {}
    }
  },
  card: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(25); } catch {}
    }
  },
  win: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([40, 50, 40, 50, 80]); } catch {}
    }
  },
  error: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([60, 40, 60]); } catch {}
    }
  }
};

if (typeof window !== 'undefined') {
  (window as any).audioEngine = audioEngine;
  (window as any).haptic = haptic;
}

