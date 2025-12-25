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
}

export default function FaceSelectionModal({
  visible,
  imageUri,
  detections,
  onSelect,
  onCancel,
}: FaceSelectionModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displayLayout, setDisplayLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [containerLayout, setContainerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageRef = useRef<Image>(null);
  const screenWidth = Dimensions.get('window').width;
  const blinkAnimations = useRef<Animated.Value[]>([]);
  
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
      }
    });
    
    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [visible, selectedIndex, detections.length]);

  useEffect(() => {
    if (visible && imageUri) {
      console.log('[FaceSelectionModal] Loading image dimensions for:', imageUri);
      console.log('[FaceSelectionModal] Detections count:', detections.length);
      Image.getSize(
        imageUri,
        (width, height) => {
          console.log('[FaceSelectionModal] Image dimensions loaded:', width, height);
          setImageDimensions({ width, height });
        },
        (error) => {
          console.error('[FaceSelectionModal] Error getting image size:', error);
          // Fallback dimensions
          setImageDimensions({ width: 800, height: 600 });
        }
      );
    } else {
      setImageDimensions(null);
      setDisplayLayout(null);
      setSelectedIndex(null);
    }
  }, [visible, imageUri, detections.length]);

  const handleImageLayout = (event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    console.log('[FaceSelectionModal] Image layout measured:', { x, y, width, height });
    setDisplayLayout({ x, y, width, height });
  };

  const handleImagePress = (event: any) => {
    if (!imageDimensions || !displayLayout) return;

    const { locationX, locationY } = event.nativeEvent;
    
    // The server resizes images to max 600px before detection
    // We need to scale bounding boxes from detection size to display size
    const MAX_DETECTION_DIMENSION = 600;
    const detectionWidth = Math.min(imageDimensions.width, MAX_DETECTION_DIMENSION);
    const detectionHeight = Math.min(imageDimensions.height, MAX_DETECTION_DIMENSION);
    
    // Calculate scale factors from detection image to displayed image
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
    
    // Scale from detection coordinates to display coordinates
    const scaleX = displayImageWidth / detectionWidth;
    const scaleY = displayImageHeight / detectionHeight;
    
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
      onSelect(detections[selectedIndex]);
    } else {
      console.warn('[FaceSelectionModal] Cannot select - selectedIndex is null or detection missing');
    }
  };

  // The server resizes images to max 600px before detection
  const MAX_DETECTION_DIMENSION = 600;
  
  // Use fallback dimensions if not yet loaded
  const effectiveDimensions = imageDimensions || { width: 800, height: 600 };
  const detectionWidth = Math.min(effectiveDimensions.width, MAX_DETECTION_DIMENSION);
  const detectionHeight = Math.min(effectiveDimensions.height, MAX_DETECTION_DIMENSION);

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
                }}
              >
                {/* Test box to verify rendering works - should appear in top-left corner */}
                {detections && detections.length > 0 && (
                  <>
                    <View
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: 10,
                        width: 50,
                        height: 50,
                        backgroundColor: 'red',
                        borderWidth: 3,
                        borderColor: 'yellow',
                        zIndex: 100,
                        elevation: 100,
                      }}
                    />
                    {/* Test box at calculated position for first detection */}
                    {containerLayout && detections[0] && (
                      <View
                        style={{
                          position: 'absolute',
                          left: containerLayout.width / 2 - 25,
                          top: containerLayout.height / 2 - 25,
                          width: 50,
                          height: 50,
                          backgroundColor: 'blue',
                          borderWidth: 3,
                          borderColor: 'cyan',
                          zIndex: 100,
                          elevation: 100,
                        }}
                      />
                    )}
                  </>
                )}
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
                
                if (displayLayout && containerLayout && imageDimensions) {
                  // Use accurate calculations with layout measurements
                  // The detection was done on a resized image (max 600px), so we need to scale from detection size to display size
                  const MAX_DETECTION_DIMENSION = 600;
                  
                  // Calculate the detection image dimensions (server resizes to max 600px)
                  const detectionWidth = Math.min(imageDimensions.width, MAX_DETECTION_DIMENSION);
                  const detectionHeight = Math.min(imageDimensions.height, MAX_DETECTION_DIMENSION);
                  
                  const detectionAspectRatio = imageDimensions.width / imageDimensions.height;
                  
                  // Use container dimensions (the actual visible area), not image layout dimensions
                  const containerAspectRatio = containerLayout.width / containerLayout.height;
                  
                  let displayImageWidth: number;
                  let displayImageHeight: number;
                  let offsetX = 0;
                  let offsetY = 0;
                  
                  if (detectionAspectRatio > containerAspectRatio) {
                    // Image is wider - fit to container width
                    displayImageWidth = containerLayout.width;
                    displayImageHeight = containerLayout.width / detectionAspectRatio;
                    offsetY = (containerLayout.height - displayImageHeight) / 2;
                  } else {
                    // Image is taller - fit to container height
                    displayImageHeight = containerLayout.height;
                    displayImageWidth = containerLayout.height * detectionAspectRatio;
                    offsetX = (containerLayout.width - displayImageWidth) / 2;
                  }
                  
                  // Scale from detection coordinates (600px max) to display coordinates
                  const scaleX = displayImageWidth / detectionWidth;
                  const scaleY = displayImageHeight / detectionHeight;
                  
                  // Position boxes relative to the container (which is at 0,0 relative to itself)
                  // With resizeMode="contain", the actual image is centered within the container
                  // offsetX/offsetY calculate where the image content starts within the container
                  // The Image component may extend beyond the container (displayLayout.x can be negative)
                  // but the actual displayed image is still positioned at offsetX/offsetY
                  
                  // The displayed image starts at offsetX/offsetY within the container
                  // We don't need to account for displayLayout.x/y because offsetX/offsetY already
                  // account for the image being centered within the container
                  boxLeft = offsetX + detection.boundingBox.x * scaleX;
                  boxTop = offsetY + detection.boundingBox.y * scaleY;
                  boxWidth = detection.boundingBox.width * scaleX;
                  boxHeight = detection.boundingBox.height * scaleY;
                  
                  console.log(`[FaceSelectionModal] Box ${index} calculated:`, {
                    detection: detection.boundingBox,
                    displayLayout,
                    containerLayout,
                    imageDimensions,
                    detectionWidth,
                    detectionHeight,
                    displayImageWidth,
                    displayImageHeight,
                    scaleX,
                    scaleY,
                    offsetX,
                    offsetY,
                    boxLeft,
                    boxTop,
                    boxWidth,
                    boxHeight,
                    // Debug: show the calculation breakdown
                    calculation: {
                      'detection.x * scaleX': detection.boundingBox.x * scaleX,
                      'offsetX': offsetX,
                      'final boxLeft': boxLeft,
                    },
                  });
                } else {
                  console.log(`[FaceSelectionModal] Box ${index} - using fallback calculation`);
                  // Fallback: assume image fills container (no padding)
                  // This is approximate but ensures boxes are visible
                  const MAX_DETECTION_DIMENSION = 600;
                  const effectiveDimensions = imageDimensions || { width: 800, height: 600 };
                  const detectionWidth = Math.min(effectiveDimensions.width, MAX_DETECTION_DIMENSION);
                  const detectionHeight = Math.min(effectiveDimensions.height, MAX_DETECTION_DIMENSION);
                  
                  const fallbackScaleX = displayWidth / detectionWidth;
                  const fallbackScaleY = displayHeight / detectionHeight;
                  boxLeft = detection.boundingBox.x * fallbackScaleX;
                  boxTop = detection.boundingBox.y * fallbackScaleY;
                  boxWidth = detection.boundingBox.width * fallbackScaleX;
                  boxHeight = detection.boundingBox.height * fallbackScaleY;
                  
                  console.log(`[FaceSelectionModal] Box ${index} fallback calculated:`, {
                    detection: detection.boundingBox,
                    fallbackScaleX,
                    fallbackScaleY,
                    boxLeft,
                    boxTop,
                    boxWidth,
                    boxHeight,
                  });
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
                        {/* Static box for debugging - always visible, no animation */}
                        <View
                          style={{
                            position: 'absolute',
                            left: boxLeft,
                            top: boxTop,
                            width: Math.max(boxWidth, 20),
                            height: Math.max(boxHeight, 20),
                            borderColor: '#ff0000',
                            borderWidth: 8,
                            backgroundColor: 'rgba(255, 0, 0, 0.5)',
                            borderRadius: 4,
                            zIndex: 100,
                            elevation: 100,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          pointerEvents="none"
                        >
                          <Text style={{ 
                            color: 'white', 
                            fontSize: 20, 
                            fontWeight: 'bold', 
                            backgroundColor: 'red', 
                            padding: 8,
                            borderRadius: 4,
                          }}>
                            {index + 1}
                          </Text>
                        </View>
                        {/* Animated box (original) */}
                        <Animated.View
                          style={[
                            styles.boundingBox,
                            {
                              left: boxLeft,
                              top: boxTop,
                              width: Math.max(boxWidth, 20), // Ensure minimum width
                              height: Math.max(boxHeight, 20), // Ensure minimum height
                              borderColor: '#ef4444',
                              borderWidth: 5, // Increased for visibility
                              opacity: blinkAnim,
                              elevation: 20, // Android - higher than image
                              shadowColor: '#ef4444', // iOS shadow
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 1.0,
                              shadowRadius: 6,
                              backgroundColor: 'rgba(239, 68, 68, 0.5)', // More visible red background
                            },
                          ]}
                          pointerEvents="none"
                        />
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
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setSelectedIndex(index)}
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
                          },
                        ]}
                      >
                        <View style={styles.selectedLabel}>
                          <Text style={styles.selectedLabelText}>Face {index + 1}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              </View>
            </View>
          </ScrollView>

          {selectedIndex !== null && (
            <Text style={styles.selectedText}>
              Selected: Face {selectedIndex + 1}
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
    borderRadius: 4,
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
});

