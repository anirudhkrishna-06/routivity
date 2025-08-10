import { useNavigation } from '@react-navigation/core';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  StatusBar
} from 'react-native';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const { width } = Dimensions.get('window');

const CreateAccountScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);

  const navigation = useNavigation();

  const handleSignUp = () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }
    createUserWithEmailAndPassword(auth, email, password)
      .then(userCredentials => {
        console.log('Registered with:', userCredentials.user.email);
        navigation.replace("Home");
      })
      .catch(error => alert(error.message));
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF2F2" />
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        {/* Background Decorations */}
        <View style={styles.backgroundDecoration} />
        <View style={styles.backgroundDecoration2} />

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
          <View style={[
            styles.inputWrapper,
            focusedInput === 'name' && styles.inputWrapperFocused
          ]}>
            <TextInput
              placeholder="Full Name"
              placeholderTextColor="#A9B5DF"
              value={name}
              onChangeText={text => setName(text)}
              style={styles.input}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={[
            styles.inputWrapper,
            focusedInput === 'email' && styles.inputWrapperFocused
          ]}>
            <TextInput
              placeholder="Email Address"
              placeholderTextColor="#A9B5DF"
              value={email}
              onChangeText={text => setEmail(text)}
              style={styles.input}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[
            styles.inputWrapper,
            focusedInput === 'password' && styles.inputWrapperFocused
          ]}>
            <TextInput
              placeholder="Password"
              placeholderTextColor="#A9B5DF"
              value={password}
              onChangeText={text => setPassword(text)}
              style={styles.input}
              secureTextEntry
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>

        {/* Register Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSignUp}
            style={styles.loginButton}
            activeOpacity={0.8}
          >
            <View style={styles.buttonGradient}>
              <Text style={styles.loginButtonText}>Register</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.registerButton}
            activeOpacity={0.8}
          >
            <Text style={styles.registerButtonText}>Back to Sign In</Text>
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
    width: 200,
    height: 160,
    marginBottom: 0,
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
});
