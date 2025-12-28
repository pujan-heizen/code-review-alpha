import type { ReviewOutput } from "../schema/reviewOutput";

/**
 * Simple diff rendering: shows removed lines (red) and added lines (green)
 */
function createDiffHtml(original: string | null, replacement: string): string {
  if (!original) {
    // No original snippet - just show replacement
    const escapedReplacement = escapeHtmlForTemplate(replacement);
    return `<div class="diff-container">
      <div class="diff-header">Replacement:</div>
      <pre class="diff-code"><code>${escapedReplacement}</code></pre>
    </div>`;
  }

  const originalLines = original.split("\n");
  const replacementLines = replacement.split("\n");

  let diffHtml = "";

  // Show original lines as removed
  for (const line of originalLines) {
    diffHtml += `<div class="diff-line diff-removed"><span class="diff-marker">-</span><span class="diff-text">${escapeHtmlForTemplate(line)}</span></div>`;
  }

  // Show replacement lines as added
  for (const line of replacementLines) {
    diffHtml += `<div class="diff-line diff-added"><span class="diff-marker">+</span><span class="diff-text">${escapeHtmlForTemplate(line)}</span></div>`;
  }

  return `<div class="diff-container">
    <div class="diff-header">Suggested change:</div>
    <div class="diff-content">${diffHtml}</div>
  </div>`;
}

function escapeHtmlForTemplate(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getReviewPanelHtml(args: {
  nonce: string;
  reviewHtml: string;
  output: ReviewOutput;
}): string {
  const serialized = JSON.stringify(args.output).replace(/</g, "\\u003c");

  // Pre-render fix cards with diff views
  const fixCardsHtml = args.output.fixes
    .map((fix) => {
      const meta = `${fix.filePath}:${fix.startLine}-${fix.endLine}`;
      const diffHtml = createDiffHtml(fix.expectedOriginalSnippet, fix.replacement);

      return `
        <div class="fix" data-fix-id="${escapeHtmlForTemplate(fix.id)}">
          <div class="fixTitle">
            <div>${escapeHtmlForTemplate(fix.title)}</div>
            <div class="fix-actions">
              <button class="secondary" data-open="${escapeHtmlForTemplate(fix.filePath)}" data-line="${fix.startLine}">Open</button>
              <button class="primary apply-btn" data-apply="${escapeHtmlForTemplate(fix.id)}">Apply</button>
            </div>
          </div>
          <div class="fixMeta">${escapeHtmlForTemplate(meta)}</div>
          ${diffHtml}
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${args.nonce}';" />
  <title>Code Review</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 18px;
      max-width: 1000px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .fix {
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 12px;
      margin: 12px 0;
      background: var(--vscode-editor-background);
    }
    .fix.applied {
      opacity: 0.6;
      border-color: var(--vscode-charts-green, #4caf50);
    }
    .fix.applied::before {
      content: "✓ Applied";
      display: block;
      color: var(--vscode-charts-green, #4caf50);
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .fixTitle {
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .fix-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .fixMeta {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      margin-bottom: 10px;
    }
    button {
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: 12px;
      padding: 6px 10px;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .primary:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    .secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .secondary:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid var(--vscode-widget-border);
    }
    code {
      font-family: var(--vscode-editor-font-family);
    }
    
    /* Diff styles */
    .diff-container {
      margin-top: 10px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .diff-header {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .diff-content {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      line-height: 1.5;
    }
    .diff-code {
      margin: 0;
      border: none;
      border-radius: 0;
    }
    .diff-line {
      display: flex;
      padding: 0 12px;
      min-height: 20px;
    }
    .diff-marker {
      width: 20px;
      flex-shrink: 0;
      user-select: none;
      font-weight: bold;
    }
    .diff-text {
      flex: 1;
      white-space: pre;
      overflow-x: auto;
    }
    .diff-removed {
      background: var(--vscode-diffEditor-removedLineBackground, rgba(255, 0, 0, 0.1));
      color: var(--vscode-errorForeground, #f44336);
    }
    .diff-removed .diff-marker {
      color: var(--vscode-errorForeground, #f44336);
    }
    .diff-added {
      background: var(--vscode-diffEditor-insertedLineBackground, rgba(0, 255, 0, 0.1));
      color: var(--vscode-charts-green, #4caf50);
    }
    .diff-added .diff-marker {
      color: var(--vscode-charts-green, #4caf50);
    }
  </style>
</head>
<body>
  <div id="review">${args.reviewHtml}</div>
  <hr />
  <h2>Fixes</h2>
  <div id="fixes">${fixCardsHtml || "<p>No fixes suggested.</p>"}</div>

  <script nonce="${args.nonce}">
    const vscode = acquireVsCodeApi();
    const output = ${serialized};
    const appliedFixes = new Set();

    const fixesEl = document.getElementById('fixes');

    fixesEl.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      
      const fixId = t.getAttribute('data-apply');
      if (fixId && !appliedFixes.has(fixId)) {
        // Disable button immediately to prevent double-clicks
        t.disabled = true;
        t.textContent = 'Applying...';
        vscode.postMessage({ type: 'applyFix', fixId });
      }

      const filePath = t.getAttribute('data-open');
      const lineStr = t.getAttribute('data-line');
      if (filePath) {
        vscode.postMessage({ type: 'openFile', filePath, line: Number(lineStr || '1') });
      }
    });

    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'fixApplied') {
        appliedFixes.add(msg.fixId);
        const fixEl = document.querySelector(\`.fix[data-fix-id="\${msg.fixId}"]\`);
        if (fixEl) {
          fixEl.classList.add('applied');
          const applyBtn = fixEl.querySelector('.apply-btn');
          if (applyBtn) {
            applyBtn.textContent = 'Applied';
            applyBtn.disabled = true;
          }
        }
      } else if (msg.type === 'fixFailed') {
        const fixEl = document.querySelector(\`.fix[data-fix-id="\${msg.fixId}"]\`);
        if (fixEl) {
          const applyBtn = fixEl.querySelector('.apply-btn');
          if (applyBtn) {
            applyBtn.textContent = 'Apply';
            applyBtn.disabled = false;
          }
        }
      }
    });

    function escapeHtml(str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }
    function escapeAttr(str) {
      return escapeHtml(str);
    }
  </script>
</body>
</html>`;
}
