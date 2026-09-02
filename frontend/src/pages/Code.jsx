import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  ChevronDown,
  MemoryStick,
  ArrowRight,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../config/api';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE_ID,
  getLanguageConfig,
} from '../config/languages';
import { MonacoLspClient } from '../services/lsp/lspClient';

// Single source of truth for the workspace palette.
const PALETTE = {
  canvas: '#0b0d10',
  panel: '#0f1115',
  surface: '#0a0c0f',
  border: '#1c2028',
  borderSoft: '#20242c',
  textPrimary: '#e7e9ec',
  textSecondary: '#8b94a1',
  textTertiary: '#565e69',
  accent: '#e8722c',
  accentSoft: 'rgba(232, 114, 44, 0.14)',
  success: '#34d399',
  error: '#f87171',
};

const STATUS_META = {
  idle: { label: 'Idle', dot: PALETTE.textTertiary },
  running: { label: 'Running', dot: PALETTE.accent },
  success: { label: 'Success', dot: PALETTE.success },
  error: { label: 'Error', dot: PALETTE.error },
};

/**
 * Extracts line number from runtime error messages (Python, JS, C++, etc.)
 */
const extractErrorLineNumber = (errorText) => {
  if (!errorText || typeof errorText !== 'string') return null;

  // Match Python: File "...", line 12 or line 12, in <module>
  const pyTraceMatch = errorText.match(/File\s+["'][^"']+["'],\s*line\s+(\d+)/i);
  if (pyTraceMatch && pyTraceMatch[1]) {
    const num = parseInt(pyTraceMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  const pyLineMatch = errorText.match(/line\s+(\d+)/i);
  if (pyLineMatch && pyLineMatch[1]) {
    const num = parseInt(pyLineMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Match syntax error (line 12)
  const syntaxMatch = errorText.match(/\(line\s+(\d+)\)/i);
  if (syntaxMatch && syntaxMatch[1]) {
    const num = parseInt(syntaxMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Match standard file:line:col or main.py:12
  const colMatch = errorText.match(/(?:solution|main|input|\.py|\.js|\.cpp|\.c|\.java):(\d+)(?::\d+)?/i);
  if (colMatch && colMatch[1]) {
    const num = parseInt(colMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return null;
};

const Code = () => {
  const [selectedLanguageId, setSelectedLanguageId] = useState(DEFAULT_LANGUAGE_ID);
  const languageConfig = getLanguageConfig(selectedLanguageId);

  const [code, setCode] = useState(languageConfig.defaultCode);
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [errorOutput, setErrorOutput] = useState('');
  const [executionStatus, setExecutionStatus] = useState('idle'); // 'idle' | 'running' | 'success' | 'error'
  const [execMetadata, setExecMetadata] = useState(null);
  const [lspStatus, setLspStatus] = useState('connecting'); // 'connected' | 'connecting' | 'error' | 'disconnected'
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const [errorLine, setErrorLine] = useState(null);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const lspClientRef = useRef(null);
  const dropdownRef = useRef(null);
  const errorDecorationsRef = useRef([]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear error line highlighting in editor
  const clearErrorDecorations = useCallback(() => {
    if (editorRef.current && errorDecorationsRef.current.length > 0) {
      errorDecorationsRef.current = editorRef.current.deltaDecorations(errorDecorationsRef.current, []);
    }
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'runtime-error', []);
      }
    }
    setErrorLine(null);
  }, []);

  // Highlight specific error line in Monaco Editor
  const highlightErrorLine = useCallback((lineNum, errorMsg) => {
    if (!editorRef.current || !monacoRef.current || !lineNum) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    const maxLines = model.getLineCount();
    const targetLine = Math.min(Math.max(1, lineNum), maxLines);
    setErrorLine(targetLine);

    // Reveal and center the target line
    editor.revealLineInCenter(targetLine);
    editor.setPosition({ lineNumber: targetLine, column: 1 });
    editor.focus();

    // Delta decorations for entire line highlighting and glyph margin
    const newDecorations = [
      {
        range: new monaco.Range(targetLine, 1, targetLine, model.getLineMaxColumn(targetLine)),
        options: {
          isWholeLine: true,
          className: 'error-line-highlight error-line-flash',
          glyphMarginClassName: 'error-glyph-margin',
          hoverMessage: {
            value: `### Execution Error (Line ${targetLine})\n\n\`\`\`\n${(errorMsg || 'An error occurred on this line during execution.').trim()}\n\`\`\``,
          },
          overviewRuler: {
            color: '#ef4444',
            position: monaco.editor.OverviewRulerLane.Right,
          },
          minimap: {
            color: '#ef4444',
            position: monaco.editor.MinimapPosition.Inline,
          },
        },
      },
    ];

    errorDecorationsRef.current = editor.deltaDecorations(errorDecorationsRef.current, newDecorations);

    // Add marker for squiggly line indicator
    monaco.editor.setModelMarkers(model, 'runtime-error', [
      {
        startLineNumber: targetLine,
        startColumn: 1,
        endLineNumber: targetLine,
        endColumn: model.getLineMaxColumn(targetLine),
        message: errorMsg || `Execution error on line ${targetLine}`,
        severity: monaco.MarkerSeverity.Error,
      },
    ]);
  }, []);

  // Jump cursor directly to error line
  const jumpToErrorLine = () => {
    if (errorLine && editorRef.current) {
      editorRef.current.revealLineInCenter(errorLine);
      editorRef.current.setPosition({ lineNumber: errorLine, column: 1 });
      editorRef.current.focus();
    }
  };

  // Initialize or re-bind LSP client when language changes or editor mounts
  const setupLspClient = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;

    if (lspClientRef.current) {
      lspClientRef.current.dispose();
      lspClientRef.current = null;
    }

    const client = new MonacoLspClient({
      languageConfig,
      monaco: monacoRef.current,
      editor: editorRef.current,
      onStatusChange: (status) => setLspStatus(status),
    });

    client.connect();
    lspClientRef.current = client;
  }, [languageConfig]);

  useEffect(() => {
    setupLspClient();
    return () => {
      if (lspClientRef.current) {
        lspClientRef.current.dispose();
        lspClientRef.current = null;
      }
    };
  }, [setupLspClient]);

  // Handle Monaco Editor Mounting
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Custom theme tuned to match the workspace palette
    monaco.editor.defineTheme('minimal-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5a626e', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'e8722c' },
        { token: 'identifier', foreground: 'e7e9ec' },
        { token: 'string', foreground: '4ade80' },
        { token: 'number', foreground: 'facc15' },
        { token: 'type', foreground: '38bdf8' },
        { token: 'delimiter', foreground: '8b94a1' },
      ],
      colors: {
        'editor.background': PALETTE.surface,
        'editorGutter.background': PALETTE.surface,
        'editor.foreground': PALETTE.textPrimary,
        'editor.lineHighlightBackground': '#12151a',
        'editorLineNumber.foreground': '#3f454e',
        'editorLineNumber.activeForeground': PALETTE.textSecondary,
        'editorCursor.foreground': PALETTE.accent,
        'editor.selectionBackground': '#232830',
        'editor.inactiveSelectionBackground': '#181b21',
      },
    });
    monaco.editor.setTheme('minimal-dark');

    // Configure Monaco Python formatting & indentation
    monaco.languages.setLanguageConfiguration('python', {
      indentationRules: {
        increaseIndentPattern: /^.*:\s*$/,
        decreaseIndentPattern: /^\s*(elif|else|except|finally)\b.*:/,
      },
      wordPattern: /(-?\d*\.\d\w*)|([^`~!@#$%^&*()=+[{\]}\\|;:'",.<>/?\s]+)/g,
    });

    // Track cursor position for the status bar
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, column: e.position.column });
    });

    // Keyboard shortcut: Ctrl + Enter / Cmd + Enter to run code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCode();
    });

    setupLspClient();
  };

  // Run Code through backend API (OnlineCompiler)
  const runCode = async () => {
    if (executionStatus === 'running') return;

    clearErrorDecorations();

    const currentCode = editorRef.current ? editorRef.current.getValue() : code;
    if (!currentCode || currentCode.trim().length === 0) {
      setOutput('');
      setErrorOutput('Please enter some code to run.');
      setExecutionStatus('error');
      return;
    }

    setExecutionStatus('running');
    setOutput('');
    setErrorOutput('');
    setExecMetadata(null);

    try {
      const response = await api.post('/code/run', {
        language: languageConfig.id,
        code: currentCode,
        input: stdin,
      });

      const data = response.data?.data;

      if (!data) {
        throw new Error(response.data?.message || 'Execution failed with no output');
      }

      const receivedOutput = data.output || '';
      const receivedError = data.error || '';

      setOutput(receivedOutput);
      setErrorOutput(receivedError);
      setExecMetadata({
        exitCode: data.exitCode,
        executionTime: data.executionTime,
        memory: data.memory,
        compiler: data.compiler,
      });

      const isSuccess = data.success || (data.exitCode === 0 && !receivedError);

      if (isSuccess) {
        setExecutionStatus('success');
      } else {
        setExecutionStatus('error');
        // Extract error line and highlight in editor
        const fullErr = receivedError || receivedOutput;
        const line = extractErrorLineNumber(fullErr);
        if (line) {
          highlightErrorLine(line, fullErr);
        }
      }
    } catch (err) {
      console.error('Run code error:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'An unexpected error occurred while executing the code.';

      setErrorOutput(msg);
      setOutput('');
      setExecutionStatus('error');

      const line = extractErrorLineNumber(msg);
      if (line) {
        highlightErrorLine(line, msg);
      }
    }
  };

  // Reset to default template & clear input/output
  const handleReset = () => {
    clearErrorDecorations();
    const defaultTemplate = languageConfig.defaultCode;
    setCode(defaultTemplate);
    if (editorRef.current) {
      editorRef.current.setValue(defaultTemplate);
    }
    setStdin('');
    setOutput('');
    setErrorOutput('');
    setExecutionStatus('idle');
    setExecMetadata(null);
  };

  // Handle language switch
  const handleLanguageSelect = (langId) => {
    if (langId === selectedLanguageId) {
      setIsLangDropdownOpen(false);
      return;
    }

    clearErrorDecorations();
    const newConfig = getLanguageConfig(langId);
    setSelectedLanguageId(langId);
    setCode(newConfig.defaultCode);
    if (editorRef.current) {
      editorRef.current.setValue(newConfig.defaultCode);
    }
    setStdin('');
    setOutput('');
    setErrorOutput('');
    setExecutionStatus('idle');
    setExecMetadata(null);
    setIsLangDropdownOpen(false);
  };

  const status = STATUS_META[executionStatus];

  return (
    <div className="min-h-screen flex flex-col antialiased" style={{ background: PALETTE.canvas }}>
      <Navbar />

      <main className="flex-1 flex flex-col max-w-[1700px] w-full mx-auto p-4 md:p-6 lg:p-8 gap-5 overflow-hidden">
        {/* Toolbar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-[15px] font-medium tracking-tight" style={{ color: PALETTE.textPrimary }}>
              Code
            </h1>

            <div className="h-4 w-px" style={{ background: PALETTE.border }} />

            {/* Language Selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="language-select-btn"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center gap-2 text-sm py-1 px-1 rounded transition-colors cursor-pointer"
                style={{ color: PALETTE.textSecondary }}
                onMouseEnter={(e) => (e.currentTarget.style.color = PALETTE.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = PALETTE.textSecondary)}
              >
                <span style={{ color: PALETTE.textPrimary }}>{languageConfig.name}</span>
                <span className="text-xs font-mono">v{languageConfig.version}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isLangDropdownOpen && (
                <div
                  className="absolute left-0 mt-2 w-52 rounded-md shadow-2xl z-50 py-1 overflow-hidden"
                  style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}
                >
                  {Object.values(SUPPORTED_LANGUAGES).map((lang) => {
                    const active = selectedLanguageId === lang.id;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => handleLanguageSelect(lang.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors"
                        style={{
                          color: active ? PALETTE.textPrimary : PALETTE.textSecondary,
                          background: active ? PALETTE.accentSoft : 'transparent',
                        }}
                      >
                        <span>{lang.name}</span>
                        <span className="text-[11px] font-mono" style={{ color: PALETTE.textTertiary }}>
                          v{lang.version}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="reset-code-btn"
              onClick={handleReset}
              disabled={executionStatus === 'running'}
              className="text-sm py-1.5 px-2 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ color: PALETTE.textSecondary }}
              title="Reset code, input, and output"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              id="run-code-btn"
              onClick={runCode}
              disabled={executionStatus === 'running'}
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
              style={{ background: PALETTE.accent, color: '#160d05' }}
              title="Run code (Ctrl+Enter)"
            >
              {executionStatus === 'running' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#160d05]/30 border-t-[#160d05] rounded-full animate-spin" />
                  <span>Running</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run</span>
                  <span className="hidden xl:inline text-[11px] font-mono font-normal opacity-70">
                    Ctrl+Enter
                  </span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Workspace Layout */}
        <div
          className="flex-1 flex flex-col min-h-0 rounded-lg overflow-hidden"
          style={{ border: `1px solid ${PALETTE.border}`, background: PALETTE.surface }}
        >
          <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            {/* Editor Pane */}
            <section
              className="flex-1 flex flex-col min-h-[380px] lg:min-h-[520px]"
              style={{ borderRight: `1px solid ${PALETTE.border}` }}
            >
              <div
                className="px-4 h-10 flex items-center justify-between shrink-0"
                style={{ borderBottom: `1px solid ${PALETTE.border}` }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: status.dot,
                      animation: executionStatus === 'running' ? 'pulse 1.4s ease-in-out infinite' : 'none',
                    }}
                  />
                  <span className="text-xs font-mono" style={{ color: PALETTE.textSecondary }}>
                    {languageConfig.fileName}
                  </span>
                </div>

                {errorLine && (
                  <button
                    type="button"
                    onClick={jumpToErrorLine}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5',
                    }}
                    title="Jump to error line in editor"
                  >
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    <span>Error at Line {errorLine}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 w-full h-full relative">
                <Editor
                  height="100%"
                  language={languageConfig.monacoLanguage}
                  value={code}
                  onChange={(val) => {
                    setCode(val || '');
                    if (errorLine) {
                      clearErrorDecorations();
                    }
                  }}
                  onMount={handleEditorDidMount}
                  theme="minimal-dark"
                  options={{
                    fontSize: 14,
                    lineNumbers: 'on',
                    glyphMargin: true,
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    automaticLayout: true,
                    tabSize: 4,
                    insertSpaces: true,
                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    minimap: { enabled: false },
                    bracketPairColorization: { enabled: true },
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    formatOnPaste: true,
                    formatOnType: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    fixedOverflowWidgets: true,
                    quickSuggestionsDelay: 0,
                    quickSuggestions: { other: true, comments: false, strings: true },
                    suggest: {
                      showWords: true,
                      showSnippets: true,
                      showIcons: true,
                      filterGraceful: true,
                      localityBonus: true,
                      preview: true,
                      shareSuggestSelections: true,
                      maxVisibleSuggestions: 12,
                    },
                    parameterHints: { enabled: true, cycle: true },
                    hover: { delay: 120, sticky: true },
                    scrollbar: {
                      vertical: 'visible',
                      horizontal: 'visible',
                      verticalScrollbarSize: 8,
                      horizontalScrollbarSize: 8,
                      verticalSliderSize: 6,
                      horizontalSliderSize: 6,
                      useShadows: false,
                    },
                    cursorBlinking: 'smooth',
                    renderLineHighlight: 'all',
                    overviewRulerBorder: false,
                    padding: { top: 14, bottom: 14 },
                  }}
                />
              </div>
            </section>

            {/* Input & Output Side Panel */}
            <aside className="w-full lg:w-[380px] xl:w-[420px] flex flex-col shrink-0 min-h-0">
              {/* Input Section */}
              <section
                className="flex flex-col h-48 lg:h-56 shrink-0"
                style={{ borderBottom: `1px solid ${PALETTE.border}` }}
              >
                <div
                  className="px-4 h-10 flex items-center justify-between shrink-0"
                  style={{ borderBottom: `1px solid ${PALETTE.border}` }}
                >
                  <div className="flex items-center gap-2 text-xs" style={{ color: PALETTE.textSecondary }}>
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Input <span style={{ color: PALETTE.textTertiary }}>· stdin</span></span>
                  </div>
                  <span className="text-[11px]" style={{ color: PALETTE.textTertiary }}>optional</span>
                </div>

                <textarea
                  id="code-stdin-input"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder={'5\n10 20 30 40 50'}
                  className="flex-1 w-full resize-none border-none focus:ring-0 p-4 font-mono text-sm bg-transparent custom-scrollbar outline-none leading-relaxed"
                  style={{ color: PALETTE.textPrimary }}
                  spellCheck={false}
                />
              </section>

              {/* Output Section */}
              <section className="flex-1 flex flex-col min-h-[200px]">
                <div
                  className="px-4 h-10 flex items-center justify-between shrink-0"
                  style={{ borderBottom: `1px solid ${PALETTE.border}` }}
                >
                  <div className="flex items-center gap-2 text-xs" style={{ color: PALETTE.textSecondary }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: status.dot,
                        animation: executionStatus === 'running' ? 'pulse 1.4s ease-in-out infinite' : 'none',
                      }}
                    />
                    <span>Output</span>
                    {executionStatus !== 'idle' && (
                      <span style={{ color: status.dot }}>{status.label.toLowerCase()}</span>
                    )}
                  </div>

                  {(output || errorOutput) && (
                    <button
                      type="button"
                      onClick={() => {
                        clearErrorDecorations();
                        setOutput('');
                        setErrorOutput('');
                        setExecutionStatus('idle');
                        setExecMetadata(null);
                      }}
                      className="text-xs transition-colors cursor-pointer"
                      style={{ color: PALETTE.textTertiary }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-sm select-text">
                  {executionStatus === 'idle' && (
                    <div className="h-full flex flex-col items-start justify-center gap-1.5">
                      <p className="text-xs" style={{ color: PALETTE.textSecondary }}>
                        Run your code to see the output here.
                      </p>
                      <p className="text-[11px]" style={{ color: PALETTE.textTertiary }}>
                        Press{' '}
                        <span
                          className="font-mono px-1.5 py-0.5 rounded"
                          style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}
                        >
                          Ctrl+Enter
                        </span>{' '}
                        or hit Run.
                      </p>
                    </div>
                  )}

                  {executionStatus === 'running' && (
                    <div className="h-full flex flex-col items-start justify-center gap-2">
                      <div
                        className="w-4 h-4 border-2 rounded-full animate-spin"
                        style={{ borderColor: `${PALETTE.border} ${PALETTE.border} ${PALETTE.accent} ${PALETTE.border}` }}
                      />
                      <p className="text-xs" style={{ color: PALETTE.textSecondary }}>Executing…</p>
                    </div>
                  )}

                  {(executionStatus === 'success' || executionStatus === 'error') && (
                    <div className="space-y-3">
                      {/* stdout Output */}
                      {output && (
                        <pre
                          className="whitespace-pre-wrap break-all leading-relaxed font-mono text-sm"
                          style={{ color: PALETTE.textPrimary }}
                        >
                          {output}
                        </pre>
                      )}

                      {/* Error / Traceback Output */}
                      {errorOutput && (
                        <div
                          className="p-3.5 rounded space-y-2 leading-relaxed"
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                          }}
                        >
                          <div className="flex items-center justify-between text-xs pb-1 border-b border-red-500/20">
                            <span className="font-semibold text-red-400 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Execution Error
                            </span>
                            {errorLine && (
                              <button
                                type="button"
                                onClick={jumpToErrorLine}
                                className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-red-950/80 border border-red-800/80 text-red-300 hover:text-white cursor-pointer transition-colors"
                              >
                                <span>Go to Line {errorLine}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <pre className="whitespace-pre-wrap break-all text-xs font-mono text-red-300">
                            {errorOutput}
                          </pre>
                        </div>
                      )}

                      {!output && !errorOutput && (
                        <p className="text-xs italic" style={{ color: PALETTE.textTertiary }}>
                          Finished with no output.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>

          {/* Status Bar */}
          <div
            className="h-8 px-4 flex items-center justify-between text-[11px] font-mono shrink-0"
            style={{ borderTop: `1px solid ${PALETTE.border}`, background: PALETTE.panel, color: PALETTE.textSecondary }}
          >
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: lspStatus === 'connected' ? PALETTE.success : lspStatus === 'connecting' ? PALETTE.accent : PALETTE.textTertiary,
                    animation: lspStatus === 'connecting' ? 'pulse 1.4s ease-in-out infinite' : 'none',
                  }}
                />
                {lspStatus === 'connected' ? 'Pyright' : lspStatus === 'connecting' ? 'Starting Pyright…' : 'LSP offline'}
              </span>
              <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
              {errorLine && (
                <button
                  type="button"
                  onClick={jumpToErrorLine}
                  className="text-red-400 hover:text-red-300 underline cursor-pointer"
                >
                  Error on Ln {errorLine}
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {execMetadata?.executionTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {execMetadata.executionTime}s
                </span>
              )}
              {execMetadata?.memory && (
                <span className="flex items-center gap-1">
                  <MemoryStick className="w-3 h-3" />
                  {execMetadata.memory}
                </span>
              )}
              {execMetadata && (
                <span className="flex items-center gap-1" style={{ color: execMetadata.exitCode === 0 ? PALETTE.success : PALETTE.error }}>
                  {execMetadata.exitCode === 0 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  exit {execMetadata.exitCode}
                </span>
              )}
              <span>{languageConfig.name} {languageConfig.version}</span>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
};

export default Code;
