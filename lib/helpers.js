'use babel';

import { dirname } from 'path';
import stylelint from 'stylelint';
import assignDeep from 'assign-deep';
import { generateRange } from 'atom-linter';
import presetConfig from 'stylelint-config-standard';

export function startMeasure(baseName) {
  const markName = `${baseName}-start`;
  // Clear any similar start mark from previous runs
  if (performance.getEntriesByName(markName).length) {
    performance.clearMarks(markName);
  }
  performance.mark(markName);
}

export function endMeasure(baseName) {
  if (atom.inDevMode()) {
    performance.mark(`${baseName}-end`);
    performance.measure(baseName, `${baseName}-start`, `${baseName}-end`);
    const duration = Math.round(performance.getEntriesByName(baseName)[0].duration * 10000) / 10000;
    // eslint-disable-next-line no-console
    console.log(`${baseName} took ${duration} ms`);
    performance.clearMarks(`${baseName}-end`);
    performance.clearMeasures(baseName);
  }
  performance.clearMarks(`${baseName}-start`);
}

export function createRange(editor, data) {
  if (!data ||
    (!Object.hasOwnProperty.call(data, 'line') && !Object.hasOwnProperty.call(data, 'column'))
  ) {
    // data.line & data.column might be undefined for non-fatal invalid rules,
    // e.g.: "block-no-empty": "foo"
    // Return a range encompassing the first line of the file
    return generateRange(editor);
  }

  return generateRange(editor, data.line - 1, data.column - 1);
}

const parseResults = (editor, results, filePath, showIgnored) => {
  startMeasure('linter-stylelint: Parsing results');
  if (!results) {
    endMeasure('linter-stylelint: Parsing results');
    endMeasure('linter-stylelint: Lint');
    return [];
  }

  const invalidOptions = results.invalidOptionWarnings.map(msg => ({
    severity: 'error',
    excerpt: msg.text,
    location: {
      file: filePath,
      position: createRange(editor)
    }
  }));

  const warnings = results.warnings.map((warning) => {
    // Stylelint only allows 'error' and 'warning' as severity values
    const severity = !warning.severity || warning.severity === 'error' ? 'Error' : 'Warning';
    const message = {
      severity: severity.toLowerCase(),
      excerpt: warning.text,
      location: {
        file: filePath,
        position: createRange(editor, warning)
      }
    };

    const ruleParts = warning.rule.split('/');
    if (ruleParts.length === 1) {
      // Core rule
      message.url = `http://stylelint.io/user-guide/rules/${ruleParts[0]}`;
    } else {
      // Plugin rule
      const pluginName = ruleParts[0];
      // const ruleName = ruleParts[1];

      const linterStylelintURL = 'https://github.com/AtomLinter/linter-stylelint/tree/master/docs';
      switch (pluginName) {
        case 'plugin':
          message.url = `${linterStylelintURL}/noRuleNamespace.md`;
          break;
        default:
          message.url = `${linterStylelintURL}/linkingNewRule.md`;
      }
    }

    return message;
  });

  const deprecations = results.deprecations.map(deprecation => ({
    severity: 'warning',
    excerpt: deprecation.text,
    url: deprecation.reference,
    location: {
      file: filePath,
      position: createRange(editor)
    }
  }));

  const ignored = [];
  if (showIgnored && results.ignored) {
    ignored.push({
      severity: 'warning',
      excerpt: 'This file is ignored',
      location: {
        file: filePath,
        position: createRange(editor)
      }
    });
  }

  const toReturn = []
    .concat(invalidOptions)
    .concat(warnings)
    .concat(deprecations)
    .concat(ignored);

  endMeasure('linter-stylelint: Parsing results');
  endMeasure('linter-stylelint: Lint');
  return toReturn;
};

export const runStylelint = async (editor, stylelintOptions, filePath, settings) => {
  startMeasure('linter-stylelint: Stylelint');
  let data;
  try {
    data = await stylelint.lint(stylelintOptions);
  } catch (error) {
    endMeasure('linter-stylelint: Stylelint');
    // Was it a code parsing error?
    if (error.line) {
      endMeasure('linter-stylelint: Lint');
      return [{
        severity: 'error',
        excerpt: error.reason || error.message,
        location: {
          file: filePath,
          position: createRange(editor, error)
        }
      }];
    }

    // If we got here, stylelint found something really wrong with the
    // configuration, such as extending an invalid configuration
    atom.notifications.addError('Unable to run stylelint', {
      detail: error.reason || error.message,
      dismissable: true
    });

    endMeasure('linter-stylelint: Lint');
    return [];
  }
  endMeasure('linter-stylelint: Stylelint');

  const results = data.results.shift();

  if (stylelintOptions.code !== editor.getText()) {
    // The editor contents have changed since the lint was requested, tell
    //   Linter not to update the results
    endMeasure('linter-stylelint: Lint');
    return null;
  }
  return parseResults(editor, results, filePath, settings.showIgnored);
};

export function getDefaultConfig(syntax, filePath) {
  const defaultConfig = assignDeep({}, presetConfig);

  if (syntax === 'sugarss') {
    // `stylelint-config-standard` isn't fully compatible with SugarSS
    // See here for details:
    // https://github.com/stylelint/stylelint-config-standard#using-the-config-with-sugarss-syntax
    defaultConfig.rules['block-closing-brace-empty-line-before'] = null;
    defaultConfig.rules['block-closing-brace-newline-after'] = null;
    defaultConfig.rules['block-closing-brace-newline-before'] = null;
    defaultConfig.rules['block-closing-brace-space-before'] = null;
    defaultConfig.rules['block-opening-brace-newline-after'] = null;
    defaultConfig.rules['block-opening-brace-space-after'] = null;
    defaultConfig.rules['block-opening-brace-space-before'] = null;
    defaultConfig.rules['declaration-block-semicolon-newline-after'] = null;
    defaultConfig.rules['declaration-block-semicolon-space-after'] = null;
    defaultConfig.rules['declaration-block-semicolon-space-before'] = null;
    defaultConfig.rules['declaration-block-trailing-semicolon'] = null;
  }

  // Base the config in the project directory
  let [configBasedir] = atom.project.relativizePath(filePath);
  if (configBasedir === null) {
    // Falling back to the file directory if no project is found
    configBasedir = dirname(filePath);
  }
  defaultConfig.configBasedir = configBasedir;

  return defaultConfig;
}
