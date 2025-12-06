import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { parseQRCodeData } from '../../utils/qrCodeService';
import { getAuth } from 'firebase/auth';
import { addMemberToTrip } from '../../utils/firebase/memberService';
import { Camera, CameraType } from 'expo-camera';



const { width } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.7;

const QRScannerScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [cameraRef, setCameraRef] = useState(null);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setHasPermission(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    
    setScanned(true);
    setScanning(false);
    
    const parsedData = parseQRCodeData(data);
    setScannedData(parsedData);
    
    if (parsedData.isValid) {
      setShowResultModal(true);
    } else {
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not a valid trip invitation.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanned(false);
              setScanning(true);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  };

  const handleJoinTrip = async () => {
    if (!scannedData?.tripId) return;
    
    setProcessing(true);
    
    try {
      const result = await addMemberToTrip(scannedData.tripId, auth.currentUser.uid);
      
      if (result.success) {
        Alert.alert(
          'Success!',
          `You've joined "${scannedData.tripName || 'the trip'}"`,
          [
            {
              text: 'Go to Trip',
              onPress: () => {
                navigation.replace('TripDashboard', { tripId: scannedData.tripId });
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to join trip');
        setShowResultModal(false);
        setScanned(false);
        setScanning(true);
      }
    } catch (error) {
      console.error('Error joining trip:', error);
      Alert.alert('Error', 'Failed to join trip. Please try again.');
      setShowResultModal(false);
      setScanned(false);
      setScanning(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowResultModal(false);
    setScanned(false);
    setScanning(true);
  };

  const toggleFlash = async () => {
  if (cameraRef) {
    try {
      setFlashOn(!flashOn);
    } catch (error) {
      console.error('Error toggling flash:', error);
    }
  }
};

  const handleGoBack = () => {
    navigation.goBack();
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        
        <View style={styles.noPermissionContainer}>
          <Ionicons name="camera-off" size={64} color="#ccc" />
          <Text style={styles.noPermissionTitle}>Camera Access Required</Text>
          <Text style={styles.noPermissionText}>
            To scan QR codes, please allow camera access in your device settings.
          </Text>
          
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              // Can't open settings directly in Expo, so show instructions
              Alert.alert(
                'Enable Camera Access',
                'Please go to your device Settings > Privacy > Camera and enable camera access for this app.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'OK', onPress: requestCameraPermission },
                ]
              );
            }}
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={styles.container}>
      {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* Scanner View */}
        <View style={styles.scannerContainer}>
          {hasPermission && (
            <Camera
              style={StyleSheet.absoluteFillObject}
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              ref={(ref) => setCameraRef(ref)}
              type={CameraType.back}
              flashMode={flashOn ? Camera.Constants.FlashMode.torch : Camera.Constants.FlashMode.off}
            />
          )}
          
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            <View style={styles.topOverlay} />
            <View style={styles.middleOverlay}>
              <View style={styles.leftOverlay} />
              <View style={styles.scannerFrame}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
              </View>
              <View style={styles.rightOverlay} />
            </View>
            <View style={styles.bottomOverlay}>
              <Text style={styles.scanInstructions}>
                Position the QR code within the frame
              </Text>
              <Text style={styles.scanHint}>
                The scanner will automatically detect the code
              </Text>
            </View>
          </View>
          
          {/* Flashlight Button (optional) */}
          <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
            <Ionicons 
              name={flashOn ? "flashlight" : "flashlight-outline"} 
              size={28} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

      {/* Scanning Status */}
      <View style={styles.statusContainer}>
        {scanning && !scanned && (
          <View style={styles.scanningStatus}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.scanningText}>Scanning...</Text>
          </View>
        )}
        
        {scanned && (
          <View style={styles.scannedStatus}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.scannedText}>QR Code Detected!</Text>
          </View>
        )}
      </View>

      {/* Manual Entry Option */}
      <TouchableOpacity
        style={styles.manualEntryButton}
        onPress={() => navigation.navigate('JoinTrip')}
      >
        <Ionicons name="keypad" size={20} color="#666" />
        <Text style={styles.manualEntryText}>Enter Trip ID Manually</Text>
      </TouchableOpacity>

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="qr-code" size={28} color="#007AFF" />
              <Text style={styles.modalTitle}>Trip Invitation Found</Text>
            </View>
            
            <View style={styles.tripInfoCard}>
              <Text style={styles.tripName}>
                {scannedData?.tripName || 'Trip Invitation'}
              </Text>
              <View style={styles.tripIdContainer}>
                <Text style={styles.tripIdLabel}>Trip ID:</Text>
                <Text style={styles.tripIdValue}>{scannedData?.tripId}</Text>
              </View>
            </View>
            
            <Text style={styles.modalMessage}>
              Would you like to join this trip?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancel}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.joinButton]}
                onPress={handleJoinTrip}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color="#fff" />
                    <Text style={styles.joinButtonText}>Join Trip</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  permissionText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  topOverlay: {
    flex: 1,
  },
  middleOverlay: {
    flexDirection: 'row',
    height: SCANNER_SIZE,
  },
  leftOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  rightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scannerFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#007AFF',
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#007AFF',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#007AFF',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#007AFF',
  },
  bottomOverlay: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  scanInstructions: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  scanHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  flashButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    borderRadius: 30,
  },
  statusContainer: {
    padding: 20,
    alignItems: 'center',
  },
  scanningStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanningText: {
    color: 'white',
    marginLeft: 12,
    fontSize: 16,
  },
  scannedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scannedText: {
    color: '#4CAF50',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  noPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    marginBottom: 12,
  },
  noPermissionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  settingsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  manualEntryText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '85%',
    padding: 24,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  tripInfoCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  tripName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  tripIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripIdLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  tripIdValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default QRScannerScreen;