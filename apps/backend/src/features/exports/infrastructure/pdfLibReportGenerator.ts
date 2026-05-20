import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';

import { displayPii, type PatientExportData } from '../domain/exportsDomain';
import type { PdfReportGenerator } from '../domain/pdfReportGenerator';

// Adapter pdf-lib pour la génération d'un rapport patient PDF/A4.
// Layout simple : marges 50px, titres bold, sections successives, pagination
// automatique quand le curseur atteint le bas de page.
const PAGE_WIDTH = 595; // A4 en points
const PAGE_HEIGHT = 842;
const MARGIN_X = 50;
const MARGIN_Y = 50;
const BODY_FONT_SIZE = 11;
const TITLE_FONT_SIZE = 20;
const SECTION_FONT_SIZE = 14;
const LINE_HEIGHT = 14;

export class PdfLibReportGenerator implements PdfReportGenerator {
  async generatePatientReport(patient: PatientExportData): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const helvetica = await document.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await document.embedFont(StandardFonts.HelveticaBold);

    const writer = new PdfWriter(document, helvetica, helveticaBold);

    const isAnonymized = patient.anonymizedAt !== null;

    writer.drawTitle('Rapport patient — Sauver la Face');
    writer.drawBodyLine(`Identifiant patient : ${patient.patientId}`);
    writer.drawBodyLine(`Généré le : ${new Date().toISOString()}`);
    if (isAnonymized) {
      writer.drawBodyLine(`Patient anonymisé le : ${patient.anonymizedAt}`);
    }
    writer.advance();

    writer.drawSectionTitle('Données patient');
    writer.drawBodyLine(`Nom : ${displayPii(patient.lastName, isAnonymized)}`);
    writer.drawBodyLine(`Prénom : ${displayPii(patient.firstName, isAnonymized)}`);
    writer.drawBodyLine(`Date de naissance : ${displayPii(patient.birthdate, isAnonymized)}`);
    writer.drawBodyLine(`Sexe : ${patient.sex ?? ''}`);
    writer.drawBodyLine(`Région : ${patient.region ?? ''}`);
    writer.drawBodyLine(`Dernière synchronisation : ${patient.lastSyncedAt ?? 'jamais'}`);
    writer.advance();

    writer.drawSectionTitle(`Procédures médicales (${patient.procedures.length})`);
    if (patient.procedures.length === 0) {
      writer.drawBodyLine('Aucune procédure enregistrée.');
    } else {
      for (const procedure of patient.procedures) {
        writer.drawBodyLine(
          `• ${procedure.date} — ${procedure.procedureType}` +
            (procedure.hospitalName ? ` (${procedure.hospitalName})` : ''),
        );
      }
    }
    writer.advance();

    writer.drawSectionTitle(`Événements médicaux (${patient.events.length})`);
    if (patient.events.length === 0) {
      writer.drawBodyLine('Aucun événement enregistré.');
    } else {
      for (const event of patient.events) {
        writer.drawBodyLine(
          `• ${event.createdAt} — ${event.eventType}${event.eventTitle ? ` — ${event.eventTitle}` : ''}`,
        );
        if (event.description) {
          writer.drawBodyLine(`  Description : ${event.description}`);
        }
        if (event.symptoms.length > 0) {
          const labels = event.symptoms
            .map((symptom) => (symptom.triggersAlert ? `${symptom.labelFr} ⚠` : symptom.labelFr))
            .join(', ');
          writer.drawBodyLine(`  Symptômes : ${labels}`);
        }
      }
    }
    writer.advance();

    writer.drawSectionTitle(`Photos (${patient.media.length})`);
    if (patient.media.length === 0) {
      writer.drawBodyLine('Aucune photo enregistrée.');
    } else {
      for (const photo of patient.media) {
        writer.drawBodyLine(`• ${photo.takenAt} — ${photo.fileType} — ${photo.fileUrl}`);
      }
    }
    writer.advance();

    writer.drawSectionTitle(`Instructions (${patient.instructions.length})`);
    if (patient.instructions.length === 0) {
      writer.drawBodyLine('Aucune instruction envoyée.');
    } else {
      for (const instruction of patient.instructions) {
        const ackLabel = instruction.acknowledgedAt
          ? `lu le ${instruction.acknowledgedAt}`
          : 'non lu';
        writer.drawBodyLine(`• ${instruction.createdAt} — ${ackLabel}`);
        writer.drawBodyLine(`  ${instruction.content}`);
      }
    }

    return document.save();
  }
}

// Helper d'écriture séquentielle avec pagination automatique.
class PdfWriter {
  private currentPage: PDFPage;
  private cursorY: number;

  constructor(
    private readonly document: PDFDocument,
    private readonly bodyFont: PDFFont,
    private readonly titleFont: PDFFont,
  ) {
    this.currentPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursorY = PAGE_HEIGHT - MARGIN_Y;
  }

  drawTitle(text: string): void {
    this.ensureSpace(TITLE_FONT_SIZE + LINE_HEIGHT);
    this.currentPage.drawText(text, {
      x: MARGIN_X,
      y: this.cursorY - TITLE_FONT_SIZE,
      size: TITLE_FONT_SIZE,
      font: this.titleFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    this.cursorY -= TITLE_FONT_SIZE + LINE_HEIGHT;
  }

  drawSectionTitle(text: string): void {
    this.ensureSpace(SECTION_FONT_SIZE + LINE_HEIGHT);
    this.currentPage.drawText(text, {
      x: MARGIN_X,
      y: this.cursorY - SECTION_FONT_SIZE,
      size: SECTION_FONT_SIZE,
      font: this.titleFont,
      color: rgb(0.15, 0.25, 0.45),
    });
    this.cursorY -= SECTION_FONT_SIZE + LINE_HEIGHT / 2;
  }

  drawBodyLine(text: string): void {
    this.ensureSpace(LINE_HEIGHT);
    // Helvetica standard ne supporte pas tous les caractères Unicode (notamment
    // les caractères khmers). On nettoie le texte pour éviter de planter pdf-lib.
    const safeText = sanitizeForHelvetica(text);
    this.currentPage.drawText(safeText, {
      x: MARGIN_X,
      y: this.cursorY - BODY_FONT_SIZE,
      size: BODY_FONT_SIZE,
      font: this.bodyFont,
      maxWidth: PAGE_WIDTH - 2 * MARGIN_X,
      lineHeight: LINE_HEIGHT,
    });
    this.cursorY -= LINE_HEIGHT;
  }

  advance(): void {
    this.cursorY -= LINE_HEIGHT / 2;
  }

  private ensureSpace(neededHeight: number): void {
    if (this.cursorY - neededHeight < MARGIN_Y) {
      this.currentPage = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.cursorY = PAGE_HEIGHT - MARGIN_Y;
    }
  }
}

// Helvetica (encodage WinAnsi) ne supporte que le latin-1. Les caractères
// non-représentables sont remplacés par '?' — les labels khmers ne sont
// pertinents que sur l'app mobile, pas sur le rapport PDF du médecin.
function sanitizeForHelvetica(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: range latin-1 explicite (0x00-0xFF) pour filtrer les caractères non-WinAnsi
  return text.replace(/[^\x00-\xFF]/g, '?');
}
