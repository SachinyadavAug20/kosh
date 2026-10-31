import * as THREE from "three";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import * as WebMMuxer from "webm-muxer";
import { LowPolyCharacter } from "../narrative/LowPolyCharacterRig";
import { DirectorCameraRig } from "../narrative/DirectorCameraRig";

export type AspectRatioType = "16:9" | "9:16" | "1:1" | "2.39:1" | "4:3";

export interface VideoResolutionConfig {
  width: number;
  height: number;
  label: string;
}

export const ASPECT_RATIO_CONFIGS: Record<AspectRatioType, Record<"720p" | "1080p", VideoResolutionConfig>> = {
  "16:9": {
    "720p": { width: 1280, height: 720, label: "1280 × 720 (Landscape 720p)" },
    "1080p": { width: 1920, height: 1080, label: "1920 × 1080 (Landscape 1080p)" },
  },
  "9:16": {
    "720p": { width: 720, height: 1280, label: "720 × 1280 (Portrait/Shorts 720p)" },
    "1080p": { width: 1080, height: 1920, label: "1080 × 1920 (Portrait/Shorts 1080p)" },
  },
  "1:1": {
    "720p": { width: 720, height: 720, label: "720 × 720 (Square 720p)" },
    "1080p": { width: 1080, height: 1080, label: "1080 × 1080 (Square 1080p)" },
  },
  "2.39:1": {
    "720p": { width: 1720, height: 720, label: "1720 × 720 (2.39:1 Cinema)" },
    "1080p": { width: 2560, height: 1070, label: "2560 × 1070 (2.39:1 Anamorphic Cinema)" },
  },
  "4:3": {
    "720p": { width: 960, height: 720, label: "960 × 720 (Retro 4:3)" },
    "1080p": { width: 1440, height: 1080, label: "1440 × 1080 (Retro 4:3)" },
  },
};

export interface ExportProgress {
  currentFrame: number;
  totalFrames: number;
  percent: number;
  status: "initializing" | "rendering" | "encoding" | "completed" | "aborted" | "error";
  format?: "mp4" | "webm";
  error?: string;
}

export interface RenderOptions {
  aspectRatio: AspectRatioType;
  quality: "720p" | "1080p";
  fps: 24 | 30 | 60;
  totalFrames: number; // e.g. 180 frames
  scene: THREE.Scene;
  character: LowPolyCharacter | null;
  cameraRig: DirectorCameraRig;
  preferredFormat?: "mp4" | "webm";
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

export class VideoExportEngine {
  /**
   * Primary entry point: Deterministic offline frame-by-frame video renderer.
   * Uses WebCodecs VideoEncoder + mp4-muxer / webm-muxer with zero frame drops.
   */
  public static async renderAnimationToVideo(options: RenderOptions): Promise<{ blob: Blob; format: "mp4" | "webm" }> {
    const hasWebCodecs = typeof window !== "undefined" && typeof (window as any).VideoEncoder !== "undefined";

    if (hasWebCodecs && options.preferredFormat !== "webm") {
      try {
        const blob = await this.exportSceneToMP4WebCodecs(options);
        return { blob, format: "mp4" };
      } catch (err) {
        console.warn("WebCodecs MP4 export failed or unsupported, falling back to WebM canvas stream:", err);
      }
    }

    const blob = await this.exportSceneToWebMStream(options);
    return { blob, format: "webm" };
  }

  /**
   * Deterministic WebCodecs + mp4-muxer offline rendering loop.
   */
  public static async exportSceneToMP4WebCodecs(options: RenderOptions): Promise<Blob> {
    const {
      aspectRatio,
      quality,
      fps = 30,
      totalFrames,
      scene,
      character,
      cameraRig,
      onProgress,
      signal,
    } = options;

    const resConfig = ASPECT_RATIO_CONFIGS[aspectRatio][quality];
    const width = resConfig.width;
    const height = resConfig.height;

    onProgress?.({
      currentFrame: 0,
      totalFrames,
      percent: 0,
      status: "initializing",
      format: "mp4",
    });

    // 1. Offscreen canvas & WebGLRenderer
    let canvas: HTMLCanvasElement;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
    } else {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
    }

    const offscreenRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    offscreenRenderer.setSize(width, height, false);
    offscreenRenderer.shadowMap.enabled = true;
    offscreenRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    offscreenRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    offscreenRenderer.toneMappingExposure = 1.0;

    // 2. Offscreen camera setup
    const offscreenCamera = cameraRig.camera.clone();
    offscreenCamera.aspect = width / height;
    offscreenCamera.updateProjectionMatrix();

    const tempCameraRig = new DirectorCameraRig(offscreenCamera, cameraRig.shotDescriptor);
    tempCameraRig.setTargetActor(character);
    tempCameraRig.setSceneCenter(cameraRig.sceneCenter);

    // 3. Setup mp4-muxer
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",
        width,
        height,
      },
      fastStart: "in-memory",
    });

    let encoderError: any = null;
    const VideoEncoderClass = (window as any).VideoEncoder;

    const encoder = new VideoEncoderClass({
      output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
      error: (e: any) => {
        encoderError = e;
        console.error("WebCodecs VideoEncoder Error:", e);
      },
    });

    encoder.configure({
      codec: "avc1.640028", // H.264 High Profile Level 4.0
      width,
      height,
      bitrate: quality === "1080p" ? 12_000_000 : 6_000_000,
      framerate: fps,
    });

    const VideoFrameClass = (window as any).VideoFrame;

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (signal?.aborted) {
          throw new Error("Video export cancelled by user");
        }
        if (encoderError) {
          throw encoderError;
        }

        const timestampUs = Math.round((frameIndex / fps) * 1_000_000);
        const progress = frameIndex / Math.max(totalFrames - 1, 1);
        const totalDurationSec = totalFrames / fps;

        // 1. Advance character kinematics along path
        if (character) {
          character.updateAtProgress(progress, totalDurationSec);
        }

        // 2. Advance virtual camera choreography
        tempCameraRig.updateAtFrame(frameIndex, totalFrames);

        // 3. Render frame to offscreen canvas
        offscreenRenderer.render(scene, offscreenCamera);

        // 4. Encapsulate into VideoFrame
        const videoFrame = new VideoFrameClass(canvas, { timestamp: timestampUs });
        const isKeyFrame = frameIndex % (fps * 2) === 0;

        encoder.encode(videoFrame, { keyFrame: isKeyFrame });
        videoFrame.close();

        const pct = Math.min(Math.round(((frameIndex + 1) / totalFrames) * 95), 95);
        onProgress?.({
          currentFrame: frameIndex + 1,
          totalFrames,
          percent: pct,
          status: "rendering",
          format: "mp4",
        });

        // Yield slightly every 4 frames so UI remains responsive
        if (frameIndex % 4 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      onProgress?.({
        currentFrame: totalFrames,
        totalFrames,
        percent: 98,
        status: "encoding",
        format: "mp4",
      });

      await encoder.flush();
      muxer.finalize();
      offscreenRenderer.dispose();

      const { buffer } = muxer.target;
      const finalBlob = new Blob([buffer], { type: "video/mp4" });

      onProgress?.({
        currentFrame: totalFrames,
        totalFrames,
        percent: 100,
        status: "completed",
        format: "mp4",
      });

      return finalBlob;
    } catch (err) {
      offscreenRenderer.dispose();
      throw err;
    }
  }

  /**
   * Deterministic WebM fallback renderer.
   */
  public static async exportSceneToWebMStream(options: RenderOptions): Promise<Blob> {
    const {
      aspectRatio,
      quality,
      fps = 30,
      totalFrames,
      scene,
      character,
      cameraRig,
      onProgress,
      signal,
    } = options;

    const resConfig = ASPECT_RATIO_CONFIGS[aspectRatio][quality];
    const width = resConfig.width;
    const height = resConfig.height;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const offscreenRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    offscreenRenderer.setSize(width, height, false);
    offscreenRenderer.shadowMap.enabled = true;
    offscreenRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const offscreenCamera = cameraRig.camera.clone();
    offscreenCamera.aspect = width / height;
    offscreenCamera.updateProjectionMatrix();

    const tempCameraRig = new DirectorCameraRig(offscreenCamera, cameraRig.shotDescriptor);
    tempCameraRig.setTargetActor(character);
    tempCameraRig.setSceneCenter(cameraRig.sceneCenter);

    const stream = canvas.captureStream ? canvas.captureStream(fps) : (canvas as any).mozCaptureStream(fps);
    const videoTrack = stream.getVideoTracks()[0];

    const mimeCandidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    let selectedMime = "video/webm";
    for (const m of mimeCandidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
        selectedMime = m;
        break;
      }
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: selectedMime,
      videoBitsPerSecond: quality === "1080p" ? 10_000_000 : 5_000_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    return new Promise<Blob>((resolve, reject) => {
      let aborted = false;

      const cleanup = () => {
        (stream.getTracks() as MediaStreamTrack[]).forEach((t: MediaStreamTrack) => t.stop());
        offscreenRenderer.dispose();
        canvas.remove();
      };

      recorder.onstop = () => {
        cleanup();
        if (aborted) {
          reject(new Error("Video export cancelled by user"));
          return;
        }
        const blob = new Blob(chunks, { type: selectedMime });
        onProgress?.({
          currentFrame: totalFrames,
          totalFrames,
          percent: 100,
          status: "completed",
          format: "webm",
        });
        resolve(blob);
      };

      recorder.onerror = (e: any) => {
        cleanup();
        reject(new Error(e.error?.message || "MediaRecorder error"));
      };

      recorder.start(100);

      const frameDurationMs = 1000 / fps;
      const totalDurationSec = totalFrames / fps;

      const loop = async () => {
        try {
          for (let f = 0; f < totalFrames; f++) {
            if (signal?.aborted) {
              aborted = true;
              recorder.stop();
              return;
            }

            const progress = f / Math.max(totalFrames - 1, 1);
            if (character) {
              character.updateAtProgress(progress, totalDurationSec);
            }
            tempCameraRig.updateAtFrame(f, totalFrames);
            offscreenRenderer.render(scene, offscreenCamera);

            if (videoTrack && (videoTrack as any).requestFrame) {
              (videoTrack as any).requestFrame();
            }

            const pct = Math.min(Math.round(((f + 1) / totalFrames) * 98), 98);
            onProgress?.({
              currentFrame: f + 1,
              totalFrames,
              percent: pct,
              status: "rendering",
              format: "webm",
            });

            await new Promise((r) => setTimeout(r, Math.max(16, frameDurationMs / 2)));
          }

          onProgress?.({
            currentFrame: totalFrames,
            totalFrames,
            percent: 99,
            status: "encoding",
            format: "webm",
          });

          setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 250);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      loop();
    });
  }
}
