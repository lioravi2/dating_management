import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Share,
} from 'react-native';

interface FaceDetection {
  descriptor: number[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

interface FaceSelectionModalProps {
  visible: boolean;
  imageUri: string;
  detections: FaceDetection[];
  onSelect: (detection: FaceDetection) => void;
  onCancel: () => void;
  warning?: string;
  imageDimensions?: { width: number; height: number };
}

export default function FaceSelectionModal({
  visible,
  imageUri,
  detections,
  onSelect,
  onCancel,
  warning,
  imageDimensions: providedImageDimensions,
}: FaceSelectionModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displayLayout, setDisplayLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [containerLayout, setContainerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageRef = useRef<Image>(null);
  const screenWidth = Dimensions.get('window').width;
  const blinkAnimations = useRef<Animated.Value[]>([]);
  const boxPositionsRef = useRef<Array<{ index: number; detection: any; displayed: any; scale: any }>>([]);
  
  // Initialize blink animations for each detection
  useEffect(() => {
    if (detections.length > 0 && blinkAnimations.current.length !== detections.length) {
      blinkAnimations.current = detections.map(() => new Animated.Value(1));
    }
  }, [detections.length]);
  
  // Start blinking animation for unselected boxes
  useEffect(() => {
    if (!visible) return;
    
    const animations: Animated.CompositeAnimation[] = [];
    
    detections.forEach((_, index) => {
      if (selectedIndex !== index && blinkAnimations.current[index]) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:62',message:'Starting blink animation',data:{index,detectionsCount:detections.length,selectedIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Add listener to track opacity changes
        const listener = blinkAnimations.current[index].addListener(({ value }) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:70',message:'Opacity animation value changed',data:{index,opacity:value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
        });
        
        const anim = Animated.loop(
          Animated.sequence([
            Animated.timing(blinkAnimations.current[index], {
              toValue: 0.3,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(blinkAnimations.current[index], {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
        anim.start();
        animations.push(anim);
      } else if (selectedIndex === index && blinkAnimations.current[index]) {
        // Stop blinking for selected box
        blinkAnimations.current[index].setValue(1);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:88',message:'Stopped blink animation (selected)',data:{index},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    });
    
    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [visible, selectedIndex, detections.length]);

  useEffect(() => {
    if (visible && imageUri) {
      // Reset box positions when modal opens
      boxPositionsRef.current = [];
      
      // Use provided dimensions if available, otherwise load them
      if (providedImageDimensions) {
        console.log('[FaceSelectionModal] Using provided image dimensions:', providedImageDimensions);
        setImageDimensions(providedImageDimensions);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:99',message:'Using provided image dimensions',data:{providedImageDimensions,detectionsCount:detections.length,detections:detections.map(d=>({boundingBox:d.boundingBox,confidence:d.confidence}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } else {
        console.log('[FaceSelectionModal] Loading image dimensions for:', imageUri);
        console.log('[FaceSelectionModal] Detections count:', detections.length);
        Image.getSize(
          imageUri,
          (width, height) => {
            console.log('[FaceSelectionModal] Image dimensions loaded:', width, height);
            setImageDimensions({ width, height });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:107',message:'Image dimensions loaded',data:{width,height,detectionsCount:detections.length,detections:detections.map(d=>({boundingBox:d.boundingBox,confidence:d.confidence}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
          },
          (error) => {
            console.error('[FaceSelectionModal] Error getting image size:', error);
            // Fallback dimensions
            setImageDimensions({ width: 800, height: 600 });
          }
        );
      }
    } else {
      setImageDimensions(null);
      setDisplayLayout(null);
      setSelectedIndex(null);
      boxPositionsRef.current = [];
    }
  }, [visible, imageUri, detections.length, providedImageDimensions]);

  const handleImageLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    console.log('[FaceSelectionModal] Image layout measured:', { x, y, width, height });
    setDisplayLayout({ x, y, width, height });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:127',message:'Image layout measured',data:{x,y,width,height,imageDimensions,detectionsCount:detections.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  };

  const handleImagePress = (event: any) => {
    if (!imageDimensions || !displayLayout) return;

    const { locationX, locationY } = event.nativeEvent;
    
    // API returns coordinates in original image space, so we scale directly from original to display
    // The displayed image uses resizeMode="contain", so it maintains aspect ratio
    const imageAspectRatio = imageDimensions.width / imageDimensions.height;
    const displayAspectRatio = displayLayout.width / displayLayout.height;
    
    let displayImageWidth: number;
    let displayImageHeight: number;
    let offsetX = 0;
    let offsetY = 0;
    
    if (imageAspectRatio > displayAspectRatio) {
      // Image is wider - fit to width
      displayImageWidth = displayLayout.width;
      displayImageHeight = displayLayout.width / imageAspectRatio;
      offsetY = (displayLayout.height - displayImageHeight) / 2;
    } else {
      // Image is taller - fit to height
      displayImageHeight = displayLayout.height;
      displayImageWidth = displayLayout.height * imageAspectRatio;
      offsetX = (displayLayout.width - displayImageWidth) / 2;
    }
    
    // Scale from original image coordinates to display coordinates
    const scaleX = displayImageWidth / imageDimensions.width;
    const scaleY = displayImageHeight / imageDimensions.height;
    
    // Adjust click coordinates relative to the displayed image (account for padding from resizeMode="contain")
    const clickedX = (locationX - offsetX) / scaleX;
    const clickedY = (locationY - offsetY) / scaleY;

    // Find which face bounding box contains the click
    for (let i = 0; i < detections.length; i++) {
      const box = detections[i].boundingBox;
      // Add generous padding for easier clicking (30% of box size)
      const paddingX = box.width * 0.3;
      const paddingY = box.height * 0.3;
      if (
        clickedX >= box.x - paddingX &&
        clickedX <= box.x + box.width + paddingX &&
        clickedY >= box.y - paddingY &&
        clickedY <= box.y + box.height + paddingY
      ) {
        setSelectedIndex(i);
        return;
      }
    }
  };

  const handleSelect = () => {
    console.log('[FaceSelectionModal] Select button pressed, selectedIndex:', selectedIndex);
    if (selectedIndex !== null && detections[selectedIndex]) {
      console.log('[FaceSelectionModal] Calling onSelect with detection:', {
        hasDescriptor: !!detections[selectedIndex].descriptor,
        descriptorLength: detections[selectedIndex].descriptor?.length,
        boundingBox: detections[selectedIndex].boundingBox,
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:194',message:'Face selected',data:{selectedIndex,boundingBox:detections[selectedIndex].boundingBox,imageDimensions,displayLayout,containerLayout},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      onSelect(detections[selectedIndex]);
    } else {
      console.warn('[FaceSelectionModal] Cannot select - selectedIndex is null or detection missing');
    }
  };

  const handleShareDebugInfo = async () => {
    try {
      const debugData = {
        timestamp: new Date().toISOString(),
        imageUri,
        imageDimensions,
        displayLayout,
        containerLayout,
        screenWidth,
        detections: detections.map((det, idx) => ({
          index: idx,
          detectionBoundingBox: det.boundingBox,
          confidence: det.confidence,
          displayedBox: boxPositionsRef.current[idx]?.displayed || null,
          scale: boxPositionsRef.current[idx]?.scale || null,
        })),
        selectedIndex,
        boxPositions: boxPositionsRef.current,
      };

      const debugText = `FACE SELECTION DEBUG DATA
=======================
Timestamp: ${debugData.timestamp}

IMAGE INFORMATION
-----------------
Image URI: ${debugData.imageUri}
Image Dimensions: ${JSON.stringify(debugData.imageDimensions, null, 2)}
Display Layout: ${JSON.stringify(debugData.displayLayout, null, 2)}
Container Layout: ${JSON.stringify(debugData.containerLayout, null, 2)}
Screen Width: ${debugData.screenWidth}

DETECTIONS (${debugData.detections.length} faces)
-----------------
${debugData.detections.map((det, idx) => `
Face ${idx + 1}:
  Detection Bounding Box (original image coordinates):
    x: ${det.detectionBoundingBox.x}
    y: ${det.detectionBoundingBox.y}
    width: ${det.detectionBoundingBox.width}
    height: ${det.detectionBoundingBox.height}
    confidence: ${det.confidence}
  
  Displayed Rectangle (screen coordinates):
    left: ${det.displayedBox?.left ?? 'N/A'}
    top: ${det.displayedBox?.top ?? 'N/A'}
    width: ${det.displayedBox?.width ?? 'N/A'}
    height: ${det.displayedBox?.height ?? 'N/A'}
  
  Scale Factors:
    scaleX: ${det.scale?.scaleX ?? 'N/A'}
    scaleY: ${det.scale?.scaleY ?? 'N/A'}
    displayImageWidth: ${det.scale?.displayImageWidth ?? 'N/A'}
    displayImageHeight: ${det.scale?.displayImageHeight ?? 'N/A'}
  
  Calculation:
    detectionXInImageComponent = detection.x (${det.detectionBoundingBox.x}) * imageComponentScaleX (${det.scale?.scaleX ?? 'N/A'}) = ${(det.detectionBoundingBox.x * (det.scale?.scaleX ?? 0)).toFixed(2)}
    boxLeft = displayLayout.x (${debugData.displayLayout?.x ?? 'N/A'}) + detectionXInImageComponent = ${det.displayedBox?.left ?? 'N/A'}
    boxTop = displayLayout.y (${debugData.displayLayout?.y ?? 'N/A'}) + detectionYInImageComponent = ${det.displayedBox?.top ?? 'N/A'}
`).join('\n')}

SELECTED FACE
-------------
Selected Index: ${debugData.selectedIndex ?? 'None'}

FULL JSON DATA
--------------
${JSON.stringify(debugData, null, 2)}
`;

      await Share.share({
        message: debugText,
        title: 'Face Selection Debug Data',
      });
    } catch (error) {
      console.error('[FaceSelectionModal] Error sharing debug info:', error);
    }
  };

  // Use fallback dimensions if not yet loaded
  const effectiveDimensions = imageDimensions || { width: 800, height: 600 };

  const imageAspectRatio = effectiveDimensions.width / effectiveDimensions.height;
  const displayWidth = screenWidth - 48;
  const displayHeight = displayWidth / imageAspectRatio;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Select a Face</Text>
          {warning && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          )}
          <Text style={styles.subtitle}>
            Multiple faces detected. Tap on the face you want to upload.
          </Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View 
              style={[styles.imageContainer, { overflow: 'visible' }]}
              onStartShouldSetResponder={() => true}
              onLayout={(event) => {
                // Also measure the container layout for reference
                const { x, y, width, height } = event.nativeEvent.layout;
                console.log('[FaceSelectionModal] Container layout:', { x, y, width, height });
                setContainerLayout({ x, y, width, height });
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:233',message:'Container layout measured',data:{x,y,width,height,imageDimensions,displayLayout},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
              }}
              collapsable={false}
            >
              <Image
                ref={imageRef}
                source={{ uri: imageUri }}
                style={[styles.image, { width: displayWidth, height: displayHeight, zIndex: 0 }]}
                resizeMode="contain"
                onLayout={handleImageLayout}
              />
              {/* Render boxes in a separate overlay layer above the image */}
              {/* FIXED: Position overlay at container origin (0,0) and adjust box coordinates to account for displayLayout offset */}
              <View 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 10,
                  elevation: 10,
                  pointerEvents: 'box-none', // Allow touches to pass through to boxes
                  overflow: 'visible', // Allow boxes to extend beyond container
                }}
                onLayout={(event) => {
                  const { x, y, width, height } = event.nativeEvent.layout;
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:361',message:'Overlay View layout measured',data:{x,y,width,height,containerLayout,displayLayout},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                }}
              >
                {/* Draw bounding boxes - show even before layout is measured using fallback values */}
              {detections && detections.length > 0 && detections.map((detection, index) => {
                // Log once per render cycle
                if (index === 0) {
                  console.log('[FaceSelectionModal] Starting to render boxes:', {
                    detectionsCount: detections.length,
                    displayLayout,
                    containerLayout,
                    imageDimensions,
                  });
                }
                  // Validate detection has required properties
                  if (!detection || !detection.boundingBox || !detection.descriptor) {
                    console.warn(`[FaceSelectionModal] Invalid detection at index ${index}:`, detection);
                    return null;
                  }
                  console.log(`[FaceSelectionModal] Processing detection ${index}:`, detection.boundingBox);
                const isSelected = selectedIndex === index;
                const blinkAnim = blinkAnimations.current[index] || new Animated.Value(1);
                
                // Calculate box position and size
                // Always use displayLayout calculations if available, otherwise use fallback
                let boxLeft: number;
                let boxTop: number;
                let boxWidth: number;
                let boxHeight: number;
                
                if (displayLayout && imageDimensions && containerLayout) {
                  // FIXED: Account for image extending beyond container with proper coordinate transformation
                  // When resizeMode="contain", React Native scales the image to fit while maintaining aspect ratio
                  // The Image component's bounds (displayLayout) can extend beyond the container
                  // We need to map detection coordinates from original image space to container space
                  
                  // Step 1: Scale from original image to Image component space
                  // The Image component is the full scaled image (may extend beyond container)
                  const imageComponentScaleX = displayLayout.width / imageDimensions.width;
                  const imageComponentScaleY = displayLayout.height / imageDimensions.height;
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:398',message:'Scale calculation (Step 1)',data:{index,imageDimensions,displayLayout,imageComponentScaleX,imageComponentScaleY,imageAspectRatio:(imageDimensions.width/imageDimensions.height).toFixed(4),displayAspectRatio:(displayLayout.width/displayLayout.height).toFixed(4)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                  
                  // Step 2: Calculate detection position in Image component space
                  const detectionXInImageComponent = detection.boundingBox.x * imageComponentScaleX;
                  const detectionYInImageComponent = detection.boundingBox.y * imageComponentScaleY;
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:404',message:'Detection position in image component (Step 2)',data:{index,detectionBoundingBox:detection.boundingBox,detectionXInImageComponent,detectionYInImageComponent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                  
                  // Step 3: Transform from Image component space to container space
                  // FIXED: Overlay is positioned at container origin (0,0), so we need to add displayLayout offset
                  // to convert from Image component space to container space
                  boxLeft = displayLayout.x + detectionXInImageComponent;
                  boxTop = displayLayout.y + detectionYInImageComponent;
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:411',message:'Container space transformation (Step 3)',data:{index,displayLayout,containerLayout,detectionXInImageComponent,detectionYInImageComponent,boxLeft,boxTop,displayLayoutX:displayLayout.x,displayLayoutY:displayLayout.y},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
                  
                  // Step 4: Scale box dimensions using Image component scale (same as position)
                  boxWidth = detection.boundingBox.width * imageComponentScaleX;
                  boxHeight = detection.boundingBox.height * imageComponentScaleY;
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:415',message:'Box dimensions (Step 4)',data:{index,detectionWidth:detection.boundingBox.width,detectionHeight:detection.boundingBox.height,boxWidth,boxHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                  
                  // For debug: calculate visible content info
                  const visibleContentWidth = Math.min(displayLayout.width, containerLayout.width);
                  const visibleContentHeight = Math.min(displayLayout.height, containerLayout.height);
                  
                  // Store box position data for sharing
                  // boxLeft/boxTop are already container-relative
                  boxPositionsRef.current[index] = {
                    index,
                    detection: {
                      boundingBox: detection.boundingBox,
                      confidence: detection.confidence,
                    },
                    displayed: {
                      left: boxLeft, // Container-relative
                      top: boxTop,   // Container-relative
                      width: boxWidth,
                      height: boxHeight,
                    },
                    scale: {
                      scaleX: imageComponentScaleX,
                      scaleY: imageComponentScaleY,
                      visibleContentWidth,
                      visibleContentHeight,
                      displayImageWidth: displayLayout.width,
                      displayImageHeight: displayLayout.height,
                    },
                  };
                  
                  console.log(`[FaceSelectionModal] Box ${index} calculated:`, {
                    detection: detection.boundingBox,
                    displayLayout,
                    containerLayout,
                    imageDimensions,
                    imageComponentScaleX,
                    imageComponentScaleY,
                    detectionXInImageComponent,
                    detectionYInImageComponent,
                    visibleContentWidth,
                    visibleContentHeight,
                    boxLeft,
                    boxTop,
                    boxWidth,
                    boxHeight,
                    calculation: {
                      'detection.x * imageComponentScaleX': detection.boundingBox.x * imageComponentScaleX,
                      'displayLayout.x': displayLayout.x,
                      'final boxLeft': boxLeft,
                    },
                  });
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:414',message:'Box position calculated',data:{index,detectionBoundingBox:detection.boundingBox,displayLayout,containerLayout,imageDimensions,imageComponentScaleX,imageComponentScaleY,detectionXInImageComponent,detectionYInImageComponent,boxLeft,boxTop,boxWidth,boxHeight,calculation:{'detection.x':detection.boundingBox.x,'scaleX':imageComponentScaleX,'detectionXInImage':detectionXInImageComponent,'displayLayout.x':displayLayout.x,'finalBoxLeft':boxLeft}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
                } else {
                  console.log(`[FaceSelectionModal] Box ${index} - using fallback calculation`);
                  // Fallback: assume image fills container (no padding)
                  // This is approximate but ensures boxes are visible
                  // API returns coordinates in original image space, so scale directly to display
                  const effectiveDimensions = imageDimensions || { width: 800, height: 600 };
                  
                  const fallbackScaleX = displayWidth / effectiveDimensions.width;
                  const fallbackScaleY = displayHeight / effectiveDimensions.height;
                  boxLeft = detection.boundingBox.x * fallbackScaleX;
                  boxTop = detection.boundingBox.y * fallbackScaleY;
                  boxWidth = detection.boundingBox.width * fallbackScaleX;
                  boxHeight = detection.boundingBox.height * fallbackScaleY;
                  
                  // Store box position data for sharing (fallback)
                  boxPositionsRef.current[index] = {
                    index,
                    detection: {
                      boundingBox: detection.boundingBox,
                      confidence: detection.confidence,
                    },
                    displayed: {
                      left: boxLeft,
                      top: boxTop,
                      width: boxWidth,
                      height: boxHeight,
                    },
                    scale: {
                      scaleX: fallbackScaleX,
                      scaleY: fallbackScaleY,
                      displayImageWidth: displayWidth,
                      displayImageHeight: displayHeight,
                    },
                  };
                  
                  console.log(`[FaceSelectionModal] Box ${index} fallback calculated:`, {
                    detection: detection.boundingBox,
                    fallbackScaleX,
                    fallbackScaleY,
                    boxLeft,
                    boxTop,
                    boxWidth,
                    boxHeight,
                  });
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:332',message:'Box position calculated (fallback)',data:{index,detectionBoundingBox:detection.boundingBox,effectiveDimensions,fallbackScaleX,fallbackScaleY,boxLeft,boxTop,boxWidth,boxHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
                }
                
                // Only show red box if not selected, green box replaces it when selected
                // Debug: Log if boxes would be visible
                const containerWidth = displayLayout?.width || displayWidth;
                const containerHeight = displayLayout?.height || displayHeight;
                const isVisible = boxLeft >= -50 && boxTop >= -50 && 
                                 boxLeft < containerWidth + 50 && 
                                 boxTop < containerHeight + 50;
                if (!isVisible) {
                  console.warn(`[FaceSelectionModal] Box ${index} is outside visible area:`, {
                    boxLeft,
                    boxTop,
                    boxWidth,
                    boxHeight,
                    containerWidth,
                    containerHeight,
                    displayLayout,
                  });
                }
                
                // Force render even if outside bounds for debugging
                console.log(`[FaceSelectionModal] Rendering box ${index} at:`, { boxLeft, boxTop, boxWidth, boxHeight, containerLayout });
                
                return (
                  <View key={`box-${index}`} collapsable={false}>
                    {!isSelected && (
                      <>
                        {/* Animated box with blinking effect - animate borderColor alpha instead of opacity to avoid rendering artifacts */}
                        <Animated.View
                          style={[
                            styles.boundingBox,
                            {
                              left: boxLeft,
                              top: boxTop,
                              width: boxWidth,
                              height: boxHeight,
                              borderColor: blinkAnim.interpolate({
                                inputRange: [0.3, 1],
                                outputRange: ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 1)'],
                              }),
                              borderWidth: 3,
                              backgroundColor: 'transparent',
                              opacity: 1, // Keep opacity at 1, animate borderColor instead
                              elevation: 20,
                            },
                          ]}
                          pointerEvents="none"
                        />
                        {/* Label outside box */}
                        <View
                          style={{
                            position: 'absolute',
                            left: boxLeft,
                            top: boxTop - 24,
                            zIndex: 100,
                            elevation: 100,
                          }}
                          pointerEvents="none"
                        >
                          <Text style={styles.unselectedLabelText}>{index + 1}</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            console.log(`[FaceSelectionModal] Face ${index + 1} selected`);
                            setSelectedIndex(index);
                          }}
                          style={[
                            styles.boundingBoxTouchable,
                            {
                              left: boxLeft - boxWidth * 0.3, // Expand clickable area by 30%
                              top: boxTop - boxHeight * 0.3,
                              width: boxWidth * 1.6, // 160% width for easier clicking
                              height: boxHeight * 1.6, // 160% height for easier clicking
                            },
                          ]}
                        />
                      </>
                    )}
                    {isSelected && (
                      <>
                        {/* Green border box - use View instead of TouchableOpacity to avoid visual artifacts */}
                        <View
                          style={[
                            styles.boundingBox,
                            {
                              left: boxLeft,
                              top: boxTop,
                              width: boxWidth,
                              height: boxHeight,
                              borderColor: '#10b981',
                              borderWidth: 3,
                              elevation: 20,
                              zIndex: 21,
                              backgroundColor: 'transparent',
                            },
                          ]}
                          pointerEvents="none"
                          onLayout={(event) => {
                            const { x, y, width, height } = event.nativeEvent.layout;
                            // #region agent log
                            fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FaceSelectionModal.tsx:597',message:'Selected bounding box layout measured',data:{index,calculated:{boxLeft,boxTop,boxWidth,boxHeight},actualLayout:{x,y,width,height}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                            // #endregion
                          }}
                        />
                        {/* Touchable area for selection - larger than box for easier clicking */}
                        <TouchableOpacity
                          activeOpacity={1.0}
                          android_ripple={null}
                          onPress={() => {
                            console.log(`[FaceSelectionModal] Face ${index + 1} selected`);
                            setSelectedIndex(index);
                          }}
                          style={[
                            styles.boundingBoxTouchable,
                            {
                              left: boxLeft - boxWidth * 0.3,
                              top: boxTop - boxHeight * 0.3,
                              width: boxWidth * 1.6,
                              height: boxHeight * 1.6,
                            },
                          ]}
                        />
                        {/* Label outside box to prevent overlap */}
                        <View
                          style={{
                            position: 'absolute',
                            left: boxLeft,
                            top: boxTop - 24,
                            zIndex: 100,
                            elevation: 100,
                          }}
                          pointerEvents="none"
                        >
                          <View style={styles.selectedLabel}>
                            <Text style={styles.selectedLabelText}>{index + 1}</Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
              </View>
            </View>
          </ScrollView>

          {selectedIndex !== null && (
            <Text style={styles.selectedText}>
              Selected: {selectedIndex + 1}
            </Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleShareDebugInfo}
            >
              <Text style={styles.debugButtonText}>Share Debug</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.selectButton,
                selectedIndex === null && styles.selectButtonDisabled,
              ]}
              onPress={handleSelect}
              disabled={selectedIndex === null}
            >
              <Text style={styles.selectButtonText}>Select Face</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200, // Ensure container has minimum height
    backgroundColor: 'transparent', // Ensure container is transparent
    overflow: 'visible', // Ensure boxes can be visible outside bounds
  },
  image: {
    borderRadius: 8,
    zIndex: 1, // Image should be below bounding boxes
  },
  boundingBox: {
    position: 'absolute',
    borderRadius: 0, // No border radius to avoid rendering artifacts
    backgroundColor: 'transparent',
    zIndex: 20,
    elevation: 20, // Android - higher than image
    pointerEvents: 'none', // Don't block touches on the box itself
  },
  boundingBoxTouchable: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 25, // Higher than bounding box so it's clickable
    elevation: 25, // Android
    borderWidth: 0,
    borderRadius: 0,
  },
  selectedLabel: {
    position: 'absolute',
    top: -24,
    left: 0,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  selectedLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unselectedLabelText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  debugButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  debugButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  selectButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  selectButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningContainer: {
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
    marginBottom: 16,
  },
  warningText: {
    color: '#92400e',
    fontSize: 14,
  },
});

