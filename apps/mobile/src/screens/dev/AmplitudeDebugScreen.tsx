/**
 * Amplitude Debug Screen
 * Displays Amplitude analytics debug information and allows testing events
 */

import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  Share,
  ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { 
  getAmplitudeStatus, 
  getRecentLogs, 
  formatAmplitudeDebugInfo,
  trackTestEvent,
  isAmplitudeInitialized
} from '../../lib/analytics';

export default function AmplitudeDebugScreen() {
  const navigation = useNavigation();
  const [status, setStatus] = useState<ReturnType<typeof getAmplitudeStatus> | null>(null);
  const [logs, setLogs] = useState<ReturnType<typeof getRecentLogs>>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDebugInfo = () => {
    setRefreshing(true);
    try {
      const currentStatus = getAmplitudeStatus();
      const recentLogs = getRecentLogs(100);
      setStatus(currentStatus);
      setLogs(recentLogs);
    } catch (error) {
      console.error('[AmplitudeDebug] Error loading debug info:', error);
      Alert.alert('Error', 'Failed to load debug information');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDebugInfo();
    // Refresh every 2 seconds to show new logs
    const interval = setInterval(loadDebugInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleTestEvent = async () => {
    setLoading(true);
    try {
      trackTestEvent('Manual test from debug screen');
      Alert.alert(
        'Test Event Sent',
        'A test event has been tracked. Check the logs below to see if it was sent successfully.',
        [{ text: 'OK', onPress: () => loadDebugInfo() }]
      );
    } catch (error) {
      console.error('[AmplitudeDebug] Error tracking test event:', error);
      Alert.alert('Error', `Failed to track test event: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const debugText = formatAmplitudeDebugInfo();
      const result = await Share.share({
        message: debugText,
        title: 'Amplitude Debug Info',
      });
      
      if (result.action === Share.sharedAction) {
        Alert.alert('Success', 'Debug information shared');
      }
    } catch (error) {
      console.error('[AmplitudeDebug] Error sharing:', error);
      Alert.alert('Error', `Failed to share debug information: ${error}`);
    }
  };

  const getStatusColor = (value: boolean) => {
    return value ? '#4caf50' : '#f44336';
  };

  const getStatusText = (value: boolean) => {
    return value ? 'YES' : 'NO';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Amplitude Analytics Debug</Text>
        <Text style={styles.subtitle}>
          View debug information to troubleshoot Amplitude event tracking issues
        </Text>

        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Initialization Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Initialized:</Text>
              <View style={styles.statusValueContainer}>
                <View 
                  style={[
                    styles.statusIndicator, 
                    { backgroundColor: status ? getStatusColor(status.initialized) : '#ccc' }
                  ]} 
                />
                <Text style={[
                  styles.statusValue,
                  { color: status ? getStatusColor(status.initialized) : '#666' }
                ]}>
                  {status ? getStatusText(status.initialized) : 'Loading...'}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>API Key Present:</Text>
              <View style={styles.statusValueContainer}>
                <View 
                  style={[
                    styles.statusIndicator, 
                    { backgroundColor: status ? getStatusColor(status.apiKeyPresent) : '#ccc' }
                  ]} 
                />
                <Text style={[
                  styles.statusValue,
                  { color: status ? getStatusColor(status.apiKeyPresent) : '#666' }
                ]}>
                  {status ? getStatusText(status.apiKeyPresent) : 'Loading...'}
                </Text>
              </View>
            </View>

            {status?.apiKeyPreview && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>API Key Preview:</Text>
                <Text style={styles.apiKeyPreview}>{status.apiKeyPreview}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity
            style={[styles.button, styles.testButton, loading && styles.buttonDisabled]}
            onPress={handleTestEvent}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" style={styles.buttonSpinner} />
                <Text style={styles.buttonText}>Sending Test Event...</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>Send Test Event</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.shareButton]}
            onPress={handleShare}
          >
            <Text style={styles.buttonText}>Share Debug Info</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.refreshButton]}
            onPress={loadDebugInfo}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <ActivityIndicator size="small" color="#2196f3" style={styles.buttonSpinner} />
                <Text style={[styles.buttonText, styles.refreshButtonText]}>Refreshing...</Text>
              </>
            ) : (
              <Text style={[styles.buttonText, styles.refreshButtonText]}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logs Section */}
        <View style={styles.section}>
          <View style={styles.logsHeader}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            <Text style={styles.logsCount}>({logs.length} entries)</Text>
          </View>
          <View style={styles.logsContainer}>
            {logs.length === 0 ? (
              <Text style={styles.noLogsText}>No logs available</Text>
            ) : (
              logs.map((log, index) => (
                <View key={index} style={styles.logEntry}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logTimestamp}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                    <View 
                      style={[
                        styles.logLevelBadge,
                        { backgroundColor: log.level === 'error' ? '#f44336' : '#2196f3' }
                      ]}
                    >
                      <Text style={styles.logLevelText}>{log.level.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.logMessage}>{log.message}</Text>
                  {log.args && log.args.length > 0 && (
                    <Text style={styles.logArgs}>
                      Args: {JSON.stringify(log.args, null, 2)}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Troubleshooting Tips</Text>
          <Text style={styles.infoText}>
            • If "Initialized" is NO, Amplitude SDK failed to initialize
          </Text>
          <Text style={styles.infoText}>
            • If "API Key Present" is NO, EXPO_PUBLIC_AMPLITUDE_API_KEY is not set
          </Text>
          <Text style={styles.infoText}>
            • Check logs for error messages about initialization or event tracking
          </Text>
          <Text style={styles.infoText}>
            • Use "Send Test Event" to verify events are being tracked
          </Text>
          <Text style={styles.infoText}>
            • Use "Share Debug Info" to send debug data for troubleshooting
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  statusValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  apiKeyPreview: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#2196f3',
    fontWeight: '600',
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  testButton: {
    backgroundColor: '#4caf50',
  },
  shareButton: {
    backgroundColor: '#2196f3',
  },
  refreshButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButtonText: {
    color: '#2196f3',
  },
  buttonSpinner: {
    marginRight: 8,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logsCount: {
    fontSize: 14,
    color: '#666',
  },
  logsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 400,
  },
  logEntry: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  logLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logLevelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  logMessage: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  logArgs: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  noLogsText: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  infoSection: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#856404',
  },
  infoText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 8,
    lineHeight: 20,
  },
});
