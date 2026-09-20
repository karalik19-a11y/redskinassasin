import jsPDF from 'jspdf';
import type { Dossier } from '../types/dossier';

export function exportDossierPDF(dossier: Dossier) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Background deep obsidian color
  doc.setFillColor(10, 10, 14);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Tribal Cyber Decorative Border
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.3);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Header Stamp
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11);
  doc.text('// REDSKIN ASSASSIN — TOMAHAWK CYBER-SHAMAN DOSSIER //', pageWidth / 2, 16, { align: 'center' });

  // Classification Banner
  doc.setFillColor(220, 38, 38);
  doc.rect(pageWidth - 65, 12, 50, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text(dossier.intelligenceNotes.classification, pageWidth - 40, 16.5, { align: 'center' });

  // Main Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(dossier.fio.full, 16, 28);

  // Totem & Threat Subtitle
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11);
  doc.text(`ТОТЕМ: ${dossier.totemTitle.toUpperCase()} | УГРОЗА: ${dossier.threatLevel} (РИСК: ${dossier.riskScore}/100)`, 16, 34);

  // Divider Line
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.4);
  doc.line(16, 37, pageWidth - 16, 37);

  let y = 44;

  // Block 1: Basic Identity Data
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(239, 68, 68);
  doc.text('1. ОСНОВНЫЕ УСТАНОВОЧНЫЕ ДАННЫЕ', 16, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 210);

  const idLines = [
    `Дата рождения: ${dossier.birthDate} (${dossier.age} лет, ${dossier.zodiac})`,
    `Место рождения: ${dossier.birthPlace}`,
    `Псевдонимы / Никнеймы: ${dossier.aliases.join(', ')}`,
    `Основной телефон: ${dossier.telecom[0]?.number || 'Не указан'} (${dossier.telecom[0]?.operator || ''})`,
    `Telegram: ${dossier.telegram ? '@' + dossier.telegram.username + ' [ID: ' + dossier.telegram.id + ']' : 'Не найден'}`,
    `Биометрическое совпадение: ${dossier.biometricMatchRate}%`,
  ];

  idLines.forEach((line) => {
    doc.text(line, 20, y);
    y += 5;
  });

  y += 4;

  // Block 2: Documents & Registries
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(239, 68, 68);
  doc.text('2. ДОКУМЕНТЫ И РЕЕСТРЫ', 16, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);

  dossier.documents.forEach((docItem) => {
    const docText = `• ${docItem.type}: ${docItem.series ? docItem.series + ' ' : ''}${docItem.number} (Выдан: ${docItem.issueDate}${docItem.departmentCode ? ', Код: ' + docItem.departmentCode : ''}) [${docItem.status}]`;
    doc.text(docText, 20, y);
    y += 4.5;
  });

  y += 4;

  // Block 3: Financial & Corporate Intelligence
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(239, 68, 68);
  doc.text('3. ФИНАНСОВЫЙ СЛЕД И АКТИВЫ', 16, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);

  doc.text(`• Оценочный капитал: ${dossier.finances.estimatedNetWorth}`, 20, y);
  y += 4.5;

  dossier.finances.banks.forEach((b) => {
    doc.text(`• Банк: ${b.bank} | Счет: ${b.accountMasked} (${b.currency}) ~ ${b.balanceEstimated || 'N/A'}`, 20, y);
    y += 4.5;
  });

  dossier.assets.vehicles.forEach((v) => {
    doc.text(`• Автотранспорт: ${v.brandModel} [Госномер: ${v.plate}] VIN: ${v.vin}`, 20, y);
    y += 4.5;
  });

  dossier.assets.realEstate.forEach((re) => {
    doc.text(`• Недвижимость: ${re.type} — ${re.address} (${re.areaSqMeters} кв.м, Оценка: ${re.estimatedPrice})`, 20, y);
    y += 4.5;
  });

  y += 4;

  // Block 4: Breaches & Leaked Data
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(239, 68, 68);
  doc.text('4. ФИКСАЦИЯ В УТЕЧКАХ БАЗ ДАННЫХ (TOMAHAWK LEAKS)', 16, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);

  dossier.breaches.slice(0, 3).forEach((br) => {
    const leakDetails = br.leakedData.address || br.leakedData.clearPassword || br.leakedData.notes || 'Личные данные';
    doc.text(`[${br.severity}] ${br.source} (${br.date}): ${leakDetails}`, 20, y);
    y += 4.5;
  });

  y += 4;

  // Block 5: Operational Risk Notes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(239, 68, 68);
  doc.text('5. ОПЕРАТИВНЫЕ ВЫВОДЫ И УЯЗВИМОСТИ', 16, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);

  dossier.intelligenceNotes.vulnerabilities.forEach((v) => {
    doc.text(`• ${v}`, 20, y);
    y += 4.5;
  });

  // Footer Watermark & Cryptographic Stamp
  const footerY = pageHeight - 14;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 140);
  doc.text(`ID ДОСЬЕ: ${dossier.id} | TIMESTAMP: ${dossier.createdTimestamp} | SYSTEM: REDSKIN-ASSASSIN-OSINT-V4`, pageWidth / 2, footerY, { align: 'center' });

  // Download
  const filename = `DOSSIER_${dossier.fio.last}_${dossier.fio.first}_${dossier.birthDate.replace(/\./g, '')}.pdf`;
  doc.save(filename);
}
