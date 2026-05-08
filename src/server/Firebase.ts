import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;

try {
  // Try to initialize Firebase Admin SDK
  // It relies on FIREBASE_SERVICE_ACCOUNT environment variable containing a stringified JSON key
  // OR GOOGLE_APPLICATION_CREDENTIALS pointing to the json file.
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    console.log('[Firebase] Successfully connected to Google Cloud Firestore.');
  } else {
    console.warn(
      '[Firebase] FIREBASE_SERVICE_ACCOUNT not found in environment. Running with in-memory storage fallback.',
    );
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Firebase:', error);
}

/**
 * Saves a trip object to Firestore.
 */
export async function saveTripToFirestore(trip: any): Promise<void> {
  if (!db) return; // Fallback to memory
  try {
    await db.collection('trips').doc(trip.tripId).set(trip);
    console.log(`[Firebase] Successfully saved trip ${trip.tripId} to Firestore.`);
  } catch (error) {
    console.error(`[Firebase] Failed to save trip ${trip.tripId} to Firestore:`, error);
  }
}

/**
 * Retrieves a trip object from Firestore.
 */
export async function getTripFromFirestore(tripId: string): Promise<any | null> {
  if (!db) return null; // Fallback to memory
  try {
    const doc = await db.collection('trips').doc(tripId).get();
    if (doc.exists) {
      return doc.data();
    }
  } catch (error) {
    console.error(`[Firebase] Failed to fetch trip ${tripId} from Firestore:`, error);
  }
  return null;
}
