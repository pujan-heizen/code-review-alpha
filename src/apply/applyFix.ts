import * as path from "path";
import * as vscode from "vscode";
import type { Fix } from "../schema/reviewOutput";

export interface ApplyFixResult {
  applied: boolean;
  reason?: string;
}

function getWorkspaceRoot(): vscode.Uri {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) throw new Error("No workspace folder is open.");
  return root;
}

function toAbsoluteUri(workspaceRelativePath: string): vscode.Uri {
  const root = getWorkspaceRoot();
  return vscode.Uri.file(path.join(root.fsPath, workspaceRelativePath));
}

/**
 * Normalize text for comparison: trim trailing whitespace from each line
 * and normalize line endings to \n
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Build a range from a character index in the document text
 */
function buildRangeFromIndex(
  docText: string,
  idx: number,
  snippet: string,
): vscode.Range {
  const beforeText = docText.substring(0, idx);
  const lines = beforeText.split(/\r?\n/);
  const startLine = lines.length - 1;
  const startCol = lines[lines.length - 1].length;

  const matchLines = snippet.split(/\r?\n/);
  const endLine = startLine + matchLines.length - 1;
  const endCol =
    matchLines.length === 1
      ? startCol + matchLines[0].length
      : matchLines[matchLines.length - 1].length;

  return new vscode.Range(
    new vscode.Position(startLine, startCol),
    new vscode.Position(endLine, endCol),
  );
}

/**
 * Check if a range is within tolerance of expected lines
 */
function isWithinTolerance(
  range: vscode.Range,
  expectedStartLine: number,
  expectedEndLine: number,
  toleranceLines: number,
): boolean {
  const minExpected = Math.max(0, expectedStartLine - 1 - toleranceLines);
  const maxExpected = expectedEndLine - 1 + toleranceLines;
  return range.start.line <= maxExpected && range.end.line >= minExpected;
}

/**
 * Calculate distance from range to expected lines (for finding closest match)
 */
function distanceFromExpected(
  range: vscode.Range,
  expectedStartLine: number,
  expectedEndLine: number,
): number {
  const expectedMid = (expectedStartLine - 1 + expectedEndLine - 1) / 2;
  const rangeMid = (range.start.line + range.end.line) / 2;
  return Math.abs(rangeMid - expectedMid);
}

interface LineHint {
  startLine: number;
  endLine: number;
}

/**
 * Find the best matching position of the original snippet in the document.
 * When a line hint is provided, finds the match closest to that location.
 * Uses content-based matching which is resilient to line number changes.
 */
function findSnippetInDocument(
  doc: vscode.TextDocument,
  expectedSnippet: string,
  hint?: LineHint,
): { range: vscode.Range; matchedText: string } | null {
  const docText = doc.getText();
  const toleranceLines = 50;

  // Collect all exact matches
  const exactMatches: { range: vscode.Range; matchedText: string }[] = [];
  let idx = docText.indexOf(expectedSnippet);
  while (idx !== -1) {
    const range = buildRangeFromIndex(docText, idx, expectedSnippet);
    exactMatches.push({ range, matchedText: expectedSnippet });
    idx = docText.indexOf(expectedSnippet, idx + 1);
  }

  // If we have exact matches, find the best one
  if (exactMatches.length > 0) {
    if (hint) {
      // Filter to matches within tolerance, then pick closest
      const validMatches = exactMatches.filter((m) =>
        isWithinTolerance(m.range, hint.startLine, hint.endLine, toleranceLines),
      );

      if (validMatches.length > 0) {
        // Return the match closest to expected location
        validMatches.sort(
          (a, b) =>
            distanceFromExpected(a.range, hint.startLine, hint.endLine) -
            distanceFromExpected(b.range, hint.startLine, hint.endLine),
        );
        return validMatches[0];
      }
      // No matches within tolerance - return null
      return null;
    }
    // No hint - return first match
    return exactMatches[0];
  }

  // No exact matches - try normalized comparison
  const normalizedDoc = normalizeText(docText);
  const normalizedSnippet = normalizeText(expectedSnippet);

  if (normalizedDoc.indexOf(normalizedSnippet) === -1) {
    return null;
  }

  // Search line by line for normalized matches
  const docLines = docText.split(/\r?\n/);
  const snippetLines = normalizedSnippet.split("\n");
  const normalizedMatches: { range: vscode.Range; matchedText: string }[] = [];

  for (let startLine = 0; startLine <= docLines.length - snippetLines.length; startLine++) {
    const candidateLines = docLines.slice(startLine, startLine + snippetLines.length);
    const candidateNormalized = candidateLines.map((l) => l.trimEnd()).join("\n");

    if (candidateNormalized === normalizedSnippet) {
      const endLine = startLine + snippetLines.length - 1;
      const range = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, docLines[endLine].length),
      );
      normalizedMatches.push({ range, matchedText: doc.getText(range) });
    }
  }

  if (normalizedMatches.length === 0) {
    return null;
  }

  if (hint) {
    // Filter to matches within tolerance, then pick closest
    const validMatches = normalizedMatches.filter((m) =>
      isWithinTolerance(m.range, hint.startLine, hint.endLine, toleranceLines),
    );

    if (validMatches.length > 0) {
      validMatches.sort(
        (a, b) =>
          distanceFromExpected(a.range, hint.startLine, hint.endLine) -
          distanceFromExpected(b.range, hint.startLine, hint.endLine),
      );
      return validMatches[0];
    }
    return null;
  }

  return normalizedMatches[0];
}

/**
 * Fallback: Try to find snippet using line numbers as hints, searching in a window
 */
function findSnippetByLineHint(
  doc: vscode.TextDocument,
  expectedSnippet: string,
  startLine: number,
  endLine: number,
): { range: vscode.Range; matchedText: string } | null {
  const searchRadius = 100; // lines to search above/below
  const minLine = Math.max(0, startLine - 1 - searchRadius);
  const maxLine = Math.min(doc.lineCount - 1, endLine - 1 + searchRadius);

  const normalizedSnippet = normalizeText(expectedSnippet);
  const snippetLineCount = normalizedSnippet.split("\n").length;

  for (let line = minLine; line <= maxLine - snippetLineCount + 1; line++) {
    const candidateEndLine = Math.min(line + snippetLineCount - 1, doc.lineCount - 1);
    const range = new vscode.Range(
      new vscode.Position(line, 0),
      new vscode.Position(candidateEndLine, doc.lineAt(candidateEndLine).text.length),
    );

    const text = doc.getText(range);
    if (normalizeText(text) === normalizedSnippet) {
      return { range, matchedText: text };
    }
  }

  return null;
}

function computeLineSimilarityScore(expectedLines: string[], candidateLines: string[]): number {
  if (expectedLines.length === 0 || expectedLines.length !== candidateLines.length) return 0;

  let exact = 0;
  for (let i = 0; i < expectedLines.length; i++) {
    if (expectedLines[i] === candidateLines[i]) exact++;
  }

  const base = exact / expectedLines.length;
  const firstBonus = expectedLines[0] === candidateLines[0] ? 0.15 : 0;
  const lastBonus =
    expectedLines[expectedLines.length - 1] === candidateLines[candidateLines.length - 1]
      ? 0.15
      : 0;

  return clamp(base + firstBonus + lastBonus, 0, 1);
}

/**
 * Fallback: fuzzy matching near the expected line range.
 * This is designed for the "multiple fixes in same file" case where earlier edits
 * can slightly change the original snippet (e.g. import re-ordering), but the
 * location is still near the original range.
 */
function findSnippetFuzzyNearLineHint(
  doc: vscode.TextDocument,
  expectedSnippet: string,
  startLine: number,
  endLine: number,
): { range: vscode.Range; matchedText: string; score: number } | null {
  const searchRadius = 200;
  const minLine = Math.max(0, startLine - 1 - searchRadius);
  const maxLine = Math.min(doc.lineCount - 1, endLine - 1 + searchRadius);

  const normalizedSnippet = normalizeText(expectedSnippet);
  const expectedLines = normalizedSnippet.split("\n");
  const snippetLineCount = expectedLines.length;
  if (snippetLineCount === 0) return null;

  // Short snippets are risky to fuzzy-match; demand a high score.
  const minScore =
    snippetLineCount <= 2 ? 0.95 : snippetLineCount <= 6 ? 0.8 : snippetLineCount <= 25 ? 0.7 : 0.65;

  let best:
    | { startLine: number; endLine: number; score: number; distance: number }
    | undefined;

  for (let line = minLine; line <= maxLine - snippetLineCount + 1; line++) {
    const candidateEndLine = Math.min(line + snippetLineCount - 1, doc.lineCount - 1);
    const candidateLines = [];
    for (let i = 0; i < snippetLineCount; i++) {
      candidateLines.push(doc.lineAt(line + i).text.trimEnd());
    }

    const score = computeLineSimilarityScore(expectedLines, candidateLines);
    if (score < minScore) continue;

    const expectedMid = (startLine - 1 + endLine - 1) / 2;
    const candMid = (line + candidateEndLine) / 2;
    const distance = Math.abs(candMid - expectedMid);

    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { startLine: line, endLine: candidateEndLine, score, distance };
    }
  }

  if (!best) return null;

  const range = new vscode.Range(
    new vscode.Position(best.startLine, 0),
    new vscode.Position(best.endLine, doc.lineAt(best.endLine).text.length),
  );
  return { range, matchedText: doc.getText(range), score: best.score };
}

function hasReplacementAlreadyApplied(
  doc: vscode.TextDocument,
  replacement: string,
  hint?: LineHint,
): boolean {
  const docText = doc.getText();
  if (replacement.length === 0) return false;

  // Quick exact containment
  if (docText.indexOf(replacement) !== -1) return true;

  // Normalized containment (tolerates trailing whitespace differences)
  const normalizedDoc = normalizeText(docText);
  const normalizedReplacement = normalizeText(replacement);
  if (normalizedReplacement.length === 0) return false;

  if (!hint) {
    return normalizedDoc.indexOf(normalizedReplacement) !== -1;
  }

  // Search within a window around the hint to reduce false positives
  const searchRadius = 200;
  const minLine = Math.max(0, hint.startLine - 1 - searchRadius);
  const maxLine = Math.min(doc.lineCount - 1, hint.endLine - 1 + searchRadius);

  const windowRange = new vscode.Range(
    new vscode.Position(minLine, 0),
    new vscode.Position(maxLine, doc.lineAt(maxLine).text.length),
  );
  const windowText = doc.getText(windowRange);
  return normalizeText(windowText).indexOf(normalizedReplacement) !== -1;
}

export async function applyFix(fix: Fix): Promise<ApplyFixResult> {
  const uri = toAbsoluteUri(fix.filePath);

  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(uri);
  } catch {
    return { applied: false, reason: `Unable to open file: ${fix.filePath}` };
  }

  // Strategy 1: Use expectedOriginalSnippet for content-based matching (preferred)
  if (fix.expectedOriginalSnippet) {
    const hint: LineHint = { startLine: fix.startLine, endLine: fix.endLine };

    // First try to find near the expected line range (more targeted, avoids wrong matches)
    let match = findSnippetByLineHint(doc, fix.expectedOriginalSnippet, fix.startLine, fix.endLine);

    // If not found near expected lines, fall back to global search with hint for tolerance
    if (!match) {
      match = findSnippetInDocument(doc, fix.expectedOriginalSnippet, hint);
    }

    if (match) {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, match.range, fix.replacement);
      const ok = await vscode.workspace.applyEdit(edit);

      if (!ok) {
        return { applied: false, reason: "VS Code rejected the edit." };
      }

      await vscode.window.showTextDocument(doc, { preview: false });
      return { applied: true };
    }

    // Fallback: fuzzy match near original line range (helps when earlier fixes modified the snippet)
    const fuzzy = findSnippetFuzzyNearLineHint(
      doc,
      fix.expectedOriginalSnippet,
      fix.startLine,
      fix.endLine,
    );

    if (fuzzy) {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, fuzzy.range, fix.replacement);
      const ok = await vscode.workspace.applyEdit(edit);

      if (!ok) {
        return { applied: false, reason: "VS Code rejected the edit." };
      }

      await vscode.window.showTextDocument(doc, { preview: false });
      return { applied: true };
    }

    // If the replacement already exists, treat as already applied (common after applying a nearby fix)
    if (hasReplacementAlreadyApplied(doc, fix.replacement, hint)) {
      return { applied: true, reason: "Fix appears to already be applied." };
    }

    return {
      applied: false,
      reason:
        "Could not find the original code snippet in the file. The file may have been modified or this fix was already applied. Please re-run the review.",
    };
  }

  // Strategy 2: Fallback to line-based replacement (less reliable, used when no snippet provided)
  const start = Math.max(1, fix.startLine);
  const end = Math.max(start, fix.endLine);

  if (end > doc.lineCount) {
    return {
      applied: false,
      reason: `Line range ${start}-${end} exceeds file length (${doc.lineCount} lines).`,
    };
  }

  const startPos = new vscode.Position(start - 1, 0);
  const endLineIdx = Math.min(end - 1, doc.lineCount - 1);
  const endPos = new vscode.Position(endLineIdx, doc.lineAt(endLineIdx).text.length);
  const range = new vscode.Range(startPos, endPos);

  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, range, fix.replacement);
  const ok = await vscode.workspace.applyEdit(edit);

  if (!ok) {
    return { applied: false, reason: "VS Code rejected the edit." };
  }

  await vscode.window.showTextDocument(doc, { preview: false });
  return { applied: true };
}

/**
 * Check if a fix can still be applied (the original snippet exists in the file)
 */
export async function canApplyFix(fix: Fix): Promise<boolean> {
  if (!fix.expectedOriginalSnippet) {
    return true; // Can't verify without expected snippet
  }

  try {
    const uri = toAbsoluteUri(fix.filePath);
    const doc = await vscode.workspace.openTextDocument(uri);

    // Prefer line-hinted search first
    let match = findSnippetByLineHint(doc, fix.expectedOriginalSnippet, fix.startLine, fix.endLine);

    // Fall back to global search with hint for tolerance
    if (!match) {
      match = findSnippetInDocument(doc, fix.expectedOriginalSnippet, {
        startLine: fix.startLine,
        endLine: fix.endLine,
      });
    }

    return match !== null;
  } catch {
    return false;
  }
}
