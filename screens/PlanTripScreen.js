// /screens/PlanTripScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Platform, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';

const BASE_URL = 'https://YOUR_BACKEND_BASE_URL'; 

const PlanTripScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();

  const [theme, setTheme] = useState('Hidden Gems');
  const [destination, setDestination] = useState('Chennai Airport');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [arrivalTime, setArrivalTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [mealPref, setMealPref] = useState('veg'); // 'veg' or 'non-veg'
  const [breakFreq, setBreakFreq] = useState('1'); // number of breaks
  const [additionalOptions, setAdditionalOptions] = useState({
    scenic: true,
    kidFriendly: false,
    lowBudget: false,
  });

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) setArrivalTime(selectedTime);
  };

  const handleSubmit = async () => {

    const tripDraft = {
      theme,
      destination,
      date: date.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
      mealPref,
      breakFreq: Number(breakFreq),
      additionalOptions,
      createdBy: auth.currentUser?.uid,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${BASE_URL}/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripDraft),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn('Suggestions fetch failed', txt);
        // still navigate with empty suggestions
      }
      const data = await res.json().catch(() => ({}));
      const suggestions = data.suggestions || []; // expecting array of items
      navigation.navigate('Suggestions', { tripDraft, suggestions });
    } catch (err) {
      console.warn('Error fetching suggestions', err);
      navigation.navigate('Suggestions', { tripDraft, suggestions: [] });
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Theme</Text>
      <TextInput value={theme} onChangeText={setTheme} placeholder="Theme (e.g., Hidden Gems)" />

      <Text>Destination</Text>
      <TextInput value={destination} onChangeText={setDestination} placeholder="Destination" />

      <Text>Date</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
        <Text>{date.toDateString()}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} />
      )}

      <Text>Arrival Time (deadline at destination)</Text>
      <TouchableOpacity onPress={() => setShowTimePicker(true)}>
        <Text>{arrivalTime.toLocaleTimeString()}</Text>
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          value={arrivalTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      <Text>Meal Preference</Text>
      <View style={{ flexDirection: 'row', marginVertical: 8 }}>
        <TouchableOpacity onPress={() => setMealPref('veg')} style={{ marginRight: 16 }}>
          <Text>{mealPref === 'veg' ? '● Veg' : '○ Veg'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMealPref('non-veg')}>
          <Text>{mealPref === 'non-veg' ? '● Non-Veg' : '○ Non-Veg'}</Text>
        </TouchableOpacity>
      </View>

      <Text>Break Frequency (approx stops)</Text>
      <TextInput
        keyboardType="numeric"
        value={String(breakFreq)}
        onChangeText={(v) => setBreakFreq(v.replace(/[^0-9]/g, '') || '0')}
      />

      <Text style={{ marginTop: 12 }}>Additional Options</Text>
      <View style={{ flexDirection: 'row', marginVertical: 8 }}>
        <TouchableOpacity
          onPress={() => setAdditionalOptions({ ...additionalOptions, scenic: !additionalOptions.scenic })}
          style={{ marginRight: 12 }}
        >
          <Text>{additionalOptions.scenic ? '● Scenic' : '○ Scenic'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            setAdditionalOptions({ ...additionalOptions, kidFriendly: !additionalOptions.kidFriendly })
          }
          style={{ marginRight: 12 }}
        >
          <Text>{additionalOptions.kidFriendly ? '● Kid-friendly' : '○ Kid-friendly'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAdditionalOptions({ ...additionalOptions, lowBudget: !additionalOptions.lowBudget })}
        >
          <Text>{additionalOptions.lowBudget ? '● Low-budget' : '○ Low-budget'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 20 }}>
        <Button title="Get Suggestions" onPress={handleSubmit} />
      </View>
    </View>
  );
};

export default PlanTripScreen;
