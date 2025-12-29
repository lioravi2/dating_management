/**
 * Metro Configuration Screen
 * Allows configuring Metro bundler URL without Developer Menu
 * Accessible via deep link or hidden menu
 */

import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { configureMetroHost, getMetroHost } from '../../lib/metro-config';

export default function MetroConfigScreen() {
  const navigation = useNavigation();
  const [host, setHost] = useState('');
  const [currentHost, setCurrentHost] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load current host
    getMetroHost().then(setCurrentHost);
  }, []);

  const handleSave = async () => {
    if (!host.trim()) {
      Alert.alert('Error', 'Please enter a Metro host (e.g., 192.168.1.100:8081)');
      return;
    }

    // Validate format (basic check)
    const hostPattern = /^[\d.]+:\d+$/;
    if (!hostPattern.test(host.trim())) {
      Alert.alert('Error', 'Invalid format. Use: IP_ADDRESS:PORT (e.g., 192.168.1.100:8081)');
      return;
    }

    setLoading(true);
    try {
      const success = await configureMetroHost(host.trim());
      if (success) {
        setCurrentHost(host.trim());
        setHost('');
        Alert.alert(
          'Success',
          'Metro host configured! The app will now connect to Metro. You may need to reload the app.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Optionally reload the app
                if (__DEV__) {
                  const { DevSettings } = require('react-native');
                  if (DevSettings && DevSettings.reload) {
                    DevSettings.reload();
                  }
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Warning', 'Metro host was saved but may not be active. You may need to reload the app.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to configure Metro host: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    Alert.alert(
      'Clear Configuration',
      'Are you sure you want to clear the Metro host configuration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const AsyncStorage = require('@react-native-async-storage/async-storage').default;
              await AsyncStorage.removeItem('@metro_debug_server_host');
              setCurrentHost(null);
              Alert.alert('Success', 'Metro host configuration cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear configuration.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Metro Bundler Configuration</Text>
        <Text style={styles.subtitle}>
          Configure the Metro bundler URL for WiFi debugging
        </Text>

        {currentHost && (
          <View style={styles.currentConfig}>
            <Text style={styles.currentLabel}>Current Configuration:</Text>
            <Text style={styles.currentValue}>{currentHost}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Metro Host (IP:Port)</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.1.100:8081"
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            editable={!loading}
          />
          <Text style={styles.hint}>
            Enter your computer's IP address followed by :8081
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Saving...' : 'Save Configuration'}
          </Text>
        </TouchableOpacity>

        {currentHost && (
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.clearButtonText]}>
              Clear Configuration
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to find your IP address:</Text>
          <Text style={styles.instructionText}>
            1. On your computer, open a terminal/command prompt
          </Text>
          <Text style={styles.instructionText}>
            2. Run: npm run config:metro (in apps/mobile directory)
          </Text>
          <Text style={styles.instructionText}>
            3. Or run: ipconfig (Windows) or ifconfig (Mac/Linux)
          </Text>
          <Text style={styles.instructionText}>
            4. Look for your WiFi adapter's IPv4 address
          </Text>
          <Text style={styles.instructionText}>
            5. Enter it here as: IP_ADDRESS:8081
          </Text>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            <Text style={styles.noteBold}>Note:</Text> Once configured, the app will remember
            this setting and work across different WiFi networks. You only need to configure it once.
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
  currentConfig: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  currentLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  currentValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#2196f3',
  },
  clearButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButtonText: {
    color: '#f44336',
  },
  instructions: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  note: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  noteText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  noteBold: {
    fontWeight: 'bold',
  },
});


