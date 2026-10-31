/**
 * AudioVisemeSynthesizer.ts
 * Real-Time Formant Lip-Sync and Offline Viseme Baking for Kosh.
 * 
 * Uses Web Audio API frequency analysis to split vocal spectrum:
 * - Low bins (100Hz - 600Hz): vowel fundamental & chest resonance -> jawDrop
 * - Mid bins (1kHz - 3kHz): vowel formants & consonant friction -> mouthWide
 * 
 * Includes pre-baking for deterministic 60fps scrubbing and procedural speech synthesis.
 */

export interface VisemeFrame {
  frame: number;
  jawDrop: number; // 0.0 to 1.0
  mouthWide: number; // 0.0 to 1.0
  energy: number; // overall rms
}

export class AudioVisemeSynthesizer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;

  public bakedFrames: VisemeFrame[] = [];
  public isLoaded: boolean = false;
  public duration: number = 0;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  private initAudioContext() {
    if (!this.audioContext && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.65;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }
    }
  }

  /**
   * Loads an audio file from Blob / File / URL and bakes the viseme curve.
   */
  public async loadAudio(
    audioSource: string | File | Blob,
    fps: number = 30,
    totalFrames: number = 180
  ): Promise<VisemeFrame[]> {
    this.initAudioContext();
    if (!this.audioContext) return [];

    let arrayBuffer: ArrayBuffer;
    let url: string;

    if (typeof audioSource === "string") {
      url = audioSource;
      const res = await fetch(audioSource);
      arrayBuffer = await res.arrayBuffer();
    } else {
      url = URL.createObjectURL(audioSource);
      arrayBuffer = await audioSource.arrayBuffer();
    }

    // Decode Audio Data
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.duration = audioBuffer.duration;

    // Setup HTMLAudioElement for playback sync
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = "";
    }
    this.audioElement = new Audio(url);
    this.audioElement.crossOrigin = "anonymous";

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
    }

    if (this.audioContext && this.analyser) {
      try {
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } catch (e) {
        // Source node already connected
      }
    }

    // Bake Visemes for all frames offline
    this.bakedFrames = this.bakeVisemesFromBuffer(audioBuffer, fps, totalFrames);
    this.isLoaded = true;

    return this.bakedFrames;
  }

  /**
   * Offline mathematical formant extraction for exact frame-accurate scrubbing.
   */
  private bakeVisemesFromBuffer(
    buffer: AudioBuffer,
    fps: number,
    totalFrames: number
  ): VisemeFrame[] {
    const rawData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const samplesPerFrame = Math.floor(sampleRate / fps);

    const frames: VisemeFrame[] = [];

    for (let f = 0; f < totalFrames; f++) {
      const startSample = f * samplesPerFrame;
      const endSample = Math.min(rawData.length, startSample + samplesPerFrame);

      if (startSample >= rawData.length) {
        frames.push({ frame: f, jawDrop: 0, mouthWide: 0, energy: 0 });
        continue;
      }

      // 1. RMS Energy
      let sumSq = 0;
      for (let s = startSample; s < endSample; s++) {
        sumSq += rawData[s] * rawData[s];
      }
      const rms = Math.sqrt(sumSq / (endSample - startSample || 1));

      // 2. Simple Zero-Crossing & Low/Mid Band approximation
      // Low band: 100-600Hz, Mid band: 1kHz-3kHz
      let lowEnergy = 0;
      let midEnergy = 0;
      let prevVal = 0;
      let zeroCrossings = 0;

      for (let s = startSample + 1; s < endSample; s++) {
        const val = rawData[s];
        const diff = val - prevVal;

        if ((val > 0 && prevVal <= 0) || (val < 0 && prevVal >= 0)) {
          zeroCrossings++;
        }

        // Low frequency changes are smooth
        lowEnergy += Math.abs(val) * Math.max(0, 1 - Math.abs(diff) * 10);
        // Mid/high frequency changes have steep slopes
        midEnergy += Math.abs(diff);

        prevVal = val;
      }

      const sampleCount = endSample - startSample || 1;
      const normLow = Math.min(1, (lowEnergy / sampleCount) * 8.0);
      const normMid = Math.min(1, (midEnergy / sampleCount) * 15.0);

      // Low formant -> Jaw drop (mouth opening)
      const jawDrop = Math.min(1, Math.max(0, normLow * 1.6 * (rms > 0.015 ? 1 : 0)));
      // Mid formant -> Mouth wide (vowel spread)
      const mouthWide = Math.min(1, Math.max(0, normMid * 1.4 * (rms > 0.015 ? 1 : 0)));

      frames.push({
        frame: f,
        jawDrop: parseFloat(jawDrop.toFixed(3)),
        mouthWide: parseFloat(mouthWide.toFixed(3)),
        energy: parseFloat(rms.toFixed(3)),
      });
    }

    return frames;
  }

  /**
   * Real-time spectrum analysis from active audio element playback.
   */
  public sampleRealtimeVisemes(): { jawDrop: number; mouthWide: number; energy: number } {
    if (!this.analyser || !this.dataArray) {
      return { jawDrop: 0, mouthWide: 0, energy: 0 };
    }

    this.analyser.getByteFrequencyData(this.dataArray as any);
    const binCount = this.analyser.frequencyBinCount; // 256 bins

    // Bin width: ~44100 / 512 = ~86Hz per bin
    // Low: bins 1 to 7 (~86Hz to ~600Hz)
    let lowSum = 0;
    for (let i = 1; i <= 7 && i < binCount; i++) {
      lowSum += this.dataArray[i];
    }
    const lowAvg = lowSum / 7 / 255;

    // Mid: bins 11 to 35 (~1000Hz to ~3000Hz)
    let midSum = 0;
    for (let i = 11; i <= 35 && i < binCount; i++) {
      midSum += this.dataArray[i];
    }
    const midAvg = midSum / 25 / 255;

    return {
      jawDrop: Math.min(1, lowAvg * 1.8),
      mouthWide: Math.min(1, midAvg * 1.5),
      energy: (lowAvg + midAvg) * 0.5,
    };
  }

  /**
   * Evaluates baked viseme frame for instantaneous timeline scrubbing.
   */
  public getVisemeAtFrame(frame: number): { jawDrop: number; mouthWide: number } {
    if (!this.bakedFrames || this.bakedFrames.length === 0) {
      return { jawDrop: 0, mouthWide: 0 };
    }
    const idx = Math.max(0, Math.min(this.bakedFrames.length - 1, Math.round(frame)));
    return {
      jawDrop: this.bakedFrames[idx].jawDrop,
      mouthWide: this.bakedFrames[idx].mouthWide,
    };
  }

  /**
   * Synchronizes audio playback with timeline playback.
   */
  public play(fromFrame: number, fps: number = 30) {
    if (!this.audioElement || !this.isLoaded) return;
    this.initAudioContext();
    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }
    this.audioElement.currentTime = fromFrame / fps;
    this.audioElement.play().catch(() => {});
  }

  public pause() {
    if (!this.audioElement) return;
    this.audioElement.pause();
  }

  public seek(frame: number, fps: number = 30) {
    if (!this.audioElement || !this.isLoaded) return;
    this.audioElement.currentTime = frame / fps;
  }

  /**
   * Generates a procedural narration audio track with rhythmic speech cadence.
   */
  public generateDemoSpeech(fps: number = 30, totalFrames: number = 180): VisemeFrame[] {
    const frames: VisemeFrame[] = [];

    // Synthesize realistic speech phrasing:
    // 3 syllables per second with pauses
    for (let f = 0; f < totalFrames; f++) {
      const timeSec = f / fps;

      // Phrasing envelope: 2.2s speech phrase, 0.6s breath pause
      const phrasePhase = timeSec % 2.8;
      const isSpeaking = phrasePhase < 2.2;

      let jd = 0;
      let mw = 0;
      let energy = 0;

      if (isSpeaking) {
        // Syllable oscillation (~4Hz)
        const syllable = Math.sin(timeSec * Math.PI * 8.0);
        const vowel = Math.cos(timeSec * Math.PI * 4.5);

        jd = Math.max(0, syllable * 0.75 + vowel * 0.25);
        mw = Math.max(0, Math.sin(timeSec * Math.PI * 6.0) * 0.6);
        energy = (jd + mw) * 0.5;
      }

      frames.push({
        frame: f,
        jawDrop: parseFloat(jd.toFixed(3)),
        mouthWide: parseFloat(mw.toFixed(3)),
        energy: parseFloat(energy.toFixed(3)),
      });
    }

    this.bakedFrames = frames;
    this.isLoaded = true;
    return frames;
  }
}
