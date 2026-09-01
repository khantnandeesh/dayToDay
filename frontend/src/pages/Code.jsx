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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col max-w-[1700px] w-full mx-auto p-3 sm:p-4 md:p-6 gap-3 sm:gap-4">
        {/* Top Control Bar */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Left Title & Language Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                <FileCode2 className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Code</h1>
            </div>

            <div className="h-5 w-px bg-slate-200" />

            {/* Language Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="language-select-btn"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 transition-colors"
              >
                <span>{languageConfig.name}</span>
                <span className="text-xs text-slate-400 font-mono">v{languageConfig.version}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {isLangDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden animate-fade-in">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Language
                  </div>
                  {Object.values(SUPPORTED_LANGUAGES).map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => handleLanguageSelect(lang.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                        selectedLanguageId === lang.id
                          ? 'bg-slate-100 font-semibold text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{lang.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">v{lang.version}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pyright LSP Status Badge */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                lspStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : lspStatus === 'connecting'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
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
                    : 'bg-slate-400'
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

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="reset-code-btn"
              onClick={handleReset}
              disabled={executionStatus === 'running'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.98] rounded-lg shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
                  <span className="hidden lg:inline text-[11px] text-slate-400 font-mono font-normal">
                    (Ctrl+Enter)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* IDE Main Workspace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 min-h-[580px]">
          {/* Left Column: Monaco Editor (65% on desktop ~ 8 cols) */}
          <div className="lg:col-span-8 bg-[#1e1e1e] border border-slate-700/80 rounded-xl shadow-lg overflow-hidden flex flex-col min-h-[420px] lg:min-h-[600px]">
            {/* Editor Header Tab */}
            <div className="h-10 bg-[#252526] border-b border-[#333333] px-3 flex items-center justify-between text-xs text-slate-300 font-mono">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded text-slate-200 font-medium flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {languageConfig.fileName}
                </span>
                <span className="text-slate-500 hidden sm:inline">Python 3.14</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Pyright LSP</span>
              </div>
            </div>

            {/* Editor Mount Area */}
            <div className="flex-1 w-full h-full relative">
              <Editor
                height="100%"
                language={languageConfig.monacoLanguage}
                value={code}
                onChange={(val) => setCode(val || '')}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  automaticLayout: true,
                  tabSize: 4,
                  insertSpaces: true,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                    verticalSliderSize: 8,
                    horizontalSliderSize: 8,
                    useShadows: true,
                  },
                  cursorBlinking: 'smooth',
                  renderLineHighlight: 'all',
                  overviewRulerBorder: false,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </div>
          </div>

          {/* Right Column: Input & Output Panels (35% on desktop ~ 4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-4 min-h-[420px] lg:min-h-[600px]">
            {/* Standard Input Panel (40% height) */}
            <div className="h-48 lg:h-[40%] bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
              <div className="h-9 bg-slate-100/90 border-b border-slate-200 px-3 flex items-center justify-between text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>INPUT (stdin)</span>
                </div>
                <span className="text-[11px] font-normal text-slate-400">Optional</span>
              </div>
              <div className="flex-1 p-2.5 bg-slate-50/50">
                <textarea
                  id="code-stdin-input"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder={languageConfig.placeholderInput}
                  className="w-full h-full p-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none resize-none overflow-auto"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Output Panel (60% height) */}
            <div className="flex-1 lg:h-[60%] bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
              <div className="h-9 bg-slate-100/90 border-b border-slate-200 px-3 flex items-center justify-between text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>OUTPUT</span>
                </div>

                {/* Execution status indicator badge */}
                {executionStatus === 'running' && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    Running...
                  </span>
                )}
                {executionStatus === 'success' && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Success
                  </span>
                )}
                {executionStatus === 'error' && (
                  <span className="flex items-center gap-1 text-[11px] text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    Error
                  </span>
                )}
              </div>

              {/* Output Content Area */}
              <div className="flex-1 p-3 bg-slate-950 text-slate-100 font-mono text-xs overflow-auto select-text custom-scrollbar">
                {executionStatus === 'idle' && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-6">
                    <Zap className="w-6 h-6 mb-2 text-slate-600 opacity-60" />
                    <p className="text-slate-400">Ready to run your code.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Click <strong className="text-slate-400 font-medium">Run Code</strong> or press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">Ctrl+Enter</kbd>
                    </p>
                  </div>
                )}

                {executionStatus === 'running' && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-6">
                    <div className="w-6 h-6 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin mb-3" />
                    <p className="font-sans text-xs">Executing via OnlineCompiler...</p>
                  </div>
                )}

                {(executionStatus === 'success' || executionStatus === 'error') && (
                  <div className="space-y-2">
                    {/* stdout */}
                    {output && (
                      <pre className="whitespace-pre-wrap break-all text-slate-100 leading-relaxed font-mono">
                        {output}
                      </pre>
                    )}

                    {/* stderr / error */}
                    {errorOutput && (
                      <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 whitespace-pre-wrap break-all leading-relaxed">
                        {errorOutput}
                      </div>
                    )}

                    {/* Empty output case */}
                    {!output && !errorOutput && (
                      <p className="text-slate-500 italic">Program finished with no output.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Execution Metadata Footer */}
              {execMetadata && (
                <div className="h-8 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-3">
                    {execMetadata.executionTime && (
                      <span className="flex items-center gap-1" title="Execution Time">
                        <Clock className="w-3 h-3 text-slate-500" />
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
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      exit: {execMetadata.exitCode}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Code;
