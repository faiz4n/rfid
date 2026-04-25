#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

#define GREEN_LED 2
#define RED_LED 15
#define BUZZER 4

const char *WIFI_SSID = "OPPO Reno14 5G";
const char *WIFI_PASSWORD = "99999999";
const char *API_BASE_URL = "http://10.85.96.254:5000";
const char *DEVICE_ID = "gate-1";

MFRC522 mfrc522(5, 22);

// Simple arrays for caching allowed and denied cards offline
String authCache[50], denyCache[50];
int authCnt = 0, denyCnt = 0;

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

void setup() {
  Serial.begin(115200);
  pinMode(GREEN_LED, OUTPUT); pinMode(RED_LED, OUTPUT); pinMode(BUZZER, OUTPUT);
  SPI.begin(18, 19, 23, 5); mfrc522.PCD_Init();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) return;
  if (WiFi.status() != WL_CONNECTED) WiFi.begin(WIFI_SSID, WIFI_PASSWORD); // Reconnect silently

  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) 
    uid += String(mfrc522.uid.uidByte[i], HEX) + (i == mfrc522.uid.size - 1 ? "" : " ");
  uid.toUpperCase();
  Serial.println("UID Scanned: " + uid);

  int status = -1; // -1: Network error, 0: Denied, 1: Success, 2: Capture
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(API_BASE_URL) + "/api/attendance/scan");
    http.addHeader("Content-Type", "application/json");
    if (http.POST("{\"uid\":\"" + uid + "\",\"deviceId\":\"" + String(DEVICE_ID) + "\"}") >= 200) {
      String res = http.getString();
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
    Serial.println("No Network/Server - Using Local Cache");
  }

  // Visual & Audio Feedback
  if (status == 2) beep(GREEN_LED, 1, 120); // Capture beep
  else ok ? beep(GREEN_LED, 1, 500) : beep(RED_LED, 2, 150); // Valid beep vs Deny beeps

  mfrc522.PICC_HaltA(); delay(200);
}
