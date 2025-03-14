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
unsigned long lastWiFiStatus = WL_IDLE_STATUS;

// Device state variables
bool isRunning = false;
bool isPaused = false;
String operatingState = "stopped"; // "stopped", "running", "paused"
const int LED_PIN = 21; // Onboard LED pin (D13 on FireBeetle 2 ESP32-S3)
unsigned long lastBlinkTime = 0;
bool ledState = false;

char wifiSSID[32];
char wifiPassword[64];

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

void connectToWiFi() {
  if (storedSSID.length() == 0) {
    Serial.println("No WiFi credentials available");
    return;
  }

  Serial.println("Attempting to connect to WiFi: " + storedSSID);
  WiFi.begin(storedSSID.c_str(), storedPassword.c_str());
  isConnectingToWiFi = true;
  wifiConnectStartTime = millis();
  shouldTryWiFiConnection = false;
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
  addCORSHeaders();
  
  if (server.hasArg("plain")) {
    String json = server.arg("plain");
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, json);
    
    if (error) {
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON\"}");
      return;
    }

    const char* ssid = doc["ssid"];
    const char* password = doc["password"];
    
    if (!ssid || !password) {
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Missing SSID or password\"}");
      return;
    }

    // Store credentials and send success response immediately
    strlcpy(wifiSSID, ssid, sizeof(wifiSSID));
    strlcpy(wifiPassword, password, sizeof(wifiPassword));
    shouldTryWiFiConnection = true;
    
    server.send(200, "application/json", "{\"success\":true}");
    
    // Start WiFi connection in the background
    WiFi.disconnect();
    WiFi.begin(wifiSSID, wifiPassword);
  } else {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"No data received\"}");
  }
}

void handleDeviceInfo() {
  addCORSHeaders();
  
  String deviceId = getDeviceId();
  
  String json = "{";
  json += "\"deviceId\":\"" + deviceId + "\",";
  json += "\"deviceName\":\"AquaSweeper-" + deviceId + "\",";
  json += "\"firmwareVersion\":\"1.0.0\",";
  json += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"macAddress\":\"" + WiFi.macAddress() + "\",";
  json += "\"apSSID\":\"" + String(deviceName) + "\",";
  json += "\"isConfigured\":" + String(isConfigured ? "true" : "false") + ",";
  json += "\"connectedToWiFi\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false");
  json += "}";
  
  server.send(200, "application/json", json);
  Serial.println("Device info request handled");
}

void handleDeviceStatus() {
  addCORSHeaders();
  
  String json = "{";
  json += "\"isRunning\":" + String(isRunning) + ",";
  json += "\"isPaused\":" + String(isPaused) + ",";
  json += "\"operatingState\":\"" + operatingState + "\",";
  json += "\"batteryLevel\":" + String(getBatteryLevel());
  json += "}";
  
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

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);
  Serial.println("\nAquaSweeper Starting...");

  // Initialize LED pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Start with LED off

  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Set WiFi mode and get MAC address
  WiFi.mode(WIFI_AP_STA);
  delay(100); // Small delay to ensure WiFi is initialized
  
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
  } else {
    Serial.println("AP Creation Failed!");
  }

  // Try to connect to stored WiFi if credentials exist
  readWiFiCredentials();
  if (isConfigured) {
    shouldTryWiFiConnection = true;
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
  
  // Handle WiFi connection attempts
  if (shouldTryWiFiConnection) {
    connectToWiFi();
  }
  
  // Check WiFi connection status
  if (isConnectingToWiFi) {
    unsigned long currentTime = millis();
    if (WiFi.status() != lastWiFiStatus) {
      lastWiFiStatus = WiFi.status();
      if (lastWiFiStatus == WL_CONNECTED) {
        Serial.println("Connected to WiFi!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
        isConnectingToWiFi = false;
      }
    }
    
    // Timeout after 30 seconds
    if (currentTime - wifiConnectStartTime > 30000) {
      Serial.println("WiFi connection attempt timed out");
      WiFi.disconnect();
      isConnectingToWiFi = false;
      // Try again in 60 seconds
      shouldTryWiFiConnection = true;
      wifiConnectStartTime = currentTime;
    }
  }
  
  delay(1); // Minimal delay to prevent watchdog issues while keeping response time fast
}