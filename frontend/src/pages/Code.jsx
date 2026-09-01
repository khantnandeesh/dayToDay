import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Terminal,
  FileCode2,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../config/api';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE_ID,
  getLanguageConfig,
} from '../config/languages';
import { MonacoLspClient } from '../services/lsp/lspClient';

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

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const lspClientRef = useRef(null);
  const dropdownRef = useRef(null);

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

    // Define sleek minimal dark theme matching #0a0a0a / #171717
    monaco.editor.defineTheme('minimal-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '666666', fontStyle: 'italic' },
        { token: 'keyword', foreground: '60a5fa' },
        { token: 'identifier', foreground: 'f3f4f6' },
        { token: 'string', foreground: '4ade80' },
        { token: 'number', foreground: 'facc15' },
        { token: 'type', foreground: '38bdf8' },
        { token: 'delimiter', foreground: '9ca3af' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editorGutter.background': '#0a0a0a',
        'editor.foreground': '#f3f4f6',
        'editor.lineHighlightBackground': '#141414',
        'editorLineNumber.foreground': '#525252',
        'editorLineNumber.activeForeground': '#a3a3a3',
        'editorCursor.foreground': '#cbd5e1',
        'editor.selectionBackground': '#262626',
        'editor.inactiveSelectionBackground': '#1e1e1e',
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

    // Add Keyboard shortcut: Ctrl + Enter / Cmd + Enter to run code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCode();
    });

    setupLspClient();
  };

  // Run Code through backend API (OnlineCompiler)
  const runCode = async () => {
    if (executionStatus === 'running') return;

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

      setOutput(data.output || '');
      setErrorOutput(data.error || '');
      setExecMetadata({
        exitCode: data.exitCode,
        executionTime: data.executionTime,
        memory: data.memory,
        compiler: data.compiler,
      });

      if (data.success || (data.exitCode === 0 && !data.error)) {
        setExecutionStatus('success');
      } else {
        setExecutionStatus('error');
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
    }
  };

  // Reset to default template & clear input/output
  const handleReset = () => {
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

  // Handle language switch (extensible for future languages)
  const handleLanguageSelect = (langId) => {
    if (langId === selectedLanguageId) {
      setIsLangDropdownOpen(false);
      return;
    }

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

  return (
    <div className="min-h-screen bg-neutral-50/50 flex flex-col antialiased">
      <Navbar />

      <main className="flex-1 flex flex-col max-w-[1700px] w-full mx-auto p-4 md:p-6 lg:p-8 gap-6 md:gap-8 overflow-hidden">
        {/* Editor Toolbar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-transparent">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 text-lg font-semibold text-neutral-900 tracking-tight">
              <FileCode2 className="w-5 h-5 text-neutral-800" />
              <span>Code</span>
            </div>

            <div className="h-4 w-px bg-neutral-300" />

            {/* Language Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="language-select-btn"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center gap-2 text-sm font-medium text-neutral-800 hover:text-neutral-950 transition-colors py-1 px-1 rounded cursor-pointer"
              >
                <span>{languageConfig.name}</span>
                <span className="text-xs text-neutral-500 font-mono">v{languageConfig.version}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
              </button>

              {isLangDropdownOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-white border border-neutral-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                    Select Language
                  </div>
                  {Object.values(SUPPORTED_LANGUAGES).map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => handleLanguageSelect(lang.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                        selectedLanguageId === lang.id
                          ? 'bg-neutral-100 font-semibold text-neutral-900'
                          : 'text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{lang.name}</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 font-mono">v{lang.version}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pyright LSP Status Badge */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                lspStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                  : lspStatus === 'connecting'
                  ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200'
              }`}
              title={
                lspStatus === 'connected'
                  ? 'Pyright Language Server active (real type-aware IntelliSense & diagnostics)'
                  : lspStatus === 'connecting'
                  ? 'Connecting to Pyright LSP...'
                  : 'Pyright LSP disconnected'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  lspStatus === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : lspStatus === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-neutral-400'
                }`}
              />
              <span>
                {lspStatus === 'connected'
                  ? 'Pyright IntelliSense'
                  : lspStatus === 'connecting'
                  ? 'Starting Pyright...'
                  : 'LSP Offline'}
              </span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              id="reset-code-btn"
              onClick={handleReset}
              disabled={executionStatus === 'running'}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Reset code template, input, and output"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              id="run-code-btn"
              onClick={runCode}
              disabled={executionStatus === 'running'}
              className="px-5 py-2 text-sm font-medium text-white bg-neutral-950 hover:bg-neutral-800 active:scale-[0.98] rounded-md shadow-xs transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
              title="Run code (Ctrl+Enter / Cmd+Enter)"
            >
              {executionStatus === 'running' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Code</span>
                  <span className="hidden xl:inline text-[11px] text-neutral-400 font-mono font-normal">
                    (Ctrl+Enter)
                  </span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Workspace Layout Grid */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 md:gap-8 min-h-0">
          {/* Left: Code Editor Panel */}
          <section className="flex-1 flex flex-col bg-[#0a0a0a] border border-neutral-800 rounded-md overflow-hidden min-h-[420px] lg:min-h-[580px] shadow-lg">
            <header className="bg-[#0a0a0a] px-5 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-mono text-neutral-300">{languageConfig.fileName}</span>
                <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline ml-1">
                  Python 3.14
                </span>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">Pyright LSP</span>
            </header>

            {/* Monaco Editor Mount */}
            <div className="flex-1 w-full h-full relative bg-[#0a0a0a]">
              <Editor
                height="100%"
                language={languageConfig.monacoLanguage}
                value={code}
                onChange={(val) => setCode(val || '')}
                onMount={handleEditorDidMount}
                theme="minimal-dark"
                options={{
                  fontSize: 14,
                  lineNumbers: 'on',
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
                  quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true,
                  },
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
                  parameterHints: {
                    enabled: true,
                    cycle: true,
                  },
                  hover: {
                    delay: 120,
                    sticky: true,
                  },
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

          {/* Right: Side Panels (Input & Output) */}
          <aside className="w-full lg:w-[380px] xl:w-[440px] flex flex-col gap-6 md:gap-8 shrink-0">
            {/* Input (stdin) Panel */}
            <section className="flex flex-col h-56 lg:h-64 shrink-0 border border-neutral-800 rounded-md overflow-hidden bg-[#0a0a0a] shadow-md">
              <header className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
                <div className="text-xs font-medium text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Input <span className="font-normal normal-case text-neutral-500">(stdin)</span></span>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono">Optional</span>
              </header>

              <div className="flex-1 flex overflow-hidden bg-[#0a0a0a]">
                <div className="w-10 bg-[#121212] border-r border-neutral-800/80 flex flex-col items-center py-4 font-mono text-[11px] text-neutral-600 select-none">
                  <span>1</span>
                </div>
                <textarea
                  id="code-stdin-input"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter standard input here...&#10;&#10;Example:&#10;5&#10;10 20 30 40 50"
                  className="flex-1 w-full resize-none border-none focus:ring-0 p-4 font-mono text-sm text-neutral-100 bg-transparent custom-scrollbar placeholder:text-neutral-600 outline-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </section>

            {/* Output Panel */}
            <section className="flex-1 flex flex-col bg-[#0a0a0a] border border-neutral-800 rounded-md overflow-hidden min-h-[260px] shadow-md">
              <header className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-widest">
                  <Layers className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Output</span>

                  {executionStatus === 'running' && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60 font-sans normal-case tracking-normal">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      Running
                    </span>
                  )}
                  {executionStatus === 'success' && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 font-sans normal-case tracking-normal">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Success
                    </span>
                  )}
                  {executionStatus === 'error' && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/60 font-sans normal-case tracking-normal">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      Error
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {(output || errorOutput) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOutput('');
                        setErrorOutput('');
                        setExecutionStatus('idle');
                        setExecMetadata(null);
                      }}
                      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </header>

              {/* Output Content Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 font-mono text-sm bg-[#0a0a0a] select-text">
                {executionStatus === 'idle' && (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-center py-6">
                    <p className="text-xs text-neutral-400">System ready. Click <span className="text-neutral-200 font-medium">'Run Code'</span> to see output.</p>
                    <p className="text-[11px] text-neutral-600 mt-1.5">
                      Shortcut: <span className="font-mono bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">Ctrl+Enter</span>
                    </p>
                  </div>
                )}

                {executionStatus === 'running' && (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 py-6">
                    <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-200 rounded-full animate-spin mb-3" />
                    <p className="font-sans text-xs text-neutral-400">Executing code...</p>
                  </div>
                )}

                {(executionStatus === 'success' || executionStatus === 'error') && (
                  <div className="space-y-3">
                    {/* stdout */}
                    {output && (
                      <pre className="whitespace-pre-wrap break-all text-neutral-100 leading-relaxed font-mono text-sm">
                        {output}
                      </pre>
                    )}

                    {/* stderr / error */}
                    {errorOutput && (
                      <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 whitespace-pre-wrap break-all text-xs font-mono leading-relaxed">
                        {errorOutput}
                      </div>
                    )}

                    {/* Empty output case */}
                    {!output && !errorOutput && (
                      <p className="text-neutral-500 italic text-xs">Program finished with no output.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Execution Metadata Footer */}
              {execMetadata && (
                <div className="h-8 bg-[#111111] border-t border-neutral-800 px-4 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <div className="flex items-center gap-3">
                    {execMetadata.executionTime && (
                      <span className="flex items-center gap-1" title="Execution Time">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {execMetadata.executionTime}s
                      </span>
                    )}
                    {execMetadata.memory && (
                      <span title="Memory Used">{execMetadata.memory}</span>
                    )}
                  </div>
                  <div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        execMetadata.exitCode === 0
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/80'
                      }`}
                    >
                      exit {execMetadata.exitCode}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Code;
