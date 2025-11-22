# Firebase Configuration Guide for HeartLink

## 🔥 Firebase Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name: "HeartLink Dating App"
4. Enable Google Analytics (optional)
5. Create project

### 2. Enable Firebase Services

#### **Authentication:**
1. Go to "Authentication" → "Get Started"
2. Enable sign-in methods:
   - ✅ Email/Password
   - ✅ Google
   - ✅ Phone (optional)

#### **Cloud Firestore (Alternative to MongoDB):**
1. Go to "Firestore Database" → "Create Database"
2. Start in production mode
3. Choose location (closest to India)

#### **Storage (for images):**
1. Go to "Storage" → "Get Started"
2. Start in production mode
3. Set security rules (see below)

#### **Cloud Functions (optional for notifications):**
1. Go to "Functions" → "Get Started"
2. Enable billing (required for functions)

### 3. Get Firebase Config

1. Go to Project Settings (⚙️)
2. Scroll to "Your apps"
3. Click Web icon (</>)
4. Register app: "HeartLink Web"
5. Copy config object

### 4. Install Firebase SDK

```bash
cd /app/frontend
npm install firebase
```

### 5. Create Firebase Config File

Create `/app/frontend/src/firebase/config.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Optional: Messaging for notifications
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.log('Messaging not supported:', error);
}
export { messaging };

export default app;
```

### 6. Add Environment Variables

Add to `/app/frontend/.env`:

```env
# Existing variables
REACT_APP_BACKEND_URL=https://matchpulse-4.preview.emergentagent.com
WDS_SOCKET_PORT=443

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=heartlink-xxxxx.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=heartlink-xxxxx
REACT_APP_FIREBASE_STORAGE_BUCKET=heartlink-xxxxx.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:xxxxxx
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 7. Firebase Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile pictures
    match /profile_pictures/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Chat images
    match /chat_images/{matchId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### 8. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Messages collection
    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Matches collection
    match /matches/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## 🚀 Usage Examples

### Firebase Authentication (Google Sign-In)

```javascript
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/firebase/config';

// Google Sign In
const handleGoogleSignIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log('User:', user);
  } catch (error) {
    console.error('Sign in error:', error);
  }
};

// Sign Out
const handleSignOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
  }
};
```

### Firebase Storage (Upload Profile Picture)

```javascript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config';

const uploadProfilePicture = async (file, userId) => {
  try {
    // Create storage reference
    const storageRef = ref(storage, `profile_pictures/${userId}/${file.name}`);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

### Firebase Firestore (Store User Data)

```javascript
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Save user profile
const saveUserProfile = async (userId, userData) => {
  try {
    await setDoc(doc(db, 'users', userId), userData);
  } catch (error) {
    console.error('Error saving profile:', error);
  }
};

// Get user profile
const getUserProfile = async (userId) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error('Error getting profile:', error);
  }
};
```

### Firebase Cloud Messaging (Push Notifications)

```javascript
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/firebase/config';

// Request notification permission
const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY'
      });
      console.log('FCM Token:', token);
      return token;
    }
  } catch (error) {
    console.error('Notification permission error:', error);
  }
};

// Listen for messages
onMessage(messaging, (payload) => {
  console.log('Message received:', payload);
  // Show notification
});
```

## 📊 Database Migration (MongoDB to Firestore)

If you want to use Firestore instead of MongoDB:

### Firestore Collection Structure:

```
users/
  ├── {userId}
  │   ├── name: string
  │   ├── email: string
  │   ├── age: number
  │   ├── verified: boolean
  │   └── ...
  
matches/
  ├── {matchId}
  │   ├── user1_id: string
  │   ├── user2_id: string
  │   ├── matched: boolean
  │   └── compatibility_score: number

messages/
  ├── {messageId}
  │   ├── match_id: string
  │   ├── sender_id: string
  │   ├── content: string
  │   └── timestamp: timestamp
```

## 🔔 Push Notifications Setup

### 1. Generate VAPID Keys

```bash
cd functions
npm install -g firebase-tools
firebase login
firebase init
```

### 2. Create Firebase Function

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendMatchNotification = functions.firestore
  .document('matches/{matchId}')
  .onCreate(async (snap, context) => {
    const match = snap.data();
    
    if (match.matched) {
      // Send notification to both users
      const message = {
        notification: {
          title: 'New Match! 💕',
          body: 'You have a new match! Start chatting now.'
        },
        tokens: [match.user1_fcm_token, match.user2_fcm_token]
      };
      
      await admin.messaging().sendMulticast(message);
    }
  });
```

## 📝 Cost Considerations

### Free Tier Limits:
- **Authentication:** Unlimited
- **Firestore:** 
  - 1 GB storage
  - 50K reads/day
  - 20K writes/day
- **Storage:**
  - 5 GB storage
  - 1 GB download/day
- **Functions:**
  - 125K invocations/month
  - 40K GB-seconds

### Pricing After Free Tier:
- Firestore: $0.06 per 100K reads
- Storage: $0.026 per GB
- Functions: Pay as you go

## 🎯 Recommended Setup for HeartLink

### Option 1: Hybrid (Current MongoDB + Firebase)
- ✅ Keep MongoDB for user data (current setup)
- ✅ Use Firebase Storage for images
- ✅ Use Firebase Auth for Google Sign-In
- ✅ Use Firebase Cloud Messaging for notifications

### Option 2: Full Firebase
- ✅ Migrate to Firestore completely
- ✅ Use Firebase Storage for images
- ✅ Use Firebase Auth
- ✅ Use Firebase Cloud Messaging
- ❌ Requires code refactoring

**Recommended: Option 1 (Hybrid)**

## 🔧 Integration Priority

1. **Firebase Storage** (for images) - High Priority
2. **Firebase Auth** (Google Sign-In) - Medium Priority
3. **Firebase Cloud Messaging** (notifications) - Medium Priority
4. **Firestore** (database migration) - Low Priority

Would you like me to implement any specific Firebase feature?
