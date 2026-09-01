/**
 * Language Server Protocol (LSP) Client for Monaco Editor
 * Connects Monaco to Pyright (and other Language Servers) over WebSocket using standard JSON-RPC 2.0.
 */

// Mapping of LSP CompletionItemKind (1-25) to Monaco CompletionItemKind
const LSP_TO_MONACO_COMPLETION_KIND = {
  1: 0, // Text
  2: 1, // Method
  3: 2, // Function
  4: 3, // Constructor
  5: 4, // Field
  6: 5, // Variable
  7: 6, // Class
  8: 7, // Interface
  9: 8, // Module
  10: 9, // Property
  11: 10, // Unit
  12: 11, // Value
  13: 12, // Enum
  14: 13, // Keyword
  15: 14, // Snippet
  16: 15, // Color
  17: 16, // File
  18: 17, // Reference
  19: 18, // Folder
  20: 19, // EnumMember
  21: 20, // Constant
  22: 21, // Struct
  23: 22, // Event
  24: 23, // Operator
  25: 24, // TypeParameter
};

export class MonacoLspClient {
  constructor({ languageConfig, monaco, editor, onStatusChange }) {
    this.config = languageConfig;
    this.monaco = monaco;
    this.editor = editor;
    this.onStatusChange = onStatusChange || (() => {});

    this.socket = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.disposables = [];
    this.isInitialized = false;
    this.documentVersion = 1;
    this.documentUri = this.config.documentUri || `file:///workspace/${this.config.fileName || 'main.py'}`;
    this.isDestroyed = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
  }

  getWebSocketUrl() {
    const customBackend = import.meta.env.VITE_BACKEND_URL;
    let base = '';

    if (customBackend && typeof customBackend === 'string' && customBackend.trim().length > 0) {
      base = customBackend.replace(/^http/, 'ws');
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      base = `${protocol}//${window.location.host}`;
    } else {
      base = 'ws://localhost:3000';
    }

    const lspPath = this.config.lspPath || `/lsp/${this.config.id || 'python'}`;
    // Strip trailing slash from base and ensure lspPath starts with slash
    return `${base.replace(/\/+$/, '')}/${lspPath.replace(/^\/+/, '')}`;
  }

  connect() {
    if (this.isDestroyed) return;

    this.onStatusChange('connecting');
    const wsUrl = this.getWebSocketUrl();

    try {
      this.socket = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('[LSP Client] Failed to create WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      if (this.isDestroyed) {
        this.socket.close();
        return;
      }
      this.reconnectAttempts = 0;
      this.onStatusChange('connected');
      this.sendInitialize();
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[LSP Client] Error parsing incoming message:', err);
      }
    };

    this.socket.onerror = (err) => {
      console.warn('[LSP Client] WebSocket error:', err);
      this.onStatusChange('error');
    };

    this.socket.onclose = () => {
      this.isInitialized = false;
      this.onStatusChange('disconnected');
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    };
  }

  scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  send(method, params, isNotification = false) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      if (isNotification) return;
      return Promise.reject(new Error('LSP WebSocket is not open'));
    }

    if (isNotification) {
      const payload = {
        jsonrpc: '2.0',
        method,
        params,
      };
      this.socket.send(JSON.stringify(payload));
      return;
    }

    const id = ++this.requestId;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request timeout for ${method} (id: ${id})`));
        }
      }, 10000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify(payload));
    });
  }

  sendInitialize() {
    this.send('initialize', {
      processId: null,
      clientInfo: {
        name: 'DayToDay Monaco IDE',
        version: '1.0.0',
      },
      rootUri: this.config.rootUri || 'file:///workspace',
      workspaceFolders: [
        {
          uri: this.config.rootUri || 'file:///workspace',
          name: 'workspace',
        },
      ],
      capabilities: {
        workspace: {
          workspaceFolders: true,
          configuration: true,
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: true,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          completion: {
            dynamicRegistration: true,
            contextSupport: true,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
              deprecatedSupport: true,
              preselectSupport: true,
            },
            completionItemKind: {
              valueSet: Array.from({ length: 25 }, (_, i) => i + 1),
            },
          },
          hover: {
            dynamicRegistration: true,
            contentFormat: ['markdown', 'plaintext'],
          },
          signatureHelp: {
            dynamicRegistration: true,
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          definition: {
            dynamicRegistration: true,
            linkSupport: true,
          },
          publishDiagnostics: {
            relatedInformation: true,
            versionSupport: true,
            codeDescriptionSupport: true,
            dataSupport: true,
          },
        },
      },
    })
      .then(() => {
        this.isInitialized = true;
        this.send('initialized', {}, true);
        this.bindDocument();
        this.registerMonacoProviders();
      })
      .catch((err) => {
        console.error('[LSP Client] Initialize failed:', err);
      });
  }

  bindDocument() {
    const model = this.editor.getModel();
    if (!model) return;

    // Send didOpen notification
    this.send(
      'textDocument/didOpen',
      {
        textDocument: {
          uri: this.documentUri,
          languageId: this.config.monacoLanguage || 'python',
          version: this.documentVersion,
          text: model.getValue(),
        },
      },
      true
    );

    // Track document changes
    let changeDebounceTimer = null;
    const contentDisposable = model.onDidChangeContent(() => {
      if (!this.isInitialized) return;

      if (changeDebounceTimer) {
        clearTimeout(changeDebounceTimer);
      }

      changeDebounceTimer = setTimeout(() => {
        this.documentVersion++;
        this.send(
          'textDocument/didChange',
          {
            textDocument: {
              uri: this.documentUri,
              version: this.documentVersion,
            },
            contentChanges: [
              {
                text: model.getValue(),
              },
            ],
          },
          true
        );
      }, 100);
    });

    this.disposables.push({
      dispose: () => {
        if (changeDebounceTimer) clearTimeout(changeDebounceTimer);
        contentDisposable.dispose();
      },
    });
  }

  handleMessage(msg) {
    // Response to a request
    if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(msg.id);
      clearTimeout(timeout);
      this.pendingRequests.delete(msg.id);

      if (msg.error) {
        reject(new Error(msg.error.message || 'LSP Request failed'));
      } else {
        resolve(msg.result);
      }
      return;
    }

    // Diagnostics notification from Pyright
    if (msg.method === 'textDocument/publishDiagnostics') {
      this.handlePublishDiagnostics(msg.params);
      return;
    }
  }

  handlePublishDiagnostics(params) {
    if (!params || !this.editor) return;

    const model = this.editor.getModel();
    if (!model) return;

    const diagnostics = params.diagnostics || [];
    const markers = diagnostics.map((diag) => {
      let severity = this.monaco.MarkerSeverity.Info;
      if (diag.severity === 1) severity = this.monaco.MarkerSeverity.Error;
      else if (diag.severity === 2) severity = this.monaco.MarkerSeverity.Warning;
      else if (diag.severity === 3) severity = this.monaco.MarkerSeverity.Info;
      else if (diag.severity === 4) severity = this.monaco.MarkerSeverity.Hint;

      const startLineNumber = (diag.range?.start?.line ?? 0) + 1;
      const startColumn = (diag.range?.start?.character ?? 0) + 1;
      const endLineNumber = (diag.range?.end?.line ?? 0) + 1;
      const endColumn = (diag.range?.end?.character ?? 0) + 1;

      return {
        severity,
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn,
        message: diag.message || 'Diagnostic',
        source: diag.source || 'Pyright',
        code: diag.code ? String(diag.code) : undefined,
      };
    });

    this.monaco.editor.setModelMarkers(model, 'pyright', markers);
  }

  registerMonacoProviders() {
    const monacoLanguage = this.config.monacoLanguage || 'python';

    // 1. Completion Provider
    const completionDisposable = this.monaco.languages.registerCompletionItemProvider(
      monacoLanguage,
      {
        triggerCharacters: ['.', '(', '"', "'", '/', '@', ' '],
        provideCompletionItems: async (model, position, context) => {
          if (!this.isInitialized) return { suggestions: [] };

          try {
            const result = await this.send('textDocument/completion', {
              textDocument: { uri: this.documentUri },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1,
              },
              context: {
                triggerKind: context.triggerKind === 1 ? 1 : 2,
                triggerCharacter: context.triggerCharacter,
              },
            });

            if (!result) return { suggestions: [] };

            const items = Array.isArray(result) ? result : result.items || [];
            const wordUntil = model.getWordUntilPosition(position);
            const defaultRange = {
              startLineNumber: position.lineNumber,
              startColumn: wordUntil.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: wordUntil.endColumn,
            };

            const suggestions = items.map((item) => {
              const kind =
                item.kind && LSP_TO_MONACO_COMPLETION_KIND[item.kind] !== undefined
                  ? LSP_TO_MONACO_COMPLETION_KIND[item.kind]
                  : this.monaco.languages.CompletionItemKind.Property;

              let insertText = item.insertText || item.label;
              let insertTextRules =
                item.insertTextFormat === 2
                  ? this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : this.monaco.languages.CompletionItemInsertTextRule.None;

              let doc = undefined;
              if (item.documentation) {
                if (typeof item.documentation === 'string') {
                  doc = { value: item.documentation };
                } else if (item.documentation.value) {
                  doc = { value: item.documentation.value };
                }
              }

              let range = defaultRange;
              if (item.textEdit && item.textEdit.range) {
                range = {
                  startLineNumber: item.textEdit.range.start.line + 1,
                  startColumn: item.textEdit.range.start.character + 1,
                  endLineNumber: item.textEdit.range.end.line + 1,
                  endColumn: item.textEdit.range.end.character + 1,
                };
                insertText = item.textEdit.newText;
              }

              return {
                label: item.label,
                kind,
                detail: item.detail,
                documentation: doc,
                insertText,
                insertTextRules,
                range,
                sortText: item.sortText,
                filterText: item.filterText,
              };
            });

            return {
              suggestions,
              incomplete: result.isIncomplete || false,
            };
          } catch (err) {
            console.warn('[LSP Client] Completion request failed:', err.message);
            return { suggestions: [] };
          }
        },
      }
    );
    this.disposables.push(completionDisposable);

    // 2. Hover Provider
    const hoverDisposable = this.monaco.languages.registerHoverProvider(monacoLanguage, {
      provideHover: async (model, position) => {
        if (!this.isInitialized) return null;

        try {
          const result = await this.send('textDocument/hover', {
            textDocument: { uri: this.documentUri },
            position: {
              line: position.lineNumber - 1,
              character: position.column - 1,
            },
          });

          if (!result || !result.contents) return null;

          let contents = [];
          if (Array.isArray(result.contents)) {
            contents = result.contents.map((c) => ({
              value: typeof c === 'string' ? c : c.value || '',
            }));
          } else if (typeof result.contents === 'string') {
            contents = [{ value: result.contents }];
          } else if (result.contents.value) {
            contents = [{ value: result.contents.value }];
          }

          let range = undefined;
          if (result.range) {
            range = {
              startLineNumber: result.range.start.line + 1,
              startColumn: result.range.start.character + 1,
              endLineNumber: result.range.end.line + 1,
              endColumn: result.range.end.character + 1,
            };
          }

          return {
            contents,
            range,
          };
        } catch {
          return null;
        }
      },
    });
    this.disposables.push(hoverDisposable);

    // 3. Signature Help Provider
    const signatureDisposable = this.monaco.languages.registerSignatureHelpProvider(
      monacoLanguage,
      {
        signatureHelpTriggerCharacters: ['(', ','],
        signatureHelpRetriggerCharacters: [','],
        provideSignatureHelp: async (model, position) => {
          if (!this.isInitialized) return null;

          try {
            const result = await this.send('textDocument/signatureHelp', {
              textDocument: { uri: this.documentUri },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1,
              },
            });

            if (!result || !result.signatures || result.signatures.length === 0) return null;

            return {
              value: {
                activeSignature: result.activeSignature || 0,
                activeParameter: result.activeParameter || 0,
                signatures: result.signatures.map((sig) => ({
                  label: sig.label,
                  documentation:
                    typeof sig.documentation === 'string'
                      ? sig.documentation
                      : sig.documentation?.value,
                  parameters: (sig.parameters || []).map((p) => ({
                    label: p.label,
                    documentation:
                      typeof p.documentation === 'string'
                        ? p.documentation
                        : p.documentation?.value,
                  })),
                })),
              },
              dispose: () => {},
            };
          } catch {
            return null;
          }
        },
      }
    );
    this.disposables.push(signatureDisposable);
  }

  dispose() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clean up markers
    if (this.editor && this.monaco) {
      const model = this.editor.getModel();
      if (model) {
        this.monaco.editor.setModelMarkers(model, 'pyright', []);
      }
    }

    // Send didClose
    if (this.isInitialized && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send(
        'textDocument/didClose',
        {
          textDocument: {
            uri: this.documentUri,
          },
        },
        true
      );
    }

    // Dispose all Monaco providers
    this.disposables.forEach((d) => {
      try {
        d.dispose();
      } catch {
        // Ignore
      }
    });
    this.disposables = [];

    // Clear pending requests
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timeout);
      req.reject(new Error('LSP Client disposed'));
    }
    this.pendingRequests.clear();

    // Close socket
    if (this.socket) {
      try {
        this.socket.close(1000, 'Client destroyed');
      } catch {
        // Ignore
      }
      this.socket = null;
    }
  }
}
