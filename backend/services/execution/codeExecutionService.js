/**
 * Extensible Code Execution Service
 * Supports OnlineCompiler.io execution with modular configuration for multiple languages.
 */

export const SUPPORTED_LANGUAGES = {
  python: {
    id: 'python',
    name: 'Python',
    version: '3.14',
    compiler: 'python-3.14',
    defaultCode: `def main():
    pass


if __name__ == "__main__":
    main()
`,
    maxCodeSize: 100 * 1024, // 100 KB
    maxInputSize: 100 * 1024, // 100 KB
  },
  // Future languages like Java can be registered here:
  // java: {
  //   id: 'java',
  //   name: 'Java',
  //   version: 'OpenJDK 25',
  //   compiler: 'java-openjdk-25',
  //   ...
  // }
};

const ONLINE_COMPILER_ENDPOINT = 'https://api.onlinecompiler.io/api/run-code-sync';

/**
 * Executes source code via OnlineCompiler.io
 *
 * @param {Object} params
 * @param {string} params.language - Language ID (e.g. 'python')
 * @param {string} params.code - Source code to execute
 * @param {string} [params.input] - Standard input stream contents
 * @returns {Promise<Object>} Normalized execution result
 */
export async function executeCode({ language = 'python', code, input = '' }) {
  const langKey = (language || '').toLowerCase().trim();
  const config = SUPPORTED_LANGUAGES[langKey];

  // 1. Language validation
  if (!config) {
    return {
      success: false,
      output: '',
      error: `Unsupported language: '${language}'. Supported languages: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`,
      exitCode: 1,
    };
  }

  // 2. Code content validation
  if (typeof code !== 'string' || code.trim().length === 0) {
    return {
      success: false,
      output: '',
      error: 'Source code cannot be empty.',
      exitCode: 1,
    };
  }

  // 3. Security Limits
  if (code.length > config.maxCodeSize) {
    return {
      success: false,
      output: '',
      error: `Source code exceeds maximum allowed size of ${config.maxCodeSize / 1024} KB.`,
      exitCode: 1,
    };
  }

  const sanitizedInput = typeof input === 'string' ? input : '';
  if (sanitizedInput.length > config.maxInputSize) {
    return {
      success: false,
      output: '',
      error: `Standard input exceeds maximum allowed size of ${config.maxInputSize / 1024} KB.`,
      exitCode: 1,
    };
  }

  const apiKey = process.env.ONLINE_COMPILER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      output: '',
      error:
        'ONLINE_COMPILER_API_KEY is not configured in the backend environment. Please set ONLINE_COMPILER_API_KEY in your environment configuration to enable live execution.',
      exitCode: 1,
    };
  }

  // 4. Call OnlineCompiler.io API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35-second safety timeout

  try {
    const payload = {
      compiler: config.compiler,
      code,
      input: sanitizedInput,
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: apiKey.startsWith('Bearer ') ? apiKey : apiKey,
    };

    const response = await fetch(ONLINE_COMPILER_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg =
        data?.message ||
        data?.error ||
        `OnlineCompiler execution failed with HTTP ${response.status} (${response.statusText})`;

      return {
        success: false,
        output: '',
        error: errorMsg,
        exitCode: response.status,
      };
    }

    // 5. Normalize response fields from OnlineCompiler
    // Expected response format: { output, error, exitCode, time, memory, status, ... }
    const stdout = data?.output || data?.stdout || '';
    const stderr = data?.error || data?.stderr || '';
    const exitCode = typeof data?.exitCode === 'number' ? data.exitCode : (stderr ? 1 : 0);
    const executionTime = data?.time || data?.executionTime || null;
    const memory = data?.memory || null;

    const isSuccess = exitCode === 0 && !stderr;

    return {
      success: isSuccess,
      output: stdout,
      error: stderr,
      exitCode,
      executionTime,
      memory,
      compiler: config.compiler,
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        success: false,
        output: '',
        error: 'Execution timed out (exceeded 30 seconds limit).',
        exitCode: 124,
      };
    }

    return {
      success: false,
      output: '',
      error: `Execution request error: ${err.message}`,
      exitCode: 1,
    };
  }
}

export default {
  SUPPORTED_LANGUAGES,
  executeCode,
};
