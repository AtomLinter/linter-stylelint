'use babel';

import stylelint from 'stylelint';
import escapeHTML from 'escape-html';
import { generateRange } from 'atom-linter';

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
  if (!Object.hasOwnProperty.call(data, 'line') && !Object.hasOwnProperty.call(data, 'column')) {
    // data.line & data.column might be undefined for non-fatal invalid rules,
    // e.g.: "block-no-empty": "foo"
    // Return `false` so Linter will ignore the range
    return false;
  }

  return generateRange(editor, data.line - 1, data.column - 1);
}

export function generateHTMLMessage(message) {
  if (!message.rule || message.rule === 'CssSyntaxError') {
    return escapeHTML(message.text);
  }

  const ruleParts = message.rule.split('/');
  let url;

  if (ruleParts.length === 1) {
    // Core rule
    url = `http://stylelint.io/user-guide/rules/${ruleParts[0]}`;
  } else {
    // Plugin rule
    const pluginName = ruleParts[0];
    // const ruleName = ruleParts[1];

    switch (pluginName) {
      case 'plugin':
        url = 'https://github.com/AtomLinter/linter-stylelint/tree/master/docs/noRuleNamespace.md';
        break;
      default:
        url = 'https://github.com/AtomLinter/linter-stylelint/tree/master/docs/linkingNewRule.md';
    }
  }

  // Escape any HTML in the message, and replace the rule ID with a link
  return escapeHTML(message.text).replace(
    `(${message.rule})`, `(<a href="${url}">${message.rule}</a>)`
  );
}

export const parseResults = (editor, results, filePath, showIgnored) => {
  startMeasure('linter-stylelint: Parsing results');
  if (!results) {
    endMeasure('linter-stylelint: Parsing results');
    endMeasure('linter-stylelint: Lint');
    return [];
  }

  const invalidOptions = results.invalidOptionWarnings.map(msg => ({
    type: 'Error',
    severity: 'error',
    text: msg.text,
    filePath
  }));

  const warnings = results.warnings.map((warning) => {
    // Stylelint only allows 'error' and 'warning' as severity values
    const severity = !warning.severity || warning.severity === 'error' ? 'Error' : 'Warning';
    return {
      type: severity,
      severity: severity.toLowerCase(),
      html: generateHTMLMessage(warning),
      filePath,
      range: createRange(editor, warning)
    };
  });

  const deprecations = results.deprecations.map(deprecation => ({
    type: 'Warning',
    severity: 'warning',
    html: `${escapeHTML(deprecation.text)} (<a href="${deprecation.reference}">reference</a>)`,
    filePath
  }));

  const ignored = [];
  if (showIgnored && results.ignored) {
    ignored.push({
      type: 'Warning',
      severity: 'warning',
      text: 'This file is ignored',
      filePath
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
        type: 'Error',
        severity: 'error',
        text: error.reason || error.message,
        filePath,
        range: createRange(editor, error)
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
