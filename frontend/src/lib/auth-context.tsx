/**
 * Auth Context - Provides authentication state and Keycloak integration across the app.
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiAuth, apiSettings } from '../lib/api-client';
import type { AuthToken, User } from '../types/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('rf-sor-token');
    if (storedToken) {
      setTokenState(storedToken);
      // Try to verify token and fetch user info
      verifyToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const verifyToken = async (storedToken: string) => {
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (resp.ok) {
        const userData: User = await resp.json();
        setUser(userData);
      } else {
        // Token expired/invalid, clear it
        localStorage.removeItem('rf-sor-token');
        setTokenState(null);
      }
    } catch {
      // Auth endpoint unreachable
      setUser(null);
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    const settings = apiSettings.getPersisted();
    let authResult: AuthToken;
    
    try {
      if (settings.keycloak_url && settings.keycloak_realm) {
        // Use Keycloak OIDC Password Grant
        const tokenUrl = `${settings.keycloak_url}/realms/${settings.keycloak_realm}/protocol/openid-connect/token`;
        const formData = new URLSearchParams();
        formData.append('grant_type', 'password');
        formData.append('client_id', settings.client_id || 'rf-sor-client');
        formData.append('username', username);
        formData.append('password', password);
        
        const resp = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData,
        });
        
        if (!resp.ok) throw new Error(`Keycloak auth failed: ${resp.status}`);
        authResult = await resp.json();
      } else {
        // Use local JWT auth
        authResult = await apiAuth.loginKeycloak(username, password);
      }
      
      setTokenState(authResult.access_token);
      localStorage.setItem('rf-sor-token', authResult.access_token);
      
      // Fetch user info
      const userResp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authResult.access_token}` },
      });
      if (userResp.ok) {
        const userData: User = await userResp.json();
        setUser(userData);
      }
    } catch (err: any) {
      throw new Error(`Auth failed: ${err.message || 'Invalid credentials'}`);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('rf-sor-token');
    setUser(null);
    setTokenState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem('rf-sor-token');
    if (currentToken) {
      await verifyToken(currentToken);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
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
