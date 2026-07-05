import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();

  const modules = [
    {
      id: 'fiscal',
      title: 'Radar Fiscal',
      emoji: '💰',
      description: 'Comparez vos impôts entre deux communes, calculez votre revenu imposable et optimisez vos déductions.',
      path: '/radar-fiscal', // Chemin corrigé
      color: '#16A34A',
      bgColor: '#F0FDF4',
      available: true
    },
    { 
      id: 'assurance',
      title: 'Assurance LAMal',
      emoji: '🏥',
      description: 'Comparez les primes d\'assurance maladie de base pour votre région et trouvez la plus avantageuse.',
      path: '/assurance',
      color: '#DC2626',
      bgColor: '#FEF2F2',
      available: true
    },
    {
      id: 'avs',
      title: 'Simulateur AVS',
      emoji: '🧓',
      description: 'Estimez votre rente de vieillesse de base (1er pilier) en fonction de votre salaire et de vos années de cotisation.',
      path: '/simulateur-avs',
      color: '#0EA5E9',
      bgColor: '#F0F9FF',
      available: true
    },
    {
      id: 'lpp',
      title: 'Simulateur LPP',
      emoji: '🏦',
      description: 'Projetez votre avoir de vieillesse (2ème pilier) et estimez votre rente de caisse de pension.',
      path: '/simulateur-lpp', // Chemin vers la nouvelle route
      color: '#15803D',
      bgColor: '#F0FDF4',
      available: true
    },
    {
      id: 'logement',
      title: 'Recherche Logement',
      emoji: '🔑',
      description: 'Centralisez les annonces et automatisez vos candidatures pour trouver votre prochain chez-vous.',
      path: '/modules/logement',
      color: '#2563EB',
      bgColor: '#EFF6FF',
      available: false
    },
    {
      id: 'emploi',
      title: 'Recherche Emploi',
      emoji: '💼',
      description: 'Trouvez les meilleures opportunités et créez des candidatures sur-mesure pour le marché suisse.',
      path: '/modules/emploi',
      color: '#D97706',
      bgColor: '#FFFBEB',
      available: false
    },
    {
      id: 'marches',
      title: 'Marchés Publics',
      emoji: '🏛️',
      description: 'Surveillez les appels d\'offres cantonaux et communaux et soumettez vos propositions.',
      path: '/modules/marches',
      color: '#7C3AED',
      bgColor: '#F5F3FF',
      available: false
    }
  ];

  return (
    <div className="dashboard-container">
      {/* En-tête de bienvenue */}
      <header className="dashboard-header">
        <div>
          <h1>Bienvenue sur SwissSimple 👋</h1>
          <p>La vie en Suisse, simplifiée. Choisissez un module pour commencer.</p>
        </div>
      </header>

      {/* Grille des Modules */}
      <div className="modules-grid">
        {modules.map(mod => (
          <div 
            key={mod.id} 
            className={`module-card ${mod.available ? 'available' : 'locked'}`}
            onClick={() => mod.available && navigate(mod.path)}
          >
            {!mod.available && (
              <div className="badge-coming-soon">Bientôt</div>
            )}
            
            <div className="module-icon-box" style={{ backgroundColor: mod.bgColor, color: mod.color }}>
              {mod.emoji}
            </div>
            
            <h3>{mod.title}</h3>
            <p>{mod.description}</p>
            
            {mod.available && (
              <div className="module-cta" style={{ color: mod.color }}>
                Accéder au module <span>→</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}