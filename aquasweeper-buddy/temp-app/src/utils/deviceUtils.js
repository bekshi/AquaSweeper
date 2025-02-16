export const formatMacAddress = (macAddress) => {
  // Remove colons and convert to uppercase
  const cleanMac = macAddress.replace(/:/g, '').toUpperCase();
  // Take the last 3 characters
  return cleanMac.slice(-3);
};

export const generateDeviceId = (macAddress) => {
  return `AS-${formatMacAddress(macAddress)}`;
};

export const WIFI_ERRORS = {
  TIMEOUT: 'TIMEOUT',
  AUTH_FAILED: 'AUTH_FAILED',
  NETWORK_NOT_FOUND: 'NETWORK_NOT_FOUND',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
};

export const getErrorMessage = (errorType) => {
  switch (errorType) {
    case WIFI_ERRORS.TIMEOUT:
      return 'Connection timed out. Please ensure the device is powered on and try again.';
    case WIFI_ERRORS.AUTH_FAILED:
      return 'WiFi authentication failed. Please check your password and try again.';
    case WIFI_ERRORS.NETWORK_NOT_FOUND:
      return 'Could not find the specified WiFi network. Please check the SSID and try again.';
    case WIFI_ERRORS.DEVICE_OFFLINE:
      return 'Device went offline during configuration. Please ensure it remains powered on.';
    case WIFI_ERRORS.INVALID_RESPONSE:
      return 'Received invalid response from device. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};
