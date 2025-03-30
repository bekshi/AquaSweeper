import React, { createContext, useContext, useState, useCallback } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const updateTheme = useCallback((value) => {
    setIsDarkMode(value);
  }, []);

  const themes = {
    dark: {
      background: '#1a1a1a',
      surface: '#2d2d2d',
      text: '#ffffff',
      textSecondary: '#b3b3b3',
      border: '#404040',
      primary: '#007AFF',
      accent: '#FF9500',
      error: '#FF3B30',
      success: '#4CAF50',
      cardBackground: '#2d2d2d',
    },
    light: {
      background: '#ffffff',
      surface: '#f8f8f8',
      text: '#333333',
      textSecondary: '#666666',
      border: '#f0f0f0',
      primary: '#007AFF',
      accent: '#FF9500',
      error: '#FF3B30',
      success: '#4CAF50',
      cardBackground: '#ffffff',
    },
  };

  const theme = isDarkMode ? themes.dark : themes.light;

  return (
    <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode: updateTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
