import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const theme = {
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
    },
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const currentTheme = isDarkMode ? theme.dark : theme.light;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme: currentTheme }}>
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
