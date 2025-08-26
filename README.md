# Text Diff & Formatter VS Code Extension with Activity Bar Icon

A powerful VS Code extension that provides advanced text comparison and formatting capabilities with a dedicated **Activity Bar icon** and **inline color-coded differences**.

## 🚀 NEW FEATURES

### 📍 **Activity Bar Integration**
- **Dedicated icon** on the right sidebar (Activity Bar)
- Click the **diff icon** (📊) to open the extension
- **Always accessible** - no need to use Command Palette

### 🎨 **Inline Color-Coded Differences**
- 🔴 **Red highlighting** for removed/deleted text
- 🟢 **Green highlighting** for added/new text  
- **Real-time diff rendering** directly in the extension panel
- **No external windows** needed for basic comparisons

### 🔧 **Enhanced Diff Options**
- **Line-by-line diff** for code comparison
- **Word-by-word diff** for document changes  
- **Character-by-character diff** for precise edits
- **Switch between modes** instantly

## Installation

1. **Navigate to extension folder:**
   ```bash
   cd text-diff-extension
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Compile TypeScript:**
   ```bash
   npm run compile
   ```

4. **Test in VS Code:**
   - Open the extension folder in VS Code
   - Press `F5` to launch Extension Development Host
   - Look for the **📊 diff icon** in the Activity Bar

5. **Package for installation:**
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```

## Usage

### 🖱️ **Quick Access**
1. Click the **📊 diff icon** in the Activity Bar (right sidebar)
2. The Text Diff & Formatter panel opens instantly

### 📝 **Text Comparison**
1. Paste text in **Original** and **Modified** fields
2. Select **language** and **diff type** (lines/words/chars)
3. Click **🔍 Compare** to see **red/green highlighted differences**
4. Optionally click **📋 VS Diff** for traditional side-by-side view

### 🎨 **Color-Coded Results**
- **🔴 Red background**: Text that was removed or deleted
- **🟢 Green background**: Text that was added or new
- **No highlighting**: Unchanged text
- **Responsive layout**: Works on any screen size

### 📁 **File Comparison**
1. Expand **📁 Files** section
2. Select two files to compare
3. **Auto-detects** programming language from file extension
4. **Automatically runs comparison** with color highlighting

## Key Improvements

| Feature | Old Version | New Version |
|---------|-------------|-------------|
| Access Method | Command Palette only | **Activity Bar icon** |
| Diff Visualization | External VS Code diff | **Inline colored diff** |
| Interface | Full-screen webview | **Compact sidebar panel** |
| Color Coding | None | **🔴 Red / 🟢 Green** |
| Diff Granularity | Lines only | **Lines/Words/Characters** |
| File Operations | Manual selection | **Auto-detect & compare** |

## Screenshots

The extension now appears as a **📊 diff icon** in your Activity Bar, providing instant access to text comparison with beautiful **red and green color highlighting** for differences.

## Technical Details

### Activity Bar Integration
```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "textdiff",
      "title": "Text Diff & Formatter", 
      "icon": "$(diff)"
    }
  ]
}
```

### Color-Coded Diff Algorithm
- **Line Diff**: Compares entire lines for structural changes
- **Word Diff**: Identifies word-level modifications
- **Character Diff**: Precise character-by-character comparison
- **HTML Rendering**: Safe HTML escaping with color CSS classes

### Responsive Design
- **Mobile-friendly**: Stacks diff panels vertically on narrow screens
- **VS Code theming**: Inherits colors from your current theme
- **Compact layout**: Optimized for sidebar usage

## Requirements

- **VS Code 1.74.0+**
- **Node.js** (for development)
- **TypeScript** (included in devDependencies)

## File Structure

```
text-diff-extension/
├── package.json              # Activity Bar configuration
├── src/extension.ts          # WebviewViewProvider + diff logic
├── tsconfig.json             # TypeScript config
└── README.md                 # This documentation
```

Perfect for developers who want **instant access** to text comparison with **beautiful visual diff highlighting** right in their VS Code sidebar! 🎯
