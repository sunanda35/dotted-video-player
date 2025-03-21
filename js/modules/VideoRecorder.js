import { CONSTANTS } from "./constants.js";

export class VideoRecorder {
  constructor(state) {
    this.state = state;
    this.downloadBtn = document.getElementById("downloadBtn");
    this.processingVideo = document.getElementById("processingVideo");
    this.reset();
  }

  reset() {
    this.state.recordedChunks = [];
    this.state.isRecording = false;
    this.state.mediaRecorder = null;
    if (this.processingVideo) {
      this.processingVideo.pause();
      this.processingVideo.currentTime = 0;
    }
  }

  updateDownloadButton(status, progress = 0) {
    if (!this.downloadBtn) return;

    switch (status) {
      case "processing":
        this.downloadBtn.disabled = true;
        this.downloadBtn.innerHTML = `
          <div class="flex flex-col items-center gap-2">
            <span class="material-icons animate-spin">refresh</span>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
              <div class="bg-green-600 h-2.5 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
            </div>
            <span class="text-sm">Processing... ${progress}%</span>
          </div>
        `;
        break;
      case "error":
        this.downloadBtn.disabled = false;
        this.downloadBtn.innerHTML = `
          <span class="material-icons">error</span>
          Error - Try Again
        `;
        break;
      default:
        this.downloadBtn.disabled = false;
        this.downloadBtn.innerHTML = `
          <span class="material-icons">download</span>
          Download Dotted Video
        `;
    }
  }

  async processFrame(video, canvas, dotSize) {
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Create a temporary canvas for processing
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

      // Draw the frame to temp canvas
      tempCtx.drawImage(canvas, 0, 0);

      // Clear main canvas with white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw dots with original colors
      const spacing = dotSize * 0.9; // Slightly reduce spacing for denser pattern
      const minDotSize = dotSize * 0.15; // Minimum dot size (15% of max)
      const contrastFactor = 1.3; // Increase contrast

      for (let y = 0; y < canvas.height; y += spacing) {
        for (let x = 0; x < canvas.width; x += spacing) {
          // Get pixel color from temp canvas
          const pixel = tempCtx.getImageData(x, y, 1, 1).data;
          const r = pixel[0];
          const g = pixel[1];
          const b = pixel[2];

          // Calculate luminance for dot size
          let luminance = (r + g + b) / 3;

          // Apply contrast enhancement
          luminance = Math.pow(luminance / 255, contrastFactor) * 255;

          // Calculate dot size with minimum size and inverted luminance
          const currentDotSize = Math.max(
            minDotSize,
            ((255 - luminance) / 255) * dotSize
          );

          // Add slight randomness to dot position for more organic look
          const randomOffset = 0.1; // 10% random offset
          const offsetX = (Math.random() - 0.5) * spacing * randomOffset;
          const offsetY = (Math.random() - 0.5) * spacing * randomOffset;

          // Set the original color with increased saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const saturation = max === 0 ? 0 : delta / max;

          // Increase saturation by 20%
          const enhancedSaturation = Math.min(1, saturation * 1.2);

          // Calculate enhanced RGB values
          const enhancedR = r + (r - (r + g + b) / 3) * enhancedSaturation;
          const enhancedG = g + (g - (r + g + b) / 3) * enhancedSaturation;
          const enhancedB = b + (b - (r + g + b) / 3) * enhancedSaturation;

          ctx.fillStyle = `rgb(${Math.round(enhancedR)}, ${Math.round(
            enhancedG
          )}, ${Math.round(enhancedB)})`;

          // Add a very subtle shadow for depth
          ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
          ctx.shadowBlur = 1;
          ctx.shadowOffsetX = 0.5;
          ctx.shadowOffsetY = 0.5;

          ctx.beginPath();
          ctx.arc(
            x + spacing / 2 + offsetX,
            y + spacing / 2 + offsetY,
            currentDotSize / 2,
            0,
            Math.PI * 2
          );
          ctx.fill();

          // Reset shadow
          ctx.shadowColor = "transparent";
        }
      }
    } catch (error) {
      console.error("Error processing frame:", error);
      throw error;
    }
  }

  async startRecording(canvas) {
    try {
      console.log("Starting recording process...");
      this.updateDownloadButton("processing", 0);

      const video = document.getElementById("myVideo");
      if (!video || !video.src) {
        throw new Error("No video source found");
      }

      const dotSize = parseInt(document.getElementById("dot-slider").value);
      if (!dotSize || dotSize < 1) {
        throw new Error("Invalid dot size");
      }

      this.processingVideo.src = video.src;
      console.log("Processing video source set:", this.processingVideo.src);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Video loading timeout"));
        }, 10000);

        this.processingVideo.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };

        this.processingVideo.onerror = (error) => {
          clearTimeout(timeout);
          reject(new Error("Error loading video: " + error.message));
        };
      });

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported(
        "video/mp4;codecs=avc1.42E01E"
      )
        ? "video/mp4;codecs=avc1.42E01E"
        : "video/webm;codecs=vp9";

      this.state.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 12000000,
      });

      this.state.recordedChunks = [];

      this.state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.state.recordedChunks.push(event.data);
        }
      };

      this.state.mediaRecorder.start(1000);
      this.state.isRecording = true;

      const duration = this.processingVideo.duration;
      const frameRate = 30;
      const totalFrames = Math.ceil(duration * frameRate);
      console.log("Total frames to process:", totalFrames);

      for (let frame = 0; frame < totalFrames; frame++) {
        try {
          const frameTime = frame / frameRate;

          await new Promise((resolve, reject) => {
            this.processingVideo.currentTime = frameTime;
            this.processingVideo.onseeked = resolve;
            this.processingVideo.onerror = reject;
          });

          await this.processFrame(this.processingVideo, canvas, dotSize);

          const progress = Math.round((frame / totalFrames) * 100);
          this.updateDownloadButton("processing", progress);

          await new Promise((resolve) => setTimeout(resolve, 1000 / frameRate));
        } catch (error) {
          console.error(`Error processing frame ${frame}:`, error);
          throw error;
        }
      }

      this.state.mediaRecorder.stop();

      this.state.mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(this.state.recordedChunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `dotted-video.${
            mimeType.includes("mp4") ? "mp4" : "webm"
          }`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this.reset();
          this.updateDownloadButton("default");
        } catch (error) {
          console.error("Error creating download:", error);
          this.updateDownloadButton("error");
        }
      };

      return true;
    } catch (error) {
      console.error("Error in startRecording:", error);
      this.updateDownloadButton("error");
      this.reset();
      return false;
    }
  }
}
