import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';

interface Device {
  id: string;
  name: string;
  rssi: number;
}

export default function ScanDevicesScreen() {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  const startScan = async () => {
    setScanning(true);
    // TODO: Implement actual ESP32 WiFi scanning logic here
    // This is a mock implementation
    setTimeout(() => {
      setDevices([
        { id: '1', name: 'ESP32-Device1', rssi: -65 },
        { id: '2', name: 'ESP32-Device2', rssi: -70 },
      ]);
      setScanning(false);
    }, 2000);
  };

  useEffect(() => {
    startScan();
  }, []);

  const connectToDevice = (device: Device) => {
    // TODO: Implement connection logic
    console.log('Connecting to device:', device.name);
  };

  const renderDevice = ({ item }: { item: Device }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}>
      <ThemedText type="subtitle">{item.name}</ThemedText>
      <ThemedText>Signal Strength: {item.rssi} dBm</ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Available Devices</ThemedText>
      {scanning ? (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.scanningText}>Scanning for devices...</ThemedText>
        </ThemedView>
      ) : (
        <>
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            style={styles.list}
          />
          <TouchableOpacity
            style={styles.scanButton}
            onPress={startScan}>
            <ThemedText style={styles.scanButtonText}>Scan Again</ThemedText>
          </TouchableOpacity>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    marginTop: 16,
  },
  list: {
    flex: 1,
  },
  deviceItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(161, 206, 220, 0.1)',
  },
  scanButton: {
    backgroundColor: '#A1CEDC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  scanButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});
