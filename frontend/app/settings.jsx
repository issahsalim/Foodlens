import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch, SafeAreaView, Alert, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

import { API_BASE_URL } from '../config';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, isDarkMode, toggleDarkMode, themeColor, updateThemeColor, fontSize, updateFontSize, getFontSizeValue } = useTheme();
  
  const [username, setUsername] = useState('Guest');
  const [email, setEmail] = useState('');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoContent, setInfoContent] = useState('');

  // Edit Profile States
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const storedName = await SecureStore.getItemAsync('username');
    const storedEmail = await SecureStore.getItemAsync('user_email');
    if (storedName) {
      setUsername(storedName);
      setNewUsername(storedName);
    }
    if (storedEmail) {
      setEmail(storedEmail);
      setNewEmail(storedEmail);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newUsername || !newEmail) {
      Alert.alert("Error", "Username and Email are required.");
      return;
    }

    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const response = await axios.patch(`${API_BASE_URL}/profile/update/`, {
        username: newUsername,
        email: newEmail,
        old_password: oldPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await SecureStore.setItemAsync('username', response.data.username);
      await SecureStore.setItemAsync('user_email', response.data.email);
      setUsername(response.data.username);
      setEmail(response.data.email);
      
      Alert.alert("Success", "Profile updated successfully!");
      setIsEditModalVisible(false);
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Failed to update profile";
      Alert.alert("Update Failed", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('username');
          router.replace('/auth');
      }}
    ]);
  };

  const showAbout = () => {
    setInfoTitle("About FoodLens");
    setInfoContent("FoodLens is your AI-powered culinary assistant. Using advanced computer vision and Gemini AI, we help you identify dishes, discover recipes, and manage your kitchen with ease.\n\nOur mission is to make cooking accessible, fun, and personalized for everyone.");
    setIsInfoModalVisible(true);
  };

  const showPrivacy = () => {
    setInfoTitle("Privacy Policy");
    setInfoContent("At FoodLens, your privacy is our priority. We only store the data necessary to provide you with personalized recipes and shopping lists. Your images are processed securely and are not shared with third parties without your consent.");
    setIsInfoModalVisible(true);
  };

  const handleRateApp = () => {
    Alert.alert("Rate FoodLens", "Thank you for your support! Redirecting to App Store...", [
      { text: "Later", style: "cancel" },
      { text: "Rate Now", onPress: () => Alert.alert("Demo", "In a real app, this would open the Store!") }
    ]);
  };

  const SettingRow = ({ icon, label, children, noBorder }) => (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }, noBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.settingLabelContainer}>
        <MaterialCommunityIcons name={icon} size={24} color={colors.subtext} style={styles.settingIcon} />
        <Text style={[styles.settingLabel, { color: colors.text, fontSize: getFontSizeValue(16) }]}>{label}</Text>
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollArea}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: getFontSizeValue(32) }]}>Settings</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]}>Customise your experience</Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, shadowColor: isDarkMode ? '#000' : '#888' }]}>
          <View style={styles.profileInfo}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.profileName, { color: colors.text }]}>{username}</Text>
              <Text style={[styles.profileSub, { color: colors.subtext }]}>{email || username.toLowerCase()}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.editBtn, { borderColor: colors.primary }]} onPress={() => setIsEditModalVisible(true)}>
            <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>APPEARANCE</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <SettingRow icon="weather-night" label="Dark Mode">
            <Switch value={isDarkMode} onValueChange={toggleDarkMode} trackColor={{ false: "#ddd", true: colors.primary }} />
          </SettingRow>

          <SettingRow icon="palette-outline" label="Theme Colour">
            <View style={styles.colorRow}>
              {['#4A7729', '#1A5F7A', '#9B2C2C', '#84541B'].map(color => (
                <TouchableOpacity 
                  key={color} 
                  style={[styles.colorCircle, { backgroundColor: color }, themeColor === color && { borderColor: colors.text, borderWidth: 2 }]} 
                  onPress={() => updateThemeColor(color)}
                />
              ))}
            </View>
          </SettingRow>

          <SettingRow icon="format-size" label="Font Size" noBorder>
            <View style={[styles.fontControls, { backgroundColor: isDarkMode ? '#333' : '#f5f5f5' }]}>
              {['Small', 'Medium', 'Large'].map(size => (
                <TouchableOpacity 
                  key={size} 
                  style={[styles.fontBtn, fontSize === size && { backgroundColor: colors.primary }]}
                  onPress={() => updateFontSize(size)}
                >
                  <Text style={[styles.fontBtnText, fontSize === size ? { color: 'white' } : { color: colors.subtext }]}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SettingRow>
        </View>

        <Text style={styles.sectionTitle}>APP</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.navRow} onPress={showAbout}>
            <View style={styles.settingLabelContainer}>
              <MaterialCommunityIcons name="information-outline" size={24} color={colors.subtext} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>About FoodLens</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navRow} onPress={showPrivacy}>
            <View style={styles.settingLabelContainer}>
              <MaterialCommunityIcons name="lock-outline" size={24} color={colors.subtext} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Privacy Policy</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.navRow, { borderBottomWidth: 0 }]} onPress={handleRateApp}>
            <View style={styles.settingLabelContainer}>
              <MaterialCommunityIcons name="star-outline" size={24} color={colors.subtext} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Rate the App</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.signOutCard, { backgroundColor: colors.card }]} onPress={handleLogout}>
          <View style={styles.settingLabelContainer}>
            <MaterialCommunityIcons name="door-open" size={24} color="#E53E3E" style={styles.settingIcon} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            FoodLens v1.0.0 • Built with ❤️ using{"\n"}React Native + Django + Gemini AI
          </Text>
        </View>
      </ScrollView>

      {/* MODALS */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Username</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={newUsername} onChangeText={setNewUsername} />
            
            <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 15 }]}>Email</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text }]} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" />
            
            <View style={styles.separator} />
            <Text style={[styles.inputLabel, { color: '#E53E3E', fontWeight: 'bold' }]}>Change Password</Text>
            <Text style={[styles.inputHint, { color: colors.subtext }]}>Fill both to update your password</Text>
            
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, marginTop: 10 }]} placeholder="Current Password" placeholderTextColor="#aaa" secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
            <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.text, marginTop: 10 }]} placeholder="New Password" placeholderTextColor="#aaa" secureTextEntry value={newPassword} onChangeText={setNewPassword} />

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleUpdateProfile} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isInfoModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, paddingBottom: 30 }]}>
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 15 }]}>{infoTitle}</Text>
            <Text style={[styles.infoText, { color: colors.text }]}>{infoContent}</Text>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 25 }]} onPress={() => setIsInfoModalVisible(false)}>
              <Text style={styles.saveBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Persistent Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/')}>
          <MaterialCommunityIcons name="home-outline" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push({ pathname: '/', params: { tab: 'detect' } })}>
          <MaterialCommunityIcons name="magnify" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Detect</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/chat')}>
          <MaterialCommunityIcons name="chat-outline" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}><MaterialCommunityIcons name="play-circle-outline" size={26} color={colors.subtext} /><Text style={[styles.tabText, { color: colors.subtext }]}>Videos</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}><MaterialCommunityIcons name="cog" size={26} color={colors.primary} /><Text style={[styles.tabText, { color: colors.primary, fontWeight: 'bold' }]}>Settings</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollArea: { paddingBottom: 100 },
  header: { paddingHorizontal: 20, paddingVertical: 20 },
  headerTitle: { fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  profileCard: { marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, elevation: 3 },
  profileInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  profileName: { fontSize: 20, fontWeight: 'bold' },
  profileSub: { fontSize: 13 },
  editBtn: { borderWidth: 1, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  editBtnText: { fontWeight: 'bold' },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#999', marginLeft: 25, marginBottom: 10, letterSpacing: 1.5 },
  sectionCard: { marginHorizontal: 20, borderRadius: 20, paddingHorizontal: 15, marginBottom: 25, elevation: 2 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  settingLabelContainer: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { marginRight: 15 },
  settingLabel: { fontWeight: '500' },
  colorRow: { flexDirection: 'row' },
  colorCircle: { width: 26, height: 26, borderRadius: 13, marginLeft: 10 },
  fontControls: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  fontBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  fontBtnText: { fontSize: 11, fontWeight: 'bold' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f5f5f0' },
  signOutCard: { marginHorizontal: 20, borderRadius: 20, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  signOutText: { fontSize: 16, fontWeight: 'bold' },
  footer: { paddingHorizontal: 40, alignItems: 'center', marginBottom: 20 },
  footerText: { textAlign: 'center', fontSize: 12, color: '#bbb', lineHeight: 18 },
  tabBar: { height: 85, flexDirection: 'row', borderTopWidth: 1, paddingBottom: 25, position: 'absolute', bottom: 0, width: '100%' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 10, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 25, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputLabel: { fontSize: 12, marginBottom: 5 },
  input: { borderRadius: 12, padding: 12, fontSize: 16 },
  inputHint: { fontSize: 11, marginTop: 2 },
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  saveBtn: { borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  infoText: { fontSize: 15, lineHeight: 24 }
});
