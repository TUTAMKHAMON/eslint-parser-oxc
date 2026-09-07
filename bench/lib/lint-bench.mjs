/** Time a full ESLint pass over a corpus with a given parser. */

import { ESLint } from 'eslint';
import js from '@eslint/js';

import { buildConfig } from '../../conformance/lib/lint-config.mjs';

export async function lintOnce({ parser, parserName, languageOptions, react, importX, jsxA11y, files, corpus }) {
  const [base] = buildConfig({ js, parser, parserName, react, importX, jsxA11y });
  const config = languageOptions
    ? { ...base, languageOptions: { ...base.languageOptions, ...languageOptions } }
    : base;

  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [config], cwd: corpus });
  let messages = 0;
  for (const file of files) {
    try {
      const [result] = await eslint.lintText(file.code, { filePath: file.filePath, warnIgnored: false });
      messages += result?.messages.length ?? 0;
    } catch {
      // A rule that crashes on a corpus file is not what is being measured.
    }
  }
  return messages;
}
