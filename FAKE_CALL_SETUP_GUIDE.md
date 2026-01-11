# Fake Call Feature - Setup Guide

## 🎯 Overview

The Fake Call feature allows users to simulate an incoming phone call from "Dad" as a safety mechanism. This can help users exit uncomfortable situations discreetly.

## ✅ Feature Status

**Status:** ✅ **FULLY INTEGRATED** (as of January 11, 2026)

The feature is now accessible from:
- **Home Screen** → Safety Tools → "Fake Call"

## 🚀 Quick Start

### 1. Basic Usage (No API Key Required)

The feature works out-of-the-box with a default script:

```
"Hey dear, just checking in. I'm heading your way now, should be there soon. Stay where it's safe."
```

**Steps:**
1. Open the app
2. Navigate to **Home** → **Safety Tools** → **Fake Call**
3. Tap **"Simulate Incoming Call"**
4. Wait for the "incoming call" screen
5. Tap the green **Accept** button
6. Listen to the AI-generated voice message
7. The call ends automatically

### 2. Advanced Usage (With AI Script Generation)

For unique, AI-generated scripts each time:

#### Step 1: Get a Groq API Key (FREE)

1. Visit [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign up for a free account
3. Create a new API key
4. Copy the key

#### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API key:
   ```
   EXPO_PUBLIC_OPENAI_API_KEY=gsk_your_actual_api_key_here
   ```

3. Restart the Expo development server:
   ```bash
   npm start
   ```

## 🎨 How It Works

### User Flow

```
┌─────────────────────────────────┐
│  User taps "Simulate Call"      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  AI generates unique script     │
│  (or uses default if no API)    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  iPhone-style incoming call UI  │
│  • Ringtone plays               │
│  • Phone vibrates               │
│  • Animated pulse effects       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  User accepts call              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  TTS speaks the script          │
│  (deep masculine voice)         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Call ends automatically        │
└─────────────────────────────────┘
```

### Technical Details

- **AI Model:** Groq's llama-3.1-8b-instant
- **TTS Engine:** Expo Speech (device-native)
- **Voice Settings:**
  - Pitch: 0.60 (very deep)
  - Rate: 0.78 (deliberate pace)
  - Preferred voices: Aaron, Fred (iOS)
- **Ringtone:** Custom iPhone ringtone
- **Vibration Pattern:** `[0, 300, 200, 300, 700]` (iPhone-style)

## 🎭 Script Examples

The AI generates natural, casual father-daughter check-in calls:

**Example 1:**
```
"Hey sweetie, just got your message. I'm on my way to pick you up, should be there shortly. Wait for me there."
```

**Example 2:**
```
"Hi dear, checking in on you. I'm heading over now, won't be long. Just hang tight."
```

**Example 3:**
```
"Hey, saw your ping. I'm coming to get you, almost there. Stay put for me."
```

### Script Constraints

The AI is programmed to:
- ✅ Use casual, natural English (no Hinglish/Hindi)
- ✅ Sound like a normal check-in call (NOT emergency)
- ✅ Keep it short (2-3 sentences)
- ✅ Avoid explicit location references
- ✅ Use vague arrival times ("soon", "shortly")
- ✅ Include subtle safety instructions ("wait there", "stay put")

## 🔧 Troubleshooting

### Issue: No sound during call

**Solution:**
- Check device volume
- Ensure phone is not in silent mode (feature should override, but check anyway)
- Restart the app

### Issue: TTS voice sounds robotic

**Solution:**
- This is expected on some devices
- iOS devices have better voice quality (Aaron, Fred voices)
- Android uses Google TTS engine

### Issue: "Preparing..." takes too long

**Solution:**
- Check internet connection (needed for AI script generation)
- If offline, it will use the default script
- API might be rate-limited (wait a few seconds)

### Issue: Script is always the same

**Solution:**
- Verify API key is set correctly in `.env`
- Check console logs for API errors
- Ensure Expo server was restarted after adding `.env`

### Issue: Feature not showing in app

**Solution:**
- Make sure you're on the latest version
- Navigate to: Home → Safety Tools → Fake Call
- If missing, check that `AppNavigator.js` includes FakeCallScreen

## 📱 Platform Support

| Platform | Ringtone | Vibration | TTS | AI Scripts |
|----------|----------|-----------|-----|------------|
| iOS      | ✅       | ✅        | ✅ (Best) | ✅ |
| Android  | ✅       | ✅        | ✅ (Good) | ✅ |
| Web      | ⚠️       | ❌        | ✅  | ✅ |

**Note:** Web version has limited audio/vibration support.

## 🎯 Use Cases

1. **Uncomfortable Social Situations:** Exit awkward conversations discreetly
2. **Safety Concerns:** Signal you're being monitored without alerting others
3. **Unwanted Attention:** Create a reason to leave
4. **Late Night Travel:** Deter potential threats by showing someone is tracking you
5. **First Dates:** Have an exit strategy if needed

## 🔐 Privacy & Security

- ✅ All processing happens on-device (except AI script generation)
- ✅ No call logs are created
- ✅ No data is stored or transmitted (except to Groq API for scripts)
- ✅ API calls are encrypted (HTTPS)
- ✅ No personal information is sent to the AI

## 🚀 Future Enhancements

Planned features:
- [ ] Custom caller name/photo
- [ ] Multiple contact presets (Mom, Friend, Boss)
- [ ] Scheduled fake calls
- [ ] Custom voice recordings
- [ ] Quick access widget
- [ ] Integration with emergency contacts

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review `FAKE_CALL_FEATURE_REPORT.md` for technical details
3. Check console logs for error messages

## 🎉 Credits

- **AI Model:** Groq (llama-3.1-8b-instant)
- **TTS:** Expo Speech
- **Audio:** Custom iPhone ringtone
- **Design:** iPhone-inspired call UI

---

**Last Updated:** January 11, 2026  
**Version:** 1.0.0
