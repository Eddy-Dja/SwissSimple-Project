import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import './TaxCopilot.css';

// Cantons : noms propres officiels. Les VALUES correspondent EXACTEMENT
// aux noms stockés dans Supabase (tax_documents.canton) — ne JAMAIS
// traduire les values, uniquement les libellés.
const CANTONS: [string, string][] = [
  ["Zürich", "Zürich"], ["Bern", "Bern"], ["Luzern", "Luzern"], ["Uri", "Uri"],
  ["Schwyz", "Schwyz"], ["Obwalden", "Obwalden"], ["Nidwalden", "Nidwalden"],
  ["Glarus", "Glarus"], ["Zug", "Zug"], ["Fribourg", "Fribourg"],
  ["Solothurn", "Solothurn"], ["Basel-Stadt", "Basel-Stadt"],
  ["Basel-Landschaft", "Basel-Landschaft"], ["Schaffhausen", "Schaffhausen"],
  ["Appenzell Ausserrhoden", "Appenzell A.Rh."],
  ["Appenzell Innerrhoden", "Appenzell I.Rh."],
  ["St. Gallen", "St. Gallen"], ["Graubünden", "Graubünden"], ["Aargau", "Aargau"],
  ["Thurgau", "Thurgau"], ["Ticino", "Ticino"], ["Vaud", "Vaud"],
  ["Valais", "Valais"], ["Neuchâtel", "Neuchâtel"], ["Genève", "Genève"], ["Jura", "Jura"],
];

const TaxCopilot = () => {
  const { t, i18n } = useTranslation();
  const uiLang: string = (i18n.language || 'fr').slice(0, 2);

  // ⚠️ RÈGLE D'OR : la VALUE part telle quelle au backend (match Supabase).
  // Seul le LIBELLÉ est traduit.
  const statusOptions: [string, string][] = [
    ["Célibataire", t('Chatbot.status_celibataire')],
    ["Marié(e)", t('Chatbot.status_marie')],
    ["Divorcé(e)", t('Chatbot.status_divorce')],
    ["Veuf(ve)", t('Chatbot.status_veuf')],
  ];
  const profOptions: [string, string][] = [
    ["Salarié", t('Chatbot.prof_salaries')],
    ["Indépendant", t('Chatbot.prof_independant')],
    ["Retraité", t('Chatbot.prof_retraite')],
  ];
  const childrenOptions: [string, string][] = [
    ["0", t('Chatbot.children_0')],
    ["1", t('Chatbot.children_1')],
    ["2", t('Chatbot.children_2')],
    ["3+", t('Chatbot.children_3plus')],
  ];

  const [selectedCanton, setSelectedCanton] = useState<string>("Zürich");
  const [selectedStatus, setSelectedStatus] = useState<string>("Marié(e)");
  const [selectedChildren, setSelectedChildren] = useState<string>("0");
  const [selectedProfession, setSelectedProfession] = useState<string>("Salarié");
  const [selectedLang, setSelectedLang] = useState<string>(uiLang);
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // La langue de réponse suit la langue du site quand celle-ci change
  useEffect(() => {
    setSelectedLang(uiLang);
  }, [uiLang]);

  const askAI = async (): Promise<void> => {
    setLoading(true);
    setAnswer("");
    setProvider("");

    type StreamEvent =
      | { type: 'meta'; fournisseur?: string; cache?: boolean }
      | { type: 'chunk'; text: string }
      | { type: 'done' };

    try {
      const res = await fetch('http://localhost:8000/api/tax-copilot-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_question: question,
          canton: selectedCanton,
          statut: selectedStatus,
          enfants: selectedChildren,
          profession: selectedProfession,
          langue: selectedLang
        })
      });

      if (!res.ok || !res.body) {
        setAnswer(t('Chatbot.error_backend'));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // garde la ligne incomplète pour le tour suivant

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let ev: StreamEvent;
          try {
            ev = JSON.parse(trimmed) as StreamEvent;
          } catch {
            continue; // ligne malformée : ignorée
          }
          if (ev.type === 'meta') {
            setProvider(ev.fournisseur ? `${t('Chatbot.generated_by')} ${ev.fournisseur}` : "");
          } else if (ev.type === 'chunk') {
            acc += ev.text;
            setAnswer(acc); // le texte s'allonge au fil de l'eau
          }
        }
      }
    } catch {
      setAnswer(t('Chatbot.error_backend'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="copilot-container">
      <h3 className="copilot-title">{t('Chatbot.tax_copilot_title')}</h3>

      <div className="copilot-grid">
        <div>
          <label className="copilot-label">{t('Chatbot.select_canton')}</label>
          <select className="copilot-select" value={selectedCanton} onChange={(e) => setSelectedCanton(e.target.value)}>
            {CANTONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="copilot-label">{t('Chatbot.select_status')}</label>
          <select className="copilot-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="copilot-label">{t('Chatbot.select_children')}</label>
          <select className="copilot-select" value={selectedChildren} onChange={(e) => setSelectedChildren(e.target.value)}>
            {childrenOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="copilot-label">{t('Chatbot.select_profession')}</label>
          <select className="copilot-select" value={selectedProfession} onChange={(e) => setSelectedProfession(e.target.value)}>
            {profOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="copilot-label">{t('Chatbot.select_lang')}</label>
          <select className="copilot-select" value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <label className="copilot-label">{t('Chatbot.question_label')}</label>
      <input
        className="copilot-question-input"
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t('Chatbot.question_placeholder')}
      />

      <button
        className="copilot-button"
        onClick={askAI}
        disabled={loading || !question}
      >
        {loading ? t('Chatbot.loading') : t('Chatbot.ask_ai_button')}
      </button>

      {loading && !answer && (
        <div className="copilot-answer" style={{ marginTop: '20px', fontStyle: 'italic', color: '#888' }}>
          {t('Chatbot.loading')} — {t('Chatbot.loading_hint')}
        </div>
      )}

      {answer && (
        <div className="copilot-answer">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          {provider && <small className="copilot-provider">{provider}</small>}
        </div>
      )}
    </div>
  );
};

export default TaxCopilot;