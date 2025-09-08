// /screens/ItineraryScreen.js
import React, { useState } from 'react';
import { View, Text, Button, ScrollView, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const ItineraryScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { tripDraft, itinerary } = route.params || {};
  const auth = getAuth();

  const [saving, setSaving] = useState(false);

  const handleConfirmAndSave = async () => {
    if (!itinerary) {
      Alert.alert('No itinerary to save');
      return;
    }
    setSaving(true);
    try {
      const tripDoc = {
        title: tripDraft.title || `${tripDraft.theme} - ${tripDraft.destination}`,
        theme: tripDraft.theme,
        createdBy: auth.currentUser?.uid,
        members: [auth.currentUser?.uid],
        destination: tripDraft.destination,
        arrivalDateTime: tripDraft.arrivalTime,
        confirmed: true,
        spots: itinerary.spots || itinerary.places || [],
        itineraryLLM: itinerary,
        budget: itinerary.budget || {},
        createdAt: new Date().toISOString(),
      };

      const tripsCol = collection(db, 'trips');
      const tripRef = await addDoc(tripsCol, tripDoc);

      // Add tripId to user's document (assumes users collection keyed by uid)
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        myTrips: arrayUnion(tripRef.id),
      });

      Alert.alert('Saved', 'Itinerary saved to My Trips.');
      navigation.navigate('MyTrips');
    } catch (err) {
      console.warn('Save failed', err);
      Alert.alert('Save failed', String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontWeight: '700', marginBottom: 8 }}>Generated Itinerary</Text>
      <ScrollView style={{ flex: 1, marginBottom: 12 }}>
        <Text>{JSON.stringify(itinerary, null, 2)}</Text>
      </ScrollView>

      <Button title={saving ? 'Saving...' : 'Confirm & Save to My Trips'} onPress={handleConfirmAndSave} disabled={saving} />
    </View>
  );
};

export default ItineraryScreen;
