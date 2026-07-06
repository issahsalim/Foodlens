import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const syncGuestData = async (token) => {
    try {
      const isGuest = await SecureStore.getItemAsync('is_guest');
      const localData = await SecureStore.getItemAsync('guest_shopping_list');
      
      if (isGuest === 'true' && localData) {
        const items = JSON.parse(localData);
        if (items.length > 0) {
          const ingredients = items.map(i => i.name);
          
          await fetch(`${API_BASE_URL}/shopping/bulk/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ingredients })
          }); 
        }
        await SecureStore.deleteItemAsync('is_guest');
        await SecureStore.deleteItemAsync('guest_shopping_list');
      }
    } catch (e) {
      console.error("Failed to sync guest data:", e);
    }
  };

  const handleAuth = async () => {
    if (!username || !password || (!isLogin && !email)) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    const endpoint = isLogin ? 'login/' : 'register/';
    const body = isLogin
      ? { username, password }
      : { username, password, email };

    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          await SecureStore.setItemAsync('access_token', data.access);
          await SecureStore.setItemAsync('refresh_token', data.refresh);
          await SecureStore.setItemAsync('username', username);
          await syncGuestData(data.access);
          router.replace('/');
        } else {
          Alert.alert("Success", "Account created! Please log in.");
          setIsLogin(true);
        }
      } else {
        Alert.alert("Error", data.error || data.detail || "Authentication failed");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Connection Error", "Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Top Green Section */}
      <View style={styles.topSection}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={40} color="white" style={styles.mainIcon} />
          <Text style={styles.logoText}>FoodLens</Text>
        </View>
        
        {/* Floating Icons */}
        <MaterialCommunityIcons name="clover" size={30} color="rgba(255,255,255,0.2)" style={styles.decorIcon1} />
        <MaterialCommunityIcons name="carrot" size={30} color="rgba(255,255,255,0.2)" style={styles.decorIcon2} />
        <MaterialCommunityIcons name="leaf" size={40} color="rgba(255,255,255,0.1)" style={styles.decorIcon3} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.card}>
            <Text style={styles.formTitle}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
            <Text style={styles.formSubtitle}>
              {isLogin ? 'Sign in to continue' : 'Join FoodLens to detect food & get recipes'}
            </Text>

            <View style={styles.form}>
              {!isLogin && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Username"
                    placeholderTextColor="#AAA"
                    value={username}
                    onChangeText={setUsername}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{isLogin ? 'Email or username' : 'Email Address'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={isLogin ? 'Email or username':'Email'}
                  placeholderTextColor="#AAA"
                  value={isLogin ? username : email}
                  onChangeText={isLogin ? setUsername : setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.passwordHeader}>
                  <Text style={styles.label}>Password</Text>
                  {isLogin && (
                    <TouchableOpacity>
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#AAA"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.mainButton, isLoading && styles.buttonDisabled]}
                onPress={handleAuth}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                </Text>
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                </Text>
                <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                  <Text style={styles.switchLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.socialButton}>
                <View style={styles.socialContent}>
                  <Text style={styles.socialIcon}>🔐</Text>
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </View>
              </TouchableOpacity>
              
              {/* <TouchableOpacity style={[styles.socialButton, { marginTop: 12, borderColor: '#CCC' }]} onPress={() => router.replace('/')}>
                <Text style={[styles.socialButtonText, { color: '#666' }]}>Continue as Guest</Text>
              </TouchableOpacity> */}
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  topSection: {
    height: 200,
    backgroundColor: '#4CAF50',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  mainIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 15,
    borderRadius: 30,
    marginBottom: 10,
  },
  logoText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  decorIcon1: { position: 'absolute', top: 50, left: 30 },
  decorIcon2: { position: 'absolute', top: 120, left: width - 60 },
  decorIcon3: { position: 'absolute', top: 30, right: 40 },
  
  scrollContent: {
    paddingTop: 160,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: '#757575',
    marginBottom: 25,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    height: 55,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
  },
  mainButton: {
    backgroundColor: '#2E7D32',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchText: {
    color: '#757575',
    fontSize: 14,
  },
  switchLink: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#9E9E9E',
    fontSize: 12,
  },
  socialButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#2E7D32',
    borderRadius: 15,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialIcon: {
    marginRight: 10,
  },
  socialButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '600',
  },
});
