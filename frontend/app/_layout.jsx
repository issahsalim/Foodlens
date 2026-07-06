import { Stack, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { ThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      const token = await SecureStore.getItemAsync('access_token');
      const isGuest = await SecureStore.getItemAsync('is_guest');
      const isLoggedIn = !!token;
      const isGuestUser = isGuest === 'true';

      setIsReady(true);

      const inAuthGroup = segments[0] === 'auth';
      const isAuthorized = isLoggedIn || isGuestUser;

      if (!isAuthorized && !inAuthGroup) {
        // No token and not a guest — send to login
        router.replace('/auth');
      } else if (isLoggedIn && inAuthGroup) {
        // Full member on the auth page — send to home
        router.replace('/');
      }
      // Guest on auth page — do nothing, allow sign-up
    };

    checkAndRedirect();
  }, [segments]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="index" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="recipe" />
        <Stack.Screen name="shopping" />
        <Stack.Screen name="settings" />
      </Stack>
    </ThemeProvider>
  );
}
