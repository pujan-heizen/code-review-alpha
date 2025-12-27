import { createNonce } from "./webviewShared";

export function getSidebarHtml(): { html: string; nonce: string } {
  const nonce = createNonce();

  // Sidebar UI: prompt selection + live activity + basic metrics.
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>Code Review</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
      line-height: 1.5;
    }
    .sectionTitle {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
      opacity: .75;
      margin: 0 0 8px 0;
    }
    select {
      width: 100%;
      padding: 8px 10px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      outline: none;
    }
    select:focus {
      border-color: var(--vscode-focusBorder);
    }
    .row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    button {
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      padding: 8px 10px;
    }
    .primary {
      flex: 1;
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
    .hint {
      margin-top: 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .small {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 6px;
    }
    .list {
      margin-top: 8px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 8px;
      max-height: 140px;
      overflow: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="sectionTitle">Prompt</div>
  <select id="promptSelect">
    <option value="">Loading…</option>
  </select>
  <div class="row">
    <button class="secondary" id="editPrompt">Edit</button>
    <button class="secondary" id="newPrompt">New</button>
    <button class="secondary" id="deletePrompt">Delete</button>
  </div>

  <div class="row">
    <button class="secondary" id="settings">Settings</button>
  </div>

  <div class="row">
    <button class="primary" id="run">Run Code Review</button>
  </div>

  <div class="sectionTitle" style="margin-top:16px;">Activity</div>
  <div class="small" id="statusLine">Idle</div>
  <div class="list" id="activityList">(no activity)</div>

  <div class="sectionTitle" style="margin-top:16px;">Usage</div>
  <div class="small" id="usageLine">N/A</div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const promptSelect = document.getElementById('promptSelect');
    const runBtn = document.getElementById('run');
    const settingsBtn = document.getElementById('settings');
    const editPromptBtn = document.getElementById('editPrompt');
    const newPromptBtn = document.getElementById('newPrompt');
    const deletePromptBtn = document.getElementById('deletePrompt');
    const statusLine = document.getElementById('statusLine');
    const activityList = document.getElementById('activityList');
    const usageLine = document.getElementById('usageLine');

    vscode.postMessage({ type: 'init' });

    runBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'runReview' });
    });

    settingsBtn.addEventListener('click', () => vscode.postMessage({ type: 'openSettings' }));

    promptSelect.addEventListener('change', () => {
      if (!promptSelect.value) return;
      vscode.postMessage({ type: 'selectPrompt', promptId: promptSelect.value });
    });

    editPromptBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'editPrompt', promptId: promptSelect.value });
    });
    newPromptBtn.addEventListener('click', () => vscode.postMessage({ type: 'newPrompt' }));
    deletePromptBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'deletePrompt', promptId: promptSelect.value });
    });

    function setStatus(text) {
      statusLine.textContent = text;
    }
    function setUsage(text) {
      usageLine.textContent = text;
    }
    function setActivity(lines) {
      if (!lines || lines.length === 0) {
        activityList.textContent = '(no activity)';
        return;
      }
      activityList.textContent = lines.join('\\n');
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'state': {
          setStatus(msg.isReviewing ? 'Reviewing…' : 'Idle');
          setActivity(msg.activity || []);
          setUsage(msg.usageText || 'N/A');
          const disabled = !!msg.isReviewing;
          runBtn.disabled = disabled;
          promptSelect.disabled = disabled;
          editPromptBtn.disabled = disabled;
          newPromptBtn.disabled = disabled;
          deletePromptBtn.disabled = disabled;

          // prompts
          if (Array.isArray(msg.prompts)) {
            promptSelect.innerHTML = msg.prompts
              .map((p) => \`<option value="\${p.id}" \${p.id === msg.activePromptId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`)
              .join('');
          }
          break;
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

  return { html, nonce };
}
