import { executeCode, SUPPORTED_LANGUAGES } from '../services/execution/codeExecutionService.js';

/**
 * @desc    Execute code using OnlineCompiler.io
 * @route   POST /api/code/run
 * @access  Private (Authenticated users)
 */
export const runCode = async (req, res) => {
  try {
    const { language = 'python', code, input } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Code is required and must be a string',
      });
    }

    const result = await executeCode({ language, code, input });

    return res.status(200).json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('Error in runCode controller:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while executing code',
      error: error.message,
    });
  }
};

/**
 * @desc    Get list of supported languages and default templates
 * @route   GET /api/code/languages
 * @access  Private / Public
 */
export const getLanguages = async (req, res) => {
  try {
    const languages = Object.values(SUPPORTED_LANGUAGES).map((lang) => ({
      id: lang.id,
      name: lang.name,
      version: lang.version,
      compiler: lang.compiler,
      defaultCode: lang.defaultCode,
    }));

    return res.status(200).json({
      success: true,
      data: languages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve languages',
    });
  }
};
