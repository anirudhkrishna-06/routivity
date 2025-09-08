// /screens/JoinTripScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';

const JoinTripScreen = () => {
  const [code, setCode] = useState('');
  const auth = getAuth();
  const navigation = useNavigation();

  const handleJoin = async () => {
    if (!code.trim()) {
      Alert.alert('Enter a trip code');
      return;
    }

    try {
      const tripRef = doc(db, 'trips', code.trim());
      const tripSnap = await getDoc(tripRef);
      if (!tripSnap.exists()) {
        Alert.alert('Trip not found', 'Check the code and try again.');
        return;
      }

      // Add user to members array
      await updateDoc(tripRef, {
        members: arrayUnion(auth.currentUser.uid),
      });

      // Also update user's joinedTrips
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        joinedTrips: arrayUnion(code.trim()),
      });

      Alert.alert('Joined', 'You have been added to the trip.');
      navigation.navigate('MyTrips');
    } catch (err) {
      console.warn('Join failed', err);
      Alert.alert('Error', String(err));
    }
  };

  return (
    <View style={{ padding: 12 }}>
      <Text>Enter Trip Code</Text>
      <TextInput value={code} onChangeText={setCode} placeholder="Trip ID / Code" />
      <Button title="Join Trip" onPress={handleJoin} />
    </View>
  );
};

export default JoinTripScreen;
