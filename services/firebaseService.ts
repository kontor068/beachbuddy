
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig";
import { Island } from "../types";

// FIX: Standardizing Firebase initialization using named imports from 'firebase/app' to resolve type errors.
// This handles modular SDK patterns correctly and ensures members are recognized by the TypeScript compiler.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// FIX: Exported the Firestore instance to be reused by other components, reducing initialization redundancy and errors.
export { db };

export const fetchIslandsFromDB = async (): Promise<Island[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "islands"));
    const islands: Island[] = [];
    querySnapshot.forEach((doc) => {
      islands.push(doc.data() as Island);
    });
    return islands;
  } catch (error) {
    console.error("Error fetching islands from DB:", error);
    return [];
  }
};