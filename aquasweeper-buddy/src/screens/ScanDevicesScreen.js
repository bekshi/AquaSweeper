import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';

const ScanDevicesScreen = () => {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);

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

  const connectToDevice = (device) => {
    // TODO: Implement connection logic
    console.log('Connecting to device:', device.name);
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}>
      <Text style={styles.deviceName}>{item.name}</Text>
      <Text style={styles.signalStrength}>Signal Strength: {item.rssi} dBm</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Devices</Text>
      {scanning ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.scanningText}>Scanning for devices...</Text>
        </View>
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
            <Text style={styles.scanButtonText}>Scan Again</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  list: {
    flex: 1,
  },
  deviceItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  signalStrength: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scanButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ScanDevicesScreen;
