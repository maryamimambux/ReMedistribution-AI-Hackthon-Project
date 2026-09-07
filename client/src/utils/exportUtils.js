/**
 * Export utilities — CSV and PDF generation for admin reports
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Safely get a nested value from an object using dot notation.
 */
function getValue(obj, key) {
  const val = key.split('.').reduce((acc, k) => acc?.[k], obj);
  return val === null || val === undefined ? '' : val;
}

/**
 * Escape a value for CSV output.
 */
function csvEscape(val) {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Trigger a file download from a Blob.
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Delay revoke to avoid browser cancelling the download
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Export data as CSV and trigger download.
 */
export function exportCSV(filename, data, headers, keys) {
  if (!Array.isArray(data) || data.length === 0) {
    // Still create a valid CSV with just headers
    const csv = headers.join(',');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${filename}.csv`);
    return;
  }

  const rows = data.map((row) =>
    keys
      .map((key) => csvEscape(getValue(row, key)))
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Export multiple datasets as one combined CSV file with section headers.
 */
export function exportCombinedCSV(filename, sections) {
  let csv = '';

  sections.forEach((section, index) => {
    if (index > 0) csv += '\n\n';
    csv += `${section.title}\n`;
    csv += section.headers.join(',');

    if (Array.isArray(section.data) && section.data.length > 0) {
      csv += '\n';
      csv += section.data
        .map((row) => section.keys.map((key) => csvEscape(getValue(row, key))).join(','))
        .join('\n');
    }
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Export a formatted PDF report.
 */
export function exportPDF(title, stats, tables) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setTextColor(6, 95, 70);
  doc.text('ReMedistribution', 14, 20);
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 14, 30);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 36);

  // Stats summary
  let y = 48;
  if (stats && Object.keys(stats).length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('Summary', 14, y);
    y += 4;

    const statsEntries = Object.entries(stats);
    const colWidth = (pageWidth - 28) / Math.min(statsEntries.length, 4);
    statsEntries.forEach(([label, value], i) => {
      const x = 14 + (i % 4) * colWidth;
      const row = Math.floor(i / 4);
      const yPos = y + 6 + row * 14;
      doc.setFontSize(16);
      doc.setTextColor(6, 95, 70);
      doc.text(String(value), x, yPos);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(label, x, yPos + 4);
    });
    y += 20 + Math.ceil(statsEntries.length / 4) * 14;
  }

  // Tables
  (tables || []).forEach((table) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(table.title, 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [table.headers],
      body: table.rows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    y = doc.lastAutoTable.finalY + 12;
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `ReMedistribution Report — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
