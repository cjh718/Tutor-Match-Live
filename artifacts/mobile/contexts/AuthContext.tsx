import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { User, getMe } from '@workspace/api-client-react';
import { router } from 'expo-router';

// Initialize the API client base URL
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up the token getter for API client
  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const loadAuth = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (storedToken) {
        setToken(storedToken);
        // Validate token by fetching user
        // We set token first so getMe uses it
        setAuthTokenGetter(() => storedToken);
        try {
          const fetchedUser = await getMe();
          setUser(fetchedUser);
        } catch (e) {
          // Token invalid or expired
          await AsyncStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const login = async (newToken: string, newUser: User) => {
    try {
      await AsyncStorage.setItem('auth_token', newToken);
      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      console.error('Failed to save auth token:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
      router.replace('/auth/login');
    } catch (error) {
      console.error('Failed to remove auth token:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
