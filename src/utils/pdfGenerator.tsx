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

  // Tableau 1: Détails Fiscaux
  const taxBody: any[] = [];
  if (data.taxDep && data.taxArr) {
    taxBody.push([t('pdf.revenu_net'), `${fmt(data.taxDep.revenuNet)} CHF`, `${fmt(data.taxArr.revenuNet)} CHF`]);
    taxBody.push([t('pdf.deductions_cant'), `- ${fmt(data.taxDep.totalDeductionsCant)} CHF`, `- ${fmt(data.taxArr.totalDeductionsCant)} CHF`]);
    taxBody.push([t('pdf.revenu_imposable_cant'), `${fmt(data.taxDep.revenuImposableCantonal)} CHF`, `${fmt(data.taxArr.revenuImposableCantonal)} CHF`]);
    taxBody.push([t('pdf.impot_cantonal'), `${fmt(data.taxDep.impotCantonal)} CHF`, `${fmt(data.taxArr.impotCantonal)} CHF`]);
    taxBody.push([t('pdf.impot_communal'), `${fmt(data.taxDep.impotCommunal)} CHF`, `${fmt(data.taxArr.impotCommunal)} CHF`]);
    if (data.taxDep.impotParoissial > 0 || data.taxArr.impotParoissial > 0) {
      taxBody.push([t('pdf.impot_paroissial'), `${fmt(data.taxDep.impotParoissial)} CHF`, `${fmt(data.taxArr.impotParoissial)} CHF`]);
    }
    taxBody.push([t('pdf.impot_federal'), `${fmt(data.taxDep.impotFederal)} CHF`, `${fmt(data.taxArr.impotFederal)} CHF`]);
    taxBody.push([
      { content: t('pdf.total_impot'), styles: { fontStyle: 'bold' } }, 
      { content: `${fmt(data.taxDep.impotTotal)} CHF`, styles: { fontStyle: 'bold' } }, 
      { content: `${fmt(data.taxArr.impotTotal)} CHF`, styles: { fontStyle: 'bold' } }
    ]);
    taxBody.push([
      { content: t('pdf.diff_fiscale'), colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, 
      formatColoredAmount(data.taxDiff)
    ]);
  } else {
    taxBody.push([{ content: t('pdf.no_data'), colSpan: 3, styles: { halign: 'center', textColor: [150, 150, 150] } }]);
  }

  autoTable(doc, {
    startY: 52,
    head: [[t('pdf.tax_details'), data.depName || t('pdf.commune_a'), data.arrName || t('pdf.commune_b')]],
    body: taxBody,
    theme: 'grid',
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'left' }, 2: { halign: 'left' } }
  });

  // Tableau 2: Assurance Maladie
  const insBody: any[] = [
    [t('pdf.avg_prime_a'), `${data.insuranceAvgA.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
    [t('pdf.avg_prime_b'), `${data.insuranceAvgB.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
    [{ content: t('pdf.diff_assurance'), styles: { fontStyle: 'bold', halign: 'right' } }, formatColoredAmount(data.insuranceDiff)]
  ];

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [[t('pdf.assurance_maladie'), t('pdf.amount')]],
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
      [{ content: t('pdf.total_impact_annual'), styles: { fontStyle: 'bold', fontSize: 12, fillColor: [240, 240, 240] } }, formatColoredAmount(data.totalDiff)]
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: 'left' } }
  });

  // Tableau 4: Analyse Rentabilité
  if (data.fraisUniques > 0 || data.ancienLoyer > 0 || data.nouveauLoyer > 0 || data.ancienTransport > 0 || data.nouveauTransport > 0) {
    const roiBody: any[] = [];
    
    if (data.fraisUniques > 0) roiBody.push([t('pdf.frais_uniques'), `${data.fraisUniques.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
    
    if (data.ancienLoyer > 0 || data.nouveauLoyer > 0) {
      const diffLoyer = (data.ancienLoyer - data.nouveauLoyer) * 12;
      roiBody.push([t('pdf.old_rent'), `${(data.ancienLoyer * 12).toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push([t('pdf.new_rent'), `${(data.nouveauLoyer * 12).toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push([{ content: t('pdf.diff_rent'), styles: { halign: 'right' } }, formatColoredAmount(diffLoyer)]);
    }

    if (data.ancienTransport > 0 || data.nouveauTransport > 0) {
      const diffTransport = data.ancienTransport - data.nouveauTransport;
      roiBody.push([t('pdf.old_transport'), `${data.ancienTransport.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push([t('pdf.new_transport'), `${data.nouveauTransport.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      roiBody.push([{ content: t('pdf.diff_transport'), styles: { halign: 'right' } }, formatColoredAmount(diffTransport)]);
    }

    if (data.realEco !== 0) {
      roiBody.push([{ content: t('pdf.real_savings'), styles: { fontStyle: 'bold', halign: 'right' } }, formatColoredAmount(data.realEco)]);
    }

    if (data.pointMortMois !== null && data.pointMortMois > 0) {
      const years = Math.floor(data.pointMortMois / 12);
      const months = data.pointMortMois % 12;
      roiBody.push([{ content: t('pdf.amortization'), styles: { fontStyle: 'bold', halign: 'right' } }, { content: t('pdf.amortization_detail', { months: data.pointMortMois, years, remMonths: months }), styles: { fontStyle: 'bold', textColor: [59, 130, 246] } }]);
    } else if (data.pointMortMois === -1) {
      roiBody.push([{ content: t('pdf.profitability'), styles: { fontStyle: 'bold', halign: 'right' } }, { content: t('pdf.not_profitable'), styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }]);
    }

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [[t('pdf.roi_details'), t('pdf.amount')]],
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
    head: [[t('pdf.ret_income'), t('pdf.monthly_amount')]],
    body: [
      [t('pdf.rente_avs'), `${data.renteAVS.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      [t('pdf.rente_lpp'), `${data.renteLPP.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
      [{ content: t('pdf.total_ret_income'), styles: { fontStyle: 'bold', halign: 'right' } }, { content: `${data.totalRetraite.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } }],
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
      head: [[t('pdf.replacement_rate'), t('pdf.value')]],
      body: [
        [t('pdf.last_salary'), `${data.dernierSalaire.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
        [t('pdf.replacement_rate'), `${data.tauxRemplacement} %`],
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
      head: [[t('pdf.lpp_impact_title'), t('pdf.amount')]],
      body: [
        [t('pdf.capital_withdrawn'), `${data.retraitLPP.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
        [{ content: t('pdf.rent_loss'), styles: { halign: 'right' } }, { content: `- ${data.perteRenteLPPRetrait.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`, styles: { textColor: [220, 38, 38], fontStyle: 'bold' } }],
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
      head: [[t('pdf.capital_option_title'), t('pdf.amount')]],
      body: [
        [t('pdf.capital_percent'), `${data.pourcentageCapital} %`],
        [t('pdf.capital_cash'), `${data.capitalCash.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
        [t('pdf.new_lpp_rent'), `${data.renteLPP.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
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
      [t('pdf.desired_income'), `${data.revenuSouhaite.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`],
    ];
    
    if (data.trouMensuel > 0) {
      objBody.push([{ content: t('pdf.monthly_gap'), styles: { halign: 'right' } }, { content: `- ${data.trouMensuel.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`, styles: { textColor: [220, 38, 38], fontStyle: 'bold' } }]);
      objBody.push([t('pdf.capital_needed'), `${data.capitalNecessaire.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
      objBody.push([t('pdf.monthly_3a'), `${data.versementMensuel3a.toLocaleString('de-CH', { minimumFractionDigits: 2 })} CHF`]);
    } else {
      objBody.push([{ content: t('pdf.profitability'), styles: { halign: 'right' } }, { content: t('pdf.goal_success'), styles: { textColor: [22, 163, 74], fontStyle: 'bold' } }]);
    }

    autoTable(doc, {
      startY: nextY,
      head: [[t('pdf.income_goal_title'), t('pdf.amount')]],
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
    head: [[t('pdf.3a_reco_title'), t('pdf.details')]],
    body: [
      [t('pdf.3a_max_deductible'), "7'258 CHF / an"],
      [{ content: t('pdf.estimated_tax_saving'), styles: { halign: 'right' } }, { content: `~ ${data.estimatedTaxSaving} CHF / an`, styles: { textColor: [22, 163, 74], fontStyle: 'bold' } }],
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