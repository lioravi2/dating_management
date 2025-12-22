import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';

// Initialize TensorFlow.js with CPU backend (no native compilation needed)
// This uses the same TensorFlow.js library as the web app, ensuring same algorithm
let tfInitialized = false;
let modelsLoaded = false;
const MODEL_PATH = path.join(process.cwd(), 'public', 'models');

async function initializeTensorFlow() {
  if (tfInitialized) return;
  
  // Use CPU backend (pure JavaScript, no native compilation)
  // This ensures the same algorithm as the web app
  await tf.setBackend('cpu');
  await tf.ready();
  tfInitialized = true;
  console.log('[Face Detection] TensorFlow.js CPU backend initialized');
}

async function loadModels() {
  if (modelsLoaded) return;
  
  try {
    await initializeTensorFlow();
    
    // Load face-api.js models from file system
    // These are the same models used in the web app
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
    ]);
    
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
  try {
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
    await loadModels();

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
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Load image using canvas (Node.js compatible)
    const img = await loadImage(buffer);
    
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
    const detections = await faceapi
      .detectAllFaces(inputCanvas as any)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return NextResponse.json({
        detections: [],
        error: 'No faces detected',
      });
    }

    // Convert detections to response format (same structure as web app)
    const results = detections.map((detection) => {
      const box = detection.detection.box;
      return {
        descriptor: Array.from(detection.descriptor),
        boundingBox: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
        confidence: detection.detection.score,
      };
    });

    return NextResponse.json({
      detections: results,
    });
  } catch (error) {
    console.error('[Face Detection] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

