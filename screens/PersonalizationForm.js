// /screens/PersonalizationForm.js
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

const travelStyles = [
  'Adventurer',
  'Relaxer',
  'Cultural Explorer',
  'Foodie',
  'Socializer',
];

const budgets = ['Budget', 'Mid-range', 'Luxury'];
const paces = ['Fast', 'Balanced', 'Slow'];
const foodPreferences = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Jain', 'Other'];
const companionsOptions = ['Solo', 'Friends', 'Family with kids', 'Couple'];
const activitiesList = [
  'Trekking',
  'Beaches',
  'Wildlife',
  'Heritage',
  'Food & Street Food',
  'Nightlife',
  'Photography',
  'Road Trips',
  'Wellness',
  'Water Sports',
];
const socialOptions = ['Yes', 'No']; // Instagram-friendly?
const tripLengths = ['Weekend', '3-7 days', '1-2 weeks', '2+ weeks'];
const accessibilityOptions = ['None', 'Wheelchair-friendly', 'Elderly-friendly'];
const moods = ['Relax', 'Party', 'Adventure', 'Spiritual'];

const TOTAL_STEPS = 5; // update if steps count changes

export default function PersonalizationForm() {
  const navigation = useNavigation();
  const auth = getAuth();
  const db = getFirestore();

  // Loading / saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Wizard step (0-indexed)
  const [step, setStep] = useState(0);

  // Form state
  const [travelStyle, setTravelStyle] = useState(null);
  const [budget, setBudget] = useState(null);
  const [pace, setPace] = useState(null);
  const [foodPreference, setFoodPreference] = useState(null);
  const [companions, setCompanions] = useState(null);
  const [activities, setActivities] = useState([]);
  const [socialInclination, setSocialInclination] = useState(null);
  const [tripLength, setTripLength] = useState(null);
  const [accessibility, setAccessibility] = useState('None');
  const [mood, setMood] = useState(null);
  const [preferredDestinations, setPreferredDestinations] = useState('');
  const [existingDocId, setExistingDocId] = useState(null);

  // Load existing preferences if present (allow editing)
  useEffect(() => {
    let mounted = true;
    const loadPreferences = async () => {
      const user = auth.currentUser;
      if (!user) {
        // If not logged in, route to landing
        navigation.replace('Landing');
        return;
      }
      try {
        const ref = doc(db, 'users', user.uid, 'preferences', 'userPrefs');
        const snap = await getDoc(ref);
        if (snap.exists() && mounted) {
          const d = snap.data();
          // prefill fields
          setTravelStyle(d.travelStyle ?? null);
          setBudget(d.budget ?? null);
          setPace(d.pace ?? null);
          setFoodPreference(d.foodPreference ?? null);
          setCompanions(d.companions ?? null);
          setActivities(d.activities ?? []);
          setSocialInclination(d.socialInclination ?? null);
          setTripLength(d.tripLength ?? null);
          setAccessibility(d.accessibility ?? 'None');
          setMood(d.mood ?? null);
          setPreferredDestinations(d.preferredDestinations ?? '');
          setExistingDocId('userPrefs');
        }
      } catch (err) {
        console.log('Error loading preferences:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPreferences();
    return () => (mounted = false);
  }, []);

  const toggleActivity = (name) => {
    setActivities((prev) => {
      if (prev.includes(name)) return prev.filter((a) => a !== name);
      return [...prev, name];
    });
  };

  const validateStep = () => {
    // Validate required fields step-by-step
    if (step === 0) {
      if (!travelStyle) return 'Please select the travel style that best describes you.';
    } else if (step === 1) {
      if (!budget) return 'Please select your budget preference.';
      if (!pace) return 'Please choose your travel pace.';
    } else if (step === 2) {
      if (!foodPreference) return 'Please select your food preference.';
      if (!companions) return 'Please select who you usually travel with.';
    } else if (step === 3) {
      if (activities.length === 0) return 'Please choose at least one activity of interest.';
      if (!socialInclination) return 'Do you look for Instagram-friendly spots?';
      if (!tripLength) return 'Please choose your typical trip length.';
    } else if (step === 4) {
      // Step 4 is extras + review — nothing required here
      return null;
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) {
      Alert.alert('Hold on', err);
      return;
    }
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else handleSubmit(); // last step
  };

  const handleBack = () => {
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    // Final validation (in case)
    const err = validateStep();
    if (err) {
      Alert.alert('Validation error', err);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not logged in', 'Please login and try again.');
      navigation.replace('Landing');
      return;
    }

    const payload = {
      travelStyle,
      budget,
      pace,
      foodPreference,
      companions,
      activities,
      socialInclination,
      tripLength,
      accessibility,
      mood,
      preferredDestinations: preferredDestinations.trim() || null,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    };

    // If document is new, add createdAt on write
    if (!existingDocId) payload.createdAt = serverTimestamp();

    setSaving(true);
    try {
      const ref = doc(db, 'users', user.uid, 'preferences', 'userPrefs');
      await setDoc(ref, payload, { merge: true });
      // Also save to backend preferences endpoint so server-side personalization can read it
      try {
        const BACKEND_URL = 'http://10.180.18.12:8000';
        await fetch(`${BACKEND_URL}/users/${user.uid}/preferences`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foodPreference: (foodPreference || 'any').toLowerCase(),
            budget: (budget || 'moderate').toLowerCase(),
            pace: (pace || 'balanced').toLowerCase(),
            mood: (mood || 'adventure').toLowerCase(),
            companions: companions || 'solo',
            activities: activities || [],
            accessibility: accessibility || 'none'
          })
        });
      } catch (err) {
        console.warn('Failed to save preferences to backend:', err);
      }
      Alert.alert('Saved', 'Your preferences have been saved successfully.');
      navigation.navigate('Home'); // or navigation.replace('Home') depending on flow
    } catch (err) {
      console.log('Error saving preferences:', err);
      Alert.alert('Save failed', 'Could not save preferences. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Render helpers for option chips and radio-like options
  const OptionChip = ({ label, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.chip, selected ? styles.chipSelected : null]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const progressPercent = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBack}>
            <Text style={styles.headerBackText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personalization</Text>
          <View style={{ width: 64 }} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>{progressPercent}%</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Step 0: Travel Personality */}
          {step === 0 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>What's your travel personality?</Text>
              <Text style={styles.stepSubtitle}>
                Pick one that best describes your trips and vibes.
              </Text>
              <View style={styles.optionsWrap}>
                {travelStyles.map((t) => (
                  <OptionChip
                    key={t}
                    label={t}
                    selected={travelStyle === t}
                    onPress={() => setTravelStyle(t)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Step 1: Budget & Pace */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Budget & Travel Pace</Text>
              <Text style={styles.stepSubtitle}>Help us match stays & activities to your budget.</Text>

              <Text style={styles.groupLabel}>Typical budget</Text>
              <View style={styles.optionsWrap}>
                {budgets.map((b) => (
                  <OptionChip
                    key={b}
                    label={b}
                    selected={budget === b}
                    onPress={() => setBudget(b)}
                  />
                ))}
              </View>

              <Text style={[styles.groupLabel, { marginTop: 12 }]}>Preferred travel pace</Text>
              <View style={styles.optionsWrap}>
                {paces.map((p) => (
                  <OptionChip
                    key={p}
                    label={p}
                    selected={pace === p}
                    onPress={() => setPace(p)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Food & Companions */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Food & Companions</Text>
              <Text style={styles.stepSubtitle}>This helps with food spots and accommodations.</Text>

              <Text style={styles.groupLabel}>Food preference</Text>
              <View style={styles.optionsWrap}>
                {foodPreferences.map((f) => (
                  <OptionChip
                    key={f}
                    label={f}
                    selected={foodPreference === f}
                    onPress={() => setFoodPreference(f)}
                  />
                ))}
              </View>

              <Text style={[styles.groupLabel, { marginTop: 12 }]}>Who do you usually travel with?</Text>
              <View style={styles.optionsWrap}>
                {companionsOptions.map((c) => (
                  <OptionChip
                    key={c}
                    label={c}
                    selected={companions === c}
                    onPress={() => setCompanions(c)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Step 3: Activities, Social, Trip Length */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Activities & Interests</Text>
              <Text style={styles.stepSubtitle}>Choose activities you enjoy (pick multiple).</Text>

              <Text style={styles.groupLabel}>Activities</Text>
              <View style={styles.optionsWrap}>
                {activitiesList.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.chip, activities.includes(a) ? styles.chipSelected : null]}
                    onPress={() => toggleActivity(a)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, activities.includes(a) ? styles.chipTextSelected : null]}>
                      {a}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.groupLabel, { marginTop: 12 }]}>Do you look for Instagram-worthy spots?</Text>
              <View style={styles.optionsWrap}>
                {socialOptions.map((s) => (
                  <OptionChip
                    key={s}
                    label={s === 'Yes' ? 'Yes — visually appealing' : 'No — not important'}
                    selected={socialInclination === s}
                    onPress={() => setSocialInclination(s)}
                  />
                ))}
              </View>

              <Text style={[styles.groupLabel, { marginTop: 12 }]}>Typical trip length</Text>
              <View style={styles.optionsWrap}>
                {tripLengths.map((t) => (
                  <OptionChip
                    key={t}
                    label={t}
                    selected={tripLength === t}
                    onPress={() => setTripLength(t)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Step 4: Extras & Review */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Extras & Review</Text>
              <Text style={styles.stepSubtitle}>
                Any accessibility needs, mood for trips, or destination preferences?
              </Text>

              <Text style={styles.groupLabel}>Accessibility needs</Text>
              <View style={styles.optionsWrap}>
                {accessibilityOptions.map((a) => (
                  <OptionChip
                    key={a}
                    label={a}
                    selected={accessibility === a}
                    onPress={() => setAccessibility(a)}
                  />
                ))}
              </View>

              <Text style={[styles.groupLabel, { marginTop: 12 }]}>Preferred travel mood</Text>
              <View style={styles.optionsWrap}>
                {moods.map((m) => (
                  <OptionChip
                    key={m}
                    label={m}
                    selected={mood === m}
                    onPress={() => setMood(m)}
                  />
                ))}
              </View>

              <Text style={[styles.groupLabel, { marginTop: 12 }]}>Any preferred destinations (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="E.g. Coorg, Gokarna, Spiti"
                value={preferredDestinations}
                onChangeText={setPreferredDestinations}
                multiline
              />

              {/* Review summary */}
              <View style={styles.reviewBox}>
                <Text style={styles.reviewTitle}>Quick review</Text>
                <Text style={styles.reviewLine}>Travel Style: {travelStyle ?? '-'}</Text>
                <Text style={styles.reviewLine}>Budget: {budget ?? '-'}</Text>
                <Text style={styles.reviewLine}>Pace: {pace ?? '-'}</Text>
                <Text style={styles.reviewLine}>Food: {foodPreference ?? '-'}</Text>
                <Text style={styles.reviewLine}>Companions: {companions ?? '-'}</Text>
                <Text style={styles.reviewLine}>Activities: {activities.length ? activities.join(', ') : '-'}</Text>
                <Text style={styles.reviewLine}>Instagram-friendly: {socialInclination ?? '-'}</Text>
                <Text style={styles.reviewLine}>Trip Length: {tripLength ?? '-'}</Text>
                <Text style={styles.reviewLine}>Accessibility: {accessibility ?? '-'}</Text>
                <Text style={styles.reviewLine}>Mood: {mood ?? '-'}</Text>
                <Text style={styles.reviewLine}>Preferred Destinations: {preferredDestinations || '-'}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: '#eee' }]}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.footerButtonText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNext}
            style={[styles.footerButton, { backgroundColor: '#2D336B' }]}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.footerButtonText, { color: '#fff' }]}>
                {step === TOTAL_STEPS - 1 ? 'Save Preferences' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerBack: { padding: 8 },
  headerBackText: { color: '#2D336B', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#2D336B' },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#eee',
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#2D336B',
  },
  progressText: { width: 40, textAlign: 'right', fontWeight: '600', color: '#333' },
  content: { padding: 16, paddingBottom: 100 },
  stepContainer: { marginBottom: 24 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#1f2a63', marginBottom: 6 },
  stepSubtitle: { color: '#6b7280', marginBottom: 12 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, // gap may not be supported on RN, but harmless
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#2D336B',
    borderColor: '#2D336B',
  },
  chipText: { color: '#333', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  groupLabel: { marginTop: 8, marginBottom: 6, fontWeight: '700', color: '#374151' },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  reviewBox: {
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eef2ff',
    padding: 12,
    backgroundColor: '#fbfbff',
  },
  reviewTitle: { fontWeight: '800', marginBottom: 8, color: '#1f2a63' },
  reviewLine: { color: '#4b5563', marginBottom: 4 },
  footer: {
    height: 80,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerButton: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  footerButtonText: { fontWeight: '700', color: '#111' },
});
