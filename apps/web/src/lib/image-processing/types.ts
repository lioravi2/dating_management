/**
 * Image Processing Abstraction Types
 * 
 * These interfaces abstract Canvas API operations to enable React Native compatibility.
 * Web implementation uses HTML Canvas, mobile will use expo-gl or native image processing.
 */

export interface IImage {
  width: number;
  height: number;
  getData(): Promise<ImageData | Uint8Array>;
}

export interface ICanvas {
  width: number;
  height: number;
  getContext(type: '2d'): ICanvasContext | null;
  toBlob(type?: string, quality?: number): Promise<Blob>;
  toDataURL(type?: string, quality?: number): string;
}

export interface ICanvasContext {
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: IImage | ICanvas, dx: number, dy: number): void;
  drawImage(image: IImage | ICanvas, dx: number, dy: number, dw: number, dh: number): void;
  drawImage(
    image: IImage | ICanvas,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  
  // Drawing properties
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  
  // Drawing methods
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): TextMetrics;
}

export interface IImageProcessor {
  createCanvas(width: number, height: number): ICanvas;
  loadImage(src: string | File | Blob): Promise<IImage>;
  createImageData(width: number, height: number): ImageData;
  resizeImage(image: IImage, maxWidth: number, maxHeight: number): Promise<IImage>;
  cropImage(image: IImage, x: number, y: number, width: number, height: number): Promise<Blob>;
}

