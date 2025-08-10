import { useNavigation } from '@react-navigation/core';
import React, { useEffect, useState } from 'react';
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
import { 
  onAuthStateChanged,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';

const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);

  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigation.replace("Home");
      }
    });

    return unsubscribe;
  }, []);

  const handleSignUp = () => {
    createUserWithEmailAndPassword(auth, email, password)
      .then(userCredentials => {
        console.log('Registered with:', userCredentials.user.email);
      })
      .catch(error => alert(error.message));
  };

  const handleLogin = () => {
    signInWithEmailAndPassword(auth, email, password)
      .then(userCredentials => {
        console.log('Logged in with:', userCredentials.user.email);
      })
      .catch(error => alert(error.message));
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF2F2" />
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        {/* Background Decoration */}
        <View style={styles.backgroundDecoration} />
        <View style={styles.backgroundDecoration2} />
        
        {/* Logo Container */}
        <View style={styles.logoContainer}>
          {/* Replace this with your actual logo */}
          <Image 
            source={require('../assets/logo.png')} // <-- Place your logo here
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.subtitleText}>Sign in to continue</Text>
        </View>

        {/* Input Container */}
        <View style={styles.inputContainer}>
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

        {/* Button Container */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleLogin}
            style={styles.loginButton}
            activeOpacity={0.8}
          >
            <View style={styles.buttonGradient}>
              <Text style={styles.loginButtonText}>Sign In</Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>
          
          <TouchableOpacity
            onPress={() => navigation.navigate('SignUp')}
            style={styles.registerButton}
            activeOpacity={0.8}
            >
   <Text style={styles.registerButtonText}>Create Account</Text>
</TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service
          </Text>
        </View>
      </KeyboardAvoidingView>
    </>
  );
};

export default LoginScreen;

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
    marginTop: -100,
  },
  logo: {
    width: 360,
    height: 260,
    marginBottom: 0,
    resizeMode: 'cover'
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D336B',
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 15,
    color: '#7886C7',
    fontWeight: '400',
  },
  inputContainer: {
    width: '90%',
    marginBottom: 20,
    marginTop:20,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    shadowOffset: {
      width: 0,
      height: 6,
    },
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#A9B5DF',
    opacity: 0.5,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#7886C7',
    fontWeight: '500',
  },
  registerButton: {
    width: '60%',
    borderRadius: 30,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#A9B5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#2D336B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#A9B5DF',
    textAlign: 'center',
    lineHeight: 18,
  },
});