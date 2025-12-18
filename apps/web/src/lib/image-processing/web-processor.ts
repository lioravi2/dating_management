/**
 * Web Implementation of Image Processing Abstraction
 * 
 * Uses HTML Canvas API for image processing operations.
 * This will be replaced with expo-gl or native image processing on mobile.
 */

import { IImageProcessor, ICanvas, IImage, ICanvasContext } from './types';

class WebCanvas implements ICanvas {
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get width(): number {
    return this.canvas.width;
  }

  set width(value: number) {
    this.canvas.width = value;
  }

  get height(): number {
    return this.canvas.height;
  }

  set height(value: number) {
    this.canvas.height = value;
  }

  getContext(type: '2d'): ICanvasContext | null {
    const ctx = this.canvas.getContext('2d');
    return ctx ? new WebCanvasContext(ctx) : null;
  }

  async toBlob(type?: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        type,
        quality
      );
    });
  }

  toDataURL(type?: string, quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }

  // Internal method to get native canvas (for face-api.js compatibility)
  getNativeCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

class WebCanvasContext implements ICanvasContext {
  constructor(private ctx: CanvasRenderingContext2D) {}

  clearRect(x: number, y: number, w: number, h: number): void {
    this.ctx.clearRect(x, y, w, h);
  }

  drawImage(image: IImage | ICanvas, ...args: number[]): void {
    // Validate argument count - must be 2, 4, or 8 numeric arguments
    if (args.length !== 2 && args.length !== 4 && args.length !== 8) {
      throw new Error(
        `drawImage requires 2, 4, or 8 numeric arguments, but received ${args.length}. ` +
        `Supported signatures: (image, dx, dy), (image, dx, dy, dw, dh), ` +
        `or (image, sx, sy, sw, sh, dx, dy, dw, dh)`
      );
    }

    // Get native element using type-safe approach
    // Both WebCanvas and WebImage implement the interfaces but have internal methods
    let nativeElement: HTMLImageElement | HTMLCanvasElement;
    
    if (image instanceof WebCanvas) {
      nativeElement = image.getNativeCanvas();
    } else if (image instanceof WebImage) {
      nativeElement = image.getNativeImage();
    } else {
      // If it's not a WebCanvas or WebImage, it's an invalid implementation
      throw new Error(
        'Unsupported image type for drawImage. Expected WebCanvas or WebImage instance. ' +
        'Other implementations must provide compatible native elements.'
      );
    }

    // Call the appropriate drawImage overload based on argument count
    if (args.length === 2) {
      // drawImage(image, dx, dy)
      this.ctx.drawImage(nativeElement, args[0], args[1]);
    } else if (args.length === 4) {
      // drawImage(image, dx, dy, dw, dh)
      this.ctx.drawImage(nativeElement, args[0], args[1], args[2], args[3]);
    } else {
      // args.length === 8: drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
      this.ctx.drawImage(
        nativeElement,
        args[0], args[1], args[2], args[3], // sx, sy, sw, sh
        args[4], args[5], args[6], args[7]  // dx, dy, dw, dh
      );
    }
  }

  putImageData(imageData: ImageData, dx: number, dy: number): void {
    this.ctx.putImageData(imageData, dx, dy);
  }

  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
    return this.ctx.getImageData(sx, sy, sw, sh);
  }

  get strokeStyle(): string | CanvasGradient | CanvasPattern {
    return this.ctx.strokeStyle;
  }

  set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
    this.ctx.strokeStyle = value;
  }

  get fillStyle(): string | CanvasGradient | CanvasPattern {
    return this.ctx.fillStyle;
  }

  set fillStyle(value: string | CanvasGradient | CanvasPattern) {
    this.ctx.fillStyle = value;
  }

  get lineWidth(): number {
    return this.ctx.lineWidth;
  }

  set lineWidth(value: number) {
    this.ctx.lineWidth = value;
  }

  get font(): string {
    return this.ctx.font;
  }

  set font(value: string) {
    this.ctx.font = value;
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.ctx.strokeRect(x, y, w, h);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.ctx.fillRect(x, y, w, h);
  }

  fillText(text: string, x: number, y: number): void {
    this.ctx.fillText(text, x, y);
  }

  measureText(text: string): TextMetrics {
    return this.ctx.measureText(text);
  }
}

class WebImage implements IImage {
  private objectUrl: string | null = null; // Track object URL for cleanup

  constructor(private img: HTMLImageElement, objectUrl?: string | null) {
    this.objectUrl = objectUrl || null;
  }

  get width(): number {
    return this.img.naturalWidth || this.img.width;
  }

  get height(): number {
    return this.img.naturalHeight || this.img.height;
  }

  async getData(): Promise<ImageData> {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');
    ctx.drawImage(this.img, 0, 0);
    return ctx.getImageData(0, 0, this.width, this.height);
  }

  // Internal method to get native image (for face-api.js compatibility)
  getNativeImage(): HTMLImageElement {
    return this.img;
  }

  // Cleanup method to revoke object URL (call when image is no longer needed)
  // Note: Once the image has loaded, the browser has the image data, so it's safe to revoke
  cleanup(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  // Clear object URL reference (used after immediate cleanup in loadImage)
  // This is called after URL.revokeObjectURL() to mark the URL as already cleaned up
  clearObjectUrl(): void {
    this.objectUrl = null;
  }
}

export class WebImageProcessor implements IImageProcessor {
  createCanvas(width: number, height: number): ICanvas {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return new WebCanvas(canvas);
  }

  async loadImage(src: string | File | Blob, crossOrigin?: string): Promise<IImage> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let objectUrl: string | null = null;
      
      // Set crossOrigin BEFORE setting src (critical for CORS with Supabase storage)
      // This must be done before src is set, otherwise CORS may fail
      if (crossOrigin !== undefined) {
        img.crossOrigin = crossOrigin;
      }
      
      img.onload = () => {
        // Once the image has loaded, the browser has the image data in memory
        // It's safe to revoke the object URL immediately to prevent memory leaks
        // The image element retains the image data even after the URL is revoked
        const webImage = new WebImage(img, objectUrl);
        
        // Revoke object URL immediately after load to prevent memory leak
        // The image data is already in the browser's memory, so this is safe
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          // Clear the objectUrl reference in WebImage since it's been revoked
          // This ensures cleanup() becomes a no-op if called later
          webImage.clearObjectUrl();
        }
        
        resolve(webImage);
      };
      
      img.onerror = (error) => {
        // Clean up object URL on error
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        console.error('[ImageProcessor] Failed to load image:', error, src);
        reject(error);
      };
      
      // Set src after crossOrigin and event handlers are set
      if (src instanceof File || src instanceof Blob) {
        objectUrl = URL.createObjectURL(src);
        img.src = objectUrl;
      } else {
        img.src = src;
      }
    });
  }

  createImageData(width: number, height: number): ImageData {
    return new ImageData(width, height);
  }

  async resizeImage(image: IImage, maxWidth: number, maxHeight: number): Promise<IImage> {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const newWidth = Math.round(image.width * scale);
    const newHeight = Math.round(image.height * scale);
    
    const canvas = this.createCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');
    
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
    
    // Convert canvas back to image
    const dataUrl = canvas.toDataURL();
    return this.loadImage(dataUrl);
  }

  async cropImage(image: IImage, x: number, y: number, width: number, height: number): Promise<Blob> {
    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');
    
    ctx.drawImage(image, -x, -y);
    return canvas.toBlob();
  }
}

// Export internal classes for face-api.js compatibility
export { WebCanvas, WebImage };

