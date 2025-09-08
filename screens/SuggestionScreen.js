// /screens/SuggestionsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, ActivityIndicator } from 'react-native';
import SelectableTile from '../components/selectableTile'
import { useNavigation, useRoute } from '@react-navigation/native';

const BASE_URL = 'https://YOUR_BACKEND_BASE_URL'; // <-- replace

const SuggestionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { tripDraft, suggestions: initialSuggestions = [] } = route.params || {};

  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If server returned nothing, optionally fetch fallback recommended suggestions
    if (!suggestions || suggestions.length === 0) {
      // Could call backend to fetch default suggestions; skipping for brevity
    }
  }, []);

  const toggleSelect = (item) => {
    const id = item.id || item.name || item.title;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleGenerateItinerary = async () => {
    setLoading(true);
    const payload = {
      tripDraft,
      selectedSuggestions: suggestions.filter((s) => selectedIds.includes(s.id || s.name || s.title)),
    };

    try {
      const res = await fetch(`${BASE_URL}/api/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const itinerary = data.itinerary || data; // depends on backend
      navigation.navigate('Itinerary', { tripDraft, itinerary });
    } catch (err) {
      console.warn('Itinerary generation failed', err);
      navigation.navigate('Itinerary', { tripDraft, itinerary: null });
    } finally {
      setLoading(false);
    }
  };

  if (!suggestions) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>No suggestions available.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontWeight: '700', marginBottom: 8 }}>Tap to add suggestions</Text>
      <FlatList
        data={suggestions}
        keyExtractor={(item, idx) => String(item.id || item.name || item.title || idx)}
        renderItem={({ item }) => {
          const id = item.id || item.name || item.title;
          const isSelected = selectedIds.includes(id);
          return <SelectableTile item={item} selected={isSelected} onPress={toggleSelect} />;
        }}
      />

      <View style={{ marginVertical: 12 }}>
        {loading ? <ActivityIndicator /> : <Button title="Generate Itinerary" onPress={handleGenerateItinerary} />}
      </View>
    </View>
  );
};

export default SuggestionsScreen;
