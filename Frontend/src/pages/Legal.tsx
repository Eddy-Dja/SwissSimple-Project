import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import './Legal.css';

export default function Legal() {
  const { i18n } = useTranslation();
  const isDe = i18n.language.startsWith('de');

  return (
    <div className="legal-container">
      <SEO
        title={isDe ? 'Impressum & Datenschutzerklärung | SwissSimple' : 'Mentions légales & Confidentialité | SwissSimple'}
        description={isDe
          ? 'Impressum und Datenschutzerklärung von SwissSimple: Herausgeber, Hosting, Datenverarbeitung und Ihre Rechte nach revDSG.'
          : 'Mentions légales et confidentialité de SwissSimple : éditeur, hébergement, traitement des données et vos droits selon la revLPD.'}
        path="/legal"
      />

      <div className="legal-content">
        <h1>{isDe ? 'Impressum & Datenschutzerklärung' : 'Mentions Légales & Politique de Confidentialité'}</h1>
        <p className="legal-update">{isDe ? 'Letzte Aktualisierung: 29. Oktober 2026' : 'Dernière mise à jour : 29 octobre 2026'}</p>

        {/* 1. ÉDITEUR */}
        <section>
          <h2>{isDe ? '1. Herausgeber der Website' : '1. Éditeur du site'}</h2>
          <p>
            {isDe ? 'Die Website SwissSimple wird herausgegeben von:' : 'Le site SwissSimple est édité par :'} <br />
            <strong>Edgard DJAHOUI</strong> (SwissSimple)<br />
            {isDe ? '1700 Freiburg, Schweiz' : '1700 Fribourg, Suisse'}<br />
            {isDe ? 'Kontakt' : 'Contact'} : <a href="mailto:contact@swisssimple.ch">contact@swisssimple.ch</a>
          </p>
        </section>

        {/* 2. HÉBERGEMENT */}
        <section>
          <h2>{isDe ? '2. Hosting & Infrastruktur' : '2. Hébergement & Infrastructures'}</h2>
          <p>
            {isDe
              ? 'Die Website wird über das Cloudflare-Netzwerk (CDN) ausgeliefert. Der Anwendungsserver (KI-Assistent) wird von Render Inc. (USA) betrieben. Authentifizierung, sichere Datenbank sowie die offiziellen Referenzdaten (KVG-Prämien 2027, ESTV-Steuertarife 2026) werden von Supabase Inc. gehostet. Die Referenzdatenbanken enthalten ausschliesslich öffentliche offizielle Daten — ohne personenbezogene Daten. Die E-Mail-Adressen der Konten werden separat und sicher gespeichert (siehe Abschnitt 4).'
              : "Le site est distribué via le réseau Cloudflare (CDN). Le serveur applicatif (assistant IA) est opéré par Render Inc. (USA). L'authentification, la base de données sécurisée et les données officielles de référence (primes LAMal 2027, barèmes fiscaux AFC 2026) sont hébergées par Supabase Inc. Les bases de référence ne contiennent que des données officielles publiques, sans aucune donnée personnelle. Les adresses e-mail des comptes sont stockées séparément, de manière sécurisée (voir section 4)."}
          </p>
        </section>

        {/* 3. PROPRIÉTÉ */}
        <section>
          <h2>{isDe ? '3. Geistiges Eigentum' : '3. Propriété intellectuelle'}</h2>
          <p>
            {isDe
              ? 'Alle auf dieser Website enthaltenen Inhalte sind Eigentum von SwissSimple. Die Steuerdaten stammen aus den offiziellen Tarifen der ESTV (2026), die KVG-Prämien 2027 aus den Daten des BAG. Die AHV/PK-Daten stammen aus den offiziellen Schweizer Gesetzen und Verordnungen.'
              : "L'ensemble des contenus présents sur ce site est la propriété exclusive de SwissSimple. Les données fiscales proviennent des barèmes officiels de l'AFC (2026), les primes LAMal 2027 des données de l'OFSP. Les données AVS/LPP proviennent des lois et ordonnances officielles suisses."}
          </p>
        </section>

        {/* 4. CONFIDENTIALITÉ */}
        <section>
          <h2>{isDe ? '4. Datenschutz (revDSG)' : '4. Protection des données (revLPD)'}</h2>
          <p>
            {isDe
              ? 'SwissSimple verpflichtet sich, Ihre persönlichen Daten gemäss dem revidierten Bundesgesetz über den Datenschutz (revDSG, in Kraft seit 1. September 2023) zu schützen.'
              : "SwissSimple s'engage à protéger vos données personnelles conformément à la loi fédérale révisée sur la protection des données (revLPD, en vigueur depuis le 1er septembre 2023)."}
          </p>
          <ul>
            <li>
              <strong>{isDe ? 'Kein Konto erforderlich: ' : 'Aucun compte requis : '}</strong>
              {isDe
                ? 'Alle Simulatoren funktionieren vollständig anonym, ohne Registrierung. Die optionale Kontoerstellung (nur E-Mail-Adresse) dient einzig dazu, Ihre Einstellungen zu speichern.'
                : "Tous les simulateurs fonctionnent entièrement anonymement, sans inscription. La création optionnelle d'un compte (adresse e-mail uniquement) sert uniquement à sauvegarder vos préférences."}
            </li>
            <li>
              <strong>{isDe ? 'Erhobene Daten: ' : 'Données récoltées : '}</strong>
              {isDe
                ? 'Bei der Kontoerstellung erheben wir über unseren sicheren Dienstleister Supabase nur Ihre E-Mail-Adresse. Passwörter werden von Supabase gehasht und verwaltet — wir haben darauf nie Zugriff.'
                : "Lors de la création d'un compte, nous récoltons uniquement votre adresse e-mail via notre prestataire sécurisé Supabase. Les mots de passe sont hachés et gérés par Supabase — nous n'y avons jamais accès."}
            </li>
            <li>
              <strong>{isDe ? 'Zweck: ' : 'Finalité : '}</strong>
              {isDe
                ? 'Ihre E-Mail dient nur dazu, Ihre Sitzung zu erstellen und Ihre Einstellungen zu speichern.'
                : 'Votre e-mail sert uniquement à créer votre session et sauvegarder vos préférences.'}
            </li>
            <li>
              <strong>{isDe ? 'Simulationsdaten: ' : 'Données de simulation : '}</strong>
              {isDe
                ? 'Die Informationen, die Sie in die Simulatoren eingeben (Einkommen, Alter, Gemeinde), werden nie an unsere Server übertragen. Sie bleiben ausschliesslich in Ihrem Browser.'
                : "Les informations que vous saisissez dans les simulateurs (salaire, âge, commune) ne sont jamais transmises à nos serveurs. Elles restent exclusivement dans votre navigateur."}
            </li>
            <li>
              <strong>{isDe ? 'Teilen von Resultaten: ' : 'Partage de résultats : '}</strong>
              {isDe
                ? 'Wenn Sie ein Ergebnis teilen, werden die Simulationsparameter direkt im Link (in der URL) codiert. Es werden keine Daten auf einem Server gespeichert — das Teilen erfolgt nur auf Ihre aktive Entscheidung hin.'
                : "Lorsque vous partagez un résultat, les paramètres de simulation sont encodés directement dans le lien (dans l'URL). Aucune donnée n'est stockée sur un serveur — le partage n'a lieu que sur votre décision active."}
            </li>
            <li>
              <strong>{isDe ? 'Lokale Speicherung (LocalStorage): ' : 'Stockage local (LocalStorage) : '}</strong>
              {isDe
                ? 'Ihre Sprachwahl, Theme-Präferenz und gewisse Simulationsparameter werden im lokalen Speicher Ihres Browsers gespeichert. Diese Daten verlassen niemals Ihr Gerät und können jederzeit über die Browsereinstellungen gelöscht werden.'
                : "Votre choix de langue, votre préférence de thème (clair/sombre) et certains paramètres de simulation sont enregistrés dans le stockage local de votre navigateur. Ces données ne quittent jamais votre appareil et peuvent être effacées à tout moment via les réglages du navigateur."}
            </li>
            <li>
              <strong>{isDe ? 'KI-Assistent (Copilot): ' : 'Assistant IA (Copilote) : '}</strong>
              {isDe
                ? 'Wenn Sie dem Copiloten eine Frage stellen, wird diese zur Beantwortung an unseren Server übermittelt. Um wiederkehrende Fragen schneller zu beantworten und Ressourcen zu schonen, wird der Fragetext in einem Server-Cache gespeichert. Es werden keine identifizierenden Daten damit verknüpft.'
                : "Lorsque vous posez une question au Copilote, celle-ci est transmise à notre serveur afin de générer la réponse. Afin d'accélérer les réponses aux questions identiques et d'éviter de consommer inutilement des ressources, le texte des questions est conservé dans un cache serveur. Aucune donnée d'identification ne lui est associée."}
            </li>
            <li>
              <strong>{isDe ? 'Datenverkauf: ' : 'Revente de données : '}</strong>
              {isDe
                ? 'SwissSimple verkauft, vermietet oder teilt Ihre persönlichen Daten niemals zu kommerziellen Zwecken mit Dritten.'
                : 'SwissSimple ne vend, ne loue et ne partage jamais vos données personnelles avec des tiers à des fins commerciales.'}
            </li>
            {/* ⚠️ Item valable uniquement si @fontsource/inter est en place (voir message) */}
            <li>
              <strong>{isDe ? 'Schriftarten: ' : 'Polices de caractères : '}</strong>
              {isDe
                ? 'Die verwendete Schrift (Inter) wird selbst gehostet und von swisssimple.ch ausgeliefert. Es gehen keine Anfragen an Dritte.'
                : "La police utilisée (Inter) est auto-hébergée et servie depuis swisssimple.ch. Aucune requête n'est envoyée à un tiers."}
            </li>
            {/* ⚠️ Item valable uniquement si le beacon Cloudflare est en place (voir message) */}
            <li>
              <strong>{isDe ? 'Statistiken: ' : 'Statistiques : '}</strong>
              {isDe
                ? 'Wir verwenden Cloudflare Web Analytics: keine Cookies, keine individuelle Identifizierung. Besuche werden nur aggregiert gezählt.'
                : "Nous utilisons Cloudflare Web Analytics : aucun cookie, aucune identification individuelle. Les visites sont comptées de manière agrégée."}
            </li>
          </ul>
        </section>

        {/* 5. DROITS */}
        <section>
          <h2>{isDe ? '5. Ihre Rechte' : '5. Vos droits'}</h2>
          <p>
            {isDe
              ? 'Gemäss revDSG haben Sie insbesondere das Recht auf Auskunft, Berichtigung und Löschung Ihrer personenbezogenen Daten. Sie können die sofortige Löschung Ihres Kontos jederzeit über die entsprechende Schaltfläche in der Menüleiste oder durch eine Nachricht anfordern: '
              : "Conformément à la revLPD, vous disposez notamment d'un droit d'accès, de rectification et de suppression de vos données personnelles. Vous pouvez demander la suppression immédiate de votre compte à tout moment via le bouton dédié dans la barre du menu, ou en nous écrivant à : "}
            <a href="mailto:contact@swisssimple.ch">contact@swisssimple.ch</a>.
            {isDe
              ? ' Sie können sich zudem an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) wenden.'
              : " Vous pouvez également vous adresser au Préposé fédéral à la protection des données et à la transparence (PFPDT)."}
          </p>
        </section>

        {/* 6. DISCLAIMER */}
        <section>
          <h2>{isDe ? '6. Haftungsausschluss (Disclaimer)' : '6. Avertissement (Disclaimer)'}</h2>
          <p>
            {isDe
              ? 'Die von SwissSimple angebotenen Rechner liefern Schätzungen, die auf mathematischen Modellen und offiziellen Behördendaten basieren. Obwohl wir uns um maximale Genauigkeit bemühen, können die Ergebnisse leicht von Ihrer tatsächlichen Situation abweichen. Die bereitgestellten Informationen stellen keine Steuer-, Rechts- oder Finanzberatung dar. Konsultieren Sie für konkrete Entscheidungen eine zugelassene Fachperson.'
              : "Les calculateurs proposés par SwissSimple fournissent des estimations basées sur des modèles mathématiques et les données officielles des autorités. Bien que nous nous efforcions d'offrir une précision maximale, les résultats peuvent varier légèrement par rapport à votre situation réelle. Les informations fournies ne constituent pas un conseil fiscal, juridique ou financier. Pour toute décision, consultez une professionnelle ou un professionnel agréé."}
          </p>
        </section>

        {/* 7. DROIT APPLICABLE */}
        <section>
          <h2>{isDe ? '7. Anwendbares Recht und Gerichtsstand' : '7. Droit applicable et for juridique'}</h2>
          <p>
            {isDe
              ? 'Es gilt Schweizer Recht. Gerichtsstand ist Freiburg, Schweiz.'
              : 'Le présent site est soumis au droit suisse. Le for juridique est Fribourg, Suisse.'}
          </p>
        </section>
      </div>
    </div>
  );
}