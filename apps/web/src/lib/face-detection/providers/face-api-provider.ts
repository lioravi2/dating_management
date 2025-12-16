import * as faceapi from 'face-api.js';
import { 
  IFaceDetectionProvider, 
  FaceDetectionResult, 
  MultipleFaceDetectionResult,
  FaceDescriptor 
} from '../types';

export class FaceApiProvider implements IFaceDetectionProvider {
  private modelsLoaded = false;
  private loading = false;
  private error: string | null = null;
  private readonly MODEL_URL = '/models';

  async initialize(): Promise<void> {
    if (this.modelsLoaded) return;
    
    this.loading = true;
    this.error = null;
    
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL),
      ]);
      
      this.modelsLoaded = true;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load models';
      throw new Error(this.error);
    } finally {
      this.loading = false;
    }
  }

  isInitialized(): boolean {
    return this.modelsLoaded;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getError(): string | null {
    return this.error;
  }

  async detectFace(
    image: HTMLImageElement | HTMLCanvasElement | ImageData
  ): Promise<FaceDetectionResult> {
    if (!this.modelsLoaded) {
      return {
        descriptor: null,
        boundingBox: null,
        confidence: null,
        error: 'Models not loaded',
      };
    }

    let createdCanvas: HTMLCanvasElement | null = null;
    let originalWidth = 0;
    let originalHeight = 0;

    try {
      // Resize image to reduce GPU memory usage (max 800px on longest side)
      const MAX_DIMENSION = 800;
      let input: HTMLImageElement | HTMLCanvasElement;
      
      if (image instanceof ImageData) {
        originalWidth = image.width;
        originalHeight = image.height;
        createdCanvas = document.createElement('canvas');
        createdCanvas.width = image.width;
        createdCanvas.height = image.height;
        const ctx = createdCanvas.getContext('2d');
        if (!ctx) {
          return {
            descriptor: null,
            boundingBox: null,
            confidence: null,
            error: 'Failed to create canvas context',
          };
        }
        ctx.putImageData(image, 0, 0);
        input = createdCanvas;
      } else {
        // Get image dimensions
        if (image instanceof HTMLImageElement) {
          originalWidth = image.naturalWidth || image.width;
          originalHeight = image.naturalHeight || image.height;
        } else {
          originalWidth = image.width;
          originalHeight = image.height;
        }

        // Resize if image is too large
        if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
          const scale = Math.min(MAX_DIMENSION / originalWidth, MAX_DIMENSION / originalHeight);
          const newWidth = Math.round(originalWidth * scale);
          const newHeight = Math.round(originalHeight * scale);

          createdCanvas = document.createElement('canvas');
          createdCanvas.width = newWidth;
          createdCanvas.height = newHeight;
          const ctx = createdCanvas.getContext('2d');
          if (!ctx) {
            return {
              descriptor: null,
              boundingBox: null,
              confidence: null,
              error: 'Failed to create canvas context',
            };
          }
          
          // Draw resized image
          ctx.drawImage(image, 0, 0, newWidth, newHeight);
          input = createdCanvas;
        } else {
          input = image;
        }
      }

      const detection = await faceapi
        .detectSingleFace(input)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return {
          descriptor: null,
          boundingBox: null,
          confidence: null,
          error: 'No face detected',
        };
      }

      // Scale bounding box back to original size if we resized
      const inputWidth = createdCanvas ? createdCanvas.width : (image instanceof ImageData ? image.width : (image instanceof HTMLImageElement ? (image.naturalWidth || image.width) : image.width));
      const inputHeight = createdCanvas ? createdCanvas.height : (image instanceof ImageData ? image.height : (image instanceof HTMLImageElement ? (image.naturalHeight || image.height) : image.height));
      const scaleX = originalWidth / inputWidth;
      const scaleY = originalHeight / inputHeight;

      return {
        descriptor: Array.from(detection.descriptor),
        boundingBox: {
          x: detection.detection.box.x * scaleX,
          y: detection.detection.box.y * scaleY,
          width: detection.detection.box.width * scaleX,
          height: detection.detection.box.height * scaleY,
        },
        confidence: detection.detection.score,
        error: null,
      };
    } catch (err) {
      return {
        descriptor: null,
        boundingBox: null,
        confidence: null,
        error: err instanceof Error ? err.message : 'Detection failed',
      };
    } finally {
      // Clean up created canvas to free memory
      if (createdCanvas) {
        const ctx = createdCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, createdCanvas.width, createdCanvas.height);
        }
        // Remove canvas from DOM if it was added (it shouldn't be, but just in case)
        if (createdCanvas.parentNode) {
          createdCanvas.parentNode.removeChild(createdCanvas);
        }
        // Clear canvas reference to help GC
        createdCanvas = null;
      }
    }
  }

  async detectAllFaces(
    image: HTMLImageElement | HTMLCanvasElement | ImageData
  ): Promise<MultipleFaceDetectionResult> {
    if (!this.modelsLoaded) {
      return {
        detections: [],
        error: 'Models not loaded',
      };
    }

    let createdCanvas: HTMLCanvasElement | null = null;
    let originalWidth = 0;
    let originalHeight = 0;

    try {
      // Resize image to reduce GPU memory usage (max 800px on longest side)
      const MAX_DIMENSION = 800;
      let input: HTMLImageElement | HTMLCanvasElement;
      
      if (image instanceof ImageData) {
        originalWidth = image.width;
        originalHeight = image.height;
        createdCanvas = document.createElement('canvas');
        createdCanvas.width = image.width;
        createdCanvas.height = image.height;
        const ctx = createdCanvas.getContext('2d');
        if (!ctx) {
          return {
            detections: [],
            error: 'Failed to create canvas context',
          };
        }
        ctx.putImageData(image, 0, 0);
        input = createdCanvas;
      } else {
        // Get image dimensions
        if (image instanceof HTMLImageElement) {
          originalWidth = image.naturalWidth || image.width;
          originalHeight = image.naturalHeight || image.height;
        } else {
          originalWidth = image.width;
          originalHeight = image.height;
        }

        // Resize if image is too large
        if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
          const scale = Math.min(MAX_DIMENSION / originalWidth, MAX_DIMENSION / originalHeight);
          const newWidth = Math.round(originalWidth * scale);
          const newHeight = Math.round(originalHeight * scale);

          createdCanvas = document.createElement('canvas');
          createdCanvas.width = newWidth;
          createdCanvas.height = newHeight;
          const ctx = createdCanvas.getContext('2d');
          if (!ctx) {
            return {
              detections: [],
              error: 'Failed to create canvas context',
            };
          }
          
          // Draw resized image
          ctx.drawImage(image, 0, 0, newWidth, newHeight);
          input = createdCanvas;
        } else {
          input = image;
        }
      }

      const detections = await faceapi
        .detectAllFaces(input)
        .withFaceLandmarks()
        .withFaceDescriptors();

      // Scale bounding boxes back to original size if we resized
      const inputWidth = createdCanvas ? createdCanvas.width : (image instanceof ImageData ? image.width : (image instanceof HTMLImageElement ? (image.naturalWidth || image.width) : image.width));
      const inputHeight = createdCanvas ? createdCanvas.height : (image instanceof ImageData ? image.height : (image instanceof HTMLImageElement ? (image.naturalHeight || image.height) : image.height));
      const scaleX = originalWidth / inputWidth;
      const scaleY = originalHeight / inputHeight;

      return {
        detections: detections.map(detection => ({
          descriptor: Array.from(detection.descriptor),
          boundingBox: {
            x: detection.detection.box.x * scaleX,
            y: detection.detection.box.y * scaleY,
            width: detection.detection.box.width * scaleX,
            height: detection.detection.box.height * scaleY,
          },
          confidence: detection.detection.score,
          error: null,
        })),
        error: null,
      };
    } catch (err) {
      return {
        detections: [],
        error: err instanceof Error ? err.message : 'Detection failed',
      };
    } finally {
      // Clean up created canvas to free memory
      if (createdCanvas) {
        const ctx = createdCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, createdCanvas.width, createdCanvas.height);
        }
        // Remove canvas from DOM if it was added (it shouldn't be, but just in case)
        if (createdCanvas.parentNode) {
          createdCanvas.parentNode.removeChild(createdCanvas);
        }
        // Clear canvas reference to help GC
        createdCanvas = null;
      }
    }
  }

  calculateSimilarity(
    descriptor1: FaceDescriptor,
    descriptor2: FaceDescriptor
  ): number {
    // Use face-api.js euclidean distance
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    return Math.max(0, 1 - Math.min(distance, 1));
  }
}
