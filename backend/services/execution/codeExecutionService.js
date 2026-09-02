import { spawn } from 'child_process';

/**
 * Extensible Code Execution Service
 * Supports local Python execution and OnlineCompiler.io execution with modular configuration.
 */

export const SUPPORTED_LANGUAGES = {
  python: {
    id: 'python',
    name: 'Python',
    version: '3.10',
    compiler: 'python-3.10',
    defaultCode: `def main():
    pass


if __name__ == "__main__":
    main()
`,
    maxCodeSize: 100 * 1024, // 100 KB
    maxInputSize: 100 * 1024, // 100 KB
  },
};

const ONLINE_COMPILER_ENDPOINT = 'https://api.onlinecompiler.io/api/run-code-sync';

/**
 * Executes Python code locally using system python3
 *
 * @param {Object} params
 * @param {string} params.code - Python code
 * @param {string} [params.input] - Standard input
 * @param {number} [params.timeout] - Timeout in seconds
 * @returns {Promise<Object>} Execution result
 */
export function executeLocalPython({ code, input = '', timeout = 15 }) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const timeoutMs = Math.min(Math.max(Number(timeout) || 15, 1), 30) * 1000;
    const maxOutputBytes = 512 * 1024; // 512 KB

    let stdout = '';
    let stderr = '';
    let killedDueToTimeout = false;
    let settled = false;

    let child;
    try {
      child = spawn('python3', ['-u', '-c', code], {
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONUNBUFFERED: '1',
        },
      });
    } catch (err) {
      return resolve({
        success: false,
        output: '',
        error: `Failed to spawn Python process: ${err.message}`,
        exitCode: 1,
        executionTime: 0,
        compiler: 'python-local',
      });
    }

    const timer = setTimeout(() => {
      killedDueToTimeout = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (stdout.length < maxOutputBytes) {
        stdout += chunk.toString();
        if (stdout.length >= maxOutputBytes) {
          stdout += '\n[Output truncated: exceeded 512KB limit]';
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      if (stderr.length < maxOutputBytes) {
        stderr += chunk.toString();
        if (stderr.length >= maxOutputBytes) {
          stderr += '\n[Error output truncated: exceeded 512KB limit]';
        }
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const executionTime = Number(((Date.now() - startTime) / 1000).toFixed(3));
      resolve({
        success: false,
        output: stdout,
        error: `Process error: ${err.message}`,
        exitCode: 1,
        executionTime,
        compiler: 'python-local',
      });
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const executionTime = Number(((Date.now() - startTime) / 1000).toFixed(3));

      if (killedDueToTimeout) {
        return resolve({
          success: false,
          output: stdout,
          error: `Execution timed out (exceeded ${timeoutMs / 1000}s limit).`,
          exitCode: 124,
          executionTime,
          compiler: 'python-local',
        });
      }

      const exitCode = typeof code === 'number' ? code : (signal ? 1 : 0);
      const isSuccess = exitCode === 0 && !stderr.trim();

      resolve({
        success: isSuccess,
        output: stdout,
        error: stderr,
        exitCode,
        executionTime,
        compiler: 'python-local',
      });
    });

    // Write stdin and close the stream
    try {
      if (input && typeof input === 'string') {
        child.stdin.write(input);
      }
      child.stdin.end();
    } catch {
      // stdin may already be closed
    }
  });
}

/**
 * Executes source code via local Python runner or OnlineCompiler.io
 *
 * @param {Object} params
 * @param {string} params.language - Language ID (e.g. 'python')
 * @param {string} params.code - Source code to execute
 * @param {string} [params.input] - Standard input stream contents
 * @param {number} [params.timeout] - Timeout in seconds (default 15)
 * @returns {Promise<Object>} Normalized execution result
 */
export async function executeCode({ language = 'python', code, input = '', timeout = 15 }) {
  const langKey = (language || '').toLowerCase().trim();
  const config = SUPPORTED_LANGUAGES[langKey] || SUPPORTED_LANGUAGES.python;

  // 1. Code content validation
  if (typeof code !== 'string' || code.trim().length === 0) {
    return {
      success: false,
      output: '',
      error: 'Source code cannot be empty.',
      exitCode: 1,
      executionTime: 0,
    };
  }

  // 2. Security Limits
  if (code.length > config.maxCodeSize) {
    return {
      success: false,
      output: '',
      error: `Source code exceeds maximum allowed size of ${config.maxCodeSize / 1024} KB.`,
      exitCode: 1,
      executionTime: 0,
    };
  }

  const sanitizedInput = typeof input === 'string' ? input : String(input || '');
  if (sanitizedInput.length > config.maxInputSize) {
    return {
      success: false,
      output: '',
      error: `Standard input exceeds maximum allowed size of ${config.maxInputSize / 1024} KB.`,
      exitCode: 1,
      executionTime: 0,
    };
  }

  const apiKey = process.env.ONLINE_COMPILER_API_KEY;

  // 3. If OnlineCompiler API key is provided and not python-local preference, try OnlineCompiler
  if (apiKey && process.env.PREFER_LOCAL_PYTHON !== 'true') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (timeout + 5) * 1000);

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

      if (response.ok && data) {
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
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Fall through to local runner below
    }
  }

  // 4. Default fast, robust local Python execution
  return executeLocalPython({
    code,
    input: sanitizedInput,
    timeout,
  });
}

export default {
  SUPPORTED_LANGUAGES,
  executeCode,
  executeLocalPython,
};
