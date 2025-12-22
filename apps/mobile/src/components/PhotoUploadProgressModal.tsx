import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

export type UploadStep = 
  | 'preparing'
  | 'detecting_faces'
  | 'analyzing_matches'
  | 'uploading'
  | 'complete';

interface PhotoUploadProgressModalProps {
  visible: boolean;
  currentStep: UploadStep;
  error?: string | null;
  onDismiss?: () => void;
}

const stepLabels: Record<UploadStep, string> = {
  preparing: 'Preparing image...',
  detecting_faces: 'Detecting faces...',
  analyzing_matches: 'Analyzing matches...',
  uploading: 'Uploading photo...',
  complete: 'Upload complete!',
};

export default function PhotoUploadProgressModal({
  visible,
  currentStep,
  error,
  onDismiss,
}: PhotoUploadProgressModalProps) {
  const steps: UploadStep[] = ['preparing', 'detecting_faces', 'analyzing_matches', 'uploading', 'complete'];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {error ? (
            <>
              <Text style={styles.title}>Upload Failed</Text>
              <Text style={styles.errorText}>{error}</Text>
              {onDismiss && (
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={onDismiss}
                >
                  <Text style={styles.dismissButtonText}>Close</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#dc2626" style={styles.spinner} />
              <Text style={styles.title}>Uploading Photo</Text>
              <Text style={styles.stepText}>{stepLabels[currentStep]}</Text>
              
              {/* Progress steps */}
              <View style={styles.stepsContainer}>
                {steps.slice(0, -1).map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  
                  return (
                    <View key={step} style={styles.stepRow}>
                      <View style={[
                        styles.stepIndicator,
                        isCompleted && styles.stepCompleted,
                        isCurrent && styles.stepCurrent,
                      ]}>
                        {isCompleted ? (
                          <Text style={styles.checkmark}>✓</Text>
                        ) : isCurrent ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <View style={styles.stepDot} />
                        )}
                      </View>
                      <Text style={[
                        styles.stepLabel,
                        isCompleted && styles.stepLabelCompleted,
                        isCurrent && styles.stepLabelCurrent,
                      ]}>
                        {stepLabels[step]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
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
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  stepsContainer: {
    width: '100%',
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCompleted: {
    backgroundColor: '#10b981',
  },
  stepCurrent: {
    backgroundColor: '#dc2626',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
  },
  stepLabelCompleted: {
    color: '#6b7280',
  },
  stepLabelCurrent: {
    color: '#111827',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  dismissButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    marginTop: 8,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

