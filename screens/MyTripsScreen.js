// /screens/MyTripsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';

const MyTripsScreen = () => {
  const auth = getAuth();
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);
      try {
        const tripsRef = collection(db, 'trips');
        const q = query(tripsRef, where('members', 'array-contains', auth.currentUser.uid));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        setTrips(items);
      } catch (err) {
        console.warn('Failed to fetch trips', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

  if (loading) return <ActivityIndicator />;

  if (!trips.length) {
    return (
      <View style={{ padding: 12 }}>
        <Text>No trips yet. Create one from Plan Trip.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Itinerary', { tripDraft: item, itinerary: item.itineraryLLM })}
            style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
          >
            <Text style={{ fontWeight: '700' }}>{item.title}</Text>
            <Text>{item.destination}</Text>
            <Text>Members: {item.members?.length || 1}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default MyTripsScreen;
