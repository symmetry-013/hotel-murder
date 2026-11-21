class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.055);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playDoorMove(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.14);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1280, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(940, now + 0.12);
    gain2.gain.setValueAtTime(0.04, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.14);
  }

  public playReadyChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 554.37].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  public playSecretPing(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playNightBell(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [110, 164.81, 233.08].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 1.5);
      gain.gain.setValueAtTime(i === 0 ? 0.18 : 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.6);
    });
  }

  public playMorningChime(hasDeath: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = hasDeath ? [146.83, 174.61, 207.65] : [261.63, 329.63, 392.0];
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = hasDeath ? 'sawtooth' : 'triangle';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(hasDeath ? 620 : 1400, now);

      const start = now + i * 0.09;
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.95);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.0);
    });
  }

  public playVoteGavel(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.22);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** 1. KILLED: Razor blade unsheathe + visceral slash + fading heartbeat */
  public playKillSlashSequence(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.55);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const bladeNoise = ctx.createBufferSource();
    bladeNoise.buffer = noiseBuffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2200, now);
    bandpass.frequency.exponentialRampToValueAtTime(6400, now + 0.22);
    bandpass.Q.value = 5.5;

    const bladeGain = ctx.createGain();
    bladeGain.gain.setValueAtTime(0.001, now);
    bladeGain.gain.linearRampToValueAtTime(0.26, now + 0.08);
    bladeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    bladeNoise.connect(bandpass).connect(bladeGain).connect(ctx.destination);
    bladeNoise.start(now);
    bladeNoise.stop(now + 0.42);

    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3420, now + 0.04);
    ring.frequency.exponentialRampToValueAtTime(2680, now + 0.48);
    ringGain.gain.setValueAtTime(0.08, now + 0.04);
    ringGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.52);
    ring.connect(ringGain).connect(ctx.destination);
    ring.start(now + 0.04);
    ring.stop(now + 0.54);

    const impactOsc = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impactOsc.type = 'sawtooth';
    impactOsc.frequency.setValueAtTime(140, now + 0.16);
    impactOsc.frequency.exponentialRampToValueAtTime(32, now + 0.72);
    const impactFilter = ctx.createBiquadFilter();
    impactFilter.type = 'lowpass';
    impactFilter.frequency.setValueAtTime(420, now + 0.16);
    impactGain.gain.setValueAtTime(0.32, now + 0.16);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    impactOsc.connect(impactFilter).connect(impactGain).connect(ctx.destination);
    impactOsc.start(now + 0.16);
    impactOsc.stop(now + 0.88);

    [1.05, 1.32, 2.15, 2.44].forEach((offset, idx) => {
      const hb = ctx.createOscillator();
      const hbGain = ctx.createGain();
      hb.type = 'sine';
      const t = now + offset;
      hb.frequency.setValueAtTime(idx % 2 === 0 ? 64 : 52, t);
      hb.frequency.exponentialRampToValueAtTime(30, t + 0.16);
      hbGain.gain.setValueAtTime(idx < 2 ? 0.22 : 0.12, t);
      hbGain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      hb.connect(hbGain).connect(ctx.destination);
      hb.start(t);
      hb.stop(t + 0.2);
    });
  }

  /** 2. SAVED_BY_LOCKSMITH: Heavy steel door slam + bright brass deadbolt snap + golden shield chime */
  public playLocksmithSaveSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Heavy iron door slam
    const slam = ctx.createOscillator();
    const slamGain = ctx.createGain();
    slam.type = 'triangle';
    slam.frequency.setValueAtTime(125, now);
    slam.frequency.exponentialRampToValueAtTime(36, now + 0.28);
    slamGain.gain.setValueAtTime(0.34, now);
    slamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    slam.connect(slamGain).connect(ctx.destination);
    slam.start(now);
    slam.stop(now + 0.34);

    // Metallic deadbolt click-clack (0.2s, 0.32s)
    [0.2, 0.32].forEach((off, idx) => {
      const bolt = ctx.createOscillator();
      const boltGain = ctx.createGain();
      bolt.type = 'square';
      const f = idx === 0 ? 1150 : 1680;
      bolt.frequency.setValueAtTime(f, now + off);
      bolt.frequency.exponentialRampToValueAtTime(f * 0.5, now + off + 0.08);
      boltGain.gain.setValueAtTime(0.12, now + off);
      boltGain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.09);
      bolt.connect(boltGain).connect(ctx.destination);
      bolt.start(now + off);
      bolt.stop(now + off + 0.1);
    });

    // Golden relief chord (0.55s)
    [392.0, 493.88, 587.33].forEach((freq, i) => {
      const chime = ctx.createOscillator();
      const cGain = ctx.createGain();
      chime.type = 'sine';
      const t = now + 0.55 + i * 0.07;
      chime.frequency.setValueAtTime(freq, t);
      cGain.gain.setValueAtTime(0.09, t);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      chime.connect(cGain).connect(ctx.destination);
      chime.start(t);
      chime.stop(t + 1.15);
    });
  }

  /** 3. CLUE_DISCOVERED: Rapid tense heartbeat + eerie high shimmer */
  public playClueHeartbeatSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Rapid tense heartbeats
    const beats = [0.05, 0.25, 0.72, 0.92, 1.38, 1.58, 2.08, 2.28];
    beats.forEach((off, idx) => {
      const hb = ctx.createOscillator();
      const g = ctx.createGain();
      hb.type = 'sine';
      const t = now + off;
      hb.frequency.setValueAtTime(idx % 2 === 0 ? 78 : 62, t);
      hb.frequency.exponentialRampToValueAtTime(34, t + 0.14);
      g.gain.setValueAtTime(idx % 2 === 0 ? 0.26 : 0.17, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      hb.connect(g).connect(ctx.destination);
      hb.start(t);
      hb.stop(t + 0.18);
    });

    // Eerie mystery realization tone
    const shimmer = ctx.createOscillator();
    const sGain = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(659.25, now + 0.35);
    shimmer.frequency.exponentialRampToValueAtTime(622.25, now + 2.2);
    sGain.gain.setValueAtTime(0.001, now + 0.35);
    sGain.gain.linearRampToValueAtTime(0.06, now + 0.75);
    sGain.gain.exponentialRampToValueAtTime(0.0008, now + 2.4);
    shimmer.connect(sGain).connect(ctx.destination);
    shimmer.start(now + 0.35);
    shimmer.stop(now + 2.45);
  }

  /** 4. FLOOR_LOCKDOWN: Industrial shutter sliding + chain rattle + heavy steel slam */
  public playFloorLockdownSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Metallic grating shutter noise (0.0s - 0.55s)
    const bufferSize = Math.floor(ctx.sampleRate * 0.65);
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      ch[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i * 0.08));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.58);
    filter.Q.value = 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.64);

    // Heavy bulkhead boom at 0.52s
    const boom = ctx.createOscillator();
    const bGain = ctx.createGain();
    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(96, now + 0.52);
    boom.frequency.exponentialRampToValueAtTime(28, now + 1.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, now + 0.52);
    bGain.gain.setValueAtTime(0.32, now + 0.52);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    boom.connect(lp).connect(bGain).connect(ctx.destination);
    boom.start(now + 0.52);
    boom.stop(now + 1.22);

    // Iron chain clinks
    [0.65, 0.82, 0.96].forEach((off) => {
      const clink = ctx.createOscillator();
      const cGain = ctx.createGain();
      clink.type = 'square';
      clink.frequency.setValueAtTime(2100 + Math.random() * 600, now + off);
      cGain.gain.setValueAtTime(0.06, now + off);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.07);
      clink.connect(cGain).connect(ctx.destination);
      clink.start(now + off);
      clink.stop(now + off + 0.08);
    });
  }

  public playVictoryFanfare(winner: 'GOOD' | 'EVIL' | 'SPECIAL'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes =
      winner === 'GOOD'
        ? [261.63, 329.63, 392.0, 523.25]
        : winner === 'SPECIAL'
          ? [293.66, 369.99, 415.3, 587.33]
          : [196.0, 185.0, 146.83, 138.59];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = winner === 'EVIL' ? 'sawtooth' : 'triangle';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(winner === 'EVIL' ? 700 : 1850, now);
      const t = now + idx * 0.14;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.95);
    });
  }
}

export const soundEngine = new SoundEngine();
