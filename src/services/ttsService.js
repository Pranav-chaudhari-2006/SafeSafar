import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Speaks text using device-native TTS (Expo Speech).
 * Optimized for STRONG, PROTECTIVE, AUTHORITATIVE father voice.
 * Deep pitch (0.60) + deliberate pace (0.78) for maximum authority.
 * This uses the device's built-in text-to-speech engine.
 * NO OpenAI TTS API calls - completely client-side.
 * 
 * @param {string} text - The text to speak
 * @param {Object} options - Optional speech configuration
 * @returns {Promise<boolean>} - Returns true if speech started successfully
 */
export async function speakText(text, options = {}) {
  if (!text || text.trim().length === 0) {
    console.warn('No text provided for TTS');
    return false;
  }

  try {
    console.log('Speaking text with device TTS:', text);
    
    // Stop any ongoing speech
    await Speech.stop();
    
    // Get available voices for male selection (iOS)
    let selectedVoice = null;
    if (Platform.OS === 'ios') {
      const voices = await Speech.getAvailableVoicesAsync();
      // Prioritize deep, authoritative male voices
      // Priority: Aaron (deep, mature) > Fred (older, gravelly) > Daniel (standard male)
      const maleVoices = voices.filter(v => 
        v.language.startsWith('en') && 
        (v.identifier.toLowerCase().includes('aaron') ||
         v.identifier.toLowerCase().includes('fred') ||
         v.identifier.toLowerCase().includes('daniel') ||
         v.identifier.toLowerCase().includes('james') ||
         v.identifier.toLowerCase().includes('male'))
      );
      
      // Pick Aaron first if available (deepest, most authoritative)
      const aaronVoice = maleVoices.find(v => v.identifier.toLowerCase().includes('aaron'));
      const fredVoice = maleVoices.find(v => v.identifier.toLowerCase().includes('fred'));
      
      if (aaronVoice) {
        selectedVoice = aaronVoice.identifier;
        console.log('🎙️ Selected AUTHORITATIVE voice: Aaron (deep, protective)');
      } else if (fredVoice) {
        selectedVoice = fredVoice.identifier;
        console.log('🎙️ Selected STRONG voice: Fred (mature, gravelly)');
      } else if (maleVoices.length > 0) {
        selectedVoice = maleVoices[0].identifier;
        console.log('🎙️ Selected male voice:', selectedVoice);
      } else {
        console.log('⚠️ No male voice found, using default');
      }
    }
    
    // Configure speech options for AUTHORITATIVE FATHER voice
    // Pitch: 0.60 = very deep, commanding presence (lower than standard masculine)
    // Rate: 0.78 = deliberate, measured pace (conveys control and seriousness)
    const speechOptions = {
      language: 'en-US',
      pitch: 0.60,        // VERY DEEP authoritative voice (0.5=deepest, 1.0=normal)
      rate: 0.78,         // DELIBERATE protective pace (slower = more authority)
      voice: selectedVoice, // Prioritized Aaron/Fred for maximum depth
      ...options
    };
    
    console.log('Speech options:', speechOptions);
    
    // Speak the text
    Speech.speak(text, speechOptions);
    
    return true;
  } catch (err) {
    console.error('Device TTS failed:', err?.message || err);
    return false;
  }
}

/**
 * Stops any ongoing speech.
 */
export async function stopSpeech() {
  try {
    await Speech.stop();
    console.log('Speech stopped');
  } catch (err) {
    console.warn('Failed to stop speech:', err?.message);
  }
}

/**
 * Check if speech is currently in progress.
 * @returns {Promise<boolean>}
 */
export async function isSpeaking() {
  try {
    return await Speech.isSpeakingAsync();
  } catch (err) {
    console.warn('Failed to check speaking status:', err?.message);
    return false;
  }
}
