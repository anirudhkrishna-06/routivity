
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-file-system';
import { Camera } from 'expo-camera';


// Request camera permissions for scanning
export const requestCameraPermissions = async () => {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting camera permissions:', error);
    return false;
  }
};


// Generate QR code data for a trip
export const generateQRCodeData = (tripId, tripName) => {
  return JSON.stringify({
    type: 'trip_invite',
    tripId: tripId,
    tripName: tripName || 'Untitled Trip',
    timestamp: Date.now(),
  });
};

// Parse QR code data
export const parseQRCodeData = (data) => {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === 'trip_invite' && parsed.tripId) {
      return {
        isValid: true,
        tripId: parsed.tripId,
        tripName: parsed.tripName,
        timestamp: parsed.timestamp,
      };
    }
  } catch (error) {
    // If not JSON, check if it's just a trip ID
    if (data && data.length >= 20 && data.length <= 28) {
      return {
        isValid: true,
        tripId: data,
        tripName: 'Trip',
        timestamp: Date.now(),
      };
    }
  }
  return { isValid: false };
};

// Save QR code image to device
export const saveQRCodeImage = async (uri) => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Media library permission not granted');
    }

    const asset = await MediaLibrary.createAssetAsync(uri);
    const album = await MediaLibrary.getAlbumAsync('RoadTripApp');
    
    if (album === null) {
      await MediaLibrary.createAlbumAsync('RoadTripApp', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }
    
    return { success: true, uri: asset.uri };
  } catch (error) {
    console.error('Error saving QR code:', error);
    return { success: false, error: error.message };
  }
};

// Share QR code image
export const shareQRCodeImage = async (uri) => {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share Trip QR Code',
      UTI: 'public.image',
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error sharing QR code:', error);
    return { success: false, error: error.message };
  }
};

export default {
  requestCameraPermissions,
  generateQRCodeData,
  parseQRCodeData,
  saveQRCodeImage,
  shareQRCodeImage,
};