import React, { createContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export const PreferencesContext = createContext({
  preferences: null,
  fetchPreferences: async () => {},
  savePreferences: async () => {},
  setPreferences: () => {},
});

const BACKEND_URL = 'http://10.180.18.12:8000'; // Update if your backend runs elsewhere

export const PreferencesProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // fetch prefs for user
        await fetchPreferences(user.uid);
      } else {
        setPreferences(null);
      }
    });

    return () => unsub();
  }, []);

  const fetchPreferences = async (userId) => {
    try {
      const resp = await fetch(`${BACKEND_URL}/users/${userId}/preferences`);
      if (!resp.ok) throw new Error('Failed to fetch preferences');
      const data = await resp.json();
      setPreferences(data);
      return data;
    } catch (err) {
      console.warn('fetchPreferences error', err);
      return null;
    }
  };

  const savePreferences = async (userId, prefs) => {
    try {
      const resp = await fetch(`${BACKEND_URL}/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!resp.ok) throw new Error('Failed to save preferences');
      const data = await resp.json();
      setPreferences(data);
      return data;
    } catch (err) {
      console.warn('savePreferences error', err);
      Alert.alert('Error', 'Failed to save preferences');
      return null;
    }
  };

  return (
    <PreferencesContext.Provider value={{ preferences, fetchPreferences, savePreferences, setPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};
