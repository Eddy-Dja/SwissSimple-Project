import React, { useState, useEffect } from 'react';
//import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SimulateurAVS from '../modules/rente_avs/SimulateurAVS';
import SimulateurLPP from '../modules/rente_lpp/SimulateurLPP';
import EmailGate from '../components/EmailGate';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';
import { generateRetraitePDF } from '../utils/pdfGenerator';
import './RetraiteHub.css';

const RetraiteHub: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'avs' | 'lpp' | 'synthese'>('avs');
  
  const { user } = useAuth();
  const isUnlocked = !!user;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [avsData, setAvsData] = useState<{ rente: number } | null>(null);
  const [lppData, setLppData] = useState<{ rente: number, capital: number, salaire: number, moisRestants: number } | null>(null);

  const [retraitLPPInput, setRetraitLPPInput] = useState('0');
  const [pourcentageCapital, setPourcentageCapital] = useState(0);
  const [revenuSouhaiteInput, setRevenuSouhaiteInput] = useState('');

  const formatCHF = (amount: number) => Math.round(amount).toLocaleString('de-CH');
  const formatCHFPrecis = (amount: number) => amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isDataReady = avsData !== null && lppData !== null;

  const renteAVSBase = avsData?.rente || 0;
  const renteLPPBase = lppData?.rente || 0;
  const capitalLPPBase = lppData?.capital || 0;
  const dernierSalaire = lppData?.salaire || 0;
  const moisRestants = lppData?.moisRestants || 0;

  const retraitLPP = parseFloat(retraitLPPInput) || 0;
  const perteRenteLPPRetrait = (retraitLPP * 0.068) / 12; 
  const renteLPPApresRetrait = Math.max(0, renteLPPBase - perteRenteLPPRetrait);

  const renteLPPFinale = renteLPPApresRetrait * (1 - pourcentageCapital / 100);
  const capitalCash = capitalLPPBase * (pourcentageCapital / 100);

  const totalRetraite = renteAVSBase + renteLPPFinale;
  const tauxRemplacement = dernierSalaire > 0 ? Math.round((totalRetraite / dernierSalaire) * 100) : 0;
  
  const tauxMarginalEstime = dernierSalaire > 200000 ? 0.30 : (dernierSalaire > 100000 ? 0.25 : 0.20);
  const estimatedTaxSaving = Math.round(7258 * tauxMarginalEstime);

  const revenuSouhaite = parseFloat(revenuSouhaiteInput) || 0;
  const trouMensuel = revenuSouhaite - totalRetraite;
  const capitalNecessaire = trouMensuel > 0 ? trouMensuel * 12 * 14.7 : 0; 
  const versementMensuel3a = capitalNecessaire > 0 && moisRestants > 0 ? capitalNecessaire / moisRestants : 0;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  return (
    <div className="hub-container">
      <div className="hub-header">
        <h1 className="radar-title">{t('hub.retraite_title')}</h1>
        <p>{t('hub.retraite_subtitle')}</p>
        
        <div className="hub-tabs">
          <button className={activeTab === 'avs' ? 'active' : ''} onClick={() => setActiveTab('avs')}>
            {t('hub.tab1_avs')}
          </button>
          <button className={activeTab === 'lpp' ? 'active' : ''} onClick={() => setActiveTab('lpp')}>
            {t('hub.tab2_lpp')}
          </button>
          <button className={activeTab === 'synthese' ? 'active' : ''} onClick={() => setActiveTab('synthese')}>
            {t('hub.tab3_synthese')}
          </button>
        </div>
      </div>

      <div className="hub-content">
        {/* --- ÉTAPE 1 : AVS --- */}
        <div className={`hub-step ${activeTab === 'avs' ? 'visible' : 'hidden'}`}>
          <SimulateurAVS 
            hideWarning
            onResultChange={(data) => setAvsData(data)}
          />
          <div className="hub-navigation">
            <button className="btn-hub-next" onClick={() => setActiveTab('lpp')}>
              {t('hub.tab2_lpp')} →
            </button>
          </div>
        </div>

        {/* --- ÉTAPE 2 : LPP --- */}
        <div className={`hub-step ${activeTab === 'lpp' ? 'visible' : 'hidden'}`}>
          <SimulateurLPP 
            hideWarning
            onResultChange={(data) => setLppData(data)}
          />
          <div className="hub-navigation">
            {/* MODIFICATION ICI : Texte plus clair */}
            <button className="btn-hub-prev" onClick={() => setActiveTab('avs')}>
              ← {t('hub.back_avs', 'Retour à la rente AVS')}
            </button>
            <button className="btn-hub-next" onClick={() => setActiveTab('synthese')}>
              {t('hub.next_step_synthese', 'Passer à la synthèse financière')} → 📊
            </button>
          </div>
        </div>

        {/* --- ÉTAPE 3 : SYNTHÈSE FINALE --- */}
        <div className={`hub-step ${activeTab === 'synthese' ? 'visible' : 'hidden'}`}>
          <div className="synthese-container">
            <h2>{t('hub.synthese_title_ret')}</h2>
            <p>{t('hub.synthese_intro_ret')}</p>
            
            {!isDataReady && (
              <p className="hub-warning-message">
                {t('hub.waiting_message')}
              </p>
            )}
            
            <div className="synthese-recap">
              <div className="recap-item">
                <span className="recap-title">{t('hub.recap_avs')}</span>
                <p className="recap-value benefice">
                  {avsData !== null ? `${formatCHFPrecis(renteAVSBase)} CHF / mois` : t('hub.waiting_calc')}
                </p>
              </div>
              <div className="recap-item">
                <span className="recap-title">{t('hub.recap_lpp')}</span>
                <p className="recap-value benefice">
                  {lppData !== null ? (
                    <>
                      {formatCHFPrecis(renteLPPFinale)} CHF / mois
                      {(retraitLPP > 0 || pourcentageCapital > 0) && <small className="hub-adjusted-small">{t('hub.adjusted')}</small>}
                    </>
                  ) : t('hub.waiting_calc')}
                </p>
              </div>
              <div className="recap-total">
                <span>{t('hub.recap_total_ret')}</span>
                <h3 className="benefice">
                  {isDataReady ? `${formatCHFPrecis(totalRetraite)} CHF / mois` : t('hub.waiting_calc')}
                </h3>
              </div>
            </div>

            {!isUnlocked ? (
              <EmailGate 
                title={t('hub.gate_title')}
                description={t('hub.gate_desc_ret')}
                onUnlock={() => setIsAuthModalOpen(true)}
              />
            ) : (
              <div className="unlocked-results">
                <h3>{t('hub.unlocked')}</h3>
                <p>{t('hub.unlocked_desc_ret')}</p>

                <div className="analysis-card">
                  <h4>{t('hub.rate_title')}</h4>
                  <p className="analysis-desc">
                    {t('hub.rate_desc', { salary: formatCHFPrecis(dernierSalaire) })}
                  </p>
                  <div className="replacement-gauge">
                    <div className="gauge-bar" style={{ width: `${Math.min(tauxRemplacement, 100)}%` }}></div>
                    <span className="gauge-text">{tauxRemplacement}%</span>
                  </div>
                  {dernierSalaire > 0 && tauxRemplacement < 70 ? (
                    <p className="break-even-result perte mt-15" dangerouslySetInnerHTML={{ __html: t('hub.rate_warning', { missing: formatCHFPrecis(dernierSalaire * 0.7 - totalRetraite) }) }} />
                  ) : dernierSalaire > 0 ? (
                    <p className="break-even-result benefice mt-15">
                      {t('hub.rate_success')}
                    </p>
                  ) : null}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.goal_title')}</h4>
                  <p className="analysis-desc">{t('hub.goal_desc')}</p>
                  
                  <div className="break-even-grid">
                    <div className="break-even-item">
                      <label>{t('hub.goal_label')}</label>
                      <div className="input-wrapper">
                        <span className="input-currency">CHF</span>
                        <input 
                          type="number" min="0" step="0.01"
                          placeholder="Ex: 6000.00" 
                          className="break-even-input"
                          value={revenuSouhaiteInput}
                          onChange={(e) => setRevenuSouhaiteInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {revenuSouhaite > 0 && (
                    <div className={`break-even-result ${trouMensuel > 0 ? 'perte' : 'benefice'}`}>
                      {trouMensuel > 0 ? (
                        <p dangerouslySetInnerHTML={{ __html: t('hub.goal_warning', {
                          target: formatCHFPrecis(revenuSouhaite),
                          missing: formatCHFPrecis(trouMensuel),
                          capital: formatCHFPrecis(capitalNecessaire),
                          monthly: formatCHFPrecis(versementMensuel3a)
                        }) }} />
                      ) : (
                        <p dangerouslySetInnerHTML={{ __html: t('hub.goal_success', {
                          target: formatCHFPrecis(revenuSouhaite),
                          surplus: formatCHFPrecis(Math.abs(trouMensuel))
                        }) }} />
                      )}
                    </div>
                  )}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.lpp_impact_title')}</h4>
                  <p className="analysis-desc">{t('hub.lpp_impact_desc')}</p>
                  
                  <div className="break-even-grid">
                    <div className="break-even-item">
                      <label>{t('hub.lpp_impact_label')}</label>
                      <div className="input-wrapper">
                        <span className="input-currency">CHF</span>
                        <input 
                          type="number" min="0" step="0.01"
                          placeholder="Ex: 50000.00" 
                          className="break-even-input"
                          value={retraitLPPInput}
                          onChange={(e) => setRetraitLPPInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {retraitLPP > 0 && (
                    <div className="break-even-result perte">
                      <p dangerouslySetInnerHTML={{ __html: t('hub.lpp_impact_warning', {
                        amount: formatCHFPrecis(retraitLPP),
                        loss: formatCHFPrecis(perteRenteLPPRetrait),
                        totalLoss: formatCHFPrecis(perteRenteLPPRetrait * 12 * 20)
                      }) }} />
                    </div>
                  )}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.capital_title')}</h4>
                  <p className="analysis-desc">{t('hub.capital_desc')}</p>
                  
                  <div className="slider-container">
                    <div className="slider-row">
                      <span>{t('hub.capital_0')}</span>
                      <strong className="text-blue">{pourcentageCapital}%</strong>
                    </div>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={pourcentageCapital}
                      onChange={(e) => setPourcentageCapital(parseInt(e.target.value))}
                      className="range-slider"
                    />
                  </div>

                  {pourcentageCapital > 0 && (
                    <div className="reco-3a mt-20">
                      <div className="reco-item">
                        <span>{t('hub.capital_cash')}</span>
                        <strong className="benefice">+ {formatCHFPrecis(capitalCash)} CHF</strong>
                      </div>
                      <div className="reco-item">
                        <span>{t('hub.capital_rent')}</span>
                        <strong className="perte">{formatCHFPrecis(renteLPPFinale)} CHF / mois</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.reco_title')}</h4>
                  <p className="analysis-desc">
                    {t('hub.reco_desc')}
                  </p>

                  <div className="reco-3a">
                    <div className="reco-item">
                      <span>{t('hub.reco_max')}</span>
                      <strong>7'258 CHF / an</strong>
                    </div>
                    <div className="reco-item">
                      <span>{t('hub.reco_tax')}</span>
                      <strong className="benefice">~ {formatCHF(estimatedTaxSaving)} CHF / an</strong>
                    </div>
                  </div>

                  <div className="hub-navigation pdf-btn-container">
                    <button className="btn-hub-blue btn-disabled" disabled>
                      {t('hub.reco_btn')} {t('hub.coming_soon')}
                    </button>
                  </div>
                </div>

                <div className="analysis-card">
                  <h4>{t('hub.pdf_title')}</h4>
                  <p className="analysis-desc">{t('hub.pdf_desc_ret')}</p>
                   <div className="hub-navigation pdf-btn-container">
                    <button 
                      className="btn-hub-blue" 
                      onClick={() => generateRetraitePDF({
                        renteAVS: renteAVSBase,
                        renteLPP: renteLPPFinale,
                        totalRetraite,
                        dernierSalaire,
                        tauxRemplacement,
                        estimatedTaxSaving,
                        retraitLPP,
                        perteRenteLPPRetrait,
                        pourcentageCapital,
                        capitalCash,
                        revenuSouhaite,
                        trouMensuel,
                        capitalNecessaire,
                        versementMensuel3a
                      }, t)}
                    >
                      {t('hub.pdf_btn_ret')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* LA MAGIE EST ICI : LES BOUTONS SONT SORTIS DU BLOC ISUNLOCKED */}
            {/* LES BOUTONS SONT TOUJOURS AFFICHÉS EN BAS DE LA SYNTHÈSE */}
            <div className="hub-navigation" style={{ marginTop: '30px', marginBottom: '40px' }}>
              <button className="btn-hub-next" onClick={() => setActiveTab('avs')}>
                {t('hub.back_avs', '← Retour à la rente AVS')}
              </button>
              <button className="btn-hub-next" onClick={() => setActiveTab('lpp')}>
                {t('hub.back_lpp', '← Retour à la rente LPP')}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* AVERTISSEMENT TRADUIT TOUT EN BAS */}
      <div className="avertissement-legal">
        <span className="titre-avertissement">⚖️ {t('hub.warning_title')}</span>
        <span className="texte-avertissement">{t('hub.warning_ret')}</span>
      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};

export default RetraiteHub;