import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { FaceMatch } from '@dating-app/shared';

interface DifferentPartnerWarningModalProps {
  visible: boolean;
  matches: FaceMatch[];
  onUploadAnyway: () => void;
  onCancel: () => void;
}

export default function DifferentPartnerWarningModal({
  visible,
  matches,
  onUploadAnyway,
  onCancel,
}: DifferentPartnerWarningModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Face Matches Another Partner</Text>
          <Text style={styles.message}>
            This photo matches photos from {matches.length} other partner{matches.length > 1 ? 's' : ''}. Are you sure you want to upload it to this partner?
          </Text>

          <ScrollView style={styles.matchesContainer}>
            {matches.map((match, index) => (
              <View key={match.photo_id} style={styles.matchItem}>
                <Text style={styles.matchName}>
                  {match.partner_name || 'Unknown Partner'}
                </Text>
                <Text style={styles.matchSimilarity}>
                  {Math.round(match.similarity * 100)}% match
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={onUploadAnyway}
            >
              <Text style={styles.uploadButtonText}>Upload Anyway</Text>
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
    maxHeight: '80%',
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
  matchesContainer: {
    maxHeight: 200,
    marginBottom: 24,
  },
  matchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  matchName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  matchSimilarity: {
    fontSize: 12,
    color: '#6b7280',
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
  uploadButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

