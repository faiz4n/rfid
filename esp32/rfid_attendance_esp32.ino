#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

#define GREEN_LED 2
#define RED_LED 15
#define BUZZER 4

const char *WIFI_SSID = "OPPO Reno14 5G";
const char *WIFI_PASSWORD = "99999999";
const char *API_BASE_URL = "https://rfid-backend-nic6.onrender.com";
const char *DEVICE_ID = "gate-1";

MFRC522 mfrc522(5, 22);

// Simple arrays for caching allowed and denied cards offline
String authCache[50], denyCache[50];
int authCnt = 0, denyCnt = 0;
unsigned long lastWiFiAttempt = 0;
const unsigned long WIFI_RETRY_INTERVAL = 10000; // Retry every 10 seconds

void beep(int pin, int times, int dur) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH); digitalWrite(BUZZER, HIGH); delay(dur);
    digitalWrite(pin, LOW); digitalWrite(BUZZER, LOW); if (times > 1) delay(50);
  }
}

void addCache(String *arr, int &cnt, String u) {
  for (int i = 0; i < cnt; i++) if (arr[i] == u) return;
  if (cnt < 50) arr[cnt++] = u;
}

void rmCache(String *arr, int &cnt, String u) {
  for (int i = 0; i < cnt; i++) if (arr[i] == u) { arr[i] = arr[--cnt]; return; }
}

bool inCache(String *arr, int cnt, String u) {
  if (u == "FE 7E E5 0") return true; // Static fallback
  for (int i = 0; i < cnt; i++) if (arr[i] == u) return true;
  return false;
}

void connectToWiFi() {
  unsigned long now = millis();
  if (now - lastWiFiAttempt < WIFI_RETRY_INTERVAL) {
    return; // Too soon to retry
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    lastWiFiAttempt = now;
    Serial.println("[WiFi] Attempting to connect...");
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(true);
    delay(100);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=== RFID Attendance System Starting ===");
  
  Serial.println("[SETUP] Initializing pins...");
  pinMode(GREEN_LED, OUTPUT); pinMode(RED_LED, OUTPUT); pinMode(BUZZER, OUTPUT);
  digitalWrite(GREEN_LED, HIGH); delay(200); digitalWrite(GREEN_LED, LOW);
  Serial.println("[SETUP] LEDs OK");
  
  Serial.println("[SETUP] Initializing RFID reader...");
  SPI.begin(18, 19, 23, 5); mfrc522.PCD_Init();
  Serial.println("[SETUP] RFID OK");
  
  Serial.println("[SETUP] Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int retries = 20;
  while (WiFi.status() != WL_CONNECTED && retries--) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Connection failed, will retry in loop");
  }
  
  Serial.println("=== Ready to scan cards ===\n");
}

void loop() {
  // Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    digitalWrite(RED_LED, HIGH); // Red light when no WiFi
    delay(100);
    return;
  }
  
  digitalWrite(RED_LED, LOW); // Green light when WiFi OK
  
  // Check for card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    delay(50);
    return;
  }
  
  Serial.println("[Card] CARD DETECTED!!!");
  
  if (!mfrc522.PICC_ReadCardSerial()) {
    Serial.println("[Card] Failed to read");
    return;
  }

  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) 
    uid += String(mfrc522.uid.uidByte[i], HEX) + (i == mfrc522.uid.size - 1 ? "" : " ");
  uid.toUpperCase();
  Serial.println("[Card] ✓ UID: " + uid);

  int status = -1;
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[API] Sending scan...");
    HTTPClient http;
    http.begin(String(API_BASE_URL) + "/api/attendance/scan");
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST("{\"uid\":\"" + uid + "\",\"deviceId\":\"" + String(DEVICE_ID) + "\"}");
    Serial.println("[API] HTTP: " + String(httpCode));
    
    if (httpCode >= 200 && httpCode < 300) {
      String res = http.getString();
      Serial.println("[API] Response: " + res);
      status = res.indexOf("\"capture\"") > 0 ? 2 : (res.indexOf("\"entered\"") > 0 || res.indexOf("\"exited\"") > 0 ? 1 : 0);
    }
    http.end();
  }

  bool ok = false;
  if (status == 1 || status == 2) { 
    ok = true; rmCache(denyCache, denyCnt, uid); addCache(authCache, authCnt, uid); 
  } else if (status == 0) { 
    rmCache(authCache, authCnt, uid); addCache(denyCache, denyCnt, uid); 
  } else { 
    ok = inCache(authCache, authCnt, uid) && !inCache(denyCache, denyCnt, uid); 
    Serial.println("[Cache] Using offline cache");
  }

  // Visual & Audio Feedback
  if (status == 2) {
    Serial.println("[Beep] CAPTURE");
    beep(GREEN_LED, 1, 120);
  }
  else if (ok) {
    Serial.println("[Beep] SUCCESS");
    beep(GREEN_LED, 1, 200);
  }
  else {
    Serial.println("[Beep] DENIED");
    beep(RED_LED, 2, 150);
  }

  mfrc522.PICC_HaltA(); 
  delay(500);
}
