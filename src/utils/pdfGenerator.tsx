import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fonction pour dessiner le drapeau suisse
const drawSwissFlag = (doc: jsPDF, x: number, y: number, size: number = 12) => {
  doc.setFillColor(218, 41, 28); // Rouge suisse
  doc.roundedRect(x, y, size, size, 1, 1, 'F');
  doc.setFillColor(255, 255, 255); // Blanc
  doc.rect(x + size * 0.35, y + size * 0.15, size * 0.3, size * 0.7, 'F');
  doc.rect(x + size * 0.15, y + size * 0.35, size * 0.7, size * 0.3, 'F');
};

// Fonction pour écrire "SwissSimple" avec les S en rouge (sans espace)
const drawLogoText = (doc: jsPDF, x: number, y: number) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  
  let cursorX = x;
  
  doc.setTextColor(218, 41, 28); // Rouge
  doc.text("S", cursorX, y);
  cursorX += doc.getTextWidth("S") - 0.5;
  
  doc.setTextColor(26, 32, 44); // Noir
  doc.text("wiss", cursorX, y);
  cursorX += doc.getTextWidth("wiss") - 0.5;
  
  doc.setTextColor(218, 41, 28); // Rouge
  doc.text("S", cursorX, y);
  cursorX += doc.getTextWidth("S") - 0.5;
  
  doc.setTextColor(26, 32, 44); // Noir
  doc.text("imple", cursorX, y);
};

// Fonction intelligente pour formater et coloriser les montants
const formatColoredAmount = (amount: number | null) => {
  if (amount === null || isNaN(amount)) return { content: '-', styles: {} };
  
  const isPositive = amount >= 0;
  const sign = isPositive ? '+' : '-';
  const text = `${sign} ${Math.abs(amount).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
  
  // Vert si positif, Rouge si négatif
  const color = isPositive ? [22, 163, 74] : [220, 38, 38]; 
  
  return { 
    content: text, 
    styles: { textColor: color, fontStyle: 'bold' } 
  };
};

export const generateDemenagementPDF = (data: any, t: any) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('fr-CH');

  // En-tête
  drawSwissFlag(doc, 14, 15, 12);
  drawLogoText(doc, 30, 24);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(t('pdf.generated_on', { date: today }), 30, 30);

  // Ligne de séparation
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, 196, 35);

  // Titre du rapport
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246);
  doc.text(t('pdf.title_move'), 14, 45);

  // Tableau 1 : Synthèse
  autoTable(doc, {
    startY: 52,
    head: [[t('pdf.section_recap'), t('pdf.amount')]],
    body: [
      [t('pdf.recap_impots'), formatColoredAmount(data.taxDiff)],
      [t('pdf.recap_assurance'), formatColoredAmount(data.insuranceDiff)],
      [t('pdf.total_impact'), formatColoredAmount(data.totalDiff)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: 'left' } } // Aligne les montants à gauche
  });

  // Tableau 2 : Rentabilité
  if (data.pointMortMois !== null && data.pointMortMois > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [[t('pdf.section_roi'), t('pdf.value')]],
      body: [
        [t('pdf.roi_unique'), `${data.fraisUniques || 0} CHF`],
        [t('pdf.roi_transport'), `${data.transportDiff || 0} CHF`],
        [t('pdf.roi_real_eco'), formatColoredAmount(data.realEco)],
        [t('pdf.roi_months'), `${data.pointMortMois} ${t('pdf.months')}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', halign: 'left' },
      styles: { fontSize: 10, cellPadding: 4 },
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

  // Ouvre dans un nouvel onglet
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

  // En-tête
  drawSwissFlag(doc, 14, 15, 12);
  drawLogoText(doc, 30, 24);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(t('pdf.generated_on', { date: today }), 30, 30);

  // Ligne de séparation
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 35, 196, 35);

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246);
  doc.text(t('pdf.title_ret'), 14, 45);

  // Tableau Récap (Le total est mis en vert pour le mettre en valeur)
  autoTable(doc, {
    startY: 52,
    head: [[t('pdf.section_recap'), t('pdf.amount')]],
    body: [
      [t('pdf.recap_avs'), `${data.renteAVS.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      [t('pdf.recap_lpp'), `${data.renteLPP.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      [t('pdf.total_ret'), { 
        content: `${data.totalRetraite.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`, 
        styles: { textColor: [22, 163, 74], fontStyle: 'bold' } // Vert
      }],
      [t('pdf.salary'), `${data.dernierSalaire.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      [t('pdf.replacement_rate'), `${data.tauxRemplacement} %`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: 'left' } }
  });

  // Tableau Recommandation 3a
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [[t('pdf.section_3a'), t('pdf.value')]],
    body: [
      [t('pdf.3a_max'), "7'258 CHF"],
      [t('pdf.3a_tax_estimation'), { 
        content: `~ 1'450 CHF`, 
        styles: { textColor: [22, 163, 74], fontStyle: 'bold' } // Vert
      }],
    ],
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 10, cellPadding: 4 },
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

  // Ouvre dans un nouvel onglet
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};