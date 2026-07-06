import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  recoveryMode: boolean;
  setRecoveryMode: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  signOut: async () => {},
  recoveryMode: false,
  setRecoveryMode: () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    // 1. On vérifie IMMÉDIATEMENT si l'URL de cet onglet est un lien de récupération
    const isRecoveryURL = window.location.href.includes('type=recovery');
    let isRecoveryMode = isRecoveryURL;

    if (isRecoveryURL) {
      setRecoveryMode(true);
    }

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Si on est en mode récupération, on ne connecte pas l'utilisateur
      if (!isRecoveryMode) {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Si Supabase confirme la récupération, on s'assure que c'est bien cet onglet
        if (window.location.href.includes('type=recovery')) {
          isRecoveryMode = true;
          setRecoveryMode(true);
          setUser(null); 
        }
      } else if (event === 'SIGNED_IN' && isRecoveryMode) {
        // Supabase essaie de nous connecter avec la session temporaire, on bloque !
        // On ne fait rien, on garde l'utilisateur déconnecté jusqu'au changement de mot de passe.
      } else {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        fontFamily: 'Inter, sans-serif',
        color: '#1A202C',
        fontSize: '1.2rem',
        fontWeight: '600'
      }}>
        Chargement de SwissSimple...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, signOut, recoveryMode, setRecoveryMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);