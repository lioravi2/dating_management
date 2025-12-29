import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings } from 'react-native';

interface ConnectionStatus {
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  details?: string;
}

export default function App() {
  const [metroHost, setMetroHost] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'idle',
    message: '',
  });
  const [devSettingsAvailable, setDevSettingsAvailable] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // Check if DevSettings API is available
    const isDevSettingsAvailable = typeof DevSettings !== 'undefined' && DevSettings !== null;
    setDevSettingsAvailable(isDevSettingsAvailable);

    // Load saved Metro host
    AsyncStorage.getItem('metro_host').then((saved) => {
      if (saved) {
        setMetroHost(saved);
      }
    });

    // Gather debug information using the computed value directly
    gatherDebugInfo(isDevSettingsAvailable);
  }, []);

  const gatherDebugInfo = (isDevSettingsAvailable: boolean) => {
    const info: string[] = [];
    
    info.push('=== Debug Information ===');
    info.push(`DevSettings API Available: ${isDevSettingsAvailable ? 'Yes' : 'No'}`);
    info.push(`React Native Version: ${require('react-native/package.json').version}`);
    info.push(`Expo Version: ${require('expo/package.json').version}`);
    info.push(`Platform: ${require('react-native').Platform.OS}`);
    
    if (typeof __DEV__ !== 'undefined') {
      info.push(`__DEV__: ${__DEV__}`);
    }
    
    setDebugInfo(info.join('\n'));
  };

  const testConnection = async () => {
    if (!metroHost.trim()) {
      setConnectionStatus({
        status: 'error',
        message: 'Please enter a Metro host (e.g., 192.168.1.100:8082)',
      });
      return;
    }

    setConnectionStatus({
      status: 'testing',
      message: 'Testing connection...',
    });

    try {
      // Validate format
      const hostPattern = /^[\d.]+:\d+$/;
      if (!hostPattern.test(metroHost.trim())) {
        throw new Error('Invalid format. Use IP:PORT (e.g., 192.168.1.100:8082)');
      }

      const [ip, port] = metroHost.trim().split(':');
      const url = `http://${ip}:${port}/status`;

      // Test connection with timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.text();
        setConnectionStatus({
          status: 'success',
          message: 'Connection successful!',
          details: `Metro responded: ${data.substring(0, 100)}`,
        });
        
        // Save successful host
        await AsyncStorage.setItem('metro_host', metroHost.trim());
      } else {
        throw new Error(`Metro returned status ${response.status}`);
      }
    } catch (error: any) {
      let errorMessage = 'Connection failed';
      let errorDetails = '';

      const errorMsg = error?.message || '';
      if (errorMsg) {
        errorMessage = errorMsg;
      }

      if (error.name === 'AbortError' || (errorMsg && errorMsg.includes('aborted'))) {
        errorMessage = 'Connection timeout';
        errorDetails = 'Connection timed out after 5 seconds. Metro may be slow to respond or not reachable.';
      } else if (error.name === 'TypeError' && errorMsg && errorMsg.includes('Network request failed')) {
        errorDetails = 'Network request failed. Possible causes:\n';
        errorDetails += '• Metro is not running\n';
        errorDetails += '• Wrong IP address or port\n';
        errorDetails += '• Firewall blocking connection\n';
        errorDetails += '• Device and computer not on same network';
      } else if (errorMsg && errorMsg.includes('timeout')) {
        errorDetails = 'Connection timeout. Metro may be slow to respond.';
      } else {
        errorDetails = error.toString();
      }

      setConnectionStatus({
        status: 'error',
        message: errorMessage,
        details: errorDetails,
      });
    }
  };

  const reloadApp = () => {
    if (devSettingsAvailable && DevSettings.reload) {
      DevSettings.reload();
    } else {
      Alert.alert('Not Available', 'DevSettings.reload() is not available in this build.');
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'testing':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Metro Connection Tester</Text>
        <Text style={styles.subtitle}>Test Metro bundler connection</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Metro Host (IP:PORT)</Text>
        <TextInput
          style={styles.input}
          value={metroHost}
          onChangeText={setMetroHost}
          placeholder="192.168.1.100:8082"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />
        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={testConnection}
          disabled={connectionStatus.status === 'testing'}
        >
          {connectionStatus.status === 'testing' ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
              <Text style={styles.buttonText}>Testing...</Text>
            </>
          ) : (
            <Text style={styles.buttonText}>Test Connection</Text>
          )}
        </TouchableOpacity>
      </View>

      {connectionStatus.status !== 'idle' && (
        <View style={styles.section}>
          <View style={[styles.statusBox, { borderColor: getStatusColor() }]}>
            <Text style={[styles.statusTitle, { color: getStatusColor() }]}>
              {connectionStatus.status === 'success' ? '✓ Success' : 
               connectionStatus.status === 'error' ? '✗ Error' : 
               '⏳ Testing...'}
            </Text>
            <Text style={styles.statusMessage}>{connectionStatus.message}</Text>
            {connectionStatus.details && (
              <Text style={styles.statusDetails}>{connectionStatus.details}</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.reloadButton]}
          onPress={reloadApp}
        >
          <Text style={styles.buttonText}>Reload App</Text>
        </TouchableOpacity>
        {!devSettingsAvailable && (
          <Text style={styles.warning}>
            ⚠ DevSettings API not available. Reload may not work.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Information</Text>
        <View style={styles.debugBox}>
          <Text style={styles.debugText}>{debugInfo}</Text>
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
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  testButton: {
    backgroundColor: '#2196F3',
  },
  reloadButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    marginRight: 8,
  },
  statusBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 8,
    padding: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  statusDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  warning: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 8,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  debugBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  debugText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
});
