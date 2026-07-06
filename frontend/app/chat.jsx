import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../config';

export default function ChatScreen() {
  const router = useRouter();
  const { foodName } = useLocalSearchParams();
  const { colors, getFontSizeValue, isDarkMode } = useTheme();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [username, setUsername] = useState('Friend');
  const flatListRef = useRef(null);
  const hasSpoken = useRef(false);

  useEffect(() => {
    // Add a small delay to ensure Expo Router params are fully loaded
    const timer = setTimeout(() => {
      loadUserAndGreet();
    }, 100);
    return () => clearTimeout(timer);
  }, [foodName]);

  const loadUserAndGreet = async () => {
    const storedName = await SecureStore.getItemAsync('username');
    const name = storedName || 'Friend';
    setUsername(name);

    // If we have a foodName, we show the detection greeting
    if (foodName && !hasSpoken.current) {
      const welcomeText = `Hello ${name}! 👋 I've analyzed your image and detected **${foodName}**. I'm Chef Latifa — ask me anything about its ingredients, how to prepare it, or its nutritional value!`;
      const spokenText = `Hello ${name}, I have detected ${foodName} in your image. I am Chef Latifa, your AI assistant. How can I help you cook this?`;

      setMessages([
        {
          id: '1',
          text: welcomeText,
          sender: 'ai',
        },
      ]);
      
      Speech.speak(spokenText, { rate: 0.9, pitch: 1.0 });
      hasSpoken.current = true;
    } 
    // Only show general greeting if NO foodName exists AND no messages are present
    else if (!foodName && messages.length === 0) {
      setMessages([
        {
          id: '1',
          text: `Hello ${name}! 👋 I'm Chef Latifa, your culinary assistant. How can I help you in the kitchen today?`,
          sender: 'ai',
        },
      ]);
    }
  };

  const sendMessage = async (overrideText) => {
    let textToSend = overrideText || inputText;
    if (textToSend.trim() === '') return;

    // SMART CONTEXT: If the user uses a chip and we have a foodName, 
    // inject the food name into the query to ensure AI understands perfectly.
    if (overrideText && foodName) {
      if (textToSend.toLowerCase().includes("ingredients")) {
        textToSend = `What are the ingredients for ${foodName}?`;
      } else if (textToSend.toLowerCase().includes("allergen")) {
        textToSend = `Are there any allergen warnings for ${foodName}?`;
      } else if (textToSend.toLowerCase().includes("substitution")) {
        textToSend = `Give me a healthy substitution for ${foodName}.`;
      }
    }

    const newUserMessage = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user',
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    setIsTyping(true);

    const token = await SecureStore.getItemAsync('access_token');

    try {
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          query: textToSend,
          context_food: foodName 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const aiResponse = {
          id: Date.now().toString(),
          text: data.response,
          sender: 'ai',
        };
        setMessages(prev => [...prev, aiResponse]);
      } else {
        throw new Error(data.error || "Failed to get AI response");
      }
    } catch (error) {
      const errorMsg = {
        id: Date.now().toString(),
        text: "I'm having trouble connecting to the kitchen server. Please try again!",
        sender: 'ai',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageWrapper,
      item.sender === 'user' ? styles.userWrapper : styles.aiWrapper
    ]}>
      {item.sender === 'ai' && (
        <View style={styles.botAvatar}>
          <MaterialCommunityIcons name="robot" size={16} color="white" />
        </View>
      )}
      <View style={[
        styles.messageBubble,
        item.sender === 'user' ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.aiBubble, { backgroundColor: isDarkMode ? '#2d3e2d' : '#E7F1E2' }]
      ]}>
        <Text style={[
          styles.messageText,
          item.sender === 'user' ? styles.userText : [styles.aiText, { color: colors.text }],
          { fontSize: getFontSizeValue(15) }
        ]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      
      {/* Chef Latifa Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={32} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.chefAvatar}>
            <MaterialCommunityIcons name="robot-happy" size={30} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Chef Latifa</Text>
            {/* <Text style={styles.headerSubtitle}>AI Recipe Assistant • Powered by Gemini</Text> */}
          </View>
        </View>

        <View style={styles.statusDot} />
      </View>

      {/* Detection Context Bar */}
      {foodName && (
        <View style={styles.contextBar}>
          <Text style={styles.contextLabel}>🍛 Detected: <Text style={styles.contextFood}>{foodName}</Text></Text>
        </View>
      )}

      {/* Suggestion Chips */}
      <View style={styles.chipContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          <TouchableOpacity style={styles.chip} onPress={() => sendMessage("What are the ingredients?")}>
            <Text style={styles.chipText}>What are the ingredients?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => sendMessage("Any allergen warnings?")}>
            <Text style={styles.chipText}>Any allergen warnings?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => sendMessage(`Give me a healthy substitution for ${foodName}`)}>
            <Text style={styles.chipText}>Give me a healthy substitution</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListFooterComponent={isTyping ? (
          <View style={[styles.messageWrapper, styles.aiWrapper]}>
             <View style={styles.botAvatar}>
              <MaterialCommunityIcons name="robot" size={16} color="white" />
            </View>
            <View style={[styles.messageBubble, styles.aiBubble, {paddingVertical: 10}]}>
              <ActivityIndicator size="small" color="#4A7729" />
            </View>
          </View>
        ) : null}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: isDarkMode ? '#333' : '#f5f5f5', color: colors.text }]}
            placeholder="Ask about ingredients, steps..."
            placeholderTextColor={colors.subtext}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: colors.primary }]} 
            onPress={() => sendMessage()}
          >
            <MaterialCommunityIcons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Persistent Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => router.push('/')}
        >
          <MaterialCommunityIcons name="home-outline" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => router.push({ pathname: '/', params: { tab: 'detect' } })}
        >
          <MaterialCommunityIcons name="magnify" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Detect</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => {}}
        >
          <MaterialCommunityIcons name="chat" size={26} color={colors.primary} />
          <Text style={[styles.tabText, { color: colors.primary, fontWeight: 'bold' }]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="play-circle-outline" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Videos</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => router.push('/settings')}
        >
          <MaterialCommunityIcons name="cog-outline" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9F5',
  },
  header: {
    backgroundColor: '#4A7729',
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 5,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  chefAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#4A7729',
  },
  contextBar: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  contextLabel: {
    fontSize: 14,
    color: '#2E7D32',
  },
  contextFood: {
    fontWeight: 'bold',
  },
  chipContainer: {
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  chipScroll: {
    paddingHorizontal: 15,
  },
  chip: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  chipText: {
    fontSize: 13,
    color: '#4A7729',
    fontWeight: '500',
  },
  messageList: {
    padding: 15,
    paddingBottom: 30,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 20,
    maxWidth: '85%',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  aiWrapper: {
    alignSelf: 'flex-start',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A7729',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 'auto',
  },
  messageBubble: {
    padding: 15,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#4A7729',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#E7F1E2',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: 'white',
  },
  aiText: {
    color: '#1B3022',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    color: '#333',
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#4A7729',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  tabBar: {
    height: 85,
    backgroundColor: 'white',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingBottom: 25,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#4A7729',
    fontWeight: 'bold',
  },
});
