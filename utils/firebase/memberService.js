import { db } from '../../firebase';
import { 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc,
  query,
  collection,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';

// Get user profile from users collection
export const getUserProfile = async (userId) => {
  try {
    // Check if userId is valid
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn('Invalid userId provided:', userId);
      return getFallbackUserData(userId || 'unknown');
    }

    const userDoc = await getDoc(doc(db, 'users', userId.trim()));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return { 
        id: userDoc.id, 
        ...data,
        displayName: data.fullName || data.displayName || 'User',
        phoneNumber: data.contactNumber || data.phoneNumber || '',
        email: data.email || '',
        photoURL: data.photoURL || '',
        fullName: data.fullName || '',
        contactNumber: data.contactNumber || '',
        gender: data.gender || '',
        uid: data.uid || userDoc.id
      };
    } else {
      console.warn('User document not found for ID:', userId);
      return getFallbackUserData(userId);
    }
  } catch (error) {
    console.error('Error getting user profile for ID:', userId, error);
    return getFallbackUserData(userId);
  }
};

// Fallback user data for when profile can't be loaded
const getFallbackUserData = (userId) => {
  return {
    id: userId,
    displayName: `User (${userId.substring(0, 6)}...)`,
    email: '',
    phoneNumber: '',
    fullName: '',
    contactNumber: '',
    photoURL: '',
    isFallback: true,
  };
};

// Find user by contact number
export const findUserByContactNumber = async (contactNumber) => {
  try {
    // Remove any non-digit characters
    const cleanNumber = contactNumber.replace(/\D/g, '');
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('contactNumber', '==', cleanNumber));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      return {
        id: userDoc.id,
        ...data,
        displayName: data.fullName || 'User',
        phoneNumber: data.contactNumber || '',
        email: data.email || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Error finding user by contact number:', error);
    return null;
  }
};

// Find user by email
export const findUserByEmail = async (email) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      return {
        id: userDoc.id,
        ...data,
        displayName: data.fullName || 'User',
        phoneNumber: data.contactNumber || '',
        email: data.email || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
};

// Check if current user is trip admin
export const isTripAdmin = (trip, userId) => {
  return trip && trip.userId === userId;
};

// Check if user is a member of the trip
export const isTripMember = (trip, userId) => {
  if (!trip || !trip.members) return false;
  // Filter out empty strings when checking
  const validMembers = trip.members.filter(m => m && m.trim() !== '');
  return validMembers.includes(userId);
};

// Clean members array - remove empty strings and duplicates
const cleanMembersArray = (members) => {
  if (!members || !Array.isArray(members)) return [];
  
  // Remove empty strings and null values
  const cleaned = members.filter(m => 
    m && typeof m === 'string' && m.trim() !== ''
  );
  
  // Remove duplicates
  return [...new Set(cleaned)];
};

// Add member to trip
export const addMemberToTrip = async (tripId, memberId) => {
  try {
    console.log(`DEBUG: Adding member ${memberId} to trip ${tripId}`);
    console.log(`DEBUG: Current user UID: ${memberId}`);
    
    const tripRef = doc(db, 'trips', tripId);
    
    console.log(`DEBUG: Attempting update...`);
    await updateDoc(tripRef, {
      members: arrayUnion(memberId),
      updatedAt: new Date(),
    });
    
    console.log(`DEBUG: Update successful!`);
    return { success: true };
  } catch (error) {
    console.error('DEBUG: Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Remove member from trip (admin only)
export const removeMemberFromTrip = async (tripId, memberId) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    
    // Get current members
    const tripDoc = await getDoc(tripRef);
    if (!tripDoc.exists()) {
      return { success: false, error: 'Trip not found' };
    }
    
    const tripData = tripDoc.data();
    const currentMembers = cleanMembersArray(tripData.members || []);
    
    // Remove the member
    const updatedMembers = currentMembers.filter(id => id !== memberId);
    
    await updateDoc(tripRef, {
      members: updatedMembers,
      updatedAt: new Date(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: error.message };
  }
};

// Get all members with profiles
// Get all members with profiles
export const getTripMembersWithProfiles = async (trip) => {
  if (!trip.members || trip.members.length === 0) {
    return [];
  }

  try {
    const memberPromises = trip.members.map(memberId => getUserProfile(memberId));
    const members = await Promise.all(memberPromises);
    
    // Filter out null results and add admin flag
    return members
      .filter(member => member !== null)
      .map(member => ({
        ...member,
        isAdmin: trip.userId === member.id,
        joinedAt: trip.createdAt,
      }));
  } catch (error) {
    console.error('Error getting member profiles:', error);
    // Return at least the current user's profile as fallback
    const currentUserProfile = await getUserProfile(auth.currentUser.uid);
    return currentUserProfile ? [{
      ...currentUserProfile,
      isAdmin: trip.userId === auth.currentUser.uid,
      joinedAt: trip.createdAt,
    }] : [];
  }
};

// Generate invite code for trip
export const generateInviteCode = (tripId) => {
  return tripId;
};

// Validate invite code
export const validateInviteCode = async (code) => {
  try {
    const tripDoc = await getDoc(doc(db, 'trips', code));
    return tripDoc.exists();
  } catch (error) {
    console.error('Error validating invite code:', error);
    return false;
  }
};

// Clean up a trip's members array (remove empty strings)
export const cleanupTripMembers = async (tripId) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripDoc = await getDoc(tripRef);
    
    if (!tripDoc.exists()) {
      return { success: false, error: 'Trip not found' };
    }
    
    const tripData = tripDoc.data();
    const cleanedMembers = cleanMembersArray(tripData.members || []);
    
    // Only update if there's a change
    if (cleanedMembers.length !== (tripData.members || []).length) {
      await updateDoc(tripRef, {
        members: cleanedMembers,
        updatedAt: new Date(),
      });
      console.log(`Cleaned members array for trip ${tripId}`);
    }
    
    return { success: true, cleanedMembers };
  } catch (error) {
    console.error('Error cleaning trip members:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getUserProfile,
  isTripAdmin,
  isTripMember,
  addMemberToTrip,
  removeMemberFromTrip,
  getTripMembersWithProfiles,
  generateInviteCode,
  validateInviteCode,
  cleanupTripMembers,
};