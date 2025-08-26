// Monaco Workspace Application
class MonacoWorkspace {
    constructor() {
        this.currentUser = null;
        this.editors = {};
        this.diffEditor = null;
        this.snippetEditor = null;
        this.autoSaveTimer = null;
        this.diffTimer = null;
        this.monacoLoaded = false;
        this.languages = [
            { id: 'javascript', name: 'JavaScript', icon: '🟨', sample: "function hello() {\n    console.log('Hello World!');\n    return true;\n}" },
            { id: 'typescript', name: 'TypeScript', icon: '🔷', sample: "interface User {\n    name: string;\n    age: number;\n}\n\nfunction greet(user: User): string {\n    return `Hello ${user.name}!`;\n}" },
            { id: 'python', name: 'Python', icon: '🐍', sample: "def hello_world():\n    print('Hello World!')\n    return True\n\nif __name__ == '__main__':\n    hello_world()" },
            { id: 'html', name: 'HTML', icon: '🌐', sample: "<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n</body>\n</html>" },
            { id: 'css', name: 'CSS', icon: '🎨', sample: ".container {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    height: 100vh;\n}" },
            { id: 'json', name: 'JSON', icon: '📄', sample: "{\n  \"name\": \"example\",\n  \"version\": \"1.0.0\",\n  \"description\": \"A sample JSON file\"\n}" }
        ];
        this.categories = [
            { id: 'development', name: 'Development', color: '#3498db' },
            { id: 'design', name: 'Design', color: '#e74c3c' },
            { id: 'documentation', name: 'Documentation', color: '#2ecc71' },
            { id: 'tools', name: 'Tools', color: '#f39c12' },
            { id: 'learning', name: 'Learning', color: '#9b59b6' },
            { id: 'reference', name: 'Reference', color: '#34495e' }
        ];
        
        this.init();
    }

    async init() {
        try {
            this.bindEvents();
            this.initAuth();
            // Don't load Monaco until after authentication
        } catch (error) {
            console.error('Initialization error:', error);
            this.showSnackbar('Application initialization failed', 'error');
        }
    }

    async loadMonaco() {
        try {
            if (this.monacoLoaded) return Promise.resolve();
            
            return new Promise((resolve, reject) => {
                // Set up Monaco configuration
                require.config({ 
                    paths: { 
                        vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' 
                    }
                });
                
                // Add timeout for Monaco loading
                const timeout = setTimeout(() => {
                    reject(new Error('Monaco Editor loading timeout'));
                }, 10000);
                
                require(['vs/editor/editor.main'], () => {
                    clearTimeout(timeout);
                    try {
                        // Set VS Code Dark theme
                        monaco.editor.setTheme('vs-dark');
                        this.monacoLoaded = true;
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } catch (error) {
            console.error('Monaco loading error:', error);
            throw error;
        }
    }

    initAuth() {
        const savedUser = localStorage.getItem('monacoWorkspaceUser');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.showApp();
            } catch (error) {
                console.error('Error loading saved user:', error);
                this.showAuthModal();
            }
        } else {
            this.showAuthModal();
        }
    }

    showAuthModal() {
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }

    async showApp() {
        try {
            document.getElementById('authModal').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            document.getElementById('userEmail').textContent = this.currentUser.email;
            
            // Show loading state
            this.showSnackbar('Loading Monaco Editor...', 'info');
            
            // Load Monaco Editor
            await this.loadMonaco();
            
            // Initialize editors after Monaco is loaded
            await this.initEditors();
            
            // Load user data
            this.loadUserData();
            
            // Show success message
            this.showSnackbar('Workspace loaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error showing app:', error);
            this.showSnackbar('Failed to load workspace. Using fallback mode.', 'warning');
            // Continue without Monaco editors - show basic UI
            this.initFallbackMode();
        }
    }

    initFallbackMode() {
        // Hide editor containers and show message
        const editorContainers = document.querySelectorAll('.editor');
        editorContainers.forEach(container => {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Code editor unavailable. Please refresh to try again.</div>';
        });
        
        // Load other sections that don't require Monaco
        this.renderSnippets();
        this.renderLinks();
    }

    async initEditors() {
        try {
            if (!window.monaco) {
                throw new Error('Monaco Editor not available');
            }

            // Initialize diff editors
            this.editors.original = monaco.editor.create(document.getElementById('originalEditor'), {
                value: this.languages[0].sample,
                language: 'javascript',
                theme: 'vs-dark',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true
            });

            this.editors.modified = monaco.editor.create(document.getElementById('modifiedEditor'), {
                value: this.languages[0].sample + '\n// Modified version',
                language: 'javascript',
                theme: 'vs-dark',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true
            });

            // Initialize text editor
            this.editors.text = monaco.editor.create(document.getElementById('textEditor'), {
                value: '// Welcome to Monaco Workspace\n// Start typing your document here...',
                language: 'markdown',
                theme: 'vs-dark',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on'
            });

            // Initialize diff editor
            this.diffEditor = monaco.editor.createDiffEditor(document.getElementById('diffEditor'), {
                theme: 'vs-dark',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true
            });

            // Set up real-time diff updates
            this.editors.original.onDidChangeModelContent(() => {
                this.debouncedDiffUpdate();
            });

            this.editors.modified.onDidChangeModelContent(() => {
                this.debouncedDiffUpdate();
            });

            // Set up text editor auto-save
            this.editors.text.onDidChangeModelContent(() => {
                this.updateTextStats();
                this.debouncedAutoSave();
            });

            // Initial stats update
            this.updateTextStats();

            // Initialize snippet editor after a delay to ensure modal is ready
            setTimeout(() => {
                try {
                    if (document.getElementById('snippetCodeEditor')) {
                        this.snippetEditor = monaco.editor.create(document.getElementById('snippetCodeEditor'), {
                            value: '',
                            language: 'javascript',
                            theme: 'vs-dark',
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            lineNumbers: 'off',
                            folding: false
                        });
                    }
                } catch (error) {
                    console.warn('Could not initialize snippet editor:', error);
                }
            }, 500);

        } catch (error) {
            console.error('Editor initialization error:', error);
            throw error;
        }
    }

    debouncedDiffUpdate() {
        clearTimeout(this.diffTimer);
        this.diffTimer = setTimeout(() => {
            this.updateDiffEditor();
        }, 500);
    }

    debouncedAutoSave() {
        document.getElementById('autoSaveStatus').textContent = 'Saving...';
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.autoSaveDocument();
        }, 30000);
    }

    updateDiffEditor() {
        try {
            if (!this.diffEditor || !window.monaco) return;

            const originalModel = monaco.editor.createModel(
                this.editors.original.getValue(),
                this.editors.original.getModel().getLanguageId()
            );

            const modifiedModel = monaco.editor.createModel(
                this.editors.modified.getValue(),
                this.editors.modified.getModel().getLanguageId()
            );

            this.diffEditor.setModel({
                original: originalModel,
                modified: modifiedModel
            });

            this.updateDiffStats();
        } catch (error) {
            console.error('Diff update error:', error);
        }
    }

    updateDiffStats() {
        try {
            const originalLines = this.editors.original.getValue().split('\n');
            const modifiedLines = this.editors.modified.getValue().split('\n');
            
            let additions = 0;
            let deletions = 0;
            let changes = 0;

            // Simple diff calculation
            const maxLines = Math.max(originalLines.length, modifiedLines.length);
            
            for (let i = 0; i < maxLines; i++) {
                const originalLine = originalLines[i] || '';
                const modifiedLine = modifiedLines[i] || '';
                
                if (originalLine !== modifiedLine) {
                    if (!originalLine) {
                        additions++;
                    } else if (!modifiedLine) {
                        deletions++;
                    } else {
                        changes++;
                    }
                }
            }

            document.getElementById('additions').textContent = additions;
            document.getElementById('deletions').textContent = deletions;
            document.getElementById('changes').textContent = changes;
        } catch (error) {
            console.error('Diff stats error:', error);
        }
    }

    updateTextStats() {
        try {
            const content = this.editors.text ? this.editors.text.getValue() : '';
            const chars = content.length;
            const words = content.trim() ? content.trim().split(/\s+/).length : 0;
            const lines = content.split('\n').length;

            document.getElementById('charCount').textContent = chars;
            document.getElementById('wordCount').textContent = words;
            document.getElementById('lineCount').textContent = lines;
        } catch (error) {
            console.error('Text stats error:', error);
        }
    }

    bindEvents() {
        // Authentication
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('emailInput').value.trim();
            if (this.isValidEmail(email)) {
                this.currentUser = { email };
                localStorage.setItem('monacoWorkspaceUser', JSON.stringify(this.currentUser));
                this.showApp();
            } else {
                this.showSnackbar('Please enter a valid email address', 'error');
            }
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('monacoWorkspaceUser');
            location.reload();
        });

        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchSection(tab.dataset.section);
            });
        });

        // Diff & Format controls
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });

        document.getElementById('compareBtn').addEventListener('click', () => {
            this.showDiffResults();
        });

        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatCode();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearEditors();
        });

        // Text editor controls
        document.getElementById('saveDocBtn').addEventListener('click', () => {
            this.saveDocument();
        });

        document.getElementById('loadDocBtn').addEventListener('click', () => {
            this.showDocumentsList();
        });

        document.getElementById('exportDocBtn').addEventListener('click', () => {
            this.exportDocument();
        });

        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Snippets controls
        document.getElementById('addSnippetBtn').addEventListener('click', () => {
            this.showSnippetModal();
        });

        document.getElementById('snippetSearch').addEventListener('input', (e) => {
            this.filterSnippets(e.target.value);
        });

        document.getElementById('snippetLanguage').addEventListener('change', (e) => {
            this.filterSnippets(null, e.target.value);
        });

        // Links controls
        document.getElementById('addLinkBtn').addEventListener('click', () => {
            this.showLinkModal();
        });

        document.getElementById('linkSearch').addEventListener('input', (e) => {
            this.filterLinks(e.target.value);
        });

        document.getElementById('linkCategory').addEventListener('change', (e) => {
            this.filterLinks(null, e.target.value);
        });

        // Modal events
        document.querySelectorAll('.modal__close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        document.getElementById('snippetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSnippet();
        });

        document.getElementById('linkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLink();
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    switchSection(sectionName) {
        // Update tab states
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('nav-tab--active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('nav-tab--active');

        // Update section visibility
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('section--active');
        });
        document.getElementById(`${sectionName}Section`).classList.add('section--active');

        // Refresh editors when switching sections
        setTimeout(() => {
            if (sectionName === 'diff') {
                this.editors.original?.layout();
                this.editors.modified?.layout();
                this.diffEditor?.layout();
            }

            if (sectionName === 'editor') {
                this.editors.text?.layout();
            }
        }, 100);

        // Load data when switching sections
        if (sectionName === 'snippets') {
            this.renderSnippets();
        }

        if (sectionName === 'links') {
            this.renderLinks();
        }
    }

    changeLanguage(language) {
        try {
            const lang = this.languages.find(l => l.id === language);
            if (!lang || !this.editors.original || !this.editors.modified) return;

            // Don't reset content, just change language
            monaco.editor.setModelLanguage(this.editors.original.getModel(), language);
            monaco.editor.setModelLanguage(this.editors.modified.getModel(), language);

            this.showSnackbar(`Language changed to ${lang.name}`, 'info');
        } catch (error) {
            console.error('Language change error:', error);
            this.showSnackbar('Error changing language', 'error');
        }
    }

    showDiffResults() {
        try {
            document.getElementById('diffStats').style.display = 'flex';
            document.getElementById('diffEditor').style.display = 'block';
            
            this.updateDiffEditor();
            this.showSnackbar('Diff comparison updated', 'success');
            
            // Scroll to diff results
            document.getElementById('diffEditor').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Show diff results error:', error);
            this.showSnackbar('Error showing diff results', 'error');
        }
    }

    async formatCode() {
        try {
            if (!this.editors.original || !this.editors.modified) {
                this.showSnackbar('Editors not available for formatting', 'error');
                return;
            }

            // Format original editor
            await this.editors.original.getAction('editor.action.formatDocument').run();
            // Format modified editor  
            await this.editors.modified.getAction('editor.action.formatDocument').run();
            
            this.showSnackbar('Code formatted successfully', 'success');
        } catch (error) {
            console.error('Format error:', error);
            this.showSnackbar('Error formatting code', 'error');
        }
    }

    clearEditors() {
        try {
            if (!this.editors.original || !this.editors.modified) return;

            const currentLang = this.editors.original.getModel().getLanguageId();
            const sample = this.languages.find(l => l.id === currentLang)?.sample || '';
            
            this.editors.original.setValue(sample);
            this.editors.modified.setValue(sample);
            
            // Hide diff results
            document.getElementById('diffStats').style.display = 'none';
            document.getElementById('diffEditor').style.display = 'none';
            
            this.showSnackbar('Editors cleared', 'info');
        } catch (error) {
            console.error('Clear editors error:', error);
            this.showSnackbar('Error clearing editors', 'error');
        }
    }

    saveDocument() {
        const title = document.getElementById('docTitle').value.trim();
        if (!title) {
            this.showSnackbar('Please enter a document title', 'error');
            return;
        }

        const content = this.editors.text ? this.editors.text.getValue() : '';
        const doc = {
            id: Date.now().toString(),
            title,
            content,
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };

        const userData = this.getUserData();
        userData.documents = userData.documents || [];
        
        // Check if updating existing document
        const existingIndex = userData.documents.findIndex(d => d.title === title);
        if (existingIndex >= 0) {
            userData.documents[existingIndex] = { ...userData.documents[existingIndex], ...doc, id: userData.documents[existingIndex].id };
        } else {
            userData.documents.push(doc);
        }
        
        this.saveUserData(userData);
        this.showSnackbar(`Document "${title}" saved successfully`, 'success');
        document.getElementById('autoSaveStatus').textContent = 'Saved';
    }

    autoSaveDocument() {
        const title = document.getElementById('docTitle').value.trim();
        if (!title) {
            document.getElementById('autoSaveStatus').textContent = 'Ready';
            return;
        }

        const userData = this.getUserData();
        userData.documents = userData.documents || [];
        
        const existingDoc = userData.documents.find(d => d.title === title);
        if (existingDoc && this.editors.text) {
            existingDoc.content = this.editors.text.getValue();
            existingDoc.modified = new Date().toISOString();
            this.saveUserData(userData);
            document.getElementById('autoSaveStatus').textContent = 'Auto-saved';
        } else {
            document.getElementById('autoSaveStatus').textContent = 'Ready';
        }
    }

    showDocumentsList() {
        const userData = this.getUserData();
        const documents = userData.documents || [];
        
        const listContainer = document.getElementById('documentsList');
        
        if (documents.length === 0) {
            listContainer.innerHTML = '<div class="empty-state"><div class="empty-state__title">No Documents</div><div class="empty-state__description">Create and save your first document</div></div>';
        } else {
            listContainer.innerHTML = documents.map(doc => `
                <div class="document-item" data-id="${doc.id}">
                    <div class="document-item__info">
                        <div class="document-item__title">${this.escapeHtml(doc.title)}</div>
                        <div class="document-item__date">Modified: ${new Date(doc.modified).toLocaleDateString()}</div>
                    </div>
                    <div class="document-item__actions">
                        <button class="btn btn--sm btn--outline" onclick="workspace.loadDocument('${doc.id}')">Load</button>
                        <button class="btn btn--sm btn--outline" onclick="workspace.deleteDocument('${doc.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }
        
        document.getElementById('docListModal').classList.remove('hidden');
    }

    loadDocument(id) {
        const userData = this.getUserData();
        const doc = userData.documents?.find(d => d.id === id);
        
        if (doc) {
            document.getElementById('docTitle').value = doc.title;
            if (this.editors.text) {
                this.editors.text.setValue(doc.content);
            }
            this.closeModal(document.getElementById('docListModal'));
            this.showSnackbar(`Document "${doc.title}" loaded`, 'success');
            this.switchSection('editor');
        }
    }

    deleteDocument(id) {
        const userData = this.getUserData();
        userData.documents = userData.documents?.filter(d => d.id !== id) || [];
        this.saveUserData(userData);
        this.showDocumentsList(); // Refresh list
        this.showSnackbar('Document deleted', 'info');
    }

    exportDocument() {
        const title = document.getElementById('docTitle').value.trim() || 'document';
        const content = this.editors.text ? this.editors.text.getValue() : '';
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSnackbar('Document exported successfully', 'success');
    }

    toggleFullscreen() {
        const editorSection = document.getElementById('editorSection');
        const btn = document.getElementById('fullscreenBtn');
        
        if (editorSection.classList.contains('fullscreen-mode')) {
            editorSection.classList.remove('fullscreen-mode');
            btn.textContent = 'Fullscreen';
            document.body.style.overflow = '';
        } else {
            editorSection.classList.add('fullscreen-mode');
            btn.textContent = 'Exit Fullscreen';
            document.body.style.overflow = 'hidden';
        }
        
        setTimeout(() => {
            this.editors.text?.layout();
        }, 100);
    }

    showSnippetModal(snippet = null) {
        const modal = document.getElementById('snippetModal');
        const title = document.getElementById('snippetModalTitle');
        const form = document.getElementById('snippetForm');
        
        if (snippet) {
            title.textContent = 'Edit Snippet';
            document.getElementById('snippetName').value = snippet.name;
            document.getElementById('snippetLang').value = snippet.language;
            document.getElementById('snippetDescription').value = snippet.description;
            
            // Set snippet editor content if available
            if (this.snippetEditor) {
                this.snippetEditor.setValue(snippet.code);
                try {
                    monaco.editor.setModelLanguage(this.snippetEditor.getModel(), snippet.language);
                } catch (error) {
                    console.warn('Could not set snippet editor language:', error);
                }
            }
            form.dataset.editId = snippet.id;
        } else {
            title.textContent = 'Add Snippet';
            form.reset();
            delete form.dataset.editId;
            
            // Clear snippet editor if available
            if (this.snippetEditor) {
                this.snippetEditor.setValue('');
                try {
                    monaco.editor.setModelLanguage(this.snippetEditor.getModel(), 'javascript');
                } catch (error) {
                    console.warn('Could not reset snippet editor language:', error);
                }
            }
        }
        
        modal.classList.remove('hidden');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('snippetName').focus();
        }, 100);
    }

    saveSnippet() {
        const form = document.getElementById('snippetForm');
        const name = document.getElementById('snippetName').value.trim();
        const language = document.getElementById('snippetLang').value;
        const description = document.getElementById('snippetDescription').value.trim();
        const code = this.snippetEditor ? this.snippetEditor.getValue() : '';
        
        if (!name || !code) {
            this.showSnackbar('Please fill in name and code fields', 'error');
            return;
        }
        
        const snippet = {
            id: form.dataset.editId || Date.now().toString(),
            name,
            language,
            description,
            code,
            created: form.dataset.editId ? undefined : new Date().toISOString(),
            modified: new Date().toISOString()
        };
        
        const userData = this.getUserData();
        userData.snippets = userData.snippets || [];
        
        if (form.dataset.editId) {
            const index = userData.snippets.findIndex(s => s.id === form.dataset.editId);
            if (index >= 0) {
                userData.snippets[index] = { ...userData.snippets[index], ...snippet };
            }
        } else {
            userData.snippets.push(snippet);
        }
        
        this.saveUserData(userData);
        this.closeModal(document.getElementById('snippetModal'));
        this.renderSnippets();
        this.showSnackbar('Snippet saved successfully', 'success');
    }

    renderSnippets() {
        const userData = this.getUserData();
        const snippets = userData.snippets || [];
        const container = document.getElementById('snippetsGrid');
        
        if (snippets.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📝</div><div class="empty-state__title">No Snippets</div><div class="empty-state__description">Create your first code snippet to get started</div><button class="btn btn--primary" onclick="workspace.showSnippetModal()">Add Snippet</button></div>';
            return;
        }
        
        container.innerHTML = snippets.map(snippet => `
            <div class="snippet-card">
                <div class="snippet-card__header">
                    <h3 class="snippet-card__title">${this.escapeHtml(snippet.name)}</h3>
                    <span class="snippet-card__language">${this.languages.find(l => l.id === snippet.language)?.name || snippet.language}</span>
                </div>
                <div class="snippet-card__code">${this.escapeHtml(snippet.code.substring(0, 200))}${snippet.code.length > 200 ? '...' : ''}</div>
                ${snippet.description ? `<div class="snippet-card__description">${this.escapeHtml(snippet.description)}</div>` : ''}
                <div class="snippet-card__actions">
                    <button class="btn btn--sm btn--outline" onclick="workspace.copySnippet('${snippet.id}')">Copy</button>
                    <button class="btn btn--sm btn--outline" onclick="workspace.editSnippet('${snippet.id}')">Edit</button>
                    <button class="btn btn--sm btn--outline" onclick="workspace.deleteSnippet('${snippet.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    copySnippet(id) {
        const userData = this.getUserData();
        const snippet = userData.snippets?.find(s => s.id === id);
        
        if (snippet) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(snippet.code).then(() => {
                    this.showSnackbar('Snippet copied to clipboard', 'success');
                }).catch(() => {
                    this.showSnackbar('Failed to copy snippet', 'error');
                });
            } else {
                this.showSnackbar('Clipboard not supported', 'warning');
            }
        }
    }

    editSnippet(id) {
        const userData = this.getUserData();
        const snippet = userData.snippets?.find(s => s.id === id);
        
        if (snippet) {
            this.showSnippetModal(snippet);
        }
    }

    deleteSnippet(id) {
        const userData = this.getUserData();
        userData.snippets = userData.snippets?.filter(s => s.id !== id) || [];
        this.saveUserData(userData);
        this.renderSnippets();
        this.showSnackbar('Snippet deleted', 'info');
    }

    filterSnippets(searchQuery = null, language = null) {
        const search = searchQuery !== null ? searchQuery : document.getElementById('snippetSearch').value.toLowerCase();
        const lang = language !== null ? language : document.getElementById('snippetLanguage').value;
        
        const cards = document.querySelectorAll('.snippet-card');
        cards.forEach(card => {
            const title = card.querySelector('.snippet-card__title').textContent.toLowerCase();
            const cardLang = card.querySelector('.snippet-card__language').textContent;
            
            const matchesSearch = !search || title.includes(search);
            const matchesLang = !lang || cardLang.toLowerCase().includes(lang.toLowerCase());
            
            card.style.display = matchesSearch && matchesLang ? 'block' : 'none';
        });
    }

    showLinkModal(link = null) {
        const modal = document.getElementById('linkModal');
        const title = document.getElementById('linkModalTitle');
        const form = document.getElementById('linkForm');
        
        if (link) {
            title.textContent = 'Edit Link';
            document.getElementById('linkTitle').value = link.title;
            document.getElementById('linkUrl').value = link.url;
            document.getElementById('linkDesc').value = link.description;
            document.getElementById('linkCat').value = link.category;
            form.dataset.editId = link.id;
        } else {
            title.textContent = 'Add Link';
            form.reset();
            delete form.dataset.editId;
        }
        
        modal.classList.remove('hidden');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('linkTitle').focus();
        }, 100);
    }

    saveLink() {
        const form = document.getElementById('linkForm');
        const title = document.getElementById('linkTitle').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const description = document.getElementById('linkDesc').value.trim();
        const category = document.getElementById('linkCat').value;
        
        if (!title || !url) {
            this.showSnackbar('Please fill in title and URL fields', 'error');
            return;
        }
        
        const link = {
            id: form.dataset.editId || Date.now().toString(),
            title,
            url,
            description,
            category,
            created: form.dataset.editId ? undefined : new Date().toISOString(),
            modified: new Date().toISOString()
        };
        
        const userData = this.getUserData();
        userData.links = userData.links || [];
        
        if (form.dataset.editId) {
            const index = userData.links.findIndex(l => l.id === form.dataset.editId);
            if (index >= 0) {
                userData.links[index] = { ...userData.links[index], ...link };
            }
        } else {
            userData.links.push(link);
        }
        
        this.saveUserData(userData);
        this.closeModal(document.getElementById('linkModal'));
        this.renderLinks();
        this.showSnackbar('Link saved successfully', 'success');
    }

    renderLinks() {
        const userData = this.getUserData();
        const links = userData.links || [];
        const container = document.getElementById('linksGrid');
        
        if (links.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🔗</div><div class="empty-state__title">No Links</div><div class="empty-state__description">Add your first link to get started</div><button class="btn btn--primary" onclick="workspace.showLinkModal()">Add Link</button></div>';
            return;
        }
        
        container.innerHTML = links.map(link => `
            <div class="link-card">
                <div class="link-card__category link-card__category--${link.category}">${this.categories.find(c => c.id === link.category)?.name || link.category}</div>
                <h3 class="link-card__title">${this.escapeHtml(link.title)}</h3>
                <div class="link-card__url">${this.escapeHtml(this.truncateUrl(link.url))}</div>
                ${link.description ? `<div class="link-card__description">${this.escapeHtml(link.description)}</div>` : ''}
                <div class="link-card__actions">
                    <button class="btn btn--sm btn--primary" onclick="window.open('${link.url}', '_blank')">Open</button>
                    <button class="btn btn--sm btn--outline" onclick="workspace.editLink('${link.id}')">Edit</button>
                    <button class="btn btn--sm btn--outline" onclick="workspace.deleteLink('${link.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    editLink(id) {
        const userData = this.getUserData();
        const link = userData.links?.find(l => l.id === id);
        
        if (link) {
            this.showLinkModal(link);
        }
    }

    deleteLink(id) {
        const userData = this.getUserData();
        userData.links = userData.links?.filter(l => l.id !== id) || [];
        this.saveUserData(userData);
        this.renderLinks();
        this.showSnackbar('Link deleted', 'info');
    }

    filterLinks(searchQuery = null, category = null) {
        const search = searchQuery !== null ? searchQuery : document.getElementById('linkSearch').value.toLowerCase();
        const cat = category !== null ? category : document.getElementById('linkCategory').value;
        
        const cards = document.querySelectorAll('.link-card');
        cards.forEach(card => {
            const title = card.querySelector('.link-card__title').textContent.toLowerCase();
            const cardCat = card.querySelector('.link-card__category').className;
            
            const matchesSearch = !search || title.includes(search);
            const matchesCat = !cat || cardCat.includes(`--${cat}`);
            
            card.style.display = matchesSearch && matchesCat ? 'block' : 'none';
        });
    }

    truncateUrl(url) {
        return url.length > 50 ? url.substring(0, 47) + '...' : url;
    }

    closeModal(modal) {
        modal.classList.add('hidden');
    }

    getUserData() {
        try {
            const key = `monacoWorkspaceData_${this.currentUser.email}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : { documents: [], snippets: [], links: [] };
        } catch (error) {
            console.error('Error getting user data:', error);
            return { documents: [], snippets: [], links: [] };
        }
    }

    saveUserData(data) {
        try {
            const key = `monacoWorkspaceData_${this.currentUser.email}`;
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving user data:', error);
            this.showSnackbar('Error saving data', 'error');
        }
    }

    loadUserData() {
        // Initialize with sample data if first time
        const userData = this.getUserData();
        if (userData.documents.length === 0 && userData.snippets.length === 0 && userData.links.length === 0) {
            // Add some sample data
            userData.snippets = [
                {
                    id: 'sample1',
                    name: 'Hello World Function',
                    language: 'javascript',
                    description: 'A simple hello world function',
                    code: 'function hello() {\n    console.log("Hello World!");\n    return true;\n}',
                    created: new Date().toISOString()
                }
            ];
            
            userData.links = [
                {
                    id: 'sample1',
                    title: 'Monaco Editor Documentation',
                    url: 'https://microsoft.github.io/monaco-editor/',
                    description: 'Official documentation for Monaco Editor',
                    category: 'documentation',
                    created: new Date().toISOString()
                }
            ];
            
            this.saveUserData(userData);
        }
    }

    showSnackbar(message, type = 'info') {
        const container = document.getElementById('snackbarContainer');
        const snackbar = document.createElement('div');
        snackbar.className = `snackbar snackbar--${type}`;
        snackbar.textContent = message;
        
        container.appendChild(snackbar);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            if (snackbar.parentNode) {
                snackbar.parentNode.removeChild(snackbar);
            }
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
const workspace = new MonacoWorkspace();

// Make workspace globally available for onclick handlers
window.workspace = workspace;