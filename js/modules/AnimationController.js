import { CONSTANTS } from "./constants.js";

export class AnimationController {
  constructor(state, dotVideoProcessor, elements) {
    this.state = state;
    this.dotVideoProcessor = dotVideoProcessor;
    this.elements = elements;
    this.ctx = elements.canvas.getContext("2d", { willReadFrequently: true });
    this.boundDrawFrame = this.drawFrame.bind(this);
  }

  drawFrame() {
    if (!this.state.videoLoaded || !this.elements.video) return;

    try {
      // Only process frame if video is ready
      if (this.elements.video.readyState >= 2) {
        // Ensure canvas dimensions match video
        if (
          this.elements.canvas.width !== this.elements.video.videoWidth ||
          this.elements.canvas.height !== this.elements.video.videoHeight
        ) {
          this.elements.canvas.width = this.elements.video.videoWidth;
          this.elements.canvas.height = this.elements.video.videoHeight;
        }

        // Render the frame
        this.dotVideoProcessor.renderFrame(
          this.elements.video,
          this.ctx,
          this.state.dotSize
        );
      }

      // Continue animation if playing
      if (this.state.isPlaying) {
        this.state.animationFrameId = requestAnimationFrame(
          this.boundDrawFrame
        );
      }
    } catch (error) {
      console.error("Error in animation frame:", error);
      this.stopAnimation();
    }
  }

  startAnimation() {
    this.state.isPlaying = true;
    this.drawFrame();
  }

  stopAnimation() {
    this.state.isPlaying = false;
    if (this.state.animationFrameId) {
      cancelAnimationFrame(this.state.animationFrameId);
      this.state.animationFrameId = null;
    }
  }
}
