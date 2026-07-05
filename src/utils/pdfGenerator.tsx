import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const drawSwissFlag = (doc: jsPDF, x: number, y: number, size: number = 12) => {
  doc.setFillColor(218, 41, 28);
  doc.roundedRect(x, y, size, size, 1, 1, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(x + size * 0.35, y + size * 0.15, size * 0.3, size * 0.7, 'F');
  doc.rect(x + size * 0.15, y + size * 0.35, size * 0.7, size * 0.3, 'F');
};

const drawLogoText = (doc: jsPDF, x: number, y: number) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  let cursorX = x;
  doc.setTextColor(218, 41, 28); doc.text("S", cursorX, y); cursorX += doc.getTextWidth("S") - 0.5;
  doc.setTextColor(26, 32, 44); doc.text("wiss", cursorX, y); cursorX += doc.getTextWidth("wiss") - 0.5;
  doc.setTextColor(218, 41, 28); doc.text("S", cursorX, y); cursorX += doc.getTextWidth("S") - 0.5;
  doc.setTextColor(26, 32, 44); doc.text("imple", cursorX, y);
};

const formatColoredAmount = (amount: number | null | undefined): any => {
  if (amount === null || amount === undefined || isNaN(amount)) return { content: '0.00 CHF', styles: {} };
  const isPositive = amount >= 0;
  const sign = isPositive ? '+' : '-';
  const text = `${sign} ${Math.abs(amount).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
  const color = isPositive ? [22, 163, 74] : [220, 38, 38]; 
  // On ajoute 'as const' ici pour dire à TypeScript que c'est bien le type 'bold' et pas juste un string
  return { content: text, styles: { textColor: color, fontStyle: 'bold' as const } };
};

const fmt = (val: number | undefined) => val ? val.toLocaleString('de-CH') : '0';

export const generateDemenagementPDF = (data: any, t: any) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('fr-CH');

  drawSwissFlag(doc, 14, 15, 12);
  drawLogoText(doc, 30, 24);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(t('pdf.generated_on', { date: today }), 30, 30);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, 196, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246);
  doc.text(t('pdf.title_move'), 14, 45);

  // Tableau 1: Détails Fiscaux (Impôts) - Type any[] pour éviter les erreurs TS
  const taxBody: any[] = [];
  if (data.taxDep && data.taxArr) {
    taxBody.push(["Revenu Net", `${fmt(data.taxDep.revenuNet)} CHF`, `${fmt(data.taxArr.revenuNet)} CHF`]);
    taxBody.push(["Déductions Cantonales", `- ${fmt(data.taxDep.totalDeductionsCant)} CHF`, `- ${fmt(data.taxArr.totalDeductionsCant)} CHF`]);
    taxBody.push(["Revenu Imposable Cantonal", `${fmt(data.taxDep.revenuImposableCantonal)} CHF`, `${fmt(data.taxArr.revenuImposableCantonal)} CHF`]);
    taxBody.push(["Impôt Cantonal", `${fmt(data.taxDep.impotCantonal)} CHF`, `${fmt(data.taxArr.impotCantonal)} CHF`]);
    taxBody.push(["Impôt Communal", `${fmt(data.taxDep.impotCommunal)} CHF`, `${fmt(data.taxArr.impotCommunal)} CHF`]);
    if (data.taxDep.impotParoissial > 0 || data.taxArr.impotParoissial > 0) {
      taxBody.push(["Impôt Paroissial", `${fmt(data.taxDep.impotParoissial)} CHF`, `${fmt(data.taxArr.impotParoissial)} CHF`]);
    }
    taxBody.push(["Impôt Fédéral", `${fmt(data.taxDep.impotFederal)} CHF`, `${fmt(data.taxArr.impotFederal)} CHF`]);
    taxBody.push([
      { content: "Total Impôt", styles: { fontStyle: 'bold' } }, 
      { content: `${fmt(data.taxDep.impotTotal)} CHF`, styles: { fontStyle: 'bold' } }, 
      { content: `${fmt(data.taxArr.impotTotal)} CHF`, styles: { fontStyle: 'bold' } }
    ]);
    taxBody.push([
      { content: "Différence Fiscale", colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, 
      formatColoredAmount(data.taxDiff)
    ]);
  } else {
    taxBody.push([{ content: "Données fiscales non disponibles", colSpan: 3, styles: { halign: 'center', textColor: [150, 150, 150] } }]);
  }

  autoTable(doc, {
    startY: 52,
    head: [["Détails Fiscaux (Impôts)", data.depName || 'Commune A', data.arrName || 'Commune B']],
    body: taxBody,
    theme: 'grid',
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } }
  });

  // Tableau 2: Assurance Maladie
  const insBody: any[] = [
    ["Prime Annuelle Moyenne (A)", `${data.insuranceAvgA.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
    ["Prime Annuelle Moyenne (B)", `${data.insuranceAvgB.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
    [{ content: "Différence Assurance", styles: { fontStyle: 'bold', halign: 'right' } }, formatColoredAmount(data.insuranceDiff)]
  ];

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Assurance Maladie", "Montant"]],
    body: insBody,
    theme: 'grid',
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'left' } }
  });

  // Tableau 3: Total Impact Annuel
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    body: [
      [{ content: "Total Impact Annuel (Impôts + Assurance)", styles: { fontStyle: 'bold', fontSize: 12, fillColor: [240, 240, 240] } }, formatColoredAmount(data.totalDiff)]
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: 'left' } }
  });

  // Tableau 4: Analyse Rentabilité
  if (data.fraisUniques > 0 || data.ancienLoyer > 0 || data.nouveauLoyer > 0 || data.ancienTransport > 0 || data.nouveauTransport > 0) {
    const roiBody: any[] = [];
    
    if (data.fraisUniques > 0) roiBody.push(["Frais uniques de déménagement", `${data.fraisUniques.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
    
    if (data.ancienLoyer > 0 || data.nouveauLoyer > 0) {
      const diffLoyer = (data.ancienLoyer - data.nouveauLoyer) * 12;
      roiBody.push(["Ancien Loyer (annuel)", `${(data.ancienLoyer * 12).toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push(["Nouveau Loyer (annuel)", `${(data.nouveauLoyer * 12).toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push([{ content: "Différence Loyer", styles: { halign: 'right' } }, formatColoredAmount(diffLoyer)]);
    }

    if (data.ancienTransport > 0 || data.nouveauTransport > 0) {
      const diffTransport = data.ancienTransport - data.nouveauTransport;
      roiBody.push(["Ancien Transport", `${data.ancienTransport.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push(["Nouveau Transport", `${data.nouveauTransport.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push([{ content: "Différence Transport", styles: { halign: 'right' } }, formatColoredAmount(diffTransport)]);
    }

    if (data.realEco !== 0) {
      roiBody.push([{ content: "Économies Réelles Annuelles", styles: { fontStyle: 'bold', halign: 'right' } }, formatColoredAmount(data.realEco)]);
    }

    if (data.pointMortMois !== null && data.pointMortMois > 0) {
      const years = Math.floor(data.pointMortMois / 12);
      const months = data.pointMortMois % 12;
      roiBody.push([{ content: "Amortissement des frais", styles: { fontStyle: 'bold', halign: 'right' } }, { content: `${data.pointMortMois} mois (env. ${years} an(s) et ${months} mois)`, styles: { fontStyle: 'bold', textColor: [59, 130, 246] } }]);
    } else if (data.pointMortMois === -1) {
      roiBody.push([{ content: "Rentabilité", styles: { fontStyle: 'bold', halign: 'right' } }, { content: "Non rentable", styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }]);
    }

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [["Analyse de Rentabilité (Détails)", "Montant"]],
      body: roiBody,
      theme: 'grid',
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', halign: 'left' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'left' } }
    });
  }

  // Pied de page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(t('pdf.disclaimer'), 14, doc.internal.pageSize.height - 10, { maxWidth: 180 });
    doc.setFont('helvetica', 'bold');
    doc.text("SwissSimple", 196, doc.internal.pageSize.height - 10, { align: 'right' });
  }

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateRetraitePDF = (data: any, t: any) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('fr-CH');

  drawSwissFlag(doc, 14, 15, 12);
  drawLogoText(doc, 30, 24);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(t('pdf.generated_on', { date: today }), 30, 30);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, 196, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246);
  doc.text(t('pdf.title_ret'), 14, 45);

  // Tableau 1: Revenus
  autoTable(doc, {
    startY: 52,
    head: [["Revenus de Retraite", "Montant Mensuel"]],
    body: [
      ["Rente AVS (1er Pilier)", `${data.renteAVS.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      ["Rente LPP (2ème Pilier)", `${data.renteLPP.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      [{ content: "Total Revenu Retraite", styles: { fontStyle: 'bold', halign: 'right' } }, { content: `${data.totalRetraite.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } }],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'left' } }
  });

  let nextY = (doc as any).lastAutoTable.finalY + 10;

  // Tableau 2: Taux de remplacement
  if (data.dernierSalaire > 0) {
    autoTable(doc, {
      startY: nextY,
      head: [["Taux de Remplacement", "Valeur"]],
      body: [
        ["Dernier Salaire", `${data.dernierSalaire.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
        ["Taux de Remplacement", `${data.tauxRemplacement} %`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold', halign: 'left' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'left' } }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Tableau 3: Impact Retrait LPP
  if (data.retraitLPP > 0) {
    autoTable(doc, {
      startY: nextY,
      head: [["Impact Retrait LPP (Immobilier)", "Montant"]],
      body: [
        ["Capital retiré", `${data.retraitLPP.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
        [{ content: "Perte de rente mensuelle", styles: { halign: 'right' } }, { content: `- ${data.perteRenteLPPRetrait.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`, styles: { textColor: [220, 38, 38], fontStyle: 'bold' } }],
      ],
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', halign: 'left' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'left' } }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Tableau 4: Option Capital (Retraite)
  if (data.pourcentageCapital > 0) {
    autoTable(doc, {
      startY: nextY,
      head: [["Option: Capital ou Rente (Retraite)", "Montant"]],
      body: [
        ["Pourcentage de capital choisi", `${data.pourcentageCapital} %`],
        ["Capital cash reçu", `${data.capitalCash.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
        ["Nouvelle rente LPP mensuelle", `${data.renteLPP.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', halign: 'left' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'left' } }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Tableau 5: Objectif de revenu
  if (data.revenuSouhaite > 0) {
    const objBody: any[] = [
      ["Revenu souhaité", `${data.revenuSouhaite.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
    ];
    
    if (data.trouMensuel > 0) {
      objBody.push([{ content: "Manque à gagner mensuel", styles: { halign: 'right' } }, { content: `- ${data.trouMensuel.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`, styles: { textColor: [220, 38, 38], fontStyle: 'bold' } }]);
      objBody.push(["Capital nécessaire à constituer", `${data.capitalNecessaire.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      objBody.push(["Versement mensuel recommandé (3a)", `${data.versementMensuel3a.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
    } else {
      objBody.push([{ content: "Rentabilité", styles: { halign: 'right' } }, { content: "Votre retraite couvre votre objectif !", styles: { textColor: [22, 163, 74], fontStyle: 'bold' } }]);
    }

    autoTable(doc, {
      startY: nextY,
      head: [["Objectif de Revenu", "Montant"]],
      body: objBody,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', halign: 'left' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'left' } }
    });
    nextY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Tableau 6: Recommandation 3a
  autoTable(doc, {
    startY: nextY,
    head: [["Recommandation: 3ème Pilier (3a)", "Détails"]],
    body: [
      ["Plafond maximal déductible", "7'258 CHF / an"],
      [{ content: "Économie d'impôts estimée", styles: { halign: 'right' } }, { content: `~ ${data.estimatedTaxSaving} CHF / an`, styles: { textColor: [22, 163, 74], fontStyle: 'bold' } }],
    ],
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'left' } }
  });

  // Pied de page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(t('pdf.disclaimer'), 14, doc.internal.pageSize.height - 10, { maxWidth: 180 });
    doc.setFont('helvetica', 'bold');
    doc.text("SwissSimple", 196, doc.internal.pageSize.height - 10, { align: 'right' });
  }

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};