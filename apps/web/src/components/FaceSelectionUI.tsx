'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FaceDetectionResult } from '@/lib/face-detection/types';
import { WebCanvas, WebImage } from '@/lib/image-processing/web-processor';
import { imageProcessor } from '@/lib/image-processing';

interface FaceSelectionUIProps {
  imageUrl: string;
  detections: FaceDetectionResult[];
  onSelect: (detection: FaceDetectionResult) => void;
  onCancel: () => void;
  warning?: string;
}

export function FaceSelectionUI({
  imageUrl,
  detections,
  onSelect,
  onCancel,
  warning,
}: FaceSelectionUIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const drawCanvasRef = useRef<(() => void) | null>(null);
  const imageLoadedRef = useRef<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [blinkOpacity, setBlinkOpacity] = useState(1);

  // Draw function that can be called without reloading the image
  // Defined early using useCallback so it can be used in effects
  // FIXED: Check imageRef.current instead of imageLoaded state to avoid async state issue
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    // Use ref instead of state to avoid async state update issue
    if (!canvas || !img || !imageLoadedRef.current) return;

    // Use abstraction for canvas operations
    const webCanvas = new WebCanvas(canvas);
    const ctx = webCanvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, webCanvas.width, webCanvas.height);

    // Draw image (from ref, no reload needed)
    // Convert HTMLImageElement to WebImage for abstraction
    const webImage = new WebImage(img);
    ctx.drawImage(webImage, 0, 0);

    // Calculate resolution-independent line width based on canvas dimensions
    // Use 1/100th of image width as base, with min/max bounds for visibility
    const baseLineWidth = Math.max(2, Math.min(8, webCanvas.width / 100));
    const selectedLineWidth = baseLineWidth * 1.2; // Slightly thicker for selected
    const outerStrokeWidth = baseLineWidth * 0.6; // Outer stroke for unselected
    const outerStrokeOffset = outerStrokeWidth;

    // Draw bounding boxes for all faces
    detections.forEach((detection, index) => {
      if (!detection.boundingBox) return;

      const { x, y, width, height } = detection.boundingBox;
      const isSelected = selectedIndex === index;
      const opacity = isSelected ? 1 : blinkOpacity;

      // Draw bounding box with resolution-independent line width
      ctx.strokeStyle = isSelected ? '#10b981' : `rgba(239, 68, 68, ${opacity})`;
      ctx.lineWidth = isSelected ? selectedLineWidth : baseLineWidth;
      ctx.strokeRect(x, y, width, height);

      // Draw a second outer stroke for even better visibility on mobile (only for unselected)
      if (!isSelected) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${opacity * 0.6})`;
        ctx.lineWidth = outerStrokeWidth;
        ctx.strokeRect(x - outerStrokeOffset, y - outerStrokeOffset, width + outerStrokeOffset * 2, height + outerStrokeOffset * 2);
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
  }, [imageLoaded, detections, selectedIndex, blinkOpacity]);

  // Store drawCanvas in ref so it can be called from image loading effect without dependency
  useEffect(() => {
    drawCanvasRef.current = drawCanvas;
  }, [drawCanvas]);

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

  // Load image only when imageUrl changes (not on every opacity change)
  // FIXED: Removed drawCanvas from dependency array to break circular dependency
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Store image in ref to avoid reloading
      imageRef.current = img;
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Set ref immediately (synchronous) so drawCanvas can use it
      imageLoadedRef.current = true;
      // Also update state for other effects that depend on it
      setImageLoaded(true);
      
      // Trigger initial draw using ref to avoid dependency
      // FIXED: Now imageLoadedRef.current is true, so drawCanvas won't return early
      // This breaks the circular dependency: image effect -> drawCanvas (via ref) -> imageLoaded -> drawCanvas recreation -> image effect
      if (drawCanvasRef.current) {
        drawCanvasRef.current();
      }
    };

    img.onerror = () => {
      console.error('Failed to load image');
    };

    img.src = imageUrl;

    return () => {
      // Reset image loaded ref on cleanup
      imageLoadedRef.current = false;
      // Cleanup: cancel any pending animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [imageUrl]); // Only depend on imageUrl, NOT drawCanvas - this breaks the circular dependency

  // Redraw canvas when detections, selectedIndex, or blinkOpacity changes
  // But NOT when imageUrl changes (that's handled by the image loading effect)
  useEffect(() => {
    if (!imageLoaded) return;

    // Cancel any pending animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use requestAnimationFrame for smooth rendering
    animationFrameRef.current = requestAnimationFrame(() => {
      drawCanvas();
      animationFrameRef.current = null;
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [imageLoaded, drawCanvas]); // Only depend on imageLoaded and drawCanvas (which already includes blinkOpacity)

  // Store handleCanvasInteraction in ref so touch handler can access latest version
  const interactionHandlerRef = useRef<((clientX: number, clientY: number) => void) | null>(null);

  const handleCanvasInteraction = useCallback((
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
  }, [detections]);

  // Update ref when handler changes
  useEffect(() => {
    interactionHandlerRef.current = handleCanvasInteraction;
  }, [handleCanvasInteraction]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasInteraction(e.clientX, e.clientY);
  };

  // Use ref-based touch handler to avoid passive event listener issue
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create non-passive touch handler that uses the latest interaction handler
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling/zooming
      if (e.touches.length > 0 && interactionHandlerRef.current) {
        const touch = e.touches[0];
        interactionHandlerRef.current(touch.clientX, touch.clientY);
      }
    };
    
    // Attach with passive: false to allow preventDefault
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
    };
  }, []); // Empty deps - interactionHandlerRef.current always has latest version

  const handleSelect = () => {
    if (selectedIndex !== null && detections[selectedIndex]) {
      onSelect(detections[selectedIndex]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold mb-4">Select a Face</h2>
        {warning && (
          <div className="mb-4 p-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">
            <p className="text-sm">{warning}</p>
          </div>
        )}
        <p className="text-gray-600 mb-4">
          Multiple faces detected. Please tap/click on the face you want to upload.
        </p>

        <div className="relative mb-4">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
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
