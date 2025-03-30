import deviceConnectionService from './DeviceConnectionService';

class AppInitializer {
  static async initialize() {
    try {
      // Initialize device connection service
      await deviceConnectionService.initialize();
      console.log('Device connection service initialized');
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  }
}

export default AppInitializer;
