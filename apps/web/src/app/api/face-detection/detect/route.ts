import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import { createCanvas, loadImage, Image as CanvasImage, Canvas as CanvasClass, ImageData as CanvasImageData } from 'canvas';
import path from 'path';

// face-api.js bundles its own TensorFlow.js, but we need to ensure TensorFlow is initialized
// with the CPU backend before face-api.js tries to use it
let tfInitialized = false;
let modelsLoaded = false;
const MODEL_PATH = path.join(process.cwd(), 'public', 'models');

async function initializeTensorFlow() {
  if (tfInitialized) return;
  
  console.log('[Face Detection] Initializing TensorFlow.js CPU backend...');
  
  // CRITICAL: Monkey patch face-api.js FIRST, before any TensorFlow operations
  // This must be done first so face-api.js knows about Node.js canvas elements
  faceapi.env.monkeyPatch({ 
    Canvas: CanvasClass as any, 
    Image: CanvasImage as any,
    ImageData: CanvasImageData as any
  });
  console.log('[Face Detection] Monkey patched face-api.js for Node.js canvas (Canvas, Image, ImageData)');
  
  // Initialize TensorFlow.js CPU backend
  // This ensures TensorFlow is ready before face-api.js tries to use it
  // face-api.js will use this initialized TensorFlow instance
  console.log('[Face Detection] Setting CPU backend...');
  await tf.setBackend('cpu');
  console.log('[Face Detection] Backend set, waiting for ready...');
  await tf.ready();
  
  tfInitialized = true;
  console.log('[Face Detection] TensorFlow.js CPU backend initialized');
}

async function loadModels() {
  if (modelsLoaded) return;
  
  try {
    // Initialize TensorFlow FIRST (this also patches canvas)
    await initializeTensorFlow();
    
    // Now load face-api.js models
    // face-api.js will use the initialized TensorFlow instance
    console.log(`[Face Detection] Loading models from: ${MODEL_PATH}`);
    console.log('[Face Detection] Loading ssdMobilenetv1...');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
    console.log('[Face Detection] Loading faceLandmark68Net...');
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
    console.log('[Face Detection] Loading faceRecognitionNet...');
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
    console.log('[Face Detection] All models loaded from disk');
    
    modelsLoaded = true;
    console.log('[Face Detection] Models loaded successfully');
  } catch (error) {
    console.error('[Face Detection] Error loading models:', error);
    throw error;
  }
}

/**
 * Detect faces in an uploaded image
 * Returns face descriptors for matching
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log('[Face Detection] Request received');
    // Check authentication
    const authHeader = request.headers.get('authorization');
    let supabase;
    let user;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Mobile app sends Bearer token
      const accessToken = authHeader.substring(7);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
      
      const { data: { user: tokenUser }, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !tokenUser) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = tokenUser;
    } else {
      // Web app uses cookies
      supabase = createSupabaseRouteHandlerClient();
      const { data: { user: cookieUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !cookieUser) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = cookieUser;
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Load models if not already loaded
    const modelLoadStart = Date.now();
    await loadModels();
    const modelLoadDuration = Date.now() - modelLoadStart;
    console.log(`[Face Detection] Models loaded in ${(modelLoadDuration / 1000).toFixed(2)}s`);

    // Get image file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    console.log('[Face Detection] Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[Face Detection] File size: ${(buffer.length / 1024).toFixed(2)}KB`);

    // Load image using canvas (Node.js compatible)
    console.log('[Face Detection] Loading image...');
    const img = await loadImage(buffer);
    console.log(`[Face Detection] Image loaded: ${img.width}x${img.height}`);
    
    // Store original dimensions before any resizing
    const originalWidth = img.width;
    const originalHeight = img.height;
    
    // Create canvas and draw image
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Resize if too large (max 600px on longest side) - same as web app
    const MAX_DIMENSION = 600;
    let inputCanvas = canvas;
    
    if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
      const newWidth = Math.round(img.width * scale);
      const newHeight = Math.round(img.height * scale);
      
      const resizedCanvas = createCanvas(newWidth, newHeight);
      const resizedCtx = resizedCanvas.getContext('2d');
      resizedCtx.drawImage(img, 0, 0, newWidth, newHeight);
      inputCanvas = resizedCanvas;
    }

    // Detect all faces using face-api.js (same algorithm as web app)
    // The canvas package provides Node.js-compatible HTMLCanvasElement
    // face-api.js should work with it directly
    console.log('[Face Detection] Starting face detection...');
    const detectionStart = Date.now();
    const detections = await faceapi
      .detectAllFaces(inputCanvas as any)
      .withFaceLandmarks()
      .withFaceDescriptors();
    const detectionDuration = Date.now() - detectionStart;
    console.log(`[Face Detection] Detection completed in ${(detectionDuration / 1000).toFixed(2)}s`);
    console.log(`[Face Detection] Found ${detections.length} face(s)`);

    // Filter by confidence threshold (0.65 = 65% confidence) to reduce false positives
    // This helps filter out animal faces and other non-human detections
    // Lowered from 0.8 to 0.65 to allow valid human faces with glasses/angles while still filtering most animal faces
    // ssdMobilenetv1 can give relatively high scores to animal faces due to similar facial structure
    const MIN_CONFIDENCE = 0.65;
    const filteredDetections = detections.filter(detection => {
      const score = detection.detection.score;
      console.log(`[Face Detection] Detection confidence score: ${score.toFixed(3)}`);
      return score >= MIN_CONFIDENCE;
    });
    console.log(`[Face Detection] Filtered to ${filteredDetections.length} face(s) with confidence >= ${MIN_CONFIDENCE} (out of ${detections.length} total detections)`);

    // Scale bounding boxes back to original size if we resized
    // This ensures coordinates are in original image space (matching web app behavior)
    const inputWidth = inputCanvas.width;
    const inputHeight = inputCanvas.height;
    const scaleX = originalWidth / inputWidth;
    const scaleY = originalHeight / inputHeight;
    
    console.log(`[Face Detection] Scaling coordinates: input=${inputWidth}x${inputHeight}, original=${originalWidth}x${originalHeight}, scale=${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);

    // Filter by minimum face size (120px minimum dimension)
    const MIN_FACE_SIZE = 120;
    const sizeFilteredDetections = filteredDetections.filter(detection => {
      const box = detection.detection.box;
      // Scale to original image dimensions
      const faceWidth = box.width * scaleX;
      const faceHeight = box.height * scaleY;
      const minDimension = Math.min(faceWidth, faceHeight);
      
      console.log(`[Face Detection] Face size: ${faceWidth.toFixed(0)}x${faceHeight.toFixed(0)}px (min dimension: ${minDimension.toFixed(0)}px)`);
      
      if (minDimension < MIN_FACE_SIZE) {
        console.log(`[Face Detection] Face too small (${minDimension.toFixed(0)}px < ${MIN_FACE_SIZE}px), filtering out`);
        return false;
      }
      
      return true;
    });
    console.log(`[Face Detection] Filtered to ${sizeFilteredDetections.length} face(s) with size >= ${MIN_FACE_SIZE}px (out of ${filteredDetections.length} confidence-filtered detections)`);

    // Calculate how many faces were filtered due to size
    const filteredCount = filteredDetections.length - sizeFilteredDetections.length;

    if (sizeFilteredDetections.length === 0) {
      return NextResponse.json({
        detections: [],
        error: filteredDetections.length > 0 
          ? `Face(s) detected but too small (minimum ${MIN_FACE_SIZE}px required)`
          : 'No faces detected',
        details: filteredDetections.length > 0 
          ? `Face(s) detected but too small (minimum ${MIN_FACE_SIZE}px required)`
          : 'No faces detected',
      });
    }

    // Convert detections to response format (same structure as web app)
    const results = sizeFilteredDetections.map((detection) => {
      const box = detection.detection.box;
      return {
        descriptor: Array.from(detection.descriptor),
        boundingBox: {
          x: box.x * scaleX,
          y: box.y * scaleY,
          width: box.width * scaleX,
          height: box.height * scaleY,
        },
        confidence: detection.detection.score,
      };
    });

    const totalDuration = Date.now() - startTime;
    console.log(`[Face Detection] Total request time: ${(totalDuration / 1000).toFixed(2)}s`);
    
    return NextResponse.json({
      detections: results,
      ...(filteredCount > 0 && {
        filteredCount,
        warning: `${filteredCount} face${filteredCount > 1 ? 's' : ''} could not be processed due to low resolution`,
      }),
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[Face Detection] Error after ${(totalDuration / 1000).toFixed(2)}s:`, error);
    
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('[Face Detection] Error name:', error.name);
      console.error('[Face Detection] Error message:', error.message);
      console.error('[Face Detection] Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : undefined,
      },
      { status: 500 }
    );
  }
}

