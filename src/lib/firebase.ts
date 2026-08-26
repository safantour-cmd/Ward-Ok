import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, setLogLevel, disableNetwork, enableNetwork } from "firebase/firestore";
import firebaseConfigJson from "../../firebase-applet-config.json";

try {
  setLogLevel("silent");
} catch (e) {}

// Intercept window uncaught errors & console error spam for firestore quota limit to prevent console flooding
if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    if (
      msg.includes("resource-exhausted") ||
      msg.includes("Quota limit exceeded") ||
      msg.includes("Free daily write units per project") ||
      msg.includes("Using maximum backoff delay to prevent overloading")
    ) {
      // Gracefully silent repetitive quota logs in console
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom database ID if specified in config, else default
export const dbFirestore = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

// Check if quota cooldown is currently active in localStorage
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("firestore_quota_cooldown_until");
    if (stored) {
      const num = parseInt(stored, 10);
      if (!isNaN(num) && Date.now() < num) {
        disableNetwork(dbFirestore).catch(() => {});
      }
    }
  } catch (e) {}
}

export async function pauseFirestoreNetwork() {
  try {
    await disableNetwork(dbFirestore);
  } catch (e) {}
}

export async function resumeFirestoreNetwork() {
  try {
    await enableNetwork(dbFirestore);
  } catch (e) {}
}

// Test connection function as required by firebase skill
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(dbFirestore, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

