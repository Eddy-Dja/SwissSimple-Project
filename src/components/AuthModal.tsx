import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from 'react-i18next';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose, forceUpdateMode }: { isOpen: boolean, onClose: () => void, forceUpdateMode?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && forceUpdateMode) {
      setIsUpdateMode(true);
      setIsResetMode(false);
      setIsLogin(false);
      setMessage(null);
    }
  }, [isOpen, forceUpdateMode]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsUpdateMode(false);
    setIsResetMode(false);
    setMessage(null);
    onClose();
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) { setMessage(error.message); setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        handleClose();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setMessage(t('auth.email_exists', 'Cet email est déjà utilisé. Essayez de vous connecter.'));
          setIsLogin(true);
        } else {
          setMessage(t('auth.signup_success', 'Inscription réussie ! Veuillez vérifier votre boîte e-mail pour confirmer votre compte.'));
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || '';
      if (errorMsg.includes('Email not confirmed')) setMessage(t('auth.error_email_not_confirmed'));
      else if (errorMsg.includes('Invalid login credentials')) setMessage(t('auth.error_invalid_credentials'));
      else setMessage(error.error_description || errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin 
      });
      if (error) throw error;
      setMessage(t('auth.reset_success', 'Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception.'));
      setIsResetMode(false);
      setIsLogin(true);
    } catch (error: any) {
      setMessage(error.message || "Erreur lors de l'envoi de l'email.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage(t('auth.error_password_match', 'Les mots de passe ne correspondent pas.'));
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;

      setMessage(t('auth.password_updated_success', 'Mot de passe mis à jour avec succès ! Redirection...'));
      
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      setMessage(error.message || "Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setIsResetMode(false);
    setMessage(null);
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>✕</button>
        
        <div className="modal-header">
          {isUpdateMode ? (
            <>
              <h2>{t('auth.title_update_password', 'Nouveau mot de passe')}</h2>
              <p>{t('auth.subtitle_update_password', 'Choisissez votre nouveau mot de passe')}</p>
            </>
          ) : isResetMode ? (
            <>
              <h2>{t('auth.title_reset', 'Mot de passe oublié')}</h2>
              <p>{t('auth.subtitle_reset', 'Entrez votre email pour recevoir un lien de réinitialisation')}</p>
            </>
          ) : (
            <>
              <h2>{isLogin ? t('auth.title_login') : t('auth.title_signup')}</h2>
              <p>{t('auth.subtitle')}</p>
            </>
          )}
        </div>

        {message && (
          <div className="modal-message" style={{ 
            padding: '12px', marginBottom: '15px', borderRadius: '8px', 
            backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '14px', border: '1px solid #bfdbfe'
          }}>
            {message}
          </div>
        )}

        {isUpdateMode ? (
          <form onSubmit={handleUpdatePassword} className="modal-form">
            <div className="form-group">
              <label>{t('auth.new_password', 'Nouveau mot de passe')}</label>
              <input className="form-input" type="password" placeholder="••••••••" value={password} required onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('auth.confirm_password', 'Confirmer le mot de passe')}</label>
              <input className="form-input" type="password" placeholder="••••••••" value={confirmPassword} required onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn-primary-full" type="submit" disabled={loading}>
              {loading ? t('auth.loading') : t('auth.update_btn', 'Mettre à jour')}
            </button>
          </form>
        ) : isResetMode ? (
          <form onSubmit={handlePasswordReset} className="modal-form">
            <div className="form-group">
              <label>{t('auth.email')}</label>
              <input className="form-input" type="email" placeholder={t('auth.email_placeholder')} value={email} required onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn-primary-full" type="submit" disabled={loading}>
              {loading ? t('auth.loading') : t('auth.reset_btn', 'Envoyer le lien')}
            </button>
            <div className="modal-footer" style={{ marginTop: '15px' }}>
              <button type="button" className="text-btn" onClick={() => { setIsResetMode(false); setMessage(null); }}>
                {t('auth.back_to_login', '← Retour à la connexion')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <button className="btn-google-login" onClick={handleGoogleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? t('auth.loading_google') : t('auth.google_btn')}
            </button>

            <div className="modal-divider"><span>{t('auth.or')}</span></div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>{t('auth.email')}</label>
                <input className="form-input" type="email" placeholder={t('auth.email_placeholder')} value={email} required onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>{t('auth.password')}</label>
                <input className="form-input" type="password" placeholder={t('auth.password_placeholder')} value={password} required onChange={(e) => setPassword(e.target.value)} />
              </div>
              
              {isLogin && (
                <div style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                  <button type="button" className="text-btn" style={{ fontSize: '0.85rem', padding: 0 }} onClick={() => { setIsResetMode(true); setMessage(null); }}>
                    {t('auth.forgot_password', 'Mot de passe oublié ?')}
                  </button>
                </div>
              )}

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
          </>
        )}
      </div>
    </div>
  );
}