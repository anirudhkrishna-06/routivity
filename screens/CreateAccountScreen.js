import { useNavigation } from '@react-navigation/core';
import { Ionicons } from '@expo/vector-icons';

import React, { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const CreateAccountScreen = () => {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);

  const navigation = useNavigation();

  // Email format validation
  const validateEmailFormat = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  // Password strength validation
  const validatePasswordStrength = (password) => {
    const re = /^(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/;
    return re.test(password);
  };

  // Local validations
  useEffect(() => {
    if (!email) {
      setEmailError('');
      return;
    }
    if (!validateEmailFormat(email)) {
      setEmailError('Invalid email format');
    } else {
      setEmailError('');
    }
  }, [email]);

  useEffect(() => {
    if (!password) {
      setPasswordError('');
      return;
    }
    if (!validatePasswordStrength(password)) {
      setPasswordError(
        'Password must be 6+ chars, include a number & special char'
      );
    } else {
      setPasswordError('');
    }
  }, [password]);

  useEffect(() => {
    if (!confirmPassword) {
      setConfirmPasswordError('');
      return;
    }
    if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  }, [confirmPassword, password]);

  const handleSignUp = async () => {
    if (!name.trim()) return setEmailError('Please enter your full name');
    if (!contact.trim()) return setEmailError('Please enter your contact number');
    if (!gender.trim()) return setEmailError('Please enter your gender');
    if (emailError || passwordError || confirmPasswordError) return;

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Store user data in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: name,
        contactNumber: contact,
        gender,
        email,
        createdAt: new Date(),
      });

      console.log('User registered & stored in Firestore:', user.uid);
      navigation.replace('Home');
    } catch (error) {
      console.error('Signup Error:', error.message);
      setEmailError(error.message);
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF2F2" />
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        {/* Background Decorations */}
        <View style={styles.backgroundDecoration} />
        <View style={styles.backgroundDecoration2} />

        {/* Back Arrow */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={23} color="#333" />
        </TouchableOpacity>


        {/* Logo and Title */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>Create Account</Text>
          <Text style={styles.subtitleText}>Join us and get started</Text>
        </View>

        {/* Input Fields */}
        <View style={styles.inputContainer}>
          {/* Full Name */}
          <View
            style={[
              styles.inputWrapper,
              focusedInput === 'name' && styles.inputWrapperFocused,
            ]}
          >
            <TextInput
              placeholder="Full Name"
              placeholderTextColor="#A9B5DF"
              value={name}
              onChangeText={setName}
              style={styles.input}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          {/* Contact Number */}
          <View
            style={[
              styles.inputWrapper,
              focusedInput === 'contact' && styles.inputWrapperFocused,
            ]}
          >
            <TextInput
              placeholder="Contact Number"
              placeholderTextColor="#A9B5DF"
              value={contact}
              onChangeText={setContact}
              style={styles.input}
              keyboardType="phone-pad"
              onFocus={() => setFocusedInput('contact')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          {/* Gender */}
          <View
            style={[
              styles.inputWrapper,
              focusedInput === 'gender' && styles.inputWrapperFocused,
            ]}
          >
            <TextInput
              placeholder="Gender (Male/Female/Other)"
              placeholderTextColor="#A9B5DF"
              value={gender}
              onChangeText={setGender}
              style={styles.input}
              onFocus={() => setFocusedInput('gender')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          {/* Email */}
          <View
            style={[
              styles.inputWrapper,
              focusedInput === 'email' && styles.inputWrapperFocused,
            ]}
          >
            <TextInput
              placeholder="Email Address"
              placeholderTextColor="#A9B5DF"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
          {emailError ? (
            <Text style={styles.errorText}>{emailError}</Text>
          ) : null}

          {/* Password */}
          <View
            style={[
              styles.inputWrapper,
              focusedInput === 'password' && styles.inputWrapperFocused,
            ]}
          >
            <TextInput
              placeholder="Password"
              placeholderTextColor="#A9B5DF"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry={true}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
          {passwordError ? (
            <Text style={styles.errorText}>{passwordError}</Text>
          ) : null}

          {/* Confirm Password */}
          <View
            style={[
              styles.inputWrapper,
              focusedInput === 'confirmPassword' && styles.inputWrapperFocused,
            ]}
          >
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor="#A9B5DF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              secureTextEntry={true}
              onFocus={() => setFocusedInput('confirmPassword')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
          {confirmPasswordError ? (
            <Text style={styles.errorText}>{confirmPasswordError}</Text>
          ) : null}
        </View>

        {/* Register Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSignUp}
            style={styles.loginButton}
            activeOpacity={0.8}
            disabled={
              !name ||
              !contact ||
              !gender ||
              !email ||
              !password ||
              !confirmPassword ||
              !!emailError ||
              !!passwordError ||
              !!confirmPasswordError
            }
          >
            <View style={styles.buttonGradient}>
              <Text style={styles.loginButtonText}>Register</Text>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
};

export default CreateAccountScreen;



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: { color: 'red', fontSize: 12, marginTop: 2, marginLeft: 5 },
  infoText: { color: 'gray', fontSize: 12, marginTop: 2, marginLeft: 5 },
  backgroundDecoration: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#A9B5DF',
    opacity: 0.1,
  },
  backgroundDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#7886C7',
    opacity: 0.1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 0,
    marginTop: -60,
  },
  logo: {
    width: 250,
    height: 160,
    marginBottom: -30,
    marginTop: 60,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D336B',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 12,
    color: '#7886C7',
    fontWeight: '400',
  },
  inputContainer: {
    width: '90%',
    marginBottom: 20,
    marginTop: 20,
  },
  inputWrapper: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#A9B5DF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputWrapperFocused: {
    borderColor: '#7886C7',
    shadowOpacity: 0.2,
  },
  input: {
    fontSize: 12,
    paddingVertical: 16,
    color: '#2D336B',
    fontWeight: '500',
  },
  buttonContainer: {
    width: '80%',
    alignItems: 'center',
  },
  loginButton: {
    width: '60%',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#7886C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonGradient: {
    backgroundColor: '#7886C7',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  registerButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 18,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#A9B5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#2D336B',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  backButton: {
  position: 'absolute',
  top: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40,
  left: 20,
  zIndex: 10,
},
});
