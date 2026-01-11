# SafeSafar
### AI-Powered Women’s Safety Application  
**Theme:** AI for Societal Good  
**Buildathon:** OpenAI × NxtWave  
**Team Name:** Techspire

---

## Live Project

- **GitHub Repository:**  
  https://github.com/Pranav-chaudhari-2006/SafeSafar-Prototype

- **Status:** Deployed & Functional  
- **Platform:** Android (React Native – Expo)

---

## Overview

**SafeSafar** is a unified, AI-powered women’s safety application designed to provide **real-time emergency assistance, safe navigation, and community-driven protection**, even in **low-connectivity or offline environments**.
Unlike traditional safety apps that react after an incident occurs, SafeSafar focuses on **prevention, discretion, and fast response**, empowering women during everyday activities such as commuting, traveling alone, or navigating unfamiliar areas.

---

## Problem Statement

Women face increasing safety challenges due to:

- Delayed emergency response systems  
- Lack of discreet SOS mechanisms  
- Poor functionality in low or no internet connectivity  
- Privacy and data security concerns  
- Fragmented safety tools across multiple applications  

**Impact:**  
Over **736 million women (≈30% worldwide)** have experienced physical or sexual violence in their lifetime.

---

## Our Solution

SafeSafar provides a **single, intelligent safety ecosystem** that combines:

- Instant SOS alerts  
- AI-powered silent activation (extendable)  
- Safe route navigation  
- Community safety alerts  
- Encrypted evidence recording  
- Offline-first reliability  

All essential safety tools — **in one application**.

---

## Key Features

### Emergency SOS
- Emergency SOS button (press & hold)
- Quick SOS (location-only alert)
- Automatic audio recording during SOS
- Direct emergency calling
- Share live location via SMS and supported apps
- Real-time system readiness status

### Incident Reporting
- Anonymous incident reporting
- Supported incident categories:
  - Harassment
  - Stalking
  - Assault
  - Unsafe Area
  - Theft / Robbery
  - Public Disturbance
  - Traffic Incident
- Location-based reporting with detailed descriptions
- Community-visible reports to improve public safety

### Safety & Navigation
- Safe Route Navigation using Google Maps
- Incident-aware routing to avoid reported danger zones
- Option to avoid unsafe areas and alleys
- Multiple travel modes (Walk / Drive / Bike)

### Safety Checkpoints
- Discover nearby police stations
- Locate safe zones and help centers
- Quick navigation to emergency-safe locations

### Safety Network
- Safety Network with trusted contacts
- Community alerts during emergency situations
- Nearby users can respond faster than traditional systems
- Incident history and alert tracking

### Safety Tips & Awareness
- Curated safety tips and best practices
- Awareness content for preventive safety
- Guidance for handling risky situations

### Emergency Contacts
- Quick access to emergency contact numbers
- One-tap calling during critical situations
- Easy management of saved emergency contacts

### Incident History
- View past SOS activations
- Track previously reported incidents
- Timeline-based history for user reference

### Offline Support
- SOS functionality works without internet
- Location and audio stored locally
- Automatic data sync when connectivity is restored

### Privacy & Security
- Anonymous reporting by default
- Secure user authentication
- Encrypted storage for sensitive data
- User-controlled access to personal information

---

## Implemented Screens

- Login & Google Authentication
- Home Dashboard
- Emergency SOS Screen
- Incident Reporting Flow
- Safe Route Navigation
- Safety Tips & Resources
- Settings & Account Management

---

## How It Works

### SOS Flow (Online)
1. User activates SOS
2. GPS location is captured
3. Audio recording starts automatically
4. Emergency contacts are notified
5. Community members are alerted
6. Data is securely stored

### SOS Flow (Offline)
1. Location and audio are saved locally
2. Data syncs automatically once internet is available
3. Alerts are sent immediately after reconnection

---

## AI & Intelligent Features

- **Whisper (Extendable):**
  - Silent voice-based SOS activation

- **GPT (Extendable):**
  - Fake call generation
  - Intelligent emergency assistance

- **AI Safety Insights (Extendable):**
  - Predictive unsafe zone detection

> The current prototype is designed to seamlessly integrate advanced AI capabilities.

---

## Tech Stack

### Frontend
- React Native (Expo)
- JavaScript

### Backend
- Supabase
  - Authentication
  - PostgreSQL Database
  - Storage
  - Realtime Updates

### Maps & Location
- Google Maps API
- Geolocation Services

### Alerts & Communication
- Supabase Realtime
- SMS / App-based alerts (extendable)

### Offline Storage
- SQLite
- Local caching

### Deployment
- Supabase Cloud
- Expo

---

## Project Structure

SafeSafar-Prototype/
│
├── assets/ # Images & static assets
├── src/ # Application source code
│ ├── screens/ # App screens
│ ├── components/ # Reusable UI components
│ ├── services/ # Backend & API logic
│
├── complete_schema.sql # Database schema
├── App.js # Application entry point
├── index.js # Root file
├── app.json # Expo configuration
├── package.json # Dependencies


---

## Installation & Setup

### Prerequisites
- Node.js
- Expo CLI
- Supabase project
- Google Maps API key

### Steps
git clone https://github.com/Pranav-chaudhari-2006/SafeSafar-Prototype
cd SafeSafar-Prototype
npm install
expo start

Configure Supabase credentials and API keys in environment variables.

### Impact
-Faster emergency response
-Community-driven protection
-Increased confidence for women
-Reduced public safety risks

SafeSafar empowers women with technology, intelligence, and community support.

### Team Techspire
-Mayuresh Mandalik
-Pranav Chaudhari
-Shreya Jadhav
-Madhura Barve

### Disclaimer
SafeSafar is a supportive safety tool and does not replace official emergency services.
Always contact local authorities in critical situations.

### Vision
SafeSafar is not just an application — it’s a movement.
Building a safer, smarter, and more connected world for women.

