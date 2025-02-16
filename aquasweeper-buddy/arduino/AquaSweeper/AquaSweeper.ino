#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <Preferences.h>

// Constants
const char* AP_PASSWORD = "12345678";  // Changed to match React Native app
const unsigned long STATUS_UPDATE_INTERVAL = 60000;
const int MAX_RECONNECT_ATTEMPTS = 5;
const unsigned long RECONNECT_DELAY = 5000;
const int TEST_CONNECTION_TIMEOUT = 15000;  // 15 seconds timeout for testing
const int WIFI_CONNECT_TIMEOUT = 10000;     // 10 seconds timeout for WiFi connection

// Global variables
WebServer server(80);
String deviceId = "";
char apName[32];  // Store AP name globally
Preferences preferences;

// Structure to store WiFi credentials in memory
struct WiFiCredentials {
  char ssid[32];
  char password[64];
} credentials;

bool hasCredentials = false;

void ensureAPMode() {
  if (WiFi.softAPSSID() == "") {
    Serial.println("AP not broadcasting, restarting it...");
    WiFi.softAPdisconnect(true);
    delay(100);
    
    if (WiFi.softAP(apName, AP_PASSWORD, 1, 0, 4)) {
      Serial.print("AP restarted. IP: ");
      Serial.println(WiFi.softAPIP());
    } else {
      Serial.println("Failed to restart AP!");
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);  // Give serial time to initialize
  
  Serial.println("\nAquaSweeper Starting...");
  Serial.println("SDK Version: " + String(ESP.getSdkVersion()));
  
  // Initialize preferences
  preferences.begin("aquasweeper", false);
  
  // Try to load saved credentials
  String ssid = preferences.getString("ssid", "");
  String password = preferences.getString("password", "");
  
  if (ssid.length() > 0) {
    strcpy(credentials.ssid, ssid.c_str());
    strcpy(credentials.password, password.c_str());
    hasCredentials = true;
  }
  
  // First reset WiFi to clear any cached settings
  Serial.println("Resetting WiFi...");
  WiFi.persistent(false);  // Disable persistent to prevent flash wear
  WiFi.disconnect(true);   // Disconnect and clear credentials
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(1000);
  
  // Set mode to AP+STA
  Serial.println("Setting WiFi mode to AP+STA...");
  WiFi.mode(WIFI_AP_STA);
  delay(100);  // Reduced delay
  
  // Get MAC address for device identification
  uint8_t mac[6];
  WiFi.macAddress(mac);
  
  // Debug: Print MAC address
  Serial.print("MAC Address: ");
  for(int i = 0; i < 6; i++) {
    if (mac[i] < 0x10) Serial.print("0");
    Serial.print(mac[i], HEX);
    if(i < 5) Serial.print(":");
  }
  Serial.println();
  
  // Generate device ID from MAC
  char macStr[7];
  snprintf(macStr, sizeof(macStr), "%02x%02x%02x", mac[3], mac[4], mac[5]);
  deviceId = String(macStr);
  
  // Create AP name
  snprintf(apName, sizeof(apName), "AquaSweeper-%s", macStr);
  
  Serial.print("Device ID: ");
  Serial.println(deviceId);
  Serial.print("AP Name: ");
  Serial.println(apName);
  
  // Start AP with multiple retries if needed
  bool apStarted = false;
  int retryCount = 0;
  const int maxRetries = 3;

  while (!apStarted && retryCount < maxRetries) {
    Serial.printf("Starting AP mode (attempt %d/%d)...\n", retryCount + 1, maxRetries);
    
    // Configure soft-AP
    if (!WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0))) {
      Serial.println("AP Config Failed!");
      retryCount++;
      delay(1000);
      continue;
    }
    
    // Start AP with specific settings
    // Channel 1, not hidden, max 4 connections
    if (WiFi.softAP(apName, AP_PASSWORD, 1, 0, 4)) {
      apStarted = true;
      Serial.print("AP Started successfully. IP: ");
      Serial.println(WiFi.softAPIP());
      
      // Verify AP is actually running
      if (WiFi.softAPSSID() == "") {
        Serial.println("AP SSID not broadcasting, retrying...");
        apStarted = false;
      }
    } else {
      Serial.println("AP Start Failed!");
    }
    
    if (!apStarted) {
      retryCount++;
      WiFi.softAPdisconnect(true);
      delay(1000);
    }
  }
  
  if (!apStarted) {
    Serial.println("Failed to start AP after multiple attempts. Restarting...");
    delay(1000);
    ESP.restart();
    return;
  }
  
  // Initialize mDNS responder
  String macAddr = WiFi.macAddress();
  String deviceSuffix = macAddr.substring(macAddr.length() - 5);
  deviceSuffix.replace(":", ""); // Replace modifies the string in place
  String hostname = "aquasweeper-" + deviceSuffix;
  
  if(!MDNS.begin(hostname.c_str())) {
    Serial.println("Error starting mDNS");
  } else {
    Serial.println("mDNS started with hostname: " + hostname);
    // Add service to mDNS
    MDNS.addService("aquasweeper", "tcp", 80);
  }
  
  // Setup web server endpoints
  setupServer();
  server.begin();
  Serial.println("HTTP server started");
  
  // Try to connect to saved WiFi if credentials exist
  if (hasCredentials) {
    connectToWiFi();
  }
}

void setupServer() {
  server.enableCORS();  // Enable CORS for all origins

  server.on("/", HTTP_GET, []() {
    Serial.println("Received request for /");
    server.send(200, "text/plain", "AquaSweeper Device");
  });

  server.on("/getDeviceInfo", HTTP_GET, []() {
    Serial.println("Received request for /getDeviceInfo");
    
    String macAddr = WiFi.macAddress();
    String ip = WiFi.localIP().toString();
    bool isConnected = WiFi.status() == WL_CONNECTED;
    
    // Get device name from preferences
    preferences.begin("aquasweeper", false);
    String deviceName = preferences.getString("device_name", "AquaSweeper-" + macAddr.substring(macAddr.length() - 5));
    preferences.end();

    // Create JSON response
    StaticJsonDocument<512> doc;
    doc["macAddress"] = macAddr;
    doc["ipAddress"] = ip;
    doc["isConnected"] = isConnected;
    doc["name"] = deviceName;
    doc["firmwareVersion"] = "1.0.0";
    doc["wifiSSID"] = isConnected ? WiFi.SSID() : "";
    doc["wifiStrength"] = isConnected ? WiFi.RSSI() : 0;
    doc["uptime"] = millis() / 1000;

    String response;
    serializeJson(doc, response);
    
    // Add CORS headers
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    
    Serial.println("Sending response: " + response);
    server.send(200, "application/json", response);
  });

  server.on("/configure", HTTP_POST, handleConfigure);
  server.on("/configure", HTTP_OPTIONS, handleConfigureOptions);  // Add OPTIONS handler
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleStatusOptions);
  server.on("/reset", HTTP_POST, handleReset);
  server.on("/scan", HTTP_GET, handleScanNetworks);
  server.on("/wifi", HTTP_POST, handleWiFiConfig);
}

void connectToWiFi() {
  if (!hasCredentials) {
    Serial.println("No WiFi credentials stored");
    return;
  }

  Serial.println("Connecting to WiFi...");
  Serial.printf("SSID: %s\n", credentials.ssid);
  
  WiFi.begin(credentials.ssid, credentials.password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < MAX_RECONNECT_ATTEMPTS) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi");
    Serial.printf("IP address: %s\n", WiFi.localIP().toString().c_str());
    
    // Update mDNS
    String macAddr = WiFi.macAddress();
    String deviceSuffix = macAddr.substring(macAddr.length() - 5);
    deviceSuffix.replace(":", "");
    String hostname = "aquasweeper-" + deviceSuffix;
    
    if (MDNS.begin(hostname.c_str())) {
      Serial.printf("mDNS responder started with hostname: %s\n", hostname.c_str());
      MDNS.addService("aquasweeper", "tcp", 80);
    } else {
      Serial.println("Error starting mDNS responder!");
    }
  } else {
    Serial.println("\nFailed to connect to WiFi");
    Serial.printf("WiFi status: %d\n", WiFi.status());
  }
}

void loop() {
  server.handleClient();
  
  static unsigned long lastCheck = 0;
  unsigned long currentMillis = millis();
  
  // Check WiFi status every 30 seconds
  if (currentMillis - lastCheck > 30000) {
    lastCheck = currentMillis;
    
    // If we have credentials but lost connection, try to reconnect and restart AP
    if (hasCredentials && WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Starting AP and attempting to reconnect...");
      WiFi.softAP(apName, AP_PASSWORD, 1, 0, 4);  // Restart AP
      connectToWiFi();
    }
  }
}

void handleConfigureOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  server.send(200);
}

void handleConfigure() {
  Serial.println("\n=== Configuration Request ===");
  Serial.println("Method: " + String(server.method() == HTTP_POST ? "POST" : 
                                   server.method() == HTTP_OPTIONS ? "OPTIONS" : 
                                   server.method() == HTTP_GET ? "GET" : "OTHER"));
  
  // Log all headers
  Serial.println("\nReceived Headers:");
  for (int i = 0; i < server.headers(); i++) {
    String headerName = server.headerName(i);
    String headerValue = server.header(i);
    Serial.println(headerName + ": " + headerValue);
  }
  
  // Add CORS headers for all responses
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  
  // Handle preflight
  if (server.method() == HTTP_OPTIONS) {
    server.send(200);
    return;
  }

  // Check content type
  bool hasCorrectContentType = false;
  String receivedContentType = "";
  
  if (server.hasHeader("Content-Type")) {
    receivedContentType = server.header("Content-Type");
    Serial.println("\nContent-Type header found: " + receivedContentType);
    hasCorrectContentType = receivedContentType.indexOf("application/json") >= 0;
  } else {
    Serial.println("\nNo Content-Type header found!");
  }
  
  if (!hasCorrectContentType) {
    String errorMsg = "{\"success\":false,\"error\":\"Invalid Content-Type. Expected application/json but got: " + receivedContentType + "\"}";
    Serial.println("Error: " + errorMsg);
    server.send(400, "application/json", errorMsg);
    return;
  }

  String jsonStr = server.arg("plain");
  Serial.println("Received JSON: " + jsonStr);
  
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  
  if (error) {
    Serial.println("Failed to parse JSON");
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Invalid JSON\"}");
    return;
  }
  
  if (!doc.containsKey("ssid") || !doc.containsKey("password")) {
    Serial.println("Missing required fields");
    server.send(400, "application/json", "{\"success\":false,\"error\":\"Missing SSID or password\"}");
    return;
  }
  
  String ssid = doc["ssid"].as<String>();
  String password = doc["password"].as<String>();
  
  // Store credentials
  preferences.begin("aquasweeper", false);
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();
  
  // Set credentials and flag
  strcpy(credentials.ssid, ssid.c_str());
  strcpy(credentials.password, password.c_str());
  hasCredentials = true;
  
  // Try to connect immediately
  connectToWiFi();
  
  // Check connection status
  bool connected = WiFi.status() == WL_CONNECTED;
  String ip = connected ? WiFi.localIP().toString() : "";
  String macAddr = WiFi.macAddress();
  
  // Create response
  StaticJsonDocument<512> response;
  response["success"] = true;
  response["connected"] = connected;
  response["ip"] = ip;
  response["macAddress"] = macAddr;
  response["deviceId"] = "aquasweeper-" + macAddr.substring(macAddr.length() - 5);
  
  String responseStr;
  serializeJson(response, responseStr);
  
  Serial.println("Sending response: " + responseStr);
  server.send(200, "application/json", responseStr);
  
  // If connected, stop AP mode after a short delay
  if (connected) {
    delay(1000);  // Give time for response to be sent
    WiFi.softAPdisconnect(true);
    Serial.println("AP mode disabled");
  }
}

void handleStatus() {
  Serial.println("Received status request");
  
  StaticJsonDocument<512> doc;
  doc["connected"] = WiFi.status() == WL_CONNECTED;
  doc["ip"] = WiFi.localIP().toString();
  doc["ssid"] = WiFi.SSID();
  doc["macAddress"] = WiFi.macAddress();
  doc["rssi"] = WiFi.RSSI();
  doc["hostname"] = WiFi.getHostname();
  doc["apMode"] = WiFi.getMode() == WIFI_AP || WiFi.getMode() == WIFI_AP_STA;
  
  String response;
  serializeJson(doc, response);
  
  // Add CORS headers
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  Serial.println("Sending status: " + response);
  server.send(200, "application/json", response);
}

void handleStatusOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  server.send(200);
}

void handleReset() {
  // Clear preferences
  preferences.clear();
  
  // Clear credentials from memory
  memset(&credentials, 0, sizeof(credentials));
  hasCredentials = false;
  
  // Disconnect from WiFi
  WiFi.disconnect();
  
  server.send(200, "application/json", "{\"success\": true, \"message\": \"Device reset successful\"}");
  
  // Reset the device
  delay(1000);
  ESP.restart();
}

void handleScanNetworks() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  int n = WiFi.scanNetworks();
  StaticJsonDocument<1024> doc;
  JsonArray networks = doc.createNestedArray("networks");
  
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i).indexOf("AquaSweeper") == -1) {  // Filter out AquaSweeper APs
      JsonObject network = networks.createNestedObject();
      network["ssid"] = WiFi.SSID(i);
      network["rssi"] = WiFi.RSSI(i);
      network["encryption"] = WiFi.encryptionType(i);
    }
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
  
  // Clean up scan
  WiFi.scanDelete();
}

void handleWiFiConfig() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  if (server.method() == HTTP_OPTIONS) {
    server.send(200);
    return;
  }

  // Parse JSON from request body
  StaticJsonDocument<200> doc;
  String json = server.arg("plain");
  Serial.println("Received WiFi config request:");
  Serial.println(json);

  DeserializationError error = deserializeJson(doc, json);

  if (error) {
    Serial.println("Failed to parse JSON");
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid JSON\"}");
    return;
  }

  const char* ssid = doc["ssid"];
  const char* password = doc["password"];

  if (!ssid || strlen(ssid) == 0) {
    Serial.println("SSID is required");
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"SSID is required\"}");
    return;
  }

  Serial.print("Attempting to connect to WiFi network: ");
  Serial.println(ssid);
  
  // Store credentials first
  strcpy(credentials.ssid, ssid);
  strcpy(credentials.password, password);
  hasCredentials = true;
  
  // Save to preferences
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  
  // Begin connection attempt
  WiFi.begin(ssid, password);
  
  // Wait for connection attempt with better status reporting
  int attempts = 0;
  bool connected = false;
  
  while (attempts < 20) { // 10 second timeout
    wl_status_t status = WiFi.status();
    Serial.print("WiFi status: ");
    
    switch (status) {
      case WL_CONNECTED:
        Serial.println("Connected!");
        connected = true;
        break;
      case WL_IDLE_STATUS:
        Serial.println("Idle");
        break;
      case WL_NO_SSID_AVAIL:
        Serial.println("SSID not available");
        break;
      case WL_SCAN_COMPLETED:
        Serial.println("Scan completed");
        break;
      case WL_CONNECT_FAILED:
        Serial.println("Connection failed");
        break;
      case WL_CONNECTION_LOST:
        Serial.println("Connection lost");
        break;
      case WL_DISCONNECTED:
        Serial.println("Disconnected");
        break;
      default:
        Serial.println(status);
        break;
    }
    
    if (connected) break;
    delay(500);
    attempts++;
  }
  
  if (connected) {
    Serial.println("Successfully connected to WiFi");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // Get WiFi AP MAC for device ID
    uint8_t mac[6];
    WiFi.softAPmacAddress(mac);  // This gets the AP (access point) MAC address
    char macStr[7];
    snprintf(macStr, sizeof(macStr), "%02x%02x%02x", mac[3], mac[4], mac[5]);
    String deviceId = String(macStr);
    String hostname = "aquasweeper-" + deviceId;

    // Setup mDNS
    if (MDNS.begin(hostname.c_str())) {
      MDNS.addService("http", "tcp", 80);
      Serial.println("mDNS responder started");
      Serial.print("Device discoverable at: ");
      Serial.println(hostname + ".local");
    }

    StaticJsonDocument<200> response;
    response["status"] = "success";
    response["ip"] = WiFi.localIP().toString();
    response["hostname"] = hostname;
    response["ssid"] = WiFi.SSID();
    response["rssi"] = WiFi.RSSI();
    response["device_id"] = deviceId;
    
    String responseStr;
    serializeJson(response, responseStr);
    Serial.print("Success response: ");
    Serial.println(responseStr);
    
    // Send response before disabling AP
    server.send(200, "application/json", responseStr);
    
    // Wait a bit to ensure response is sent
    delay(1000);
    
    // Now disable AP mode
    Serial.println("Disabling AP mode...");
    WiFi.softAPdisconnect(true);
  } else {
    Serial.println("Failed to connect to WiFi");
    Serial.print("Final status: ");
    Serial.println(WiFi.status());
    
    StaticJsonDocument<200> response;
    response["status"] = "error";
    response["message"] = "Failed to connect to network";
    response["wifi_status"] = WiFi.status();
    
    String responseStr;
    serializeJson(response, responseStr);
    Serial.print("Error response: ");
    Serial.println(responseStr);
    server.send(400, "application/json", responseStr);
  }
}

bool testWiFiConnection(const char* ssid, const char* password) {
  Serial.println("Testing WiFi credentials...");
  Serial.print("SSID: ");
  Serial.println(ssid);
  
  // Store current AP mode configuration
  String currentAPSSID = WiFi.softAPSSID();
  
  // Disconnect from any current WiFi
  WiFi.disconnect();
  
  // Try to connect with new credentials
  WiFi.begin(ssid, password);
  
  // Wait for connection with timeout
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < TEST_CONNECTION_TIMEOUT) {
    delay(500);
    Serial.print(".");
  }
  
  bool success = WiFi.status() == WL_CONNECTED;
  
  if (success) {
    Serial.println("\nTest connection successful!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // Disconnect from test network
    WiFi.disconnect();
    
    // Restore AP mode
    WiFi.softAP(currentAPSSID.c_str(), AP_PASSWORD);
    
    // If we were previously connected to a network, reconnect
    if (hasCredentials) {
      WiFi.begin(credentials.ssid, credentials.password);
    }
    
    return true;
  } else {
    Serial.println("\nTest connection failed!");
    
    // Restore AP mode
    WiFi.softAP(currentAPSSID.c_str(), AP_PASSWORD);
    
    // If we were previously connected to a network, reconnect
    if (hasCredentials) {
      WiFi.begin(credentials.ssid, credentials.password);
    }
    
    return false;
  }
}

void handleDisconnection() {
  static int reconnectAttempts = 0;  // Make this static to persist between calls
  
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    Serial.println("Attempting to reconnect...");
    WiFi.begin(credentials.ssid, credentials.password);
    reconnectAttempts++;
    delay(RECONNECT_DELAY);
  } else {
    Serial.println("Max reconnection attempts reached");
    reconnectAttempts = 0;
  }
}

void updateDeviceStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Replace with your Firebase Function URL
    String serverUrl = "YOUR_FIREBASE_FUNCTION_URL";
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["deviceId"] = deviceId;
    doc["macAddress"] = WiFi.macAddress();
    doc["status"] = "connected";
    doc["rssi"] = WiFi.RSSI();
    doc["ip"] = WiFi.localIP().toString();
    
    String payload;
    serializeJson(doc, payload);
    
    int httpResponseCode = http.POST(payload);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Status updated successfully");
      
      StaticJsonDocument<200> responseDoc;
      deserializeJson(responseDoc, response);
      if (responseDoc["reset"] == true) {
        handleReset();
      }
    }
    
    http.end();
  }
}

void handleGetDeviceInfo() {
  String mac = WiFi.macAddress();
  String ip = WiFi.localIP().toString();
  bool isConnected = WiFi.status() == WL_CONNECTED;
  
  // Get device name from preferences
  preferences.begin("aquasweeper", false);
  String deviceName = preferences.getString("device_name", "AquaSweeper-" + mac.substring(mac.length() - 4));
  preferences.end();

  // Create JSON response with all device information
  StaticJsonDocument<512> doc;
  doc["macAddress"] = mac;
  doc["ipAddress"] = ip;
  doc["isConnected"] = isConnected;
  doc["name"] = deviceName;
  doc["firmwareVersion"] = "1.0.0";
  doc["wifiSSID"] = isConnected ? WiFi.SSID() : "";
  doc["wifiStrength"] = isConnected ? WiFi.RSSI() : 0;
  doc["uptime"] = millis() / 1000; // Uptime in seconds

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}
