'use babel';

// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import { CompositeDisposable } from 'atom';

// Dependencies
let dirname;
let stylelint;
let assignDeep;
let escapeHTML;
let presetConfig;
let generateRange;

// Settings
let useStandard;
let disableWhenNoConfig;
let showIgnored;

// Internal vars
let idleCallbacks;
let subscriptions;
const baseScopes = [
  'source.css',
  'source.scss',
  'source.css.scss',
  'source.less',
  'source.css.less',
  'source.css.postcss',
  'source.css.postcss.sugarss'
];

function loadDeps() {
  if (!dirname) {
    dirname = require('path').dirname;
  }
  if (!stylelint) {
    stylelint = require('stylelint');
  }
  if (!generateRange) {
    generateRange = require('atom-linter').generateRange;
  }
  if (!assignDeep) {
    assignDeep = require('assign-deep');
  }
  if (!escapeHTML) {
    escapeHTML = require('escape-html');
  }
  if (!presetConfig) {
    presetConfig = require('stylelint-config-standard');
  }
}

function startMeasure(baseName) {
  const markName = `${baseName}-start`;
  // Clear any similar start mark from previous runs
  if (performance.getEntriesByName(markName).length) {
    performance.clearMarks(markName);
  }
  performance.mark(markName);
}

function endMeasure(baseName) {
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

function createRange(editor, data) {
  if (!Object.hasOwnProperty.call(data, 'line') && !Object.hasOwnProperty.call(data, 'column')) {
    // data.line & data.column might be undefined for non-fatal invalid rules,
    // e.g.: "block-no-empty": "foo"
    // Return `false` so Linter will ignore the range
    return false;
  }

  return generateRange(editor, data.line - 1, data.column - 1);
}

export function activate() {
  startMeasure('linter-stylelint: Activation');
  idleCallbacks = new Set();
  let depsCallbackID;
  const installLinterStylelintDeps = () => {
    idleCallbacks.delete(depsCallbackID);
    if (!atom.inSpecMode()) {
      require('atom-package-deps').install('linter-stylelint');
    }
    loadDeps();
  };
  depsCallbackID = window.requestIdleCallback(installLinterStylelintDeps);
  idleCallbacks.add(depsCallbackID);

  subscriptions = new CompositeDisposable();

  subscriptions.add(atom.config.observe('linter-stylelint.useStandard', (value) => {
    useStandard = value;
  }));
  subscriptions.add(atom.config.observe('linter-stylelint.disableWhenNoConfig', (value) => {
    disableWhenNoConfig = value;
  }));
  subscriptions.add(atom.config.observe('linter-stylelint.showIgnored', (value) => {
    showIgnored = value;
  }));

  endMeasure('linter-stylelint: Activation');
}

export function deactivate() {
  idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID));
  idleCallbacks.clear();
  subscriptions.dispose();
}

function generateHTMLMessage(message) {
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

const parseResults = (editor, options, results, filePath) => {
  startMeasure('linter-stylelint: Parsing results');
  if (options.code !== editor.getText()) {
    // The editor contents have changed since the lint was requested, tell
    //   Linter not to update the results
    endMeasure('linter-stylelint: Parsing results');
    endMeasure('linter-stylelint: Lint');
    return null;
  }

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

const runStylelint = async (editor, options, filePath) => {
  startMeasure('linter-stylelint: Stylelint');
  let data;
  try {
    data = await stylelint.lint(options);
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
  return parseResults(editor, options, results, filePath);
};

export function provideLinter() {
  return {
    name: 'stylelint',
    grammarScopes: baseScopes,
    scope: 'file',
    lintOnFly: true,
    lint: async (editor) => {
      startMeasure('linter-stylelint: Lint');
      const scopes = editor.getLastCursor().getScopeDescriptor().getScopesArray();

      const filePath = editor.getPath();
      const text = editor.getText();

      if (!text) {
        endMeasure('linter-stylelint: Lint');
        return [];
      }

      // Force the dependencies to load if they haven't already
      loadDeps();

      // Setup base config if useStandard() is true
      const defaultConfig = {
        rules: {}
      };

      // Base the config in the project directory
      let [configBasedir] = atom.project.relativizePath(filePath);
      if (configBasedir === null) {
        // Falling back to the file directory if no project is found
        configBasedir = dirname(filePath);
      }

      const rules = useStandard ? assignDeep({}, presetConfig) : defaultConfig;

      const options = {
        code: text,
        codeFilename: filePath,
        config: rules,
        configBasedir
      };

      if (scopes.includes('source.css.scss') || scopes.includes('source.scss')) {
        options.syntax = 'scss';
      }
      if (scopes.includes('source.css.less') || scopes.includes('source.less')) {
        options.syntax = 'less';
      }
      if (scopes.includes('source.css.postcss.sugarss')) {
        options.syntax = 'sugarss';
        // `stylelint-config-standard` isn't fully compatible with SugarSS
        // See here for details:
        // https://github.com/stylelint/stylelint-config-standard#using-the-config-with-sugarss-syntax
        options.config.rules['block-closing-brace-empty-line-before'] = null;
        options.config.rules['block-closing-brace-newline-after'] = null;
        options.config.rules['block-closing-brace-newline-before'] = null;
        options.config.rules['block-closing-brace-space-before'] = null;
        options.config.rules['block-opening-brace-newline-after'] = null;
        options.config.rules['block-opening-brace-space-after'] = null;
        options.config.rules['block-opening-brace-space-before'] = null;
        options.config.rules['declaration-block-semicolon-newline-after'] = null;
        options.config.rules['declaration-block-semicolon-space-after'] = null;
        options.config.rules['declaration-block-semicolon-space-before'] = null;
        options.config.rules['declaration-block-trailing-semicolon'] = null;
      }

      startMeasure('linter-stylelint: Create Linter');
      const stylelintLinter = await stylelint.createLinter();
      endMeasure('linter-stylelint: Create Linter');

      startMeasure('linter-stylelint: Config');
      let foundConfig;
      try {
        foundConfig = await stylelintLinter.getConfigForFile(filePath);
      } catch (error) {
        if (!/No configuration provided for .+/.test(error.message)) {
          endMeasure('linter-stylelint: Config');
          // If we got here, stylelint failed to parse the configuration
          // there's no point of re-linting if useStandard is true, because the
          // user does not have the complete set of desired rules parsed
          atom.notifications.addError('Unable to parse stylelint configuration', {
            detail: error.message,
            dismissable: true
          });
          endMeasure('linter-stylelint: Lint');
          return [];
        }
      }
      endMeasure('linter-stylelint: Config');

      if (foundConfig) {
        options.config = assignDeep(rules, foundConfig.config);
        options.configBasedir = dirname(foundConfig.filepath);
      }

      if (!foundConfig && disableWhenNoConfig) {
        endMeasure('linter-stylelint: Lint');
        return [];
      }

      startMeasure('linter-stylelint: Check ignored');
      let fileIsIgnored;
      try {
        fileIsIgnored = await stylelintLinter.isPathIgnored(filePath);
      } catch (error) {
        // Do nothing, configuration errors should have already been caught and thrown above
      }
      endMeasure('linter-stylelint: Check ignored');

      if (fileIsIgnored) {
        endMeasure('linter-stylelint: Lint');
        if (showIgnored) {
          return [{
            type: 'Warning',
            severity: 'warning',
            text: 'This file is ignored',
            filePath
          }];
        }
        return [];
      }

      const results = await runStylelint(editor, options, filePath);
      return results;
    }
  };
}
