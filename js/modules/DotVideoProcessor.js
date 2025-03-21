export class DotVideoProcessor {
  constructor(offscreenCanvas, offscreenCtx) {
    this.offscreenCanvas = offscreenCanvas;
    this.offscreenCtx = offscreenCtx;
    // Pre-calculate luminance multipliers
    this.luminanceMultipliers = {
      r: 0.299,
      g: 0.587,
      b: 0.114,
    };
  }

  calculateLuminance(r, g, b) {
    const { r: rM, g: gM, b: bM } = this.luminanceMultipliers;
    return Math.pow((rM * r + gM * g + bM * b) / 255, 1.2);
  }

  renderDot(ctx, centerX, centerY, radius, color) {
    ctx.fillStyle = color; // Set dot color
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  renderFrame(source, targetCtx, size) {
    try {
      if (!source.videoWidth || !source.videoHeight) return;

      const width = source.videoWidth;
      const height = source.videoHeight;

      // Ensure canvas dimensions match video
      if (
        this.offscreenCanvas.width !== width ||
        this.offscreenCanvas.height !== height
      ) {
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
        targetCtx.canvas.width = width;
        targetCtx.canvas.height = height;
      }

      // Draw video frame to offscreen canvas
      this.offscreenCtx.drawImage(source, 0, 0);

      // Get pixel data
      const imageData = this.offscreenCtx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Clear target canvas
      targetCtx.fillStyle = "white";
      targetCtx.fillRect(0, 0, width, height);

      // Calculate grid
      const numDotsX = Math.floor(width / size);
      const numDotsY = Math.floor(height / size);
      const halfSize = size / 2;

      for (let y = 0; y < numDotsY; y++) {
        const yOffset = y * size * width;
        const centerY = y * size + halfSize;

        for (let x = 0; x < numDotsX; x++) {
          const pixelIndex = (x * size + yOffset) * 4;

          // Skip if out of bounds
          if (pixelIndex >= data.length - 4) continue;

          const r = data[pixelIndex];
          const g = data[pixelIndex + 1];
          const b = data[pixelIndex + 2];

          const luminance = this.calculateLuminance(r, g, b);
          const dotRadius = halfSize * (1 - luminance * 0.85);

          if (dotRadius > 0.5) {
            const centerX = x * size + halfSize;
            const dotColor = `rgb(${r}, ${g}, ${b})`; // Use original pixel color for the dot
            this.renderDot(targetCtx, centerX, centerY, dotRadius, dotColor);
          }
        }
      }
    } catch (error) {
      console.error("Error in renderFrame:", error);
    }
  }
}
