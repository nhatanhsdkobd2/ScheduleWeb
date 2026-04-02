import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import type { PerformanceItem, WeeklyReportRow } from "../../shared/types/domain.js";

const EXPORT_DIR = path.resolve(process.cwd(), "exports");

async function ensureExportDir(): Promise<void> {
  await mkdir(EXPORT_DIR, { recursive: true });
}

function toSafeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function generateExcelReport(
  reportType: "weekly" | "monthly",
  periodStart: string,
  periodEnd: string,
  rows: WeeklyReportRow[],
): Promise<string> {
  await ensureExportDir();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${reportType}-report`);
  sheet.columns = [
    { header: "Member", key: "memberName", width: 24 },
    { header: "Assigned", key: "assigned", width: 12 },
    { header: "Done", key: "done", width: 12 },
    { header: "Overdue", key: "overdue", width: 12 },
    { header: "Avg Delay Days", key: "avgDelayDays", width: 16 },
  ];

  sheet.addRow([`Report Type: ${reportType}`]);
  sheet.addRow([`Period: ${periodStart} -> ${periodEnd}`]);
  sheet.addRow([]);
  sheet.addRows(rows);
  sheet.getRow(4).font = { bold: true };

  if (reportType === "monthly") {
    const summary = workbook.addWorksheet("monthly-summary");
    summary.columns = [
      { header: "Member", key: "memberName", width: 24 },
      { header: "Done", key: "done", width: 12 },
      { header: "Overdue", key: "overdue", width: 12 },
      { header: "Rank", key: "rank", width: 12 },
    ];
    const ranking = [...rows]
      .sort((a, b) => b.done - b.overdue - (a.done - a.overdue))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    summary.addRows(ranking);
    summary.getRow(1).font = { bold: true };
  }

  const fileName = `${reportType}_report_${toSafeName(periodStart)}_${toSafeName(periodEnd)}.xlsx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

export async function generatePdfReport(
  reportType: "weekly" | "monthly",
  periodStart: string,
  periodEnd: string,
  performance: PerformanceItem[],
): Promise<string> {
  await ensureExportDir();
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`${reportType.toUpperCase()} Performance Summary`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Period: ${periodStart} -> ${periodEnd}`, 14, 28);
  if (reportType === "monthly") {
    doc.text("Trend section: compare avg delay and score by member", 14, 34);
  }

  let y = reportType === "monthly" ? 44 : 40;
  for (const row of performance) {
    doc.text(
      `${row.memberName}: score=${row.score}, avgDelay=${row.avgDelayDays}, overdueRatio=${row.overdueRatio}`,
      14,
      y,
    );
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  const fileName = `${reportType}_summary_${toSafeName(periodStart)}_${toSafeName(periodEnd)}.pdf`;
  const filePath = path.join(EXPORT_DIR, fileName);
  const pdfBytes = doc.output("arraybuffer");
  await writeFile(filePath, Buffer.from(pdfBytes));
  return filePath;
}
