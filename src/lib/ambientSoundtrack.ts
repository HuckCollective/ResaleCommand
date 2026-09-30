/**
 * Ambient Soundtrack & Audio Synthesizer Engine
 * 
 * Provides pure in-browser, royalty-free synthesized ambient audio loops
 * using the Web Audio API without requiring any external mp3 files.
 * Supports live playback in the browser and piping into MediaRecorder for video exports.
 */

class AmbientSoundtrackEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];
  private currentPreset: string = 'none';
  private isPlaying: boolean = false;
  private customAudioElement: HTMLAudioElement | null = null;
  private customSourceNode: MediaElementAudioSourceNode | null = null;

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (!this.mediaStreamDest) {
      this.mediaStreamDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.mediaStreamDest);
    }
    return this.ctx;
  }

  public getAudioStream(): MediaStream | null {
    if (!this.mediaStreamDest) {
      this.initContext();
    }
    return this.mediaStreamDest ? this.mediaStreamDest.stream : null;
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(clamped, this.ctx.currentTime + 0.1);
    }
    if (this.customAudioElement) {
      this.customAudioElement.volume = clamped;
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.currentPreset = 'none';

    // Stop custom audio if running
    if (this.customAudioElement) {
      this.customAudioElement.pause();
      this.customAudioElement.currentTime = 0;
    }

    // Stop and disconnect all synthesized nodes
    for (const node of this.activeNodes) {
      if (typeof node === 'number') {
        window.clearInterval(node);
        window.clearTimeout(node);
      } else {
        try {
          if ('stop' in node && typeof (node as any).stop === 'function') {
            (node as any).stop();
          }
          node.disconnect();
        } catch {}
      }
    }
    this.activeNodes = [];
  }

  /**
   * Starts an ambient preset soundscape or custom audio.
   */
  public async play(presetId: 'cyberpunk' | 'antique' | 'lofi' | 'ethereal' | 'none', customFile?: File | Blob): Promise<void> {
    this.stop();
    if (presetId === 'none' && !customFile) return;

    const ctx = this.initContext();
    this.isPlaying = true;
    this.currentPreset = presetId;

    if (customFile) {
      await this.playCustomAudio(customFile);
      return;
    }

    switch (presetId) {
      case 'cyberpunk':
        this.synthCyberpunk(ctx);
        break;
      case 'antique':
        this.synthAntiqueScholar(ctx);
        break;
      case 'lofi':
        this.synthLofiChords(ctx);
        break;
      case 'ethereal':
        this.synthEthereal(ctx);
        break;
      default:
        break;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentPreset(): string {
    return this.currentPreset;
  }

  // =========================================================================
  // PRESET 1: VELVET SYNTHWAVE / CYBERPUNK CHILL (Warm Blade Runner Ambient)
  // =========================================================================
  private synthCyberpunk(ctx: AudioContext) {
    if (!this.masterGain) return;

    // Rich, warm cinematic chord: F minor 9th (F2, C3, G#3, Eb4, G4)
    const chordFrequencies = [87.31, 130.81, 207.65, 311.13, 392.00];

    chordFrequencies.forEach((freq, idx) => {
      // Dual detuned oscillators for lush analog chorus effect
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, ctx.currentTime);
      osc2.frequency.setValueAtTime(freq * 1.002, ctx.currentTime); // subtle warm detune

      // Warm lowpass filter to remove any harsh highs
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260 + idx * 35, ctx.currentTime);
      filter.Q.setValueAtTime(1.0, ctx.currentTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.045, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain!);

      osc1.start();
      osc2.start();
      this.activeNodes.push(osc1, osc2, filter, g);
    });
  }

  // =========================================================================
  // PRESET 2: ANTIQUE STUDY / VINTAGE PIANO (Gentle acoustic chord progression)
  // =========================================================================
  private synthAntiqueScholar(ctx: AudioContext) {
    if (!this.masterGain) return;

    // Beautiful cycle of nostalgic, warm jazz/classical chords
    const progressions = [
      [146.83, 220.00, 261.63, 329.63], // Dm9 (D3, A3, C4, E4)
      [116.54, 174.61, 220.00, 293.66], // Bbmaj7 (Bb2, F3, A3, D4)
      [130.81, 196.00, 233.08, 293.66], // C9sus (C3, G3, Bb3, D4)
      [174.61, 220.00, 261.63, 329.63]  // Fmaj7 (F3, A3, C4, E4)
    ];

    let chordStep = 0;

    const playChordStep = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const notes = progressions[chordStep % progressions.length];
      chordStep++;

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        // Soft, authentic piano acoustic release envelope
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.08); // soft gentle attack
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8); // long soothing decay

        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(480, t);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + 4.0);
      });
    };

    // Trigger initial chord immediately
    playChordStep();
    const chordTimer = window.setInterval(playChordStep, 4000);
    this.activeNodes.push(chordTimer);
  }

  // =========================================================================
  // PRESET 3: COZY LO-FI RHODES (Warm mellow electric piano chords)
  // =========================================================================
  private synthLofiChords(ctx: AudioContext) {
    if (!this.masterGain) return;

    // Warm Lo-Fi Progression: Fmaj7 -> Em7 -> Dm9 -> Cmaj7
    const lofiProgressions = [
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [164.81, 196.00, 246.94, 293.66], // Em7
      [146.83, 220.00, 261.63, 329.63], // Dm9
      [130.81, 196.00, 246.94, 329.63]  // Cmaj7
    ];

    let lofiStep = 0;

    const playLofiStep = () => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const chord = lofiProgressions[lofiStep % lofiProgressions.length];
      lofiStep++;

      chord.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        // Soft Rhodes bell envelope
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

        // Mellow tape saturation warmth filter
        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, t);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + 3.4);
      });
    };

    playLofiStep();
    const lofiTimer = window.setInterval(playLofiStep, 3500);
    this.activeNodes.push(lofiTimer);
  }

  // =========================================================================
  // PRESET 4: CELESTIAL / ETHEREAL (Shimmering pad)
  // =========================================================================
  private synthEthereal(ctx: AudioContext) {
    if (!this.masterGain) return;

    const notes = [174.61, 261.63, 349.23, 523.25, 698.46]; // F3, C4, F4, C5, F5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime((idx % 2 === 0 ? 1 : -1) * 0.45, ctx.currentTime);
      }

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.035, ctx.currentTime);

      if (panner) {
        osc.connect(panner);
        panner.connect(g);
      } else {
        osc.connect(g);
      }
      g.connect(this.masterGain!);
      osc.start();
      this.activeNodes.push(osc, g);
    });
  }

  // =========================================================================
  // CUSTOM AUDIO FILE PLAYBACK
  // =========================================================================
  private async playCustomAudio(file: File | Blob): Promise<void> {
    const ctx = this.initContext();
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';

    try {
      if (!this.customSourceNode && this.masterGain) {
        this.customSourceNode = ctx.createMediaElementSource(audio);
        this.customSourceNode.connect(this.masterGain);
      }
      this.customAudioElement = audio;
      await audio.play();
    } catch (e) {
      console.warn('[AmbientSoundtrackEngine] Custom audio play failed:', e);
    }
  }
}

export const ambientSoundtrack = new AmbientSoundtrackEngine();
