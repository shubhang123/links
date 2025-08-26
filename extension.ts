import * as vscode from 'vscode';
import * as path from 'path';

// Simple diff implementation without external dependencies
interface DiffPart {
    value: string;
    added?: boolean;
    removed?: boolean;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Text Diff & Formatter extension is now active!');

    // Register the webview provider for the activity bar
    const provider = new TextDiffViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('textdiff.diffView', provider)
    );

    // Register commands
    const openDiffView = vscode.commands.registerCommand('textdiff.openDiffView', () => {
        vscode.commands.executeCommand('textdiff.diffView.focus');
    });

    const compareSelectedFiles = vscode.commands.registerCommand('textdiff.compareSelectedFiles', async (uri: vscode.Uri) => {
        await compareFilesWithFormatting(uri);
    });

    const formatAndCompare = vscode.commands.registerCommand('textdiff.formatAndCompare', async () => {
        await formatAndCompareSelection();
    });

    const focusCommand = vscode.commands.registerCommand('textdiff.focus', () => {
        provider.focus();
    });

    context.subscriptions.push(openDiffView, compareSelectedFiles, formatAndCompare, focusCommand);
}

class TextDiffViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'compare':
                        await this._handleCompare(message.leftText, message.rightText, message.options);
                        return;
                    case 'format':
                        await this._handleFormat(message.text, message.language);
                        return;
                }
            }
        );
    }

    public focus() {
        if (this._view) {
            this._view.show?.(true);
        }
    }

    private async _handleCompare(leftText: string, rightText: string, options: any) {
        try {
            const config = vscode.workspace.getConfiguration('textdiff');

            let processedLeftText = leftText;
            let processedRightText = rightText;

            // Auto-format if enabled
            if (config.get('autoFormat') && options.language) {
                processedLeftText = await this._formatText(leftText, options.language);
                processedRightText = await this._formatText(rightText, options.language);
            }

            // Generate inline diff with colors
            const diffResult = this._generateInlineDiff(processedLeftText, processedRightText, options.diffType || 'lines');

            // Send diff result to webview
            this._view?.webview.postMessage({
                command: 'showDiff',
                diffResult: diffResult,
                success: true
            });

            // Also open traditional VS Code diff if requested
            if (options.openVSCodeDiff) {
                const leftUri = vscode.Uri.parse(`untitled:left.${options.language || 'txt'}`);
                const rightUri = vscode.Uri.parse(`untitled:right.${options.language || 'txt'}`);

                const leftDoc = await vscode.workspace.openTextDocument(leftUri);
                const rightDoc = await vscode.workspace.openTextDocument(rightUri);

                const leftEditor = await vscode.window.showTextDocument(leftDoc, { viewColumn: vscode.ViewColumn.One, preview: false });
                const rightEditor = await vscode.window.showTextDocument(rightDoc, { viewColumn: vscode.ViewColumn.Two, preview: false });

                await leftEditor.edit(editBuilder => {
                    editBuilder.insert(new vscode.Position(0, 0), processedLeftText);
                });

                await rightEditor.edit(editBuilder => {
                    editBuilder.insert(new vscode.Position(0, 0), processedRightText);
                });

                await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, 'Text Comparison');
            }

        } catch (error) {
            this._view?.webview.postMessage({
                command: 'showError',
                message: `Error: ${error}`,
                success: false
            });
        }
    }

    private _generateInlineDiff(leftText: string, rightText: string, diffType: string): any {
        let diffResult: DiffPart[];

        switch (diffType) {
            case 'words':
                diffResult = this._diffWords(leftText, rightText);
                break;
            case 'chars':
                diffResult = this._diffChars(leftText, rightText);
                break;
            case 'lines':
            default:
                diffResult = this._diffLines(leftText, rightText);
                break;
        }

        // Process diff result for HTML rendering
        const leftHtml: string[] = [];
        const rightHtml: string[] = [];

        diffResult.forEach((part: DiffPart) => {
            const value = this._escapeHtml(part.value);

            if (part.removed) {
                // Red background for removed content (left side)
                leftHtml.push(`<span class="diff-removed">${value}</span>`);
            } else if (part.added) {
                // Green background for added content (right side)  
                rightHtml.push(`<span class="diff-added">${value}</span>`);
            } else {
                // No change - same on both sides
                leftHtml.push(`<span class="diff-unchanged">${value}</span>`);
                rightHtml.push(`<span class="diff-unchanged">${value}</span>`);
            }
        });

        return {
            left: leftHtml.join(''),
            right: rightHtml.join(''),
            type: diffType,
            hasChanges: diffResult.some((part: DiffPart) => part.added || part.removed)
        };
    }

    private _diffLines(text1: string, text2: string): DiffPart[] {
        const lines1 = text1.split('\n');
        const lines2 = text2.split('\n');
        const result: DiffPart[] = [];

        let i = 0, j = 0;

        while (i < lines1.length || j < lines2.length) {
            if (i >= lines1.length) {
                // Only text2 has remaining lines
                result.push({ value: lines2[j] + '\n', added: true });
                j++;
            } else if (j >= lines2.length) {
                // Only text1 has remaining lines
                result.push({ value: lines1[i] + '\n', removed: true });
                i++;
            } else if (lines1[i] === lines2[j]) {
                // Lines are the same
                result.push({ value: lines1[i] + '\n' });
                i++;
                j++;
            } else {
                // Lines are different
                result.push({ value: lines1[i] + '\n', removed: true });
                result.push({ value: lines2[j] + '\n', added: true });
                i++;
                j++;
            }
        }

        return result;
    }

    private _diffWords(text1: string, text2: string): DiffPart[] {
        const words1 = text1.split(/\s+/);
        const words2 = text2.split(/\s+/);
        const result: DiffPart[] = [];

        let i = 0, j = 0;

        while (i < words1.length || j < words2.length) {
            if (i >= words1.length) {
                result.push({ value: words2[j] + ' ', added: true });
                j++;
            } else if (j >= words2.length) {
                result.push({ value: words1[i] + ' ', removed: true });
                i++;
            } else if (words1[i] === words2[j]) {
                result.push({ value: words1[i] + ' ' });
                i++;
                j++;
            } else {
                result.push({ value: words1[i] + ' ', removed: true });
                result.push({ value: words2[j] + ' ', added: true });
                i++;
                j++;
            }
        }

        return result;
    }

    private _diffChars(text1: string, text2: string): DiffPart[] {
        const result: DiffPart[] = [];
        let i = 0, j = 0;

        while (i < text1.length || j < text2.length) {
            if (i >= text1.length) {
                result.push({ value: text2[j], added: true });
                j++;
            } else if (j >= text2.length) {
                result.push({ value: text1[i], removed: true });
                i++;
            } else if (text1[i] === text2[j]) {
                result.push({ value: text1[i] });
                i++;
                j++;
            } else {
                result.push({ value: text1[i], removed: true });
                result.push({ value: text2[j], added: true });
                i++;
                j++;
            }
        }

        return result;
    }

    private _escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, '<br>');
    }

    private async _handleFormat(text: string, language: string) {
        try {
            const formattedText = await this._formatText(text, language);
            this._view?.webview.postMessage({
                command: 'formatResult',
                success: true,
                formattedText: formattedText
            });
        } catch (error) {
            this._view?.webview.postMessage({
                command: 'formatResult',
                success: false,
                message: `Error formatting: ${error}`
            });
        }
    }

    private async _formatText(text: string, language: string): Promise<string> {
        try {
            const uri = vscode.Uri.parse(`untitled:temp.${language}`);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });

            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(0, 0), text);
            });

            await vscode.commands.executeCommand('editor.action.formatDocument');

            const formattedText = doc.getText();
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

            return formattedText;
        } catch (error) {
            console.error('Formatting error:', error);
            return text;
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Text Diff & Formatter</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 10px;
                    background-color: var(--vscode-sideBar-background);
                    color: var(--vscode-sideBar-foreground);
                    margin: 0;
                    font-size: 12px;
                }

                .header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-sideBar-border);
                }

                .header-icon {
                    margin-right: 8px;
                    font-size: 16px;
                }

                .header-title {
                    font-weight: bold;
                    font-size: 13px;
                }

                .section {
                    margin-bottom: 20px;
                }

                .section-title {
                    font-size: 11px;
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: var(--vscode-sideBarSectionHeader-foreground);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .text-input {
                    width: 100%;
                    min-height: 60px;
                    padding: 6px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family);
                    font-size: 11px;
                    resize: vertical;
                    box-sizing: border-box;
                }

                .controls {
                    margin: 8px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .control-row {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                }

                .button {
                    padding: 5px 10px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    white-space: nowrap;
                    flex: 1;
                    text-align: center;
                }

                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .button.primary {
                    background-color: var(--vscode-button-background);
                }

                .button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .select {
                    padding: 3px;
                    background-color: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    border-radius: 2px;
                    font-size: 11px;
                    flex: 1;
                }

                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                }

                .diff-result {
                    margin-top: 10px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 3px;
                    overflow: hidden;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .diff-header {
                    background-color: var(--vscode-panel-background);
                    padding: 6px 8px;
                    font-size: 11px;
                    font-weight: bold;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .diff-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    background-color: var(--vscode-editor-background);
                }

                .diff-side {
                    padding: 8px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 11px;
                    line-height: 1.3;
                    overflow-wrap: break-word;
                    white-space: pre-wrap;
                }

                .diff-side:first-child {
                    border-right: 1px solid var(--vscode-panel-border);
                }

                .diff-side-title {
                    font-weight: bold;
                    margin-bottom: 6px;
                    padding-bottom: 3px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .diff-removed {
                    background-color: #ff334420;
                    color: #ff6b6b;
                    text-decoration: line-through;
                    padding: 1px 2px;
                    border-radius: 2px;
                }

                .diff-added {
                    background-color: #51cf6620;
                    color: #51cf66;
                    padding: 1px 2px;
                    border-radius: 2px;
                }

                .diff-unchanged {
                    color: var(--vscode-editor-foreground);
                }

                .status {
                    padding: 6px;
                    margin: 6px 0;
                    border-radius: 3px;
                    font-size: 11px;
                }

                .status.success {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    color: var(--vscode-inputValidation-infoForeground);
                    border: 1px solid var(--vscode-inputValidation-infoBorder);
                }

                .status.error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                }

                .no-changes {
                    text-align: center;
                    padding: 15px;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    font-size: 11px;
                }

                .diff-stats {
                    font-size: 9px;
                    color: var(--vscode-descriptionForeground);
                }

                .collapsible {
                    margin-top: 8px;
                }

                .collapsible-header {
                    background-color: var(--vscode-sideBarSectionHeader-background);
                    padding: 5px 8px;
                    cursor: pointer;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 3px;
                    font-size: 11px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .collapsible-content {
                    border: 1px solid var(--vscode-panel-border);
                    border-top: none;
                    border-radius: 0 0 3px 3px;
                    padding: 8px;
                    background-color: var(--vscode-editor-background);
                    display: none;
                }

                .collapsible-content.show {
                    display: block;
                }

                .file-input {
                    width: 100%;
                    padding: 3px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-size: 10px;
                    margin-bottom: 6px;
                }

                .icon {
                    margin-right: 4px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <span class="header-icon">📊</span>
                <span class="header-title">Text Diff & Formatter</span>
            </div>

            <div class="section">
                <div class="section-title">📝 Text Comparison</div>

                <div>
                    <textarea id="leftText" class="text-input" placeholder="Original text..."></textarea>
                </div>

                <div style="margin: 6px 0;">
                    <textarea id="rightText" class="text-input" placeholder="Modified text..."></textarea>
                </div>

                <div class="controls">
                    <div class="control-row">
                        <select id="language" class="select">
                            <option value="txt">Text</option>
                            <option value="javascript">JS</option>
                            <option value="typescript">TS</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="html">HTML</option>
                            <option value="css">CSS</option>
                            <option value="json">JSON</option>
                        </select>
                        <select id="diffType" class="select">
                            <option value="lines">Lines</option>
                            <option value="words">Words</option>
                            <option value="chars">Chars</option>
                        </select>
                    </div>

                    <div class="control-row">
                        <div class="checkbox-container">
                            <input type="checkbox" id="autoFormat" checked>
                            <label for="autoFormat">Auto-format</label>
                        </div>
                    </div>

                    <div class="control-row">
                        <button id="compareBtn" class="button primary">🔍 Compare</button>
                    </div>

                    <div class="control-row">
                        <button id="openVSCodeBtn" class="button secondary">📋 VS Diff</button>
                    </div>
                </div>
            </div>

            <div class="collapsible">
                <div class="collapsible-header" onclick="toggleCollapsible('fileSection')">
                    <span><span class="icon">📁</span>Files</span>
                    <span id="fileSectionToggle">▼</span>
                </div>
                <div class="collapsible-content" id="fileSection">
                    <input type="file" id="leftFile" class="file-input" accept=".txt,.js,.ts,.py,.java,.html,.css,.json">
                    <input type="file" id="rightFile" class="file-input" accept=".txt,.js,.ts,.py,.java,.html,.css,.json">
                    <button id="compareFilesBtn" class="button">📊 Compare Files</button>
                </div>
            </div>

            <div id="diffResult" class="diff-result" style="display: none;">
                <div class="diff-header">
                    <span>📊 Differences</span>
                    <span id="diffStats" class="diff-stats"></span>
                </div>
                <div id="diffContent" class="diff-content">
                    <div class="diff-side">
                        <div class="diff-side-title">🔴 Original</div>
                        <div id="leftDiff"></div>
                    </div>
                    <div class="diff-side">
                        <div class="diff-side-title">🟢 Modified</div>
                        <div id="rightDiff"></div>
                    </div>
                </div>
            </div>

            <div id="status"></div>

            <script>
                const vscode = acquireVsCodeApi();

                // Elements
                const leftText = document.getElementById('leftText');
                const rightText = document.getElementById('rightText');
                const language = document.getElementById('language');
                const diffType = document.getElementById('diffType');
                const autoFormat = document.getElementById('autoFormat');
                const compareBtn = document.getElementById('compareBtn');
                const openVSCodeBtn = document.getElementById('openVSCodeBtn');
                const leftFile = document.getElementById('leftFile');
                const rightFile = document.getElementById('rightFile');
                const compareFilesBtn = document.getElementById('compareFilesBtn');
                const diffResult = document.getElementById('diffResult');
                const leftDiff = document.getElementById('leftDiff');
                const rightDiff = document.getElementById('rightDiff');
                const diffStats = document.getElementById('diffStats');
                const status = document.getElementById('status');

                // Event listeners
                compareBtn.addEventListener('click', () => {
                    const left = leftText.value.trim();
                    const right = rightText.value.trim();

                    if (!left || !right) {
                        showStatus('Please enter text in both fields.', 'error');
                        return;
                    }

                    vscode.postMessage({
                        command: 'compare',
                        leftText: left,
                        rightText: right,
                        options: {
                            language: language.value,
                            autoFormat: autoFormat.checked,
                            diffType: diffType.value,
                            openVSCodeDiff: false
                        }
                    });

                    showStatus('Comparing texts...', 'success');
                });

                openVSCodeBtn.addEventListener('click', () => {
                    const left = leftText.value.trim();
                    const right = rightText.value.trim();

                    if (!left || !right) {
                        showStatus('Please enter text in both fields.', 'error');
                        return;
                    }

                    vscode.postMessage({
                        command: 'compare',
                        leftText: left,
                        rightText: right,
                        options: {
                            language: language.value,
                            autoFormat: autoFormat.checked,
                            diffType: diffType.value,
                            openVSCodeDiff: true
                        }
                    });
                });

                leftFile.addEventListener('change', handleFileSelect);
                rightFile.addEventListener('change', handleFileSelect);

                compareFilesBtn.addEventListener('click', () => {
                    if (!leftFile.files[0] || !rightFile.files[0]) {
                        showStatus('Please select both files.', 'error');
                        return;
                    }

                    const file1 = leftFile.files[0];
                    const file2 = rightFile.files[0];

                    Promise.all([
                        readFileAsText(file1),
                        readFileAsText(file2)
                    ]).then(([text1, text2]) => {
                        leftText.value = text1;
                        rightText.value = text2;

                        // Auto-detect language
                        const ext = file1.name.split('.').pop().toLowerCase();
                        const langMap = {
                            'js': 'javascript',
                            'ts': 'typescript',
                            'py': 'python',
                            'java': 'java',
                            'html': 'html',
                            'css': 'css',
                            'json': 'json'
                        };

                        if (langMap[ext]) {
                            language.value = langMap[ext];
                        }

                        // Auto-compare
                        compareBtn.click();

                    }).catch(error => {
                        showStatus('Error reading files: ' + error.message, 'error');
                    });
                });

                // Message handling
                window.addEventListener('message', event => {
                    const message = event.data;

                    switch (message.command) {
                        case 'showDiff':
                            displayDiff(message.diffResult);
                            showStatus('Comparison completed!', 'success');
                            break;

                        case 'showError':
                            showStatus(message.message, 'error');
                            break;

                        case 'formatResult':
                            if (message.success) {
                                showStatus('Formatted!', 'success');
                            } else {
                                showStatus(message.message, 'error');
                            }
                            break;
                    }
                });

                // Helper functions
                function displayDiff(diffData) {
                    if (!diffData.hasChanges) {
                        diffResult.innerHTML = '<div class="no-changes">✅ No differences found</div>';
                        diffStats.textContent = 'Identical';
                    } else {
                        leftDiff.innerHTML = diffData.left;
                        rightDiff.innerHTML = diffData.right;
                        diffStats.textContent = diffData.type + ' diff';
                    }

                    diffResult.style.display = 'block';
                }

                function showStatus(message, type) {
                    status.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
                    setTimeout(() => {
                        status.innerHTML = '';
                    }, 3000);
                }

                function handleFileSelect(event) {
                    const file = event.target.files[0];
                    if (file) {
                        showStatus('📁 ' + file.name, 'success');
                    }
                }

                function readFileAsText(file) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target.result);
                        reader.onerror = e => reject(new Error('Error reading file'));
                        reader.readAsText(file);
                    });
                }

                function toggleCollapsible(id) {
                    const content = document.getElementById(id);
                    const toggle = document.getElementById(id + 'Toggle');

                    if (content.classList.contains('show')) {
                        content.classList.remove('show');
                        toggle.textContent = '▼';
                    } else {
                        content.classList.add('show');
                        toggle.textContent = '▲';
                    }
                }

                // Auto-save preferences
                function saveState() {
                    vscode.setState({
                        leftText: leftText.value,
                        rightText: rightText.value,
                        language: language.value,
                        diffType: diffType.value,
                        autoFormat: autoFormat.checked
                    });
                }

                function restoreState() {
                    const state = vscode.getState();
                    if (state) {
                        leftText.value = state.leftText || '';
                        rightText.value = state.rightText || '';
                        language.value = state.language || 'txt';
                        diffType.value = state.diffType || 'lines';
                        autoFormat.checked = state.autoFormat !== undefined ? state.autoFormat : true;
                    }
                }

                // Event listeners for state saving
                leftText.addEventListener('input', saveState);
                rightText.addEventListener('input', saveState);
                language.addEventListener('change', saveState);
                diffType.addEventListener('change', saveState);
                autoFormat.addEventListener('change', saveState);

                // Restore state on load
                restoreState();
            </script>
        </body>
        </html>`;
    }
}

async function compareFilesWithFormatting(uri: vscode.Uri) {
    if (!uri) {
        vscode.window.showErrorMessage('No file selected');
        return;
    }

    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select file to compare with',
        filters: {
            'Text files': ['txt', 'js', 'ts', 'py', 'java', 'cs', 'cpp', 'html', 'css', 'json', 'xml', 'md'],
            'All files': ['*']
        }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (!fileUri || fileUri.length === 0) {
        return;
    }

    const config = vscode.workspace.getConfiguration('textdiff');
    const shouldFormat = config.get('autoFormat', true);

    if (shouldFormat) {
        await formatFileIfPossible(uri);
        await formatFileIfPossible(fileUri[0]);
    }

    await vscode.commands.executeCommand('vscode.diff', uri, fileUri[0], `Compare ${path.basename(uri.path)} ↔ ${path.basename(fileUri[0].path)}`);
}

async function formatFileIfPossible(uri: vscode.Uri) {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        await vscode.commands.executeCommand('editor.action.formatDocument');
        await document.save();
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } catch (error) {
        console.log(`Could not format file ${uri.path}: ${error}`);
    }
}

async function formatAndCompareSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showErrorMessage('No text selected');
        return;
    }

    const newDoc = await vscode.workspace.openTextDocument({
        content: selectedText,
        language: editor.document.languageId
    });

    const newEditor = await vscode.window.showTextDocument(newDoc, vscode.ViewColumn.Beside);
    await vscode.commands.executeCommand('editor.action.formatDocument');

    const originalUri = vscode.Uri.parse(`untitled:original.${editor.document.languageId}`);
    const formattedUri = newDoc.uri;

    const originalDoc = await vscode.workspace.openTextDocument(originalUri);
    const originalEditor = await vscode.window.showTextDocument(originalDoc, { preview: false });

    await originalEditor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(0, 0), selectedText);
    });

    await vscode.commands.executeCommand('vscode.diff', originalUri, formattedUri, 'Original ↔ Formatted');
}

export function deactivate() {}
