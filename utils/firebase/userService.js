import { db } from '../../firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Create or update user profile
export const updateUserProfile = async (userData) => {
  try {
    const auth = getAuth();
    const userId = auth.currentUser.uid;
    
    const userRef = doc(db, 'users', userId);
    
    // Get existing profile to preserve data
    const existingDoc = await getDoc(userRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};
    
    // Merge existing data with new data
    const updatedData = {
      ...existingData,
      ...userData,
      updatedAt: new Date(),
      email: auth.currentUser.email,
    };

    // Set createdAt if this is a new profile
    if (!existingDoc.exists()) {
      updatedData.createdAt = new Date();
      updatedData.displayName = auth.currentUser.displayName || '';
      updatedData.phoneNumber = auth.currentUser.phoneNumber || '';
      updatedData.photoURL = auth.currentUser.photoURL || '';
    }

    await setDoc(userRef, updatedData, { merge: true });
    return { success: true, data: updatedData };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: error.message };
  }
};

// Get current user profile
export const getCurrentUserProfile = async () => {
  try {
    const auth = getAuth();
    const userId = auth.currentUser.uid;
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    
    // Create default profile if doesn't exist
    const defaultProfile = {
      displayName: auth.currentUser.displayName || '',
      email: auth.currentUser.email || '',
      phoneNumber: auth.currentUser.phoneNumber || '',
      photoURL: auth.currentUser.photoURL || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await setDoc(userRef, defaultProfile);
    return { id: userId, ...defaultProfile };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Get user profile by ID
export const getUserProfileById = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile by ID:', error);
    return null;
  }
};

export default {
  updateUserProfile,
  getCurrentUserProfile,
  getUserProfileById,
};