#include <WiFi.h>
#include <WebServer.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <esp_system.h>

#define EEPROM_SIZE 512
#define CONFIG_FLAG_ADDR 0
#define WIFI_SSID_ADDR 1
#define WIFI_PASS_ADDR 65

WebServer server(80);

String deviceName;
String storedSSID;
String storedPassword;
bool isConfigured = false;
bool isConnectingToWiFi = false;
bool shouldTryWiFiConnection = false;
unsigned long wifiConnectStartTime = 0;
wl_status_t lastWiFiStatus = WL_IDLE_STATUS;

// Device state variables
bool isRunning = false;
bool isPaused = false;
String operatingState = "stopped"; // "stopped", "running", "paused"
const int LED_PIN = 21; // Onboard LED pin (D13 on FireBeetle 2 ESP32-S3)
unsigned long lastBlinkTime = 0;
bool ledState = false;

char wifiSSID[32];
char wifiPassword[64];

unsigned long lastAPCheckTime = 0;

const int WIFI_CONNECT_TIMEOUT = 30000; // 30 seconds

void updateBatteryLevel() {
  // For demo purposes, return a value between 0 and 100
  static int batteryLevel = 100;
  static unsigned long lastBatteryUpdate = 0;
  
  // Update battery level every 60 seconds
  if (millis() - lastBatteryUpdate > 60000) {
    // Decrease battery by 1-3% randomly
    int decrease = random(1, 4);
    batteryLevel -= decrease;
    
    // Ensure battery level doesn't go below 0
    if (batteryLevel < 0) {
      batteryLevel = 0;
    }
    
    // Reset battery to 100% if it gets too low (simulating a charge)
    if (batteryLevel < 10) {
      batteryLevel = 100;
    }
    
    lastBatteryUpdate = millis();
  }
}

String getDeviceId() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  
  // Debug print
  Serial.print("Raw MAC bytes: ");
  for(int i = 0; i < 6; i++) {
    Serial.print(mac[i], HEX);
    Serial.print(" ");
  }
  Serial.println();
  
  // Get last 3 bytes of MAC for device ID
  char deviceId[7];
  snprintf(deviceId, sizeof(deviceId), "%02X%02X%02X", mac[3], mac[4], mac[5]);
  
  Serial.print("Device ID: ");
  Serial.println(deviceId);
  
  return String(deviceId);
}

// Function to simulate battery level
int getBatteryLevel() {
  // For demo purposes, return a value between 0 and 100
  static int batteryLevel = 100;
  static unsigned long lastBatteryUpdate = 0;
  
  // Update battery level every 60 seconds
  if (millis() - lastBatteryUpdate > 60000) {
    // Decrease battery by 1-3% randomly
    int decrease = random(1, 4);
    batteryLevel -= decrease;
    
    // Ensure battery level doesn't go below 0
    if (batteryLevel < 0) {
      batteryLevel = 0;
    }
    
    // Reset battery to 100% if it gets too low (simulating a charge)
    if (batteryLevel < 10) {
      batteryLevel = 100;
    }
    
    lastBatteryUpdate = millis();
  }
  
  return batteryLevel;
}

void readWiFiCredentials() {
  isConfigured = EEPROM.read(CONFIG_FLAG_ADDR) == 1;
  if (!isConfigured) {
    Serial.println("No stored credentials found");
    return;
  }

  storedSSID = "";
  storedPassword = "";
  
  // Read SSID
  for (int i = 0; i < 32; i++) {
    char c = EEPROM.read(WIFI_SSID_ADDR + i);
    if (c == 0) break;
    storedSSID += c;
  }

  // Read password
  for (int i = 0; i < 64; i++) {
    char c = EEPROM.read(WIFI_PASS_ADDR + i);
    if (c == 0) break;
    storedPassword += c;
  }

  Serial.println("Read stored credentials - SSID: " + storedSSID);
}

void writeWiFiCredentials(String ssid, String password) {
  // Clear the area first
  for (int i = 0; i < 32; i++) {
    EEPROM.write(WIFI_SSID_ADDR + i, 0);
  }
  for (int i = 0; i < 64; i++) {
    EEPROM.write(WIFI_PASS_ADDR + i, 0);
  }

  // Write new SSID
  for (unsigned int i = 0; i < ssid.length(); i++) {
    EEPROM.write(WIFI_SSID_ADDR + i, ssid[i]);
  }

  // Write new password
  for (unsigned int i = 0; i < password.length(); i++) {
    EEPROM.write(WIFI_PASS_ADDR + i, password[i]);
  }

  EEPROM.write(CONFIG_FLAG_ADDR, 1);
  EEPROM.commit();

  // Update stored values
  storedSSID = ssid;
  storedPassword = password;
  isConfigured = true;
}

void clearStoredWiFiCredentials() {
  // Clear the area
  for (int i = 0; i < 32; i++) {
    EEPROM.write(WIFI_SSID_ADDR + i, 0);
  }
  for (int i = 0; i < 64; i++) {
    EEPROM.write(WIFI_PASS_ADDR + i, 0);
  }
  EEPROM.write(CONFIG_FLAG_ADDR, 0);
  EEPROM.commit();

  // Update stored values
  storedSSID = "";
  storedPassword = "";
  isConfigured = false;
}

void connectToWiFi() {
  // Make sure we have credentials to connect with
  if (storedSSID.length() == 0 && strlen(wifiSSID) == 0) {
    Serial.println("No WiFi credentials available");
    shouldTryWiFiConnection = false;
    return;
  }

  // Prefer the credentials from wifiSSID/wifiPassword if available
  // as they might be newer than what's in storedSSID/storedPassword
  const char* ssidToUse = strlen(wifiSSID) > 0 ? wifiSSID : storedSSID.c_str();
  const char* passwordToUse = strlen(wifiPassword) > 0 ? wifiPassword : storedPassword.c_str();
  
  Serial.println("Attempting to connect to WiFi: " + String(ssidToUse));
  
  // Disconnect from any existing connection first
  WiFi.disconnect();
  delay(100);
  
  // Ensure we're in AP+STA mode to maintain the AP while connecting to WiFi
  WiFi.mode(WIFI_AP_STA);
  delay(100);
  
  // Start the connection attempt
  WiFi.begin(ssidToUse, passwordToUse);
  Serial.println("WiFi connection attempt started");
  
  // Update state variables
  isConnectingToWiFi = true;
  wifiConnectStartTime = millis();
  shouldTryWiFiConnection = false;
  lastWiFiStatus = WL_IDLE_STATUS;
  
  // Update stored credentials if we're using temporary ones
  if (strlen(wifiSSID) > 0 && strcmp(wifiSSID, storedSSID.c_str()) != 0) {
    Serial.println("Updating stored credentials with new ones");
    writeWiFiCredentials(wifiSSID, wifiPassword);
    // Reload the stored credentials
    readWiFiCredentials();
  }
}

void addCORSHeaders() {
  Serial.println("Adding CORS headers");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  server.sendHeader("Content-Type", "application/json");
}

void handleDiscover() {
  addCORSHeaders();
  
  String deviceId = getDeviceId();
  
  // Create JSON response
  DynamicJsonDocument doc(512);
  doc["deviceId"] = deviceId;
  doc["deviceName"] = "AquaSweeper-" + deviceId;
  doc["deviceType"] = "AquaSweeper";
  doc["firmwareVersion"] = "1.0.0";
  doc["ipAddress"] = WiFi.localIP().toString();
  doc["apIPAddress"] = WiFi.softAPIP().toString();
  doc["macAddress"] = WiFi.macAddress();
  doc["isConfigured"] = isConfigured;
  doc["connectedToWiFi"] = (WiFi.status() == WL_CONNECTED);
  
  // Add endpoints
  JsonArray endpoints = doc.createNestedArray("endpoints");
  
  JsonObject infoEndpoint = endpoints.createNestedObject();
  infoEndpoint["path"] = "/info";
  infoEndpoint["method"] = "GET";
  infoEndpoint["description"] = "Get device information";
  
  JsonObject statusEndpoint = endpoints.createNestedObject();
  statusEndpoint["path"] = "/status";
  statusEndpoint["method"] = "GET";
  statusEndpoint["description"] = "Get device status";
  
  JsonObject controlEndpoint = endpoints.createNestedObject();
  controlEndpoint["path"] = "/control";
  controlEndpoint["method"] = "POST";
  controlEndpoint["description"] = "Control device operation";
  
  String response;
  serializeJson(doc, response);
  
  Serial.println("Sending response:");
  Serial.println(response);
  
  server.send(200, "application/json", response);
  Serial.println("Response sent successfully");
}

void handleWiFiConfig() {
  Serial.println("Received WiFi configuration request");
  addCORSHeaders();
  
  if (server.hasArg("plain")) {
    String json = server.arg("plain");
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, json);
    
    if (error) {
      Serial.print("JSON parsing error: ");
      Serial.println(error.c_str());
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON: " + String(error.c_str()) + "\"}");
      return;
    }

    const char* ssid = doc["ssid"];
    const char* password = doc["password"];
    
    if (!ssid || !password) {
      Serial.println("Missing SSID or password in request");
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Missing SSID or password\"}");
      return;
    }

    Serial.print("Received WiFi configuration request for SSID: ");
    Serial.println(ssid);
    
    // Store credentials in EEPROM first
    writeWiFiCredentials(ssid, password);
    
    // Also store in temporary variables for immediate use
    strlcpy(wifiSSID, ssid, sizeof(wifiSSID));
    strlcpy(wifiPassword, password, sizeof(wifiPassword));
    
    // Set configured flag
    isConfigured = true;
    
    // Switch to AP+STA mode
    WiFi.mode(WIFI_AP_STA);
    delay(200);
    
    // Create a more detailed response
    String responseJson = "{";
    responseJson += "\"success\":true,";
    responseJson += "\"message\":\"WiFi credentials saved and connection attempt started\",";
    responseJson += "\"ssid\":\"" + String(ssid) + "\",";
    responseJson += "\"apIP\":\"" + WiFi.softAPIP().toString() + "\",";
    responseJson += "\"macAddress\":\"" + WiFi.macAddress() + "\"";
    responseJson += "}";
    
    // Send success response
    Serial.print("Sending response: ");
    Serial.println(responseJson);
    server.send(200, "application/json", responseJson);
    
    // Trigger WiFi connection attempt after sending the response
    Serial.println("WiFi configuration successful, starting connection attempt");
    connectToWiFi();
  } else {
    Serial.println("No data received in WiFi configuration request");
    server.send(400, "application/json", "{\"success\":false,\"message\":\"No data received\"}");
  }
}

void handleDeviceInfo() {
  addCORSHeaders();
  
  String deviceId = getDeviceId();
  bool isWifiConnected = WiFi.status() == WL_CONNECTED;
  
  // Get the correct IP address
  String ipAddress = "";
  if (isWifiConnected) {
    ipAddress = WiFi.localIP().toString();
    Serial.print("Connected to WiFi. Local IP: ");
    Serial.println(ipAddress);
  } else {
    ipAddress = WiFi.softAPIP().toString();
    Serial.print("Not connected to WiFi. AP IP: ");
    Serial.println(ipAddress);
  }
  
  String json = "{";
  json += "\"deviceId\":\"" + deviceId + "\",";
  json += "\"deviceName\":\"AquaSweeper-" + deviceId + "\",";
  json += "\"firmwareVersion\":\"1.0.0\",";
  json += "\"ipAddress\":\"" + ipAddress + "\",";
  json += "\"macAddress\":\"" + WiFi.macAddress() + "\",";
  json += "\"apSSID\":\"" + String(deviceName) + "\",";
  json += "\"isConfigured\":" + String(isConfigured ? "true" : "false") + ",";
  json += "\"connectedToWiFi\":" + String(isWifiConnected ? "true" : "false") + ",";
  
  // Add more detailed WiFi information
  if (isWifiConnected) {
    json += "\"wifiSSID\":\"" + WiFi.SSID() + "\",";
    json += "\"wifiRSSI\":" + String(WiFi.RSSI()) + ",";
    json += "\"wifiMode\":\"station\"";
  } else if (isConnectingToWiFi) {
    json += "\"wifiStatus\":\"connecting\",";
    json += "\"wifiSSID\":\"" + String(strlen(wifiSSID) > 0 ? wifiSSID : storedSSID.c_str()) + "\",";
    json += "\"wifiMode\":\"connecting\"";
  } else {
    json += "\"wifiStatus\":\"ap_only\",";
    json += "\"wifiMode\":\"ap\"";
  }
  
  json += "}";
  
  server.send(200, "application/json", json);
  Serial.println("Device info request handled");
}

void handleDeviceStatus() {
  addCORSHeaders();
  
  bool isWifiConnected = WiFi.status() == WL_CONNECTED;
  
  // Get the correct IP address
  String ipAddress = "";
  if (isWifiConnected) {
    ipAddress = WiFi.localIP().toString();
    Serial.print("Status endpoint - Connected to WiFi. Local IP: ");
    Serial.println(ipAddress);
  } else {
    ipAddress = WiFi.softAPIP().toString();
    Serial.print("Status endpoint - Not connected to WiFi. AP IP: ");
    Serial.println(ipAddress);
  }
  
  // Create a JSON document
  StaticJsonDocument<512> doc;
  
  // Add device status information
  doc["isRunning"] = isRunning;
  doc["isPaused"] = isPaused;
  doc["operatingState"] = operatingState;
  doc["batteryLevel"] = getBatteryLevel();
  doc["connectedToWiFi"] = isWifiConnected;
  doc["ipAddress"] = ipAddress;
  doc["deviceId"] = getDeviceId();
  doc["deviceName"] = deviceName.length() > 0 ? deviceName : "AquaSweeper-" + getDeviceId();
  doc["timestamp"] = millis(); // Add timestamp to help with synchronization
  
  // Serialize the JSON document
  String json;
  serializeJson(doc, json);
  
  server.send(200, "application/json", json);
  Serial.println("Device status request handled");
}

void handleDeviceControl() {
  addCORSHeaders();
  
  if (server.hasArg("plain")) {
    String json = server.arg("plain");
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, json);
    
    if (error) {
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON\"}");
      return;
    }

    // Check for numeric command format from mobile app
    if (doc.containsKey("numericCommand")) {
      int command = doc["numericCommand"];
      
      if (command == 0) { // Stop
        isRunning = false;
        isPaused = false;
        operatingState = "stopped";
        digitalWrite(LED_PIN, LOW); // Turn LED off
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Device stopped\"}");
        Serial.println("Device stopped via numeric command");
      } else if (command == 1) { // Start
        isRunning = true;
        isPaused = false;
        operatingState = "running";
        digitalWrite(LED_PIN, HIGH); // Turn LED on
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Device started\"}");
        Serial.println("Device started via numeric command");
      } else if (command == 2) { // Pause
        isRunning = false;
        isPaused = true;
        operatingState = "paused";
        // LED will blink in the loop function
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Device paused\"}");
        Serial.println("Device paused via numeric command");
      } else {
        server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid command value\"}");
        Serial.println("Invalid numeric command value");
      }
      return;
    }

    // Check for direct command field (for backward compatibility)
    if (doc.containsKey("command")) {
      int command = doc["command"];
      
      if (command == 0) { // Stop
        isRunning = false;
        isPaused = false;
        operatingState = "stopped";
        digitalWrite(LED_PIN, LOW); // Turn LED off
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Device stopped\"}");
        Serial.println("Device stopped via direct command");
      } else if (command == 1) { // Start
        isRunning = true;
        isPaused = false;
        operatingState = "running";
        digitalWrite(LED_PIN, HIGH); // Turn LED on
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Device started\"}");
        Serial.println("Device started via direct command");
      } else if (command == 2) { // Pause
        isRunning = false;
        isPaused = true;
        operatingState = "paused";
        // LED will blink in the loop function
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Device paused\"}");
        Serial.println("Device paused via direct command");
      } else {
        server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid command value\"}");
        Serial.println("Invalid direct command value");
      }
      return;
    }

    // Original string command format
    const char* action = doc["action"];
    
    if (!action) {
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Missing action\"}");
      return;
    }

    if (strcmp(action, "start") == 0) {
      isRunning = true;
      isPaused = false;
      operatingState = "running";
      digitalWrite(LED_PIN, HIGH); // Turn LED on
      server.send(200, "application/json", "{\"success\":true,\"message\":\"Device started\"}");
      Serial.println("Device started");
    } else if (strcmp(action, "stop") == 0) {
      isRunning = false;
      isPaused = false;
      operatingState = "stopped";
      digitalWrite(LED_PIN, LOW); // Turn LED off
      server.send(200, "application/json", "{\"success\":true,\"message\":\"Device stopped\"}");
      Serial.println("Device stopped");
    } else if (strcmp(action, "pause") == 0) {
      isRunning = false;
      isPaused = true;
      operatingState = "paused";
      // LED will blink in the loop function
      server.send(200, "application/json", "{\"success\":true,\"message\":\"Device paused\"}");
      Serial.println("Device paused");
    } else {
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid action\"}");
      Serial.println("Invalid action requested");
    }
  } else {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"No data received\"}");
  }
}

void handleFactoryReset() {
  addCORSHeaders();
  
  Serial.println("Received factory reset request");
  
  // Clear WiFi credentials
  clearStoredWiFiCredentials();
  
  // Create response
  String responseJson = "{";
  responseJson += "\"success\":true,";
  responseJson += "\"message\":\"Device has been factory reset. WiFi credentials cleared.\"";
  responseJson += "}";
  
  // Send response
  server.send(200, "application/json", responseJson);
  
  // Wait a moment for the response to be sent
  delay(500);
  
  // Restart the device
  ESP.restart();
}

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);
  Serial.println("\nAquaSweeper Starting...");

  // Initialize LED pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Start with LED off

  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Read WiFi credentials from EEPROM
  readWiFiCredentials();
  Serial.print("Stored SSID from EEPROM: ");
  Serial.println(storedSSID);
  
  // Set WiFi mode to AP+STA from the beginning
  WiFi.mode(WIFI_AP_STA);
  delay(200); // Short delay to ensure WiFi is initialized
  
  // Get device name from MAC
  deviceName = "AquaSweeper-" + getDeviceId();
  
  // Configure soft AP with specific IP
  IPAddress local_ip(192, 168, 4, 1);
  IPAddress gateway(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);
  
  // Configure and start AP with specific network configuration
  WiFi.softAPConfig(local_ip, gateway, subnet);
  if (WiFi.softAP(deviceName.c_str(), "12345678")) {
    Serial.println("AP Created Successfully");
    Serial.print("AP IP: ");
    Serial.println(WiFi.softAPIP());
    Serial.print("MAC Address: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println("AP Creation Failed! Retrying...");
    delay(1000);
    ESP.restart();
  }
  
  // If we have stored WiFi credentials, try to connect
  if (isConfigured && storedSSID.length() > 0) {
    Serial.println("Found stored WiFi credentials, attempting to connect");
    
    // Copy stored credentials to temporary variables
    strlcpy(wifiSSID, storedSSID.c_str(), sizeof(wifiSSID));
    strlcpy(wifiPassword, storedPassword.c_str(), sizeof(wifiPassword));
    
    // Start connection attempt
    connectToWiFi();
  }

  // Set up web server endpoints
  server.on("/discover", HTTP_GET, handleDiscover);
  server.on("/discover", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });
  
  server.on("/wifi", HTTP_POST, handleWiFiConfig);
  server.on("/wifi", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });
  
  // Add an alias for /wifi as /wifi-config for compatibility
  server.on("/wifi-config", HTTP_POST, handleWiFiConfig);
  server.on("/wifi-config", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });
  
  server.on("/info", HTTP_GET, handleDeviceInfo);
  server.on("/info", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });
  
  // Add an alias for /info as /device for compatibility
  server.on("/device", HTTP_GET, handleDeviceInfo);
  server.on("/device", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });
  
  server.on("/status", HTTP_GET, handleDeviceStatus);
  server.on("/status", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });
  
  server.on("/control", HTTP_POST, handleDeviceControl);
  server.on("/control", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });
  
  server.on("/factory-reset", HTTP_POST, handleFactoryReset);
  server.on("/factory-reset", HTTP_OPTIONS, []() {
    addCORSHeaders();
    server.send(204);
  });

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
  
  // Handle LED blinking for paused state
  if (isPaused) {
    unsigned long currentTime = millis();
    if (currentTime - lastBlinkTime >= 500) { // Blink every 500ms
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlinkTime = currentTime;
    }
  }
  
  // Check WiFi connection status
  if (isConnectingToWiFi) {
    unsigned long currentTime = millis();
    
    // Check if we've connected
    if (WiFi.status() == WL_CONNECTED) {
      if (lastWiFiStatus != WL_CONNECTED) {
        Serial.println("Connected to WiFi!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
        isConnectingToWiFi = false;
        lastWiFiStatus = WL_CONNECTED;
      }
    } 
    // Check for connection timeout
    else if (currentTime - wifiConnectStartTime > WIFI_CONNECT_TIMEOUT) {
      Serial.println("WiFi connection attempt timed out");
      isConnectingToWiFi = false;
      lastWiFiStatus = WiFi.status();
    }
    // Status changed but not connected yet
    else if (WiFi.status() != lastWiFiStatus) {
      lastWiFiStatus = WiFi.status();
      Serial.print("WiFi status changed: ");
      Serial.println(lastWiFiStatus);
    }
  }
  
  // Check if AP is still running every 30 seconds
  unsigned long currentTime = millis();
  if (currentTime - lastAPCheckTime > 30000) {
    if (WiFi.softAPgetStationNum() == 0) {
      Serial.println("No stations connected to AP");
    } else {
      Serial.print("Stations connected to AP: ");
      Serial.println(WiFi.softAPgetStationNum());
    }
    
    // Ensure AP is still running
    if (WiFi.getMode() == WIFI_STA) {
      Serial.println("AP mode lost. Restoring AP+STA mode...");
      WiFi.mode(WIFI_AP_STA);
      delay(100);
      
      // Restart AP if needed
      if (!WiFi.softAPIP()) {
        Serial.println("AP IP not available. Restarting AP...");
        WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
        WiFi.softAP(deviceName.c_str(), "12345678");
      }
    }
    
    lastAPCheckTime = currentTime;
  }
  
  // Simulate battery drain
  updateBatteryLevel();
  
  delay(1); // Minimal delay to prevent watchdog issues while keeping response time fast
}