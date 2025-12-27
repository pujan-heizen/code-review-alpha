import type { ReviewOutput } from "../schema/reviewOutput";

export function getReviewPanelHtml(args: {
  nonce: string;
  reviewHtml: string;
  output: ReviewOutput;
}): string {
  const serialized = JSON.stringify(args.output).replace(/</g, "\\u003c");

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
    .fixTitle {
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
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
    .primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .secondary:hover {
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
  </style>
</head>
<body>
  <div id="review">${args.reviewHtml}</div>
  <hr />
  <h2>Fixes</h2>
  <div id="fixes"></div>

  <script nonce="${args.nonce}">
    const vscode = acquireVsCodeApi();
    const output = ${serialized};

    const fixesEl = document.getElementById('fixes');
    if (!output.fixes || output.fixes.length === 0) {
      fixesEl.innerHTML = '<p>No fixes suggested.</p>';
    } else {
      fixesEl.innerHTML = output.fixes.map(fix => {
        const meta = \`\${fix.filePath}:\${fix.startLine}-\${fix.endLine}\`;
        return \`
          <div class="fix">
            <div class="fixTitle">
              <div>\${escapeHtml(fix.title)}</div>
              <div style="display:flex; gap:8px;">
                <button class="secondary" data-open="\${escapeAttr(fix.filePath)}" data-line="\${fix.startLine}">Open</button>
                <button class="primary" data-apply="\${escapeAttr(fix.id)}">Apply</button>
              </div>
            </div>
            <div class="fixMeta">\${escapeHtml(meta)}</div>
            <pre><code>\${escapeHtml(fix.replacement)}</code></pre>
          </div>
        \`;
      }).join('');
    }

    fixesEl.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const fixId = t.getAttribute('data-apply');
      if (fixId) vscode.postMessage({ type: 'applyFix', fixId });

      const filePath = t.getAttribute('data-open');
      const lineStr = t.getAttribute('data-line');
      if (filePath) vscode.postMessage({ type: 'openFile', filePath, line: Number(lineStr || '1') });
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
