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
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    if (visible && imageUri) {
      Image.getSize(
        imageUri,
        (width, height) => {
          setImageDimensions({ width, height });
        },
        (error) => {
          console.error('Error getting image size:', error);
          // Fallback dimensions
          setImageDimensions({ width: 800, height: 600 });
        }
      );
    } else {
      setImageDimensions(null);
      setSelectedIndex(null);
    }
  }, [visible, imageUri]);

  const handleImagePress = (event: any) => {
    if (!imageDimensions) return;

    const { locationX, locationY } = event.nativeEvent;
    
    // Calculate which face was tapped based on bounding box
    const imageAspectRatio = imageDimensions.width / imageDimensions.height;
    const displayWidth = screenWidth - 48; // Account for padding
    const displayHeight = displayWidth / imageAspectRatio;
    
    const scaleX = imageDimensions.width / displayWidth;
    const scaleY = imageDimensions.height / displayHeight;

    const clickedX = locationX * scaleX;
    const clickedY = locationY * scaleY;

    // Find which face bounding box contains the click
    for (let i = 0; i < detections.length; i++) {
      const box = detections[i].boundingBox;
      if (
        clickedX >= box.x &&
        clickedX <= box.x + box.width &&
        clickedY >= box.y &&
        clickedY <= box.y + box.height
      ) {
        setSelectedIndex(i);
        return;
      }
    }
  };

  const handleSelect = () => {
    if (selectedIndex !== null) {
      onSelect(detections[selectedIndex]);
    }
  };

  if (!imageDimensions) {
    return null;
  }

  const imageAspectRatio = imageDimensions.width / imageDimensions.height;
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
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleImagePress}
              style={styles.imageContainer}
            >
              <Image
                source={{ uri: imageUri }}
                style={[styles.image, { width: displayWidth, height: displayHeight }]}
                resizeMode="contain"
              />
              {/* Draw bounding boxes */}
              {detections.map((detection, index) => {
                const isSelected = selectedIndex === index;
                const scaleX = displayWidth / imageDimensions.width;
                const scaleY = displayHeight / imageDimensions.height;
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.boundingBox,
                      {
                        left: detection.boundingBox.x * scaleX,
                        top: detection.boundingBox.y * scaleY,
                        width: detection.boundingBox.width * scaleX,
                        height: detection.boundingBox.height * scaleY,
                        borderColor: isSelected ? '#10b981' : '#ef4444',
                        borderWidth: isSelected ? 3 : 2,
                      },
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.selectedLabel}>
                        <Text style={styles.selectedLabelText}>Face {index + 1}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </TouchableOpacity>
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
  },
  image: {
    borderRadius: 8,
  },
  boundingBox: {
    position: 'absolute',
    borderRadius: 4,
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

