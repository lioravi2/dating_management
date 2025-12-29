import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

interface NoFaceDetectedModalProps {
  visible: boolean;
  onProceed: () => void;
  onCancel: () => void;
  partnerId?: string;
  loading?: boolean;
  errorMessage?: string;
}

export default function NoFaceDetectedModal({
  visible,
  onProceed,
  onCancel,
  partnerId,
  loading = false,
  errorMessage,
}: NoFaceDetectedModalProps) {
  const buttonText = partnerId ? 'Yes, Upload Photo' : 'Create New Partner';
  
  // Determine if this is a "face too small" error
  const isFaceTooSmall = errorMessage?.includes('too small') || errorMessage?.includes('minimum');
  
  // Set title and message based on error type
  const title = isFaceTooSmall ? 'Face Too Small' : 'No Face Detected';
  const defaultMessage = isFaceTooSmall 
    ? 'The face in this photo is too small to be accurately recognized. For best results, use a photo where the face is clearly visible and larger.'
    : 'We couldn\'t detect a face in this photo. The photo may not be clear enough, or there may be no face visible.';
  
  // Use the error message from API if provided, otherwise use default message
  const message = errorMessage && isFaceTooSmall ? errorMessage : defaultMessage;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            {message}
          </Text>
          <Text style={styles.question}>
            Do you want to upload this photo anyway?
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.cancelButton, loading && styles.buttonDisabled]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.buttonDisabled]}
              onPress={onProceed}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.createButtonText}>Creating...</Text>
                </View>
              ) : (
                <Text style={styles.createButtonText}>{buttonText}</Text>
              )}
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
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  question: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 24,
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
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    minWidth: 140,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

