'use babel';

const lazyReq = require('lazy-req')(require);
const { dirname } = lazyReq('path')('dirname');
const stylelint = lazyReq('stylelint');
const { rangeFromLineNumber } = lazyReq('atom-linter')('rangeFromLineNumber');
const assignDeep = lazyReq('assign-deep');
const cosmiconfig = lazyReq('cosmiconfig');
const escapeHTML = lazyReq('escape-html');
/**
 * Note that this can't be loaded lazily as `atom` doesn't export it correctly
 * for that, however as this comes from app.asar it is pre-compiled and is
 * essentially "free" as there is no expensive compilation step.
 */
import { CompositeDisposable } from 'atom';

// Settings
let useStandard;
let presetConfig;
let disableWhenNoConfig;
let showIgnored;
// Internal vars
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

function createRange(editor, data) {
  if (!data.hasOwnProperty('line') && !data.hasOwnProperty('column')) {
    // data.line & data.column might be undefined for non-fatal invalid rules,
    // e.g.: "block-no-empty": "foo"
    // Return `false` so Linter will ignore the range
    return false;
  }

  return rangeFromLineNumber(editor, data.line - 1, data.column - 1);
}

export function activate() {
  require('atom-package-deps').install('linter-stylelint');

  subscriptions = new CompositeDisposable();

  subscriptions.add(atom.config.observe('linter-stylelint.useStandard', value => {
    useStandard = value;
  }));
  subscriptions.add(atom.config.observe('linter-stylelint.disableWhenNoConfig', value => {
    disableWhenNoConfig = value;
  }));
  subscriptions.add(atom.config.observe('linter-stylelint.showIgnored', value => {
    showIgnored = value;
  }));
}

export function deactivate() {
  subscriptions.dispose();
}

function generateHTMLMessage(message) {
  if (!message.rule || message.rule === 'CssSyntaxError') {
    return escapeHTML()(message.text);
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
  return escapeHTML()(message.text).replace(
    `(${message.rule})`, `(<a href="${url}">${message.rule}</a>)`
  );
}

function runStylelint(editor, options, filePath) {
  return stylelint().lint(options).then(data => {
    const result = data.results.shift();
    const toReturn = [];

    if (!result) {
      return toReturn;
    }

    const invalidOptions = result.invalidOptionWarnings.map(msg => ({
      type: 'Error',
      severity: 'error',
      text: msg.text,
      filePath
    }));

    const warnings = result.warnings.map(warning => {
      // stylelint only allows 'error' and 'warning' as severity values
      const severity = !warning.severity || warning.severity === 'error' ? 'Error' : 'Warning';
      return {
        type: severity,
        severity: severity.toLowerCase(),
        html: generateHTMLMessage(warning),
        filePath,
        range: createRange(editor, warning)
      };
    });

    const deprecations = result.deprecations.map(deprecation => ({
      type: 'Warning',
      severity: 'warning',
      html: `${escapeHTML()(deprecation.text)} (<a href="${deprecation.reference}">reference</a>)`,
      filePath
    }));

    const ignored = [];
    if (showIgnored && result.ignored) {
      ignored.push({
        type: 'Warning',
        severity: 'warning',
        text: 'This file is ignored',
        filePath
      });
    }

    return toReturn
      .concat(invalidOptions)
      .concat(warnings)
      .concat(deprecations)
      .concat(ignored);
  }, error => {
    // was it a code parsing error?
    if (error.line) {
      return [{
        type: 'Error',
        severity: 'error',
        text: error.reason || error.message,
        filePath,
        range: createRange(editor, error)
      }];
    }

    // if we got here, stylelint found something really wrong with the configuration,
    // such as extending an invalid configuration
    atom.notifications.addError('Unable to run stylelint', {
      detail: error.reason || error.message,
      dismissable: true
    });

    return [];
  });
}

export function provideLinter() {
  return {
    name: 'stylelint',
    grammarScopes: baseScopes,
    scope: 'file',
    lintOnFly: true,
    lint: editor => {
      const scopes = editor.getLastCursor().getScopeDescriptor().getScopesArray();

      const filePath = editor.getPath();
      const text = editor.getText();

      if (!text) {
        return Promise.resolve([]);
      }

      // Require stylelint-config-standard if it hasn't already been loaded
      if (!presetConfig) {
        presetConfig = require('stylelint-config-standard');
      }
      // setup base config which is based on selected preset if useStandard() is true
      const rules = useStandard ? assignDeep()({}, presetConfig) : {};

      const options = {
        code: text,
        codeFilename: filePath,
        config: rules,
        configBasedir: dirname(filePath)
      };

      if (
        scopes.includes('source.css.scss') ||
        scopes.includes('source.scss')
      ) {
        options.syntax = 'scss';
      }
      if (
        scopes.includes('source.css.less') ||
        scopes.includes('source.less')
      ) {
        options.syntax = 'less';
      }
      if (
        scopes.includes('source.css.postcss.sugarss')
      ) {
        options.syntax = 'sugarss';
        // `stylelint-config-standard` isn't fully compatible with SugarSS
        // See here for details:
        // https://github.com/stylelint/stylelint-config-standard#using-the-config-with-sugarss-syntax
        options.config.rules['declaration-block-trailing-semicolon'] = null;
      }

      return cosmiconfig()('stylelint', {
        cwd: dirname(filePath),

        // Allow extensions on rc filenames
        rcExtensions: true
      }).then(result => {
        if (result) {
          options.config = assignDeep()(rules, result.config);
          options.configBasedir = dirname(result.filepath);
        }

        if (!result && disableWhenNoConfig) {
          return [];
        }

        return runStylelint(editor, options, filePath);
      }, error => {
        // if we got here, cosmiconfig failed to parse the configuration
        // there's no point of re-linting if useStandard is true, because the user does not have
        // the complete set of desired rules parsed
        atom.notifications.addError('Unable to parse stylelint configuration', {
          detail: error.message,
          dismissable: true
        });
      }).then(result => result || []);
    }
  };
}
