// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAhcJQKCCcxE0uEjqvZLMzQCu0w5PIZoFo",
  authDomain: "routivity-ai.firebaseapp.com",
  projectId: "routivity-ai",
  storageBucket: "routivity-ai.firebasestorage.app",
  messagingSenderId: "1034210232718",
  appId: "1:1034210232718:web:db9fc29c058b5c51753cdf",
  measurementId: "G-ZZMXY461BQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export { auth };