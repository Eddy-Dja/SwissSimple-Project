import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'Tableau de bord', emoji: '🏠' },
    { path: '/radar/fiscal', label: 'Radar Fiscal', emoji: '💰' },
    { path: '/assurance', label: 'Assurance LAMal', emoji: '🏥' }, // <-- NOUVEAU MODULE ICI
  ];

  const futureLinks = [
    { label: 'Module Logement', emoji: '🔑' },
    { label: 'Module Emploi', emoji: '💼' },
    { label: 'Marchés Publics', emoji: '🏛️' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '260px', backgroundColor: '#0F172A', color: 'white', padding: '24px 16px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Logo */}
        <div style={{ marginBottom: '40px', paddingLeft: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', letterSpacing: '-0.5px' }}>
            <span style={{ color: '#D32F2F' }}>S</span>wiss<span style={{ color: '#D32F2F' }}>S</span>imple
          </h2>
          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Life Simplified</span>
        </div>

        {/* Navigation Principale */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {navLinks.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                background: location.pathname === link.path ? '#1E293B' : 'transparent',
                border: 'none',
                color: location.pathname === link.path ? '#FFFFFF' : '#94A3B8',
                textAlign: 'left',
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: location.pathname === link.path ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: '0.2s'
              }}
            >
              <span>{link.emoji}</span> {link.label}
            </button>
          ))}

          <div style={{ marginTop: '20px', marginBottom: '10px', paddingLeft: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px' }}>Bientôt</span>
          </div>

          {futureLinks.map(link => (
            <button
              key={link.label}
              disabled
              style={{
                background: 'transparent',
                border: 'none',
                color: '#334155',
                textAlign: 'left',
                cursor: 'not-allowed',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span>{link.emoji}</span> {link.label}
            </button>
          ))}
        </nav>

        {/* Déconnexion */}
        <button 
          onClick={() => supabase.auth.signOut()} 
          style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #334155', color: '#94A3B8', padding: '10px', borderRadius: '6px', fontWeight: 600, fontSize: '13px' }}
        >
          Déconnexion
        </button>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <main style={{ flex: 1, padding: '40px 60px', overflowY: 'auto', backgroundColor: '#FFFFFF', borderTopLeftRadius: '24px', borderBottomLeftRadius: '24px', boxShadow: '-4px 0 15px rgba(0,0,0,0.05)' }}>
        <Outlet /> {/* C'est ici que s'afficheront Dashboard, RadarFiscal et Assurance */}
      </main>
    </div>
  );
}