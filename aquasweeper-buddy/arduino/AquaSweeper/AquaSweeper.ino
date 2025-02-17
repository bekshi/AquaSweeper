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
  server.sendHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
}

void handleDiscover() {
  Serial.println("Received /discover request");
  Serial.print("Method: ");
  Serial.println(server.method() == HTTP_GET ? "GET" : 
                server.method() == HTTP_POST ? "POST" : 
                server.method() == HTTP_OPTIONS ? "OPTIONS" : "OTHER");
  
  // Always add CORS headers first
  addCORSHeaders();
  
  if (server.method() == HTTP_OPTIONS) {
    Serial.println("Handling OPTIONS request");
    server.send(204);
    return;
  }

  // Create simple static response for faster processing
  String response = "{\"deviceName\":\"AquaSweeper-" + getDeviceId() + 
                   "\",\"type\":\"AquaSweeper\"" + 
                   ",\"ip\":\"" + WiFi.softAPIP().toString() + 
                   "\",\"wifi_connected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + "}";
  
  Serial.println("Sending response:");
  Serial.println(response);
  
  server.sendHeader("Content-Type", "application/json");
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
  String json = "{";
  json += "\"name\":\"" + deviceName + "\",";
  json += "\"mac\":\"" + WiFi.macAddress() + "\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\"";
  json += "}";
  
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);
  Serial.println("\nAquaSweeper Starting...");

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

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
  
  // Try WiFi connection if needed
  if (shouldTryWiFiConnection) {
    connectToWiFi();
  }
  
  // Check WiFi connection status
  if (WiFi.status() != lastWiFiStatus) {
    lastWiFiStatus = WiFi.status();
    if (lastWiFiStatus == WL_CONNECTED) {
      Serial.print("Connected to WiFi. IP: ");
      Serial.println(WiFi.localIP());
      isConnectingToWiFi = false;
    } else if (lastWiFiStatus == WL_CONNECT_FAILED) {
      Serial.println("Failed to connect to WiFi");
      isConnectingToWiFi = false;
    }
  }
  
  // Check connection timeout
  if (isConnectingToWiFi && (millis() - wifiConnectStartTime > 20000)) {
    Serial.println("WiFi connection timed out");
    isConnectingToWiFi = false;
    WiFi.disconnect();
  }
  
  delay(1); // Minimal delay to prevent watchdog issues while keeping response time fast
}