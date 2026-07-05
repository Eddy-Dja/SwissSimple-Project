import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // Vérification si l'email est déjà utilisé
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setMessage(t('auth.email_exists', 'Cet email est déjà utilisé. Essayez de vous connecter.'));
          setIsLogin(true);
        } else {
          // Inscription réussie, email de confirmation envoyé
          setMessage(t('auth.signup_success', 'Inscription réussie ! Veuillez vérifier votre boîte e-mail pour confirmer votre compte.'));
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || '';
      
      // Traduction des erreurs Supabase
      if (errorMsg.includes('Email not confirmed')) {
        setMessage(t('auth.error_email_not_confirmed'));
      } else if (errorMsg.includes('Invalid login credentials')) {
        setMessage(t('auth.error_invalid_credentials'));
      } else {
        // Si c'est une autre erreur (ex: mot de passe trop court), on affiche le message d'origine
        setMessage(error.error_description || errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour changer de mode (Connexion <-> Inscription) en effaçant les messages
  const switchMode = () => {
    setIsLogin(!isLogin);
    setMessage(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="modal-header">
          <h2>{isLogin ? t('auth.title_login') : t('auth.title_signup')}</h2>
          <p>{t('auth.subtitle')}</p>
        </div>

        {/* ZONE D'AFFICHAGE DES MESSAGES (Succès ou Erreur) */}
        {message && (
          <div className="modal-message" style={{ 
            padding: '12px', 
            marginBottom: '15px', 
            borderRadius: '8px', 
            backgroundColor: '#eff6ff', 
            color: '#1e40af', 
            fontSize: '14px',
            border: '1px solid #bfdbfe'
          }}>
            {message}
          </div>
        )}

        <button className="btn-google-login" onClick={handleGoogleLogin} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? t('auth.loading_google') : t('auth.google_btn')}
        </button>

        <div className="modal-divider">
          <span>{t('auth.or')}</span>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input className="form-input" type="email" placeholder={t('auth.email_placeholder')} value={email} required onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input className="form-input" type="password" placeholder={t('auth.password_placeholder')} value={password} required onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary-full" type="submit" disabled={loading}>
            {loading ? t('auth.loading') : (isLogin ? t('auth.login_btn') : t('auth.signup_btn'))}
          </button>
        </form>

        <div className="modal-footer">
          {isLogin ? (
            <span>{t('auth.no_account')} <button className="text-btn" onClick={switchMode}>{t('auth.signup_btn')}</button></span>
          ) : (
            <span>{t('auth.has_account')} <button className="text-btn" onClick={switchMode}>{t('auth.login_btn')}</button></span>
          )}
        </div>
      </div>
    </div>
  );
}