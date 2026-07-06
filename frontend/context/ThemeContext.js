import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeColor, setThemeColor] = useState('#4A7729');
  const [fontSize, setFontSize] = useState('Medium');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const dark = await SecureStore.getItemAsync('dark_mode');
    const color = await SecureStore.getItemAsync('theme_color');
    const size = await SecureStore.getItemAsync('font_size');

    if (dark !== null) setIsDarkMode(dark === 'true');
    if (color) setThemeColor(color);
    if (size) setFontSize(size);
  };

  const toggleDarkMode = async (value) => {
    setIsDarkMode(value);
    await SecureStore.setItemAsync('dark_mode', value.toString());
  };

  const updateThemeColor = async (color) => {
    setThemeColor(color);
    await SecureStore.setItemAsync('theme_color', color);
  };

  const updateFontSize = async (size) => {
    setFontSize(size);
    await SecureStore.setItemAsync('font_size', size);
  };

  // Helper to get font size value
  const getFontSizeValue = (base) => {
    if (fontSize === 'Small') return base * 0.85;
    if (fontSize === 'Large') return base * 1.2;
    return base;
  };

  const colors = {
    primary: themeColor,
    background: isDarkMode ? '#121212' : '#F8F9F5',
    card: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#1A1A1A',
    subtext: isDarkMode ? '#AAAAAA' : '#888888',
    border: isDarkMode ? '#333333' : '#F0F0F0',
  };

  return (
    <ThemeContext.Provider value={{
      isDarkMode,
      themeColor,
      fontSize,
      colors,
      toggleDarkMode,
      updateThemeColor,
      updateFontSize,
      getFontSizeValue
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
