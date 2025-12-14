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

        // Draw bounding box
        ctx.strokeStyle = isSelected ? '#10b981' : '#ef4444';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeRect(x, y, width, height);

        // Draw label
        ctx.fillStyle = isSelected ? '#10b981' : '#ef4444';
        ctx.font = '16px Arial';
        ctx.fillText(
          `Face ${index + 1}`,
          x,
          y - 5
        );
      });

      setImageLoaded(true);
    };

    img.onerror = () => {
      console.error('Failed to load image');
    };

    img.src = imageUrl;
  }, [imageUrl, detections, selectedIndex]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find which face was clicked
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
          Multiple faces detected. Please click on the face you want to upload.
        </p>

        <div className="relative mb-4">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="max-w-full h-auto border border-gray-300 rounded cursor-pointer"
            style={{ maxHeight: '70vh' }}
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
