import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// Helper to map ingredients to emojis
const getIngredientEmoji = (name) => {
  const n = name.toLowerCase();
  if (n.includes('rice')) return '🌾';
  if (n.includes('tomato')) return '🍅';
  if (n.includes('onion')) return '🧅';
  if (n.includes('pepper')) return '🌶️';
  if (n.includes('oil')) return '🟢';
  if (n.includes('carrot')) return '🥕';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('salt') || n.includes('spice')) return '🧂';
  return '🥗';
};

export default function RecipeScreen() {
  const { foodName, ingredients, steps, nutrition, imageUri } = useLocalSearchParams();
  const router = useRouter();
  const { colors, getFontSizeValue, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('ingredients');

  const ingredientsList = typeof ingredients === 'string' ? ingredients.split(',') : (ingredients || []);

  // Parse the JSON strings back into objects/arrays
  const parsedSteps = steps ? JSON.parse(steps) : [];
  const parsedNutrition = nutrition ? JSON.parse(nutrition) : {};

  // Provide fallbacks if AI didn't return specific fields
  const nutritionData = {
    calories: parsedNutrition.calories || "Unknown",
    carbs: parsedNutrition.carbs || "Unknown",
    protein: parsedNutrition.protein || "Unknown",
    allergen: parsedNutrition.allergen || "Unknown",
    region: parsedNutrition.region || "Unknown"
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: getFontSizeValue(28) }]}>Food Detection</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]}>Upload or capture a food image</Text>
        </View>

        {/* Captured Image Card */}
        <View style={styles.imageCard}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.foodImage}
              onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
            />
          ) : (
            <View style={[styles.foodImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card }]}>
              <Text style={{ fontSize: 64 }}>🍽️</Text>
              <Text style={{ color: colors.subtext, marginTop: 10 }}>No image available</Text>
            </View>
          )}
          <TouchableOpacity style={styles.retakeButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={18} color="#333" />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        </View>

        {/* Result Header Card */}
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.resultTop}>
            <Text style={[styles.dishName, { color: colors.text, fontSize: getFontSizeValue(24) }]}>{foodName || "Analyzing..."}</Text>
            <View style={[styles.originTag, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9' }]}>
              {/* <Text style={[styles.originText, { color: colors.primary }]}>Ghanaian</Text> */}
            </View>
          </View>
          {/* <Text style={[styles.detectedVia, { color: colors.subtext }]}>Detected via CNN • MobileNetV2</Text> */}

          <View style={styles.confidenceContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: '97%' }]} />
            </View>
            <Text style={[styles.confidenceText, { color: colors.subtext }]}>Confidence: <Text style={[styles.confidenceValue, { color: colors.primary }]}>97%</Text></Text>
          </View>
        </View>

        {/* Nutrition Quick Stats */}
        <View style={styles.nutritionGrid}>
          <View style={[styles.nutritionCard, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9' }]}>
            <Text style={[styles.nutriVal, { color: colors.primary }]}>{nutritionData.calories.replace(' kcal', '')}</Text>
            <Text style={[styles.nutriLabel, { color: colors.subtext }]}>kcal</Text>
          </View>
          <View style={[styles.nutritionCard, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9' }]}>
            <Text style={[styles.nutriVal, { color: colors.primary }]}>{nutritionData.carbs}</Text>
            <Text style={[styles.nutriLabel, { color: colors.subtext }]}>carbs</Text>
          </View>
          <View style={[styles.nutritionCard, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9' }]}>
            <Text style={[styles.nutriVal, { color: colors.primary }]}>{nutritionData.protein}</Text>
            <Text style={[styles.nutriLabel, { color: colors.subtext }]}>protein</Text>
          </View>
          <View style={[styles.nutritionCard, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9' }]}>
            <Text style={[styles.nutriVal, { color: colors.primary }]}>{nutritionData.allergen.substring(0, 4)}</Text>
            <Text style={[styles.nutriLabel, { color: colors.subtext }]}>allergen</Text>
          </View>
        </View>

        {/* Tab Selection */}
        <View style={[styles.tabBar, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f0f0f0' }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'ingredients' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('ingredients')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'ingredients' ? { color: 'white' } : { color: colors.subtext }]}>Ingredients</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'steps' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('steps')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'steps' ? { color: 'white' } : { color: colors.subtext }]}>Steps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'nutrition' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('nutrition')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'nutrition' ? { color: 'white' } : { color: colors.subtext }]}>Nutrition</Text>
          </TouchableOpacity>
        </View>

        {/* Content Card */}
        <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {activeTab === 'ingredients' && (
            <View>
              {ingredientsList.map((item, index) => (
                <View key={index} style={styles.ingredientRow}>
                  <Text style={styles.ingredientEmoji}>{getIngredientEmoji(item)}</Text>
                  <Text style={[styles.ingredientName, { color: colors.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          )}
          {activeTab === 'steps' && (
            <View>
              {parsedSteps.map((step, index) => (
                <View key={index} style={styles.stepRow}>
                  <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepDotText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
                </View>
              ))}
            </View>
          )}
          {activeTab === 'nutrition' && (
            <View>
              <View style={styles.nutritionRow}>
                <Text style={[styles.nutritionLabel, { color: colors.subtext }]}>Calories</Text>
                <Text style={[styles.nutritionValue, { color: colors.primary }]}>{nutritionData.calories}</Text>
              </View>
              <View style={styles.nutritionRow}>
                <Text style={[styles.nutritionLabel, { color: colors.subtext }]}>Carbohydrates</Text>
                <Text style={[styles.nutritionValue, { color: colors.primary }]}>{nutritionData.carbs}</Text>
              </View>
              <View style={styles.nutritionRow}>
                <Text style={[styles.nutritionLabel, { color: colors.subtext }]}>Protein</Text>
                <Text style={[styles.nutritionValue, { color: colors.primary }]}>{nutritionData.protein}</Text>
              </View>
              <View style={styles.nutritionRow}>
                <Text style={[styles.nutritionLabel, { color: colors.subtext }]}>Allergen Risk</Text>
                <Text style={[styles.nutritionValue, { color: colors.primary }]}>{nutritionData.allergen}</Text>
              </View>
              <View style={[styles.nutritionRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.nutritionLabel, { color: colors.subtext }]}>Region</Text>
                <Text style={[styles.nutritionValue, { color: colors.primary }]}>{nutritionData.region}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Final Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryAction, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ 
              pathname: '/chat', 
              params: { foodName: foodName } 
            })}
          >
            <MaterialCommunityIcons name="chat" size={22} color="white" />
            <Text style={styles.primaryActionText}>Ask ai for recipe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/videos', params: { foodName } })}
          >
            <MaterialCommunityIcons name="play-box" size={24} color="#007AFF" />
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>Watch Video Tutorials</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingVertical: 15 },
  headerTitle: { fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  imageCard: { marginHorizontal: 20, borderRadius: 25, overflow: 'hidden', elevation: 3, backgroundColor: 'white' },
  foodImage: { width: '100%', height: 220 },
  retakeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
  },
  retakeText: { marginLeft: 5, fontWeight: 'bold', fontSize: 13 },
  resultCard: { margin: 20, padding: 20, borderRadius: 25, borderWidth: 1 },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dishName: { fontWeight: 'bold' },
  originTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15 },
  originText: { fontSize: 12, fontWeight: 'bold' },
  detectedVia: { fontSize: 12, marginTop: 4 },
  confidenceContainer: { marginTop: 15 },
  progressBarBg: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  confidenceText: { fontSize: 13 },
  confidenceValue: { fontWeight: 'bold' },
  nutritionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 20 },
  nutritionCard: { width: '23%', paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
  nutriVal: { fontWeight: 'bold', fontSize: 16 },
  nutriLabel: { fontSize: 10, marginTop: 2 },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 15, padding: 5, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnText: { fontWeight: 'bold', fontSize: 14 },
  contentCard: { marginHorizontal: 20, padding: 20, borderRadius: 25, borderWidth: 1, minHeight: 150 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  ingredientEmoji: { fontSize: 24, marginRight: 15 },
  ingredientName: { fontSize: 16, fontWeight: '500' },
  stepRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  stepDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15, marginTop: 2 },
  stepDotText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  footer: { paddingHorizontal: 20, marginTop: 30 },
  primaryAction: { flexDirection: 'row', paddingVertical: 18, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 3 },
  primaryActionText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  secondaryAction: { flexDirection: 'row', paddingVertical: 18, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  secondaryActionText: { fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
});
