//import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Legal.css';

export default function Legal() {
  const { i18n } = useTranslation();
  const isFR = i18n.language === 'fr';

  return (
    <div className="legal-container">
      
      <div className="legal-content">
        <h1>{isFR ? 'Mentions Légales & Politique de Confidentialité' : 'Impressum & Datenschutzerklärung'}</h1>
        <p className="legal-update">{isFR ? 'Dernière mise à jour : Juillet 2026' : 'Letzte Aktualisierung: July 2026'}</p>

        {/* 1. EDITEUR */}
        <section>
          <h2>{isFR ? '1. Éditeur du site' : '1. Herausgeber der Website'}</h2>
          <p>
            {isFR ? 'Le site SwissSimple est édité par :' : 'Die Website SwissSimple wird herausgegeben von:'} <br/>
            <strong>[Edgard DJAHOUI]</strong> (SwissSimple)<br/>
            [1700 Fribourg/Freiburg] <br/>
            {isFR ? 'Contact' : 'Kontakt'} : <a href="mailto:contact@swisssimple.ch">contact@swisssimple.ch</a>
          </p>
        </section>

        {/* 2. HÉBERGEMENT */}
        <section>
          <h2>{isFR ? '2. Hébergement & Infrastructures' : '2. Hosting & Infrastruktur'}</h2>
          <p>
            {isFR ? 'Le site est hébergé par Vercel Inc. (USA). L\'authentification et la base de données sécurisées sont gérées par Supabase Inc. (USA).' 
                  : 'Die Website wird von Vercel Inc. (USA) gehostet. Die Authentifizierung und die sichere Datenbank werden von Supabase Inc. (USA) verwaltet.'}
          </p>
        </section>

        {/* 3. PROPRIÉTÉ */}
        <section>
          <h2>{isFR ? '3. Propriété intellectuelle' : '3. Geistiges Eigentum'}</h2>
          <p>
            {isFR ? 'L\'ensemble des contenus présents sur ce site est la propriété exclusive de SwissSimple. Les données fiscales et barèmes officiels proviennent de l\'Open Data de l\'AFC et de l\'OFSP. Les données AVS/LPP proviennent des lois et ordonnances officielles suisses.' 
                  : 'Alle auf dieser Website enthaltenen Inhalte sind Eigentum von SwissSimple. Die Steuerdaten und offiziellen Tarife stammen aus den Open Data der ESTV und des BAG. Die AHV/BVG-Daten stammen aus den offiziellen Schweizer Gesetzen und Verordnungen.'}
          </p>
        </section>

        {/* 4. CONFIDENTIALITÉ */}
        <section>
          <h2>{isFR ? '4. Protection des données (LPnD / RPDP)' : '4. Datenschutz (DSG / revDSG)'}</h2>
          <p>
            {isFR ? 'SwissSimple s\'engage à protéger vos données personnelles conformément à la Loi fédérale sur la protection des données.' 
                  : 'SwissSimple verpflichtet sich, Ihre persönlichen Daten gemäss dem Bundesgesetz über den Datenschutz zu schützen.'}
          </p>
          <ul>
            <li>
              <strong>{isFR ? 'Données récoltées : ' : 'Erhobene Daten: '}</strong> 
              {isFR ? 'Lors de la création d\'un compte, nous récoltons uniquement votre adresse e-mail via notre prestataire sécurisé Supabase. Aucun mot de passe n\'est stocké en clair.' 
                    : 'Bei der Erstellung eines Kontos erheben wir über unseren sicheren Dienstleister Supabase nur Ihre E-Mail-Adresse. Passwörter werden nicht im Klartext gespeichert.'}
            </li>
            <li>
              <strong>{isFR ? 'Finalité : ' : 'Zweck: '}</strong> 
              {isFR ? 'Votre e-mail sert uniquement à créer votre session et sauvegarder vos préférences.' 
                    : 'Ihre E-Mail dient nur dazu, Ihre Sitzung zu erstellen und Ihre Einstellungen zu speichern.'}
            </li>
            <li>
              <strong>{isFR ? 'Données de simulation : ' : 'Simulationsdaten: '}</strong> 
              {isFR ? 'Les informations que vous saisissez dans les simulateurs (salaire, âge, commune) ne sont pas enregistrées sur nos serveurs. Elles restent uniquement dans la mémoire de votre navigateur et sont effacées dès que vous fermez la page.' 
                    : 'Die Informationen, die Sie in die Simulatoren eingeben (Gehalt, Alter, Gemeinde), werden nicht auf unseren Servern gespeichert. Sie verbleiben nur im Arbeitsspeicher Ihres Browsers und werden gelöscht, sobald Sie die Seite schliessen.'}
            </li>
            <li>
              <strong>{isFR ? 'Cookies locaux (LocalStorage) : ' : 'Lokale Speicherung (LocalStorage): '}</strong> 
              {isFR ? 'Nous utilisons le stockage local de votre navigateur pour mémoriser votre choix de langue et votre préférence de thème (Mode clair/sombre). Ces données ne quittent jamais votre appareil.' 
                    : 'Wir verwenden den lokalen Speicher Ihres Browsers, um Ihre Sprachwahl und Ihre Theme-Präferenz (Hell/Dunkel-Modus) zu speichern. Diese Daten verlassen niemals Ihr Gerät.'}
            </li>
            <li>
              <strong>{isFR ? 'Revente de données : ' : 'Datenverkauf: '}</strong> 
              {isFR ? 'SwissSimple ne vend, ne loue et ne partage jamais vos données personnelles avec des tiers à des fins commerciales.' 
                    : 'SwissSimple verkauft, vermietet oder teilt Ihre persönlichen Daten niemals zu kommerziellen Zwecken mit Dritten.'}
            </li>
          </ul>
        </section>

        {/* 5. DROITS */}
        <section>
          <h2>{isFR ? '5. Vos droits' : '5. Ihre Rechte'}</h2>
          <p>
            {isFR ? 'Conformément à la loi suisse, vous disposez d\'un droit d\'accès, de rectification et de suppression de vos données personnelles. Vous pouvez demander la suppression immédiate de votre compte à tout moment via le bouton dédié dans la barre du menu ou en nous écrivant à : ' 
                  : 'Gemäss Schweizer Recht haben Sie das Recht auf Zugriff, Berichtigung und Löschung Ihrer persönlichen Daten. Sie können die sofortige Löschung Ihres Kontos jederzeit über die entsprechende Schaltfläche in der Menüleiste oder durch eine Nachricht anfordern: '}
            <a href="mailto:contact@swisssimple.ch">contact@swisssimple.ch</a>.
          </p>
        </section>

        {/* 6. DISCLAIMER */}
        <section>
          <h2>{isFR ? '6. Avertissement (Disclaimer)' : '6. Haftungsausschluss (Disclaimer)'}</h2>
          <p>
            {isFR ? 'Les calculateurs proposés par SwissSimple fournissent des estimations basées sur des modèles mathématiques et l\'Open Data. Bien que nous nous efforcions d\'offrir une précision maximale, les résultats peuvent varier légèrement par rapport à votre situation réelle. Les informations fournies ne constituent pas un conseil fiscal ou financier. Pour toute décision, consultez un professionnel agréé.' 
                  : 'Die von SwissSimple angebotenen Rechner liefern Schätzungen, die auf mathematischen Modellen und Open Data basieren. Obwohl wir uns um maximale Genauigkeit bemühen, können die Ergebnisse leicht von Ihrer tatsächlichen Situation abweichen. Die bereitgestellten Informationen stellen keine steuerliche oder finanzielle Beratung dar. Konsultieren Sie für Entscheidungen einen zugelassenen Fachmann.'}
          </p>
        </section>
      </div>
    </div>
  );
}