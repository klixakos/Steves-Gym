import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { ensureUserProfile, subscribeToUserProfile, ADMIN_EMAIL, getLocalClients, saveLocalClients } from '../services/bookingService';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  demoSignIn: (type: 'admin' | 'client') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const setupLocalUser = (role: 'admin' | 'client', displayName: string, email: string) => {
    const clients = getLocalClients();
    const existing = clients.find((c) => c.email.toLowerCase() === email.toLowerCase());
    const finalUid = existing?.uid || (role === 'admin' ? 'demo-admin-trainer' : `local-${Date.now()}`);

    const profile: UserProfile = existing || {
      uid: finalUid,
      email,
      displayName: displayName || (role === 'admin' ? 'Coach Aster' : 'Client'),
      role,
      remainingSessions: role === 'admin' ? 100 : 5,
      createdAt: new Date().toISOString(),
    };

    if (!existing) {
      saveLocalClients([...clients, profile]);
    }

    try {
      localStorage.setItem('corestudio_current_user', JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('corestudio_local_change'));
    } catch {}

    setUserProfile(profile);
    setUser({
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
    } as any);
    setLoading(false);
  };

  useEffect(() => {
    // Check if there is an active session saved in localStorage
    try {
      const saved = localStorage.getItem('corestudio_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) {
          const clients = getLocalClients();
          const found = clients.find((c) => c.uid === parsed.uid);
          const currentProfile = found || parsed;
          setUser({
            uid: currentProfile.uid,
            email: currentProfile.email,
            displayName: currentProfile.displayName,
          } as any);
          setUserProfile(currentProfile);
          setLoading(false);
        }
      }
    } catch {}

    const handleLocalChange = () => {
      try {
        const saved = localStorage.getItem('corestudio_current_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.uid) {
            const clients = getLocalClients();
            const found = clients.find((c) => c.uid === parsed.uid);
            setUserProfile(found || parsed);
          }
        }
      } catch {}
    };

    window.addEventListener('corestudio_local_change', handleLocalChange);

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        try {
          const isAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
          await ensureUserProfile(
            currentUser.uid,
            currentUser.email || '',
            currentUser.displayName || (isAdmin ? 'Trainer Aster' : 'Client'),
            isAdmin ? 'admin' : 'client'
          );

          unsubscribeProfile = subscribeToUserProfile(currentUser.uid, (profile) => {
            if (profile) setUserProfile(profile);
            setLoading(false);
          });
        } catch (err) {
          console.warn('Error ensuring profile with Firestore:', err);
          setLoading(false);
        }
      } else {
        // If not authenticated via Firebase, check if local session was active
        const saved = localStorage.getItem('corestudio_current_user');
        if (!saved) {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      window.removeEventListener('corestudio_local_change', handleLocalChange);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        setupLocalUser(isAdmin ? 'admin' : 'client', email.split('@')[0], email);
        return;
      }
      throw err;
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      await ensureUserProfile(cred.user.uid, email, name, isAdmin ? 'admin' : 'client');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        setupLocalUser(isAdmin ? 'admin' : 'client', name, email);
        return;
      }
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || '';
      const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      await ensureUserProfile(
        result.user.uid,
        email,
        result.user.displayName || (isAdmin ? 'Trainer Aster' : 'Client'),
        isAdmin ? 'admin' : 'client'
      );
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setupLocalUser('admin', 'Trainer Aster', ADMIN_EMAIL);
        return;
      }
      throw err;
    }
  };

  const demoSignIn = async (type: 'admin' | 'client') => {
    const email = type === 'admin' ? ADMIN_EMAIL : 'sarah.client@gymfit.com';
    const pass = 'Password123!';
    const name = type === 'admin' ? 'Coach Aster' : 'Sarah Jenkins';

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setupLocalUser(type, name, email);
        return;
      }

      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          await ensureUserProfile(cred.user.uid, email, name, type);
        } catch (innerErr: any) {
          setupLocalUser(type, name, email);
          return;
        }
      } else {
        setupLocalUser(type, name, email);
      }
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch {}
    try {
      localStorage.removeItem('corestudio_current_user');
      window.dispatchEvent(new CustomEvent('corestudio_local_change'));
    } catch {}
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        demoSignIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
