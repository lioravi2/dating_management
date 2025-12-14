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

    try {
      // Convert ImageData to canvas if needed
      let input: HTMLImageElement | HTMLCanvasElement;
      if (image instanceof ImageData) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return {
            descriptor: null,
            boundingBox: null,
            confidence: null,
            error: 'Failed to create canvas context',
          };
        }
        ctx.putImageData(image, 0, 0);
        input = canvas;
      } else {
        input = image;
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

      return {
        descriptor: Array.from(detection.descriptor),
        boundingBox: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
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

    try {
      // Convert ImageData to canvas if needed
      let input: HTMLImageElement | HTMLCanvasElement;
      if (image instanceof ImageData) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return {
            detections: [],
            error: 'Failed to create canvas context',
          };
        }
        ctx.putImageData(image, 0, 0);
        input = canvas;
      } else {
        input = image;
      }

      const detections = await faceapi
        .detectAllFaces(input)
        .withFaceLandmarks()
        .withFaceDescriptors();

      return {
        detections: detections.map(detection => ({
          descriptor: Array.from(detection.descriptor),
          boundingBox: {
            x: detection.detection.box.x,
            y: detection.detection.box.y,
            width: detection.detection.box.width,
            height: detection.detection.box.height,
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
