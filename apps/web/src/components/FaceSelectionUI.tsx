'use client';

import { useState, useRef, useEffect } from 'react';
import { FaceDetectionResult } from '@/lib/face-detection/types';

interface FaceSelectionUIProps {
  imageUrl: string;
  detections: FaceDetectionResult[];
  onSelect: (detection: FaceDetectionResult) => void;
  onCancel: () => void;
}

export function FaceSelectionUI({
  imageUrl,
  detections,
  onSelect,
  onCancel,
}: FaceSelectionUIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [blinkOpacity, setBlinkOpacity] = useState(1);

  // Blinking animation for unselected faces (better visibility on mobile)
  useEffect(() => {
    if (selectedIndex === null && detections.length > 0) {
      const interval = setInterval(() => {
        setBlinkOpacity(prev => prev === 1 ? 0.3 : 1);
      }, 600); // Blink every 600ms
      return () => clearInterval(interval);
    } else {
      setBlinkOpacity(1); // Full opacity when selected
    }
  }, [selectedIndex, detections.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes for all faces
      detections.forEach((detection, index) => {
        if (!detection.boundingBox) return;

        const { x, y, width, height } = detection.boundingBox;
        const isSelected = selectedIndex === index;
        const opacity = isSelected ? 1 : blinkOpacity;

        // Draw bounding box with thicker lines for better visibility (especially on mobile)
        ctx.strokeStyle = isSelected ? '#10b981' : `rgba(239, 68, 68, ${opacity})`;
        ctx.lineWidth = isSelected ? 6 : 5; // Increased from 4/2 to 6/5 for better visibility
        ctx.strokeRect(x, y, width, height);

        // Draw a second outer stroke for even better visibility on mobile (only for unselected)
        if (!isSelected) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${opacity * 0.6})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
        }

        // Draw label with background for better readability
        const labelText = `Face ${index + 1}`;
        ctx.font = 'bold 18px Arial'; // Increased font size
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 18;
        
        // Draw label background
        ctx.fillStyle = isSelected 
          ? 'rgba(16, 185, 129, 0.8)' 
          : `rgba(239, 68, 68, ${0.8 * opacity})`;
        ctx.fillRect(x, y - textHeight - 8, textWidth + 8, textHeight + 4);
        
        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, x + 4, y - 6);
      });

      setImageLoaded(true);
    };

    img.onerror = () => {
      console.error('Failed to load image');
    };

    img.src = imageUrl;
  }, [imageUrl, detections, selectedIndex, blinkOpacity]);

  const handleCanvasInteraction = (
    clientX: number,
    clientY: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Find which face was clicked/touched
    for (let i = 0; i < detections.length; i++) {
      const detection = detections[i];
      if (!detection.boundingBox) continue;

      const { x: bx, y: by, width, height } = detection.boundingBox;
      if (x >= bx && x <= bx + width && y >= by && y <= by + height) {
        setSelectedIndex(i);
        break;
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasInteraction(e.clientX, e.clientY);
  };

  const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling/zooming
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      handleCanvasInteraction(touch.clientX, touch.clientY);
    }
  };

  const handleSelect = () => {
    if (selectedIndex !== null && detections[selectedIndex]) {
      onSelect(detections[selectedIndex]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold mb-4">Select a Face</h2>
        <p className="text-gray-600 mb-4">
          Multiple faces detected. Please tap/click on the face you want to upload.
        </p>

        <div className="relative mb-4">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasTouch}
            className="max-w-full h-auto border border-gray-300 rounded cursor-pointer touch-none"
            style={{ maxHeight: '70vh', touchAction: 'none' }}
          />
        </div>

        <div className="flex gap-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={selectedIndex === null}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Select Face
          </button>
        </div>

        {selectedIndex !== null && (
          <p className="text-sm text-gray-600 mt-2">
            Selected: Face {selectedIndex + 1}
          </p>
        )}
      </div>
    </div>
  );
}
