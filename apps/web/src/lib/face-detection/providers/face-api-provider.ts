import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import { 
  IFaceDetectionProvider, 
  FaceDetectionResult, 
  MultipleFaceDetectionResult,
  FaceDescriptor 
} from '../types';
import { imageProcessor } from '@/lib/image-processing';
import { WebCanvas, WebImage } from '@/lib/image-processing/web-processor';
import { 
  validateFaceDetection, 
  getDefaultConfig,
  type LandmarkPosition 
} from '@dating-app/shared';

export class FaceApiProvider implements IFaceDetectionProvider {
  private modelsLoaded = false;
  private loading = false;
  private error: string | null = null;
  private readonly MODEL_URL = '/models';
  private readonly qualityConfig = getDefaultConfig();

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
      // Resize image to reduce GPU memory usage (max 600px on longest side)
      // Reduced from 800px to minimize GPU memory usage
      const MAX_DIMENSION = 600;
      let input: HTMLImageElement | HTMLCanvasElement;
      
      if (image instanceof ImageData) {
        originalWidth = image.width;
        originalHeight = image.height;
        // Use abstraction to create canvas and put ImageData
        const canvas = imageProcessor.createCanvas(image.width, image.height);
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
        // Get native canvas for face-api.js
        createdCanvas = (canvas as WebCanvas).getNativeCanvas();
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

          // Use abstraction to create canvas and resize image
          const canvas = imageProcessor.createCanvas(newWidth, newHeight);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return {
              descriptor: null,
              boundingBox: null,
              confidence: null,
              error: 'Failed to create canvas context',
            };
          }
          
          // Draw resized image
          // Convert HTMLImageElement/HTMLCanvasElement to IImage/ICanvas for abstraction
          if (image instanceof HTMLImageElement) {
            const webImage = new WebImage(image);
            ctx.drawImage(webImage, 0, 0, newWidth, newHeight);
          } else {
            const webCanvas = new WebCanvas(image);
            ctx.drawImage(webCanvas, 0, 0, newWidth, newHeight);
          }
          
          // Get native canvas for face-api.js
          createdCanvas = (canvas as WebCanvas).getNativeCanvas();
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

      // Scale bounding box to original dimensions
      const boundingBox = {
        x: detection.detection.box.x * scaleX,
        y: detection.detection.box.y * scaleY,
        width: detection.detection.box.width * scaleX,
        height: detection.detection.box.height * scaleY,
      };

      // Extract landmarks if available (scale to original dimensions)
      const landmarks: LandmarkPosition[] | undefined = detection.landmarks
        ? detection.landmarks.positions.map(pos => ({
            x: pos.x * scaleX,
            y: pos.y * scaleY,
          }))
        : undefined;

      // Validate face quality using shared validation
      const validationResult = validateFaceDetection(
        boundingBox,
        { width: originalWidth, height: originalHeight },
        landmarks,
        detection.detection.score,
        this.qualityConfig
      );

      if (!validationResult.isValid) {
        // Return first reason as error message (or combine all reasons)
        const errorMessage = validationResult.reasons.length > 0
          ? validationResult.reasons[0]
          : 'Face validation failed';
        
        return {
          descriptor: null,
          boundingBox: null,
          confidence: null,
          error: errorMessage,
        };
      }

      const result = {
        descriptor: Array.from(detection.descriptor),
        boundingBox,
        confidence: detection.detection.score,
        error: null,
      };

      // Explicitly dispose of TensorFlow.js tensors to free GPU memory
      try {
        tf.engine().startScope();
        tf.engine().endScope();
        tf.disposeVariables();
      } catch (e) {
        console.debug('[FaceDetection] Tensor cleanup:', e);
      }

      return result;
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
        // Use abstraction for cleanup
        const canvas = new WebCanvas(createdCanvas);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      // Resize image to reduce GPU memory usage (max 600px on longest side)
      // Reduced from 800px to minimize GPU memory usage
      const MAX_DIMENSION = 600;
      let input: HTMLImageElement | HTMLCanvasElement;
      
      if (image instanceof ImageData) {
        originalWidth = image.width;
        originalHeight = image.height;
        // Use abstraction to create canvas and put ImageData
        const canvas = imageProcessor.createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return {
            detections: [],
            error: 'Failed to create canvas context',
          };
        }
        ctx.putImageData(image, 0, 0);
        // Get native canvas for face-api.js
        createdCanvas = (canvas as WebCanvas).getNativeCanvas();
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

          // Use abstraction to create canvas and resize image
          const canvas = imageProcessor.createCanvas(newWidth, newHeight);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return {
              detections: [],
              error: 'Failed to create canvas context',
            };
          }
          
          // Draw resized image
          // Convert HTMLImageElement/HTMLCanvasElement to IImage/ICanvas for abstraction
          if (image instanceof HTMLImageElement) {
            const webImage = new WebImage(image);
            ctx.drawImage(webImage, 0, 0, newWidth, newHeight);
          } else {
            const webCanvas = new WebCanvas(image);
            ctx.drawImage(webCanvas, 0, 0, newWidth, newHeight);
          }
          
          // Get native canvas for face-api.js
          createdCanvas = (canvas as WebCanvas).getNativeCanvas();
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

      // Validate each detection using shared validation
      const validatedDetections = detections
        .map(detection => {
          // Scale bounding box to original dimensions
          const boundingBox = {
            x: detection.detection.box.x * scaleX,
            y: detection.detection.box.y * scaleY,
            width: detection.detection.box.width * scaleX,
            height: detection.detection.box.height * scaleY,
          };

          // Extract landmarks if available (scale to original dimensions)
          const landmarks: LandmarkPosition[] | undefined = detection.landmarks
            ? detection.landmarks.positions.map(pos => ({
                x: pos.x * scaleX,
                y: pos.y * scaleY,
              }))
            : undefined;

          // Validate face quality
          const validationResult = validateFaceDetection(
            boundingBox,
            { width: originalWidth, height: originalHeight },
            landmarks,
            detection.detection.score,
            this.qualityConfig
          );

          return {
            detection,
            boundingBox,
            validationResult,
          };
        })
        .filter(item => item.validationResult.isValid);

      const filteredCount = detections.length - validatedDetections.length;

      // Generate error message if no valid detections
      let errorMessage: string | null = null;
      if (validatedDetections.length === 0 && detections.length > 0) {
        // Get reasons from first invalid detection for error message
        const firstInvalid = detections
          .map(detection => {
            const boundingBox = {
              x: detection.detection.box.x * scaleX,
              y: detection.detection.box.y * scaleY,
              width: detection.detection.box.width * scaleX,
              height: detection.detection.box.height * scaleY,
            };
            const landmarks: LandmarkPosition[] | undefined = detection.landmarks
              ? detection.landmarks.positions.map(pos => ({
                  x: pos.x * scaleX,
                  y: pos.y * scaleY,
                }))
              : undefined;
            return validateFaceDetection(
              boundingBox,
              { width: originalWidth, height: originalHeight },
              landmarks,
              detection.detection.score,
              this.qualityConfig
            );
          })
          .find(v => !v.isValid);
        errorMessage = firstInvalid?.reasons[0] || 'Face(s) detected but validation failed';
      }

      // Extract data immediately and dispose of tensors to prevent GPU memory leak
      const result = {
        detections: validatedDetections.map(item => ({
          descriptor: Array.from(item.detection.descriptor),
          boundingBox: item.boundingBox,
          confidence: item.detection.detection.score,
          error: null,
        })),
        error: errorMessage,
        ...(filteredCount > 0 && {
          filteredCount,
          warning: `${filteredCount} face${filteredCount > 1 ? 's' : ''} could not be processed due to low resolution`,
        }),
      };

      // Explicitly dispose of TensorFlow.js tensors to free GPU memory
      // face-api.js creates tensors internally that need to be cleaned up
      try {
        // Force garbage collection by starting and ending a scope
        // This helps TensorFlow.js identify tensors that can be disposed
        tf.engine().startScope();
        tf.engine().endScope();
        // Note: face-api.js manages its own tensors, so we can't directly dispose them
        // The scope operations help trigger GC, and reducing image size (600px max) minimizes memory usage
      } catch (e) {
        // Ignore errors - this is best effort cleanup
        console.debug('[FaceDetection] Tensor cleanup:', e);
      }

      return result;
    } catch (err) {
      return {
        detections: [],
        error: err instanceof Error ? err.message : 'Detection failed',
      };
    } finally {
      // Clean up created canvas to free memory
      if (createdCanvas) {
        // Use abstraction for cleanup
        const canvas = new WebCanvas(createdCanvas);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
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
