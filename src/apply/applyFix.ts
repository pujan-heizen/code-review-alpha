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

function getRangeForLines(
  doc: vscode.TextDocument,
  startLine: number,
  endLine: number,
): vscode.Range {
  const start = Math.max(1, startLine);
  const end = Math.max(start, endLine);

  const startPos = new vscode.Position(start - 1, 0);
  const endLineIdx = Math.min(end - 1, doc.lineCount - 1);
  const endPos = new vscode.Position(endLineIdx, doc.lineAt(endLineIdx).text.length);

  return new vscode.Range(startPos, endPos);
}

export async function applyFix(fix: Fix): Promise<ApplyFixResult> {
  const uri = toAbsoluteUri(fix.filePath);

  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(uri);
  } catch (err) {
    return { applied: false, reason: `Unable to open file: ${fix.filePath}` };
  }

  const range = getRangeForLines(doc, fix.startLine, fix.endLine);
  const current = doc.getText(range);

  if (fix.expectedOriginalSnippet && current.trimEnd() !== fix.expectedOriginalSnippet.trimEnd()) {
    return {
      applied: false,
      reason:
        "The file has changed since the fix was generated (content mismatch). Re-run review to refresh fixes.",
    };
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, range, fix.replacement);
  const ok = await vscode.workspace.applyEdit(edit);

  if (!ok) {
    return { applied: false, reason: "VS Code rejected the edit." };
  }

  // Ensure the document is visible after applying.
  await vscode.window.showTextDocument(doc, { preview: false });
  return { applied: true };
}
