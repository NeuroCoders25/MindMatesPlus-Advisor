import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface AdvisorProfile {
  name: string;
  role: string;
  email: string;
  profileImageUrl?: string;
  yearsOfExperience?: number;
  qualifications?: string;
  about?: string;
  isModerator?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  advisorProfile: AdvisorProfile | null;
  loading: boolean;
  signup: (email: string, password: string, name: string, role: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateAdvisorProfile: (updates: Partial<AdvisorProfile>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [advisorProfile, setAdvisorProfile] = useState<AdvisorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function signup(email: string, password: string, name: string, role: string) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'advisors', user.uid), {
      uid: user.uid,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
    });
    setAdvisorProfile({ name, role, email });
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    setAdvisorProfile(null);
    return signOut(auth);
  }

  function updateAdvisorProfile(updates: Partial<AdvisorProfile>) {
    setAdvisorProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  }

  function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'advisors', user.uid));
          if (snap.exists()) {
            const data = snap.data();
            setAdvisorProfile({
              name: data.name,
              role: data.role,
              email: data.email,
              profileImageUrl: data.profileImageUrl,
              yearsOfExperience: data.yearsOfExperience,
              qualifications: data.qualifications,
              about: data.about,
              isModerator: data.isModerator ?? false,
            });
          }
        } catch {
          // profile fetch failed silently
        }
      } else {
        setAdvisorProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, advisorProfile, loading, signup, login, logout, resetPassword, updateAdvisorProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
