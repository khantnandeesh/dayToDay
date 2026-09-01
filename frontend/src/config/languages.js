/**
 * Extensible Language Configuration Registry
 * Allows easy addition of other programming languages (e.g. Java, C++, TypeScript) in the future.
 */

export const SUPPORTED_LANGUAGES = {
  python: {
    id: 'python',
    name: 'Python',
    version: '3.14',
    compiler: 'python-3.14',
    monacoLanguage: 'python',
    fileExtension: '.py',
    fileName: 'main.py',
    documentUri: 'file:///workspace/main.py',
    lspPath: '/lsp/python',
    defaultCode: `def main():
    pass


if __name__ == "__main__":
    main()
`,
    placeholderInput: `Enter standard input here...

Example:
5
10 20 30 40 50`,
  },
  // Additional languages can be added here without refactoring the code page architecture:
  // java: {
  //   id: 'java',
  //   name: 'Java',
  //   version: 'OpenJDK 25',
  //   compiler: 'java-openjdk-25',
  //   monacoLanguage: 'java',
  //   fileExtension: '.java',
  //   fileName: 'Main.java',
  //   documentUri: 'file:///workspace/Main.java',
  //   lspPath: '/lsp/java',
  //   defaultCode: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  // }
};

export const DEFAULT_LANGUAGE_ID = 'python';

export function getLanguageConfig(languageId = DEFAULT_LANGUAGE_ID) {
  const key = (languageId || '').toLowerCase().trim();
  return SUPPORTED_LANGUAGES[key] || SUPPORTED_LANGUAGES.python;
}
