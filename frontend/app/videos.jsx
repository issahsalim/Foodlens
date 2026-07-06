import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, SafeAreaView, Dimensions, Linking, ActivityIndicator, Modal, Platform } from 'react-native';
import YoutubePlayer from "react-native-youtube-iframe";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const { width } = Dimensions.get('window');
import { API_BASE_URL } from '../config';

export default function VideosScreen() {
  const router = useRouter();
  const { foodName } = useLocalSearchParams();
  const { colors, getFontSizeValue, isDarkMode } = useTheme();
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const onFullScreenChange = useCallback((isFullScreen) => {
    setIsFullScreen(isFullScreen);
  }, []);

  useEffect(() => {
    if (foodName) {
      fetchVideos();
    }
  }, [foodName]);

  const fetchVideos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const response = await axios.get(`${API_BASE_URL}/videos/search/`, {
        params: { q: foodName },
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideos(response.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        const backendError = err.response.data.error;
        if (backendError.includes("blocked") || backendError.includes("403")) {
          setError("Your YouTube API Key is blocked or not enabled. Please enable 'YouTube Data API v3' in your Google Cloud Console.");
        } else {
          setError(backendError);
        }
      } else {
        setError("Chef Latifa couldn't reach YouTube. Please check your connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatchOnYouTube = (id) => {
    setSelectedVideoId(id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: getFontSizeValue(24) }]}>
            Video Tutorials
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtext }]}>
            Mastering {foodName || "Cooking"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Chef Latifa is searching YouTube...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60} color="#E53E3E" />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={fetchVideos}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollArea}>
          {videos.map((video, index) => (
            <View key={video.id} style={[styles.videoCard, { backgroundColor: colors.card }]}>
              {/* Thumbnail with Rank Badge */}
              <View style={styles.thumbnailContainer}>
                <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} />
                <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={styles.playOverlay}>
                  <View style={styles.playCircle}>
                    <MaterialCommunityIcons name="play" size={40} color="white" />
                  </View>
                </View>
              </View>

              {/* Info Section */}
              <View style={styles.infoSection}>
                <Text style={[styles.videoTitle, { color: colors.text, fontSize: getFontSizeValue(18) }]} numberOfLines={2}>
                  {video.title}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.authorRow}>
                    <MaterialCommunityIcons name="television-classic" size={18} color={colors.subtext} />
                    <Text style={[styles.authorName, { color: colors.subtext }]}>{video.author}</Text>
                  </View>
                  <View style={styles.viewRow}>
                    <MaterialCommunityIcons name="eye-outline" size={16} color={colors.subtext} />
                    <Text style={[styles.viewsText, { color: colors.subtext }]}>{video.views}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.youtubeBtn}
                  onPress={() => handleWatchOnYouTube(video.id)}
                >
                  <MaterialCommunityIcons name="play" size={24} color="white" />
                  <Text style={styles.youtubeBtnText}>Watch on YouTube</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {videos.length === 0 && !isLoading && (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="video-off-outline" size={60} color={colors.subtext} />
              <Text style={[styles.loadingText, { color: colors.subtext }]}>No tutorials found for this dish.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Video Player Modal */}
      <Modal
        visible={!!selectedVideoId}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedVideoId(null)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.playerContainer, { backgroundColor: '#000' }]}>
            {/* Close Button */}
            {!isFullScreen && (
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setSelectedVideoId(null)}
              >
                <MaterialCommunityIcons name="close" size={28} color="white" />
              </TouchableOpacity>
            )}

            <YoutubePlayer
              height={isFullScreen ? width : 230}
              width={isFullScreen ? '100%' : width - 40}
              play={true}
              videoId={selectedVideoId}
              onFullScreenChange={onFullScreenChange}
              webViewProps={{
                allowsFullscreenVideo: true,
              }}
            />

            {!isFullScreen && (
              <View style={styles.playerInfo}>
                <Text style={styles.playerTitle} numberOfLines={2}>
                  {videos.find(v => v.id === selectedVideoId)?.title}
                </Text>
                <Text style={styles.playerSubtext}>
                  Cooking tutorial by {videos.find(v => v.id === selectedVideoId)?.author}
                </Text>
              </View>
            )}
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

        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="play-circle" size={26} color={colors.primary} />
          <Text style={[styles.tabText, { color: colors.primary, fontWeight: 'bold' }]}>Videos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/settings')}>
          <MaterialCommunityIcons name="cog-outline" size={26} color={colors.subtext} />
          <Text style={[styles.tabText, { color: colors.subtext }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  backBtn: { marginRight: 15 },
  headerTitle: { fontWeight: 'bold' },
  headerSubtitle: { fontSize: 13 },
  scrollArea: { padding: 20, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 15, fontSize: 14, textAlign: 'center' },
  errorText: { marginTop: 15, fontSize: 16, textAlign: 'center', fontWeight: 'bold' },
  retryBtn: { marginTop: 20, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: 'white', fontWeight: 'bold' },
  videoCard: { borderRadius: 25, marginBottom: 25, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  thumbnailContainer: { height: 180, position: 'relative', backgroundColor: '#eee' },
  thumbnail: { width: '100%', height: '100%' },
  rankBadge: { position: 'absolute', top: 15, left: 15, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15 },
  rankText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  playCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center', paddingLeft: 4 },
  infoSection: { padding: 20 },
  videoTitle: { fontWeight: 'bold', marginBottom: 10, lineHeight: 24 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorName: { fontSize: 14, marginLeft: 6 },
  viewRow: { flexDirection: 'row', alignItems: 'center' },
  viewsText: { fontSize: 12, marginLeft: 4 },
  youtubeBtn: { backgroundColor: '#FF0000', flexDirection: 'row', paddingVertical: 14, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  youtubeBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  tabBar: { height: 85, flexDirection: 'row', borderTopWidth: 1, paddingBottom: 25, position: 'absolute', bottom: 0, width: '100%' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 10, marginTop: 4 },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: -50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  playerInfo: {
    padding: 20,
    width: '100%',
    alignItems: 'flex-start',
  },
  playerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  playerSubtext: {
    color: '#aaa',
    fontSize: 14,
  },
});
