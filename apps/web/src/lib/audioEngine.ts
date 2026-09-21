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
        this.masterGain.connect(this.ctx.destination);
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

  // --- Procedural Web Audio API Sound Synthesizers ---

  /**
   * Click: Crisp tactile micro-transient (15ms).
   */
  private synthClick(ctx: AudioContext, destination: AudioNode): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.015);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.018);
  }

  /**
   * Bet: Ceramic casino chip toss with dual-tone resonance (70ms).
   */
  private synthBet(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;

    // High ceramic fret ping
    const oscHigh = ctx.createOscillator();
    const gainHigh = ctx.createGain();
    oscHigh.type = 'sine';
    oscHigh.frequency.setValueAtTime(2200, now);
    oscHigh.frequency.exponentialRampToValueAtTime(1600, now + 0.04);
    gainHigh.gain.setValueAtTime(0.4, now);
    gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    oscHigh.connect(gainHigh);
    gainHigh.connect(destination);

    // Body felt resonance
    const oscBody = ctx.createOscillator();
    const gainBody = ctx.createGain();
    oscBody.type = 'triangle';
    oscBody.frequency.setValueAtTime(780, now);
    oscBody.frequency.exponentialRampToValueAtTime(320, now + 0.07);
    gainBody.gain.setValueAtTime(0.5, now);
    gainBody.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    oscBody.connect(gainBody);
    gainBody.connect(destination);

    oscHigh.start(now);
    oscHigh.stop(now + 0.045);
    oscBody.start(now);
    oscBody.stop(now + 0.075);
  }

  /**
   * Accepted: Ascending harmonic two-tone confirmation chime (200ms).
   */
  private synthAccepted(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const notes = [739.99, 987.77]; // F#5 -> B5 (Pleasant ascending 4th)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteStart = now + idx * 0.08;
      const noteDuration = 0.16;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.4, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration);
    });
  }

  /**
   * Countdown: Urgency tick/ping (800Hz / 1200Hz, 60ms).
   */
  private synthCountdown(ctx: AudioContext, destination: AudioNode, isUrgent = false): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isUrgent ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 1200 : 800, now);
    osc.frequency.exponentialRampToValueAtTime(isUrgent ? 900 : 650, now + 0.05);

    gain.gain.setValueAtTime(isUrgent ? 0.35 : 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  /**
   * Card: Realistic deck card flick/snap (noise swoosh + transient pop, 90ms).
   */
  private synthCard(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;

    // Filtered noise swoosh (card sliding across felt)
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.08);
    filter.Q.setValueAtTime(3, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(destination);

    // Subtle transient pop
    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(260, now);
    pop.frequency.exponentialRampToValueAtTime(80, now + 0.03);
    popGain.gain.setValueAtTime(0.35, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    pop.connect(popGain);
    popGain.connect(destination);

    noise.start(now);
    noise.stop(now + 0.085);
    pop.start(now);
    pop.stop(now + 0.035);
  }

  /**
   * Win: Uplifting major arpeggio fanfare (C5 - E5 - G5 - C6, 600ms).
   */
  private synthWin(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteStart = now + idx * 0.07;
      const noteDuration = 0.35;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(0.45, noteStart + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration);
    });
  }

  /**
   * Loss: Muted lowpass descending tone (E3 -> B2, 350ms).
   */
  private synthLoss(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, now);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(164.81, now); // E3
    osc.frequency.exponentialRampToValueAtTime(123.47, now + 0.35); // B2

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  /**
   * Jackpot: Grand victory fanfare with cascading coin fountain pings (1.5s).
   */
  private synthJackpot(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;

    // Victory Brass Fanfare
    const fanfareNotes = [
      { freq: 523.25, delay: 0.0, dur: 0.25 },  // C5
      { freq: 659.25, delay: 0.12, dur: 0.25 }, // E5
      { freq: 783.99, delay: 0.24, dur: 0.35 }, // G5
      { freq: 1046.5, delay: 0.40, dur: 0.80 }, // C6
      { freq: 1318.5, delay: 0.50, dur: 0.80 }  // E6
    ];

    fanfareNotes.forEach(({ freq, delay, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + delay;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + dur);
    });

    // Cascading Coin Fountain Dings
    for (let i = 0; i < 8; i++) {
      const coinStart = now + 0.3 + i * 0.11;
      const coinFreq = 2200 + (i % 4) * 450 + Math.random() * 200;
      const coinOsc = ctx.createOscillator();
      const coinGain = ctx.createGain();

      coinOsc.type = 'sine';
      coinOsc.frequency.setValueAtTime(coinFreq, coinStart);

      coinGain.gain.setValueAtTime(0.25, coinStart);
      coinGain.gain.exponentialRampToValueAtTime(0.001, coinStart + 0.14);

      coinOsc.connect(coinGain);
      coinGain.connect(destination);

      coinOsc.start(coinStart);
      coinOsc.stop(coinStart + 0.15);
    }
  }

  /**
   * Round Start: Atmospheric table chime / swell (A4 + E5, 450ms).
   */
  private synthRoundStart(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const freqs = [440, 659.25]; // A4 + E5

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  /**
   * Round End: Clean resolving cadence (D5 -> G4, 400ms).
   */
  private synthRoundEnd(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, delay: 0.0, dur: 0.18 }, // D5
      { freq: 392.00, delay: 0.12, dur: 0.35 }  // G4
    ];

    notes.forEach(({ freq, delay, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + delay;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(start);
      osc.stop(start + dur);
    });
  }

  /**
   * Card Slide: Smooth felt friction swoosh (70ms).
   */
  private synthCardSlide(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.07;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.07);
    filter.Q.setValueAtTime(2.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    noise.start(now);
    noise.stop(now + 0.075);
  }

  /**
   * Card Flip: Crisp mechanical paper turn snap (50ms).
   */
  private synthCardFlip(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.045);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.055);
  }

  /**
   * Roulette Wheel: Ambient spinning whir (300ms).
   */
  private synthRouletteWheel(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(130, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.31);
  }

  /**
   * Roulette Ball: Sharp ivory ball pocket clatter / tick (35ms).
   */
  private synthRouletteBall(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.03);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Dice Shake: Leather cup rattle with multiple micro-ticks (180ms).
   */
  private synthDiceShake(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const clickTime = now + i * 0.045 + Math.random() * 0.01;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(750 + i * 150, clickTime);
      osc.frequency.exponentialRampToValueAtTime(250, clickTime + 0.025);

      gain.gain.setValueAtTime(0.25, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.025);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(clickTime);
      osc.stop(clickTime + 0.03);
    }
  }

  /**
   * Dice Bounce: Wood / felt impact thump (60ms).
   */
  private synthDiceBounce(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  /**
   * Lotto Pop: Pneumatic ball pop into extraction tube (90ms).
   */
  private synthLottoPop(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.095);
  }

  /**
   * Chip Drop: Multi-chip ceramic clatter (120ms).
   */
  private synthChipDrop(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const freqs = [1800, 2400, 2100];
    freqs.forEach((freq, idx) => {
      const clickTime = now + idx * 0.035;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, clickTime);
      osc.frequency.exponentialRampToValueAtTime(800, clickTime + 0.03);

      gain.gain.setValueAtTime(0.3, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.035);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(clickTime);
      osc.stop(clickTime + 0.04);
    });
  }

  /**
   * Reel Stop: Mechanical slot reel snap lock (70ms).
   */
  private synthReelStop(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Reel Spin: Upward mechanical motor whir (200ms).
   */
  private synthReelSpin(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + 0.21);
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
          this.synthAccepted(ctx, this.masterGain);
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
          this.synthWin(ctx, this.masterGain);
          break;
        case 'loss':
          this.synthLoss(ctx, this.masterGain);
          break;
        case 'jackpot':
          this.synthJackpot(ctx, this.masterGain);
          break;
        case 'roundStart':
          this.synthRoundStart(ctx, this.masterGain);
          break;
        case 'roundEnd':
          this.synthRoundEnd(ctx, this.masterGain);
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

