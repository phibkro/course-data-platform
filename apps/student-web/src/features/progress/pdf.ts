import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

import { parseTranscript, type TranscriptProposal, type TranscriptVocabulary } from './domain';

/**
 * Browser-only adapter. Coordinate reconstruction and first-page issuer
 * detection are adapted from MIT-licensed Karakter prior art (web/pdf-lines.mjs).
 * No PDF bytes or extracted transcript text leave this function's scope.
 */

const maximumPdfBytes = 10 * 1024 * 1024;
const minimumPages = 1;
const maximumPages = 30;
const maximumExtractedCharacters = 2_000_000;

const courseStartPattern = /^[A-ZÆØÅ][A-ZÆØÅ0-9]*\d[A-ZÆØÅ0-9]*(?:-\d+)?\s/iu;
const courseSuffixPattern = /^(.*?) (20\d\d [\p{L} -]+ [\d,.–-]+) (.+)$/u;
const supportedGradeLabels: Readonly<Record<string, true>> = {
  A: true,
  B: true,
  C: true,
  D: true,
  E: true,
  F: true,
  Bestått: true,
  Passed: true,
  Pass: true,
  Greidd: true,
  'Ikke bestått': true,
  Failed: true,
  Innpasset: true,
  Recognized: true,
};

interface PositionedText {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

interface ReconstructedLine {
  readonly y: number;
  readonly items: Array<PositionedText>;
}

interface RowColumns {
  readonly name: number;
  readonly grade: number;
}

/**
 * The only PDF source data suitable for a Foldkit model. The browser retains
 * the Blob behind its object URL until the caller explicitly releases it.
 */
export interface TranscriptPreview {
  readonly objectUrl: string;
  readonly fileName: string;
}

class PdfImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfImportError';
  }
}

const abortError = (): Error => {
  const error = new Error('PDF import was cancelled.');
  error.name = 'AbortError';
  return error;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw abortError();
};

const awaitWithAbort = <Value>(promise: Promise<Value>, signal: AbortSignal): Promise<Value> =>
  new Promise<Value>((resolve, reject) => {
    let settled = false;
    const finish = (): boolean => {
      if (settled) return false;
      settled = true;
      signal.removeEventListener('abort', abort);
      return true;
    };
    const abort = () => {
      if (finish()) reject(abortError());
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    void promise.then(
      (value) => {
        if (finish()) resolve(value);
      },
      (error: unknown) => {
        if (finish()) reject(error);
      },
    );
  });

const positionedText = (items: ReadonlyArray<unknown>): Array<PositionedText> => {
  const positioned: Array<PositionedText> = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Readonly<Record<string, unknown>>;
    const text = record.str;
    const transform = record.transform;
    if (typeof text !== 'string' || text.trim().length === 0 || !Array.isArray(transform)) continue;

    const x = transform[4];
    const y = transform[5];
    if (
      typeof x !== 'number' ||
      !Number.isFinite(x) ||
      typeof y !== 'number' ||
      !Number.isFinite(y)
    ) {
      continue;
    }
    positioned.push({ x, y, text: text.trim() });
  }
  return positioned;
};

/**
 * PDF content-stream order is not reading order. Group text by vertical
 * coordinate and then sort it left-to-right before parser input is built.
 */
const transcriptLines = (items: ReadonlyArray<unknown>): string => {
  const lines: Array<ReconstructedLine> = [];
  for (const item of positionedText(items).sort(
    (left, right) => right.y - left.y || left.x - right.x,
  )) {
    const existing = lines.find((line) => Math.abs(line.y - item.y) < 2.5);
    if (existing === undefined) {
      lines.push({ y: item.y, items: [item] });
    } else {
      existing.items.push(item);
    }
  }

  lines.sort((left, right) => right.y - left.y);
  const result: Array<string> = [];
  let previousY: number | undefined;
  let columns: RowColumns | undefined;

  for (const line of lines) {
    line.items.sort((left, right) => left.x - right.x);
    const text = line.items
      .map((item) => item.text)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();
    const previous = result.at(-1);
    const adjacent = previousY !== undefined && previousY - line.y > 0 && previousY - line.y <= 18;
    previousY = line.y;

    if (
      previous !== undefined &&
      columns !== undefined &&
      adjacent &&
      courseStartPattern.test(previous)
    ) {
      const activeColumns = columns;
      const suffix = courseSuffixPattern.exec(previous);
      const nameItems = line.items.filter((item) => Math.abs(item.x - activeColumns.name) < 3);
      const gradeItems = line.items.filter((item) => Math.abs(item.x - activeColumns.grade) < 3);
      const isContinuation = nameItems.length + gradeItems.length === line.items.length;
      const name = nameItems.map((item) => item.text).join(' ');
      const gradeFragment = gradeItems.map((item) => item.text).join('');
      const combinedGrade = suffix === null ? null : `${suffix[3] ?? ''}${gradeFragment}`;
      const safeGrade =
        gradeFragment.length === 0 ||
        (combinedGrade !== null && Object.hasOwn(supportedGradeLabels, combinedGrade));
      const looksLikeFooter =
        /^(Sum|Total|Side|Page|Universitet|Karakter|Studiepoeng|Grunnlag|Student|Navn|Fødsels)/iu.test(
          text,
        );

      if (suffix !== null && isContinuation && safeGrade && text.length < 180 && !looksLikeFooter) {
        result[result.length - 1] = `${suffix[1] ?? ''}${name.length === 0 ? '' : ` ${name}`} ${
          suffix[2] ?? ''
        } ${combinedGrade ?? ''}`.trim();
        continue;
      }
    }

    result.push(text);
    columns = undefined;
    if (courseStartPattern.test(text) && courseSuffixPattern.test(text)) {
      const name = line.items[1];
      const grade = line.items.at(-1);
      if (
        name !== undefined &&
        grade !== undefined &&
        name.x > 95 &&
        name.x < 180 &&
        grade.x > 400
      ) {
        columns = { name: name.x, grade: grade.x };
      }
    }
  }

  return result.join('\n');
};

/**
 * Only the first-page header can identify the issuing institution. Course names
 * elsewhere in a transcript may mention another university after a transfer.
 */
const detectInstitution = (firstPage: string): 'NTNU' | 'UiO' | null => {
  for (const line of firstPage.split(/\r?\n/u).slice(0, 20)) {
    if (courseStartPattern.test(line)) break;
    const header = line.trim();
    if (
      /^(?:NTNU(?:\s*[-–]\s*(?:SYNTETISK TESTUTSKRIFT|Synthetic test transcript \(not an official document\)))?|Norges teknisk[–-]naturvitenskapelige universitet|Noregs teknisk[–-]naturvitskaplege universitet|Norwegian University of Science and Technology)$/iu.test(
        header,
      )
    ) {
      return 'NTNU';
    }
    if (/^(?:Universitetet i Oslo|University of Oslo)$/iu.test(header)) return 'UiO';
  }
  return null;
};

const assertPdfFile = (file: File): void => {
  if (
    typeof window === 'undefined' ||
    typeof File === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof URL.revokeObjectURL !== 'function' ||
    !(file instanceof File)
  ) {
    throw new PdfImportError('PDF import is available only in a browser.');
  }
  if (file.size > maximumPdfBytes) {
    throw new PdfImportError('Select one PDF no larger than 10 MiB.');
  }
  if (file.type !== 'application/pdf' && !/\.pdf$/iu.test(file.name)) {
    throw new PdfImportError('Select one PDF transcript.');
  }
};

/**
 * Accept only a Blob URL created for browser-local preview. It prevents a
 * caller from turning the parsing seam into a network fetch.
 */
const assertPdfPreviewUrl = (objectUrl: string): void => {
  if (typeof window === 'undefined' || typeof URL === 'undefined') {
    throw new PdfImportError('PDF import is available only in a browser.');
  }

  let url: URL;
  try {
    url = new URL(objectUrl);
  } catch {
    throw new PdfImportError('The selected PDF preview is unavailable.');
  }
  if (url.protocol !== 'blob:') {
    throw new PdfImportError('The selected PDF preview is unavailable.');
  }
};

const releasePdfResources = async (
  document: PDFDocumentProxy | null,
  loadingTask: PDFDocumentLoadingTask | null,
): Promise<void> => {
  if (document !== null) {
    try {
      await document.cleanup();
    } catch {
      // The loading task still owns final worker teardown below.
    }
  }
  if (loadingTask !== null) {
    try {
      await loadingTask.destroy();
    } catch {
      // A failed or already-aborted task is still considered released.
    }
  }
};

/**
 * Validates one bounded browser file and creates a local source that can be
 * rendered before parsing. The returned record contains no File or PDF bytes.
 */
export const openTranscriptPreview = (file: File): TranscriptPreview => {
  assertPdfFile(file);
  try {
    return {
      objectUrl: URL.createObjectURL(file),
      fileName: file.name,
    };
  } catch {
    throw new PdfImportError('The selected file could not be prepared for review.');
  }
};

/**
 * Explicitly drops the browser-owned Blob mapping. Parsing deliberately never
 * calls this, so review can reopen the same source until approval or cancel.
 */
export const releaseTranscriptPreview = (objectUrl: string): void => {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  URL.revokeObjectURL(objectUrl);
};

/**
 * Parses a previously opened local PDF only after the caller explicitly asks
 * for it. PDF.js receives the Blob URL directly: no source bytes are copied
 * into the model, persisted, or fetched from the network.
 */
export const parseTranscriptPreview = async (
  objectUrl: string,
  signal: AbortSignal,
  vocabulary?: TranscriptVocabulary,
): Promise<TranscriptProposal> => {
  assertPdfPreviewUrl(objectUrl);
  throwIfAborted(signal);

  let loadingTask: PDFDocumentLoadingTask | null = null;
  let document: PDFDocumentProxy | null = null;
  const abortTask = () => {
    if (loadingTask !== null) void loadingTask.destroy().catch(() => undefined);
  };
  signal.addEventListener('abort', abortTask, { once: true });

  try {
    const [pdfjs, workerUrlModule] = await awaitWithAbort(
      Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.mjs?url')]),
      signal,
    );
    throwIfAborted(signal);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrlModule.default;

    // The validated Blob URL is browser-local. Passing it directly keeps PDF
    // bytes out of durable state and disables PDF.js range/stream fetching.
    loadingTask = pdfjs.getDocument({
      url: objectUrl,
      withCredentials: false,
      disableAutoFetch: true,
      disableRange: true,
      disableStream: true,
      stopAtErrors: true,
    });
    document = await awaitWithAbort(loadingTask.promise, signal);
    throwIfAborted(signal);

    if (document.numPages < minimumPages || document.numPages > maximumPages) {
      throw new PdfImportError('Select a transcript PDF with between 1 and 30 pages.');
    }

    const pageTexts: Array<string> = [];
    let extractedCharacters = 0;
    let institution: 'NTNU' | 'UiO' | null = null;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      const page = await awaitWithAbort(document.getPage(pageNumber), signal);
      const textContent = await awaitWithAbort(page.getTextContent(), signal);
      const pageText = transcriptLines(textContent.items);
      extractedCharacters += pageText.length;
      if (extractedCharacters > maximumExtractedCharacters) {
        throw new PdfImportError('The PDF contains too much text to import safely.');
      }
      if (pageNumber === 1) {
        institution = detectInstitution(pageText);
        if (institution === null) {
          throw new PdfImportError(
            'The first-page header does not identify an NTNU or UiO transcript.',
          );
        }
      }
      pageTexts.push(pageText);
    }

    throwIfAborted(signal);
    return parseTranscript(pageTexts.join('\n'), institution ?? '', vocabulary);
  } catch (error) {
    if (isAbortError(error) || error instanceof PdfImportError) throw error;
    throw new PdfImportError('The selected file could not be read as a PDF transcript.');
  } finally {
    signal.removeEventListener('abort', abortTask);
    await releasePdfResources(document, loadingTask);
  }
};
