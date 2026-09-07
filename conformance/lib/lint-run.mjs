/**
 * Lint a corpus with a given parser and write the findings to a JSON file.
 * Shared by both sides of the rule differential.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { collect } from './corpus.mjs';
import { buildConfig, fingerprint } from './lint-config.mjs';

export async function lintCorpus({ ESLint, js, parser, parserName, react, importX, jsxA11y, corpus, out, fix = false }) {
  const files = collect(corpus);
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: buildConfig({ js, parser, parserName, react, importX, jsxA11y, fix }),
    cwd: corpus,
    fix,
  });

  const results = [];
  const fixedOutput = {};
  for (const relPath of files) {
    const code = readFileSync(join(corpus, relPath), 'utf8');
    let result;
    try {
      [result] = await eslint.lintText(code, { filePath: join(corpus, relPath), warnIgnored: false });
    } catch (error) {
      // A rule crash is a property of the rule and the file, not of the parser;
      // recording it keeps the two runs comparable instead of aborting.
      results.push({
        relativePath: relPath,
        messages: [{ line: 0, column: 0, ruleId: 'CRASH', message: String(error.message).split('\n')[0] }],
      });
      if (fix) fixedOutput[relPath] = code;
      continue;
    }
    if (!result) continue;
    results.push({ relativePath: relPath, messages: result.messages });
    if (fix) fixedOutput[relPath] = result.output ?? code;
  }

  const { byFile, fatal } = fingerprint(results);
  writeFileSync(out, JSON.stringify({ byFile, fatal, fixed: fix ? fixedOutput : undefined }, null, 0));
  return {
    files: files.length,
    findings: Object.values(byFile).reduce((total, lines) => total + lines.length, 0),
    fatal: Object.keys(fatal).length,
  };
}
