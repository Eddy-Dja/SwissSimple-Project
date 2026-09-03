import React from 'react';
import { useTranslation } from 'react-i18next';
import './EmailGate.css';

interface EmailGateProps {
  title: string;
  description: string;
  onUnlock: () => void;
}

const EmailGate: React.FC<EmailGateProps> = ({ title, description, onUnlock }) => {
  const { t } = useTranslation();
  
  return (
    <div className="email-gate-container">
      <div className="email-gate-icon">🔒</div>
      <h3 className="email-gate-title">{title}</h3>
      <p className="email-gate-desc">{description}</p>
      
      <button className="btn-primary email-gate-btn" onClick={onUnlock}>
        {t('gate.btn')}
      </button>
      
      <small className="filter-hint email-gate-hint">
        {t('gate.hint')}
      </small>
    </div>
  );
};

export default EmailGate;