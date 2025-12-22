/**
 * Test script for face detection API endpoint
 * 
 * Usage:
 *   npm run test-face-detection <path-to-image>
 * 
 * Example:
 *   npm run test-face-detection ./test-image.jpg
 */

import * as fs from 'fs';
import * as path from 'path';
import * as FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

async function getAuthToken(): Promise<string> {
  // Try to get token from environment variable first
  const envToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Try to get token from dev sign-in endpoint
  try {
    console.log('🔐 Getting auth token from dev sign-in endpoint...');
    const devEmail = process.env.DEV_EMAIL || 'avilior@hotmail.com';
    const signInResponse = await fetch(`${API_URL}/api/auth/dev-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: devEmail }),
    });

    if (signInResponse.ok) {
      const signInData = await signInResponse.json();
      if (signInData.access_token) {
        console.log('✅ Got token from dev sign-in\n');
        return signInData.access_token;
      }
    }
  } catch (error) {
    console.log('⚠️  Could not get token from dev sign-in, trying manual token...\n');
  }

  // Fallback: require manual token
  throw new Error(
    'Please provide an access token:\n' +
    '  1. Set SUPABASE_ACCESS_TOKEN environment variable\n' +
    '  2. Or log in to the web app and get token from browser DevTools\n' +
    '  3. Or ensure dev sign-in endpoint is working'
  );
}

async function testFaceDetection(imagePath: string) {
  try {
    console.log(`\n🧪 Testing face detection endpoint...`);
    console.log(`   Image: ${imagePath}`);
    console.log(`   API URL: ${API_URL}\n`);

    // Check if image exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }

    // Get auth token
    const token = await getAuthToken();

    // Create FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));

    // Make request
    console.log('📤 Sending request to /api/face-detection/detect...');
    const response = await fetch(`${API_URL}/api/face-detection/detect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error response:');
      console.error(JSON.stringify(data, null, 2));
      return;
    }

    // Display results
    if (data.detections && data.detections.length > 0) {
      console.log(`✅ Face detection successful!`);
      console.log(`   Found ${data.detections.length} face(s)\n`);
      
      data.detections.forEach((detection: any, index: number) => {
        console.log(`   Face ${index + 1}:`);
        console.log(`   - Confidence: ${(detection.confidence * 100).toFixed(2)}%`);
        console.log(`   - Bounding box: x=${detection.boundingBox.x.toFixed(0)}, y=${detection.boundingBox.y.toFixed(0)}, width=${detection.boundingBox.width.toFixed(0)}, height=${detection.boundingBox.height.toFixed(0)}`);
        console.log(`   - Descriptor length: ${detection.descriptor.length} dimensions`);
        console.log(`   - First 5 descriptor values: [${detection.descriptor.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
        console.log('');
      });
    } else {
      console.log('⚠️  No faces detected');
      if (data.error) {
        console.log(`   Error: ${data.error}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Main
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: npm run test-face-detection <path-to-image>');
  console.error('Example: npm run test-face-detection ./test-image.jpg');
  process.exit(1);
}

testFaceDetection(imagePath);

