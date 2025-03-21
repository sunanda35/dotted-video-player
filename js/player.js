import { DotVideoProcessor } from "./modules/DotVideoProcessor.js";
import { VideoRecorder } from "./modules/VideoRecorder.js";
import { AnimationController } from "./modules/AnimationController.js";
import { CONSTANTS } from "./modules/constants.js";

// DOM Elements
const elements = {
  video: document.getElementById("myVideo"),
  canvas: document.getElementById("video-canvas"),
  dotSlider: document.getElementById("dot-slider"),
  sliderValue: document.getElementById("slider-value"),
  downloadBtn: document.getElementById("downloadBtn"),
  videoUpload: document.getElementById("video-upload"),
};

// Canvas Context Setup
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d", {
  willReadFrequently: true,
});

// Initialize main canvas context
const ctx = elements.canvas.getContext("2d", {
  willReadFrequently: true,
});

// State Management
const state = {
  dotSize: parseInt(elements.dotSlider.value),
  isPlaying: false,
  videoLoaded: false,
  isRecording: false,
  mediaRecorder: null,
  recordedChunks: [],
  animationFrameId: null,
  lastFrameTime: 0,
};

// Initialize Classes
const dotVideoProcessor = new DotVideoProcessor(offscreenCanvas, offscreenCtx);
const videoRecorder = new VideoRecorder(state);
const animationController = new AnimationController(
  state,
  dotVideoProcessor,
  elements
);

// Event Handlers
function setupEventListeners() {
  // Initialize slider value display
  elements.sliderValue.textContent = state.dotSize;

  // Video upload handling
  elements.videoUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > CONSTANTS.maxFileSize) {
      alert("File size must be less than 500MB");
      return;
    }
    if (!file.type.startsWith("video/")) {
      alert("Please select a valid video file");
      return;
    }

    // Reset state
    state.videoLoaded = false;
    state.isPlaying = false;
    animationController.stopAnimation();

    // Load new video
    const videoUrl = URL.createObjectURL(file);
    elements.video.src = videoUrl;
    elements.video.load();
  });

  // Dot size slider
  elements.dotSlider.addEventListener("input", () => {
    state.dotSize = parseInt(elements.dotSlider.value);
    elements.sliderValue.textContent = state.dotSize;
    if (state.videoLoaded && elements.video.readyState >= 2) {
      dotVideoProcessor.renderFrame(elements.video, ctx, state.dotSize);
    }
  });

  // Video event listeners
  elements.video.addEventListener("loadedmetadata", () => {
    // Set initial canvas dimensions
    elements.canvas.width = elements.video.videoWidth;
    elements.canvas.height = elements.video.videoHeight;
  });

  elements.video.addEventListener("loadeddata", () => {
    if (elements.video.readyState >= 2) {
      state.videoLoaded = true;
      // Initial render
      dotVideoProcessor.renderFrame(elements.video, ctx, state.dotSize);
    }
  });

  elements.video.addEventListener("play", () => {
    animationController.startAnimation();
  });

  elements.video.addEventListener("pause", () => {
    animationController.stopAnimation();
  });

  elements.video.addEventListener("ended", () => {
    animationController.stopAnimation();
  });

  elements.video.addEventListener("seeked", () => {
    if (elements.video.readyState >= 2) {
      dotVideoProcessor.renderFrame(elements.video, ctx, state.dotSize);
    }
  });

  // Download button
  elements.downloadBtn.addEventListener("click", async () => {
    if (
      !state.videoLoaded ||
      state.isRecording ||
      elements.video.readyState < 2
    )
      return;

    try {
      videoRecorder.updateDownloadButton("processing");

      // Store current video state
      const wasPlaying = !elements.video.paused;
      const currentTime = elements.video.currentTime;

      // Pause video during processing
      if (wasPlaying) {
        elements.video.pause();
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = elements.video.videoWidth;
      tempCanvas.height = elements.video.videoHeight;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

      if (!(await videoRecorder.startRecording(tempCanvas))) {
        throw new Error("Failed to initialize recording");
      }

      let frameCount = 0;
      const totalFrames = Math.ceil(elements.video.duration * CONSTANTS.FPS);

      const processFrame = () => {
        if (frameCount >= totalFrames) {
          state.mediaRecorder.stop();
          // Restore video state
          elements.video.currentTime = currentTime;
          if (wasPlaying) {
            elements.video.play();
          }
          return;
        }

        elements.video.currentTime =
          (frameCount / totalFrames) * elements.video.duration;
        dotVideoProcessor.renderFrame(elements.video, tempCtx, state.dotSize);
        frameCount++;
        requestAnimationFrame(processFrame);
      };

      processFrame();
    } catch (error) {
      console.error("Error processing video:", error);
      videoRecorder.updateDownloadButton("error");
    }
  });
}

// Initialize
setupEventListeners();

// Set default video source if needed
if (!elements.video.src) {
  elements.video.src =
    "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  elements.video.load();
}
