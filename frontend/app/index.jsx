import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, SafeAreaView, Dimensions, Alert, Animated, Easing, ScrollView, RefreshControl } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const { width } = Dimensions.get('window');

export default function App() {
    const { colors, getFontSizeValue, isDarkMode } = useTheme();
    const [activeTab, setActiveTab] = useState('home');
    const [username, setUsername] = useState('Guest');
    const [facing, setFacing] = useState('back');
    const [permission, requestPermission] = useCameraPermissions();
    const [image, setImage] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGuestUser, setIsGuestUser] = useState(false);
    const [history, setHistory] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const cameraRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        if (isAnalyzing) {
            Animated.loop(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            rotateAnim.setValue(0);
        }
    }, [isAnalyzing]);

    useEffect(() => {
        checkUserStatus();
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!isGuestUser) {
                fetchHistory();
            }
        }, [isGuestUser])
    );

    const fetchHistory = async () => {
        try {
            const token = await SecureStore.getItemAsync('access_token');
            if (!token) return;
            const response = await axios.get(`${API_BASE_URL}/history/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data) {
                setHistory(response.data);
            }
        } catch (err) {
            console.log('Error fetching history:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    const deleteHistory = async (id) => {
        Alert.alert(
            "Delete Detection",
            "Are you sure you want to remove this detection from your history?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await SecureStore.getItemAsync('access_token');
                            await axios.delete(`${API_BASE_URL}/delete-history/${id}/`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            // Remove from state immediately — using String() to ensure type matching
                            setHistory(prev => prev.filter(item => String(item.id) !== String(id)));
                        } catch (err) {
                            console.error('Delete error details:', err.response?.data || err.message);
                            Alert.alert("Error", "Could not delete. Please try again.");
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchHistory();
    };

    const checkUserStatus = async () => {
        const isGuest = await SecureStore.getItemAsync('is_guest');
        const storedName = await SecureStore.getItemAsync('username');
        setIsGuestUser(isGuest === 'true');
        if (storedName) setUsername(storedName);
        
        if (isGuest !== 'true') {
            fetchHistory();
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await SecureStore.deleteItemAsync('access_token');
                        await SecureStore.deleteItemAsync('refresh_token');
                        await SecureStore.deleteItemAsync('is_guest');
                        await SecureStore.deleteItemAsync('guest_shopping_list');
                        router.replace('/auth');
                    }
                }
            ]
        );
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setActiveTab('detect');
        }
    };

    const takePicture = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync();
            setImage(photo.uri);
        }
    };

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    const analyzeMeal = async () => {
        if (!image) return;
        setIsAnalyzing(true);

        try {
            const token = await SecureStore.getItemAsync('access_token');
            const formData = new FormData();
            formData.append('image', {
                uri: image,
                name: 'food.jpg',
                type: 'image/jpeg',
            });

            const response = await fetch(`${API_BASE_URL}/detect/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                // Refresh history to show the new detection immediately
                fetchHistory();

                router.push({
                    pathname: '/recipe',
                    params: {
                        foodName: data.food_name,
                        ingredients: data.ingredients?.join(','),
                        steps: JSON.stringify(data.steps || []),
                        nutrition: JSON.stringify(data.nutrition || {}),
                        imageUri: data.image_uri || image
                    }
                });
            }
        } catch (error) {
            Alert.alert("Error", "Could not analyze the image.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- RENDERING VIEWS ---

    const renderDashboard = () => (
        <ScrollView 
            style={styles.dashboard} 
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl 
                    refreshing={isRefreshing} 
                    onRefresh={onRefresh} 
                    colors={[colors.primary]}
                    tintColor={colors.primary}
                />
            }
        >
            {/* Green Hero Header */}
            <View style={[styles.heroSection, { backgroundColor: colors.primary }]}>
                <View style={styles.heroTop}>
                    <View>
                        <Text style={[styles.heroLogo, { fontSize: getFontSizeValue(26) }]}>FoodLens</Text>
                        <Text style={styles.heroSubtitle}>AI Food Detection</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout}>
                        <MaterialCommunityIcons name="logout" size={24} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>

                <View style={styles.heroGreetingContainer}>
                    <Text style={[styles.heroGreeting, { fontSize: getFontSizeValue(32) }]}>Hey, {username}! 👋</Text>
                    <Text style={[styles.heroQuestion, { fontSize: getFontSizeValue(16) }]}>What food shall we detect today?</Text>
                </View>

                {/* Floating Icons background effect */}
                <View style={styles.heroDecor}>
                    <Text style={styles.decorEmoji}>🥦</Text>
                    <Text style={styles.decorEmoji}>🍅</Text>
                    <Text style={styles.decorEmoji}>🥕</Text>
                    <Text style={styles.decorEmoji}>🥑</Text>
                </View>
            </View>

            <View style={styles.dashboardContent}>

                {/* Quick Actions Grid */}
                <View style={styles.actionGrid}>
                    <TouchableOpacity style={[styles.gridCard, { borderColor: colors.primary }]} onPress={() => setActiveTab('detect')}>
                        <Text style={styles.gridEmoji}>📸</Text>
                        <Text style={[styles.gridText, { color: colors.primary }]}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.gridCard, { borderColor: colors.primary }]} onPress={pickImage}>
                        <Text style={styles.gridEmoji}>🖼️</Text>
                        <Text style={[styles.gridText, { color: colors.primary }]}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.gridCard, { borderColor: colors.primary }]} onPress={() => router.push('/chat')}>
                        <Text style={styles.gridEmoji}>💬</Text>
                        <Text style={[styles.gridText, { color: colors.primary }]}>Ask AI</Text>
                    </TouchableOpacity>
                </View>

                {/* Browse by Cuisine */}
                {/* <Text style={[styles.sectionTitle, { color: colors.text, fontSize: getFontSizeValue(18) }]}>Browse by Cuisine</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cuisineScroll}>
                    <TouchableOpacity style={[styles.cuisinePill, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9', borderColor: colors.primary }]}>
                        <Text style={[styles.cuisineText, { color: colors.primary, fontWeight: 'bold' }]}>GH Ghanaian</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cuisinePillInactive, { backgroundColor: isDarkMode ? '#1a1a1a' : '#F5F5F5', borderColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                        <Text style={[styles.cuisineTextInactive, { color: colors.text }]}>🌍 African</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cuisinePillInactive, { backgroundColor: isDarkMode ? '#1a1a1a' : '#F5F5F5', borderColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                        <Text style={[styles.cuisineTextInactive, { color: colors.text }]}>🌍 Asian</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cuisinePillInactive, { backgroundColor: isDarkMode ? '#1a1a1a' : '#F5F5F5', borderColor: isDarkMode ? '#333' : '#E0E0E0' }]}>
                        <Text style={[styles.cuisineTextInactive, { color: colors.text }]}>🌍 American</Text>
                    </TouchableOpacity>
                </ScrollView> */}

                {/* Recent Detections */}
                <Text style={[styles.sectionTitle, { color: colors.text, fontSize: getFontSizeValue(18) }]}>Recent Detections</Text>

                {history.length > 0 ? history.map((item) => (
                    <View key={item.id} style={[styles.recentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.recentIconBox, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9' }]}>
                            {item.image_uri ? (
                                <Image source={{ uri: item.image_uri }} style={styles.recentImage} />
                            ) : (
                                <Text style={styles.recentIconEmoji}>🍽️</Text>
                            )}
                        </View>
                        <View style={styles.recentInfo}>
                            <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>{item.food_name}</Text>
                            <Text style={[styles.recentSubtitle, { color: colors.subtext }]}>
                                {item.nutrition?.region || 'Ghanaian'} cuisine
                            </Text>
                        </View>
                        <View style={styles.recentActions}>
                            <TouchableOpacity
                                style={[styles.deleteBtn]}
                                onPress={() => deleteHistory(item.id)}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#e53935" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.recentBtn, { backgroundColor: isDarkMode ? '#1e3a1e' : '#E8F5E9' }]}
                                onPress={() => {
                                    router.push({
                                        pathname: '/recipe',
                                        params: {
                                            foodName: item.food_name,
                                            ingredients: Array.isArray(item.ingredients) ? item.ingredients.join(',') : item.ingredients,
                                            steps: JSON.stringify(item.steps || []),
                                            nutrition: JSON.stringify(item.nutrition || {}),
                                            imageUri: item.image_uri
                                        }
                                    });
                                }}
                            >
                                <Text style={[styles.recentBtnText, { color: colors.primary }]}>Recipe →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )) : (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="history" size={40} color={colors.subtext} style={{ opacity: 0.5 }} />
                        <Text style={[styles.emptyText, { color: colors.subtext }]}>No recent detections yet.</Text>
                    </View>
                )}

            </View>
        </ScrollView>
    );

    const renderCamera = () => {
        if (!permission) return <View />;
        if (!permission.granted) {
            return (
                <View style={styles.centered}>
                    <Text style={{ color: 'white', marginBottom: 20 }}>We need your permission to show the camera</Text>
                    <TouchableOpacity onPress={requestPermission} style={styles.uploadBtn}>
                        <Text style={styles.uploadBtnText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (image) {
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.previewHeader}>
                        <TouchableOpacity onPress={() => setImage(null)} style={styles.cameraBack}>
                            <MaterialCommunityIcons name="close" size={28} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.previewTitle}>Scan Food</Text>
                        <View style={{ width: 50 }} />
                    </View>

                    <Image source={{ uri: image }} style={styles.previewImage} />

                    <View style={styles.previewFooter}>
                        <TouchableOpacity
                            style={[styles.analyzeButton, isAnalyzing && styles.disabledBtn]}
                            onPress={analyzeMeal}
                            disabled={isAnalyzing}
                        >
                            <Animated.View style={isAnalyzing ? { transform: [{ rotate: spin }] } : null}>
                                <MaterialCommunityIcons name={isAnalyzing ? "loading" : "brain"} size={24} color="white" />
                            </Animated.View>
                            <Text style={styles.analyzeButtonText}>
                                {isAnalyzing ? "Analyzing..." : "Identify Meal"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return (
            <View style={styles.container}>
                <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
                    <SafeAreaView style={styles.cameraOverlay}>
                        <View style={styles.cameraTop}>
                            <TouchableOpacity onPress={() => setActiveTab('home')} style={styles.cameraBack}>
                                <MaterialCommunityIcons name="chevron-left" size={32} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.cameraBottom}>
                            <TouchableOpacity style={styles.cameraIcon} onPress={pickImage}>
                                <MaterialCommunityIcons name="image-multiple" size={30} color="white" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.shutter} onPress={takePicture}>
                                <View style={styles.shutterInner} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.cameraIcon} onPress={toggleCameraFacing}>
                                <MaterialCommunityIcons name="camera-flip" size={30} color="white" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </CameraView>
            </View>
        );
    };

    return (
        <View style={styles.mainWrapper}>
            <StatusBar style={activeTab === 'home' ? "light" : "light"} />

            <View style={styles.contentArea}>
                {activeTab === 'home' ? renderDashboard() : renderCamera()}
            </View>

            {/* Persistent Bottom Tab Bar */}
            <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => { setActiveTab('home'); fetchHistory(); }}
                >
                    <MaterialCommunityIcons
                        name={activeTab === 'home' ? "home" : "home-outline"}
                        size={26}
                        color={activeTab === 'home' ? colors.primary : colors.subtext}
                    />
                    <Text style={[styles.tabText, activeTab === 'home' && { color: colors.primary, fontWeight: 'bold' }]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setActiveTab('detect')}
                >
                    <MaterialCommunityIcons
                        name={activeTab === 'detect' ? "magnify-scan" : "magnify"}
                        size={26}
                        color={activeTab === 'detect' ? colors.primary : colors.subtext}
                    />
                    <Text style={[styles.tabText, activeTab === 'detect' && { color: colors.primary, fontWeight: 'bold' }]}>Detect</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => router.push('/chat')}
                >
                    <MaterialCommunityIcons name="chat-outline" size={26} color={colors.subtext} />
                    <Text style={[styles.tabText, { color: colors.subtext }]}>Chat</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    mainWrapper: {
        flex: 1,
        backgroundColor: '#F8F9F5',
    },
    contentArea: {
        flex: 1,
    },
    dashboard: {
        flex: 1,
    },
    heroSection: {
        backgroundColor: '#4A7729',
        paddingTop: 60,
        paddingHorizontal: 25,
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    heroLogo: {
        color: 'white',
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -1,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: 'bold',
    },
    heroGreetingContainer: {
        marginTop: 10,
    },
    heroGreeting: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
    },
    heroQuestion: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 16,
        marginTop: 5,
    },
    heroDecor: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: -15,
        right: 30,
    },
    decorEmoji: {
        fontSize: 24,
        marginHorizontal: 5,
        opacity: 0.8,
    },
    dashboardContent: {
        padding: 20,
    },
    mainUploadCard: {
        backgroundColor: 'white',
        borderRadius: 25,
        padding: 15,
        marginBottom: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    dashedBorder: {
        borderWidth: 2,
        borderColor: '#e1e8d9',
        borderStyle: 'dashed',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 15,
    },
    uploadSubtitle: {
        fontSize: 13,
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    uploadBtn: {
        backgroundColor: '#4A7729',
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    uploadBtnText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    actionGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    gridCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 15,
        marginHorizontal: 5,
        borderRadius: 15,
        borderWidth: 1,
        backgroundColor: 'transparent',
    },
    gridEmoji: { fontSize: 24, marginBottom: 8 },
    gridText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 15,
        marginTop: 5,
    },
    cuisineScroll: {
        paddingBottom: 25,
    },
    cuisinePill: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
    },
    cuisineText: {
        fontSize: 14,
    },
    cuisinePillInactive: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
    },
    cuisineTextInactive: {
        fontSize: 14,
    },
    recentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 20,
        backgroundColor: 'white',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
    },
    recentIconBox: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        overflow: 'hidden',
    },
    recentImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    recentIconEmoji: {
        fontSize: 22,
    },
    recentInfo: {
        flex: 1,
    },
    recentTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    recentSubtitle: {
        fontSize: 13,
        opacity: 0.6,
    },
    recentBtn: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 12,
    },
    recentBtnText: {
        fontWeight: 'bold',
        fontSize: 13,
    },
    recentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    deleteBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FFEBEE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: 10,
        fontSize: 14,
        fontWeight: '500',
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
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: 'space-between',
    },
    cameraTop: {
        padding: 20,
    },
    cameraBack: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraBottom: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 40,
    },
    shutter: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'white',
    },
    shutterInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
    },
    cameraIcon: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        alignItems: 'center',
        backgroundColor: 'black',
    },
    previewTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    previewImage: {
        flex: 1,
        resizeMode: 'cover',
    },
    previewFooter: {
        padding: 30,
        backgroundColor: 'black',
    },
    analyzeButton: {
        backgroundColor: '#4A7729',
        flexDirection: 'row',
        paddingVertical: 18,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    analyzeButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    disabledBtn: {
        opacity: 0.6,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0f0f',
    },
});
