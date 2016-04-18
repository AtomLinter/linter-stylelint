'use babel';

const lazyReq = require('lazy-req')(require);
const { dirname } = lazyReq('path')('dirname');
const stylelint = lazyReq('stylelint');
const { rangeFromLineNumber } = lazyReq('atom-linter')('rangeFromLineNumber');
const assignDeep = lazyReq('assign-deep');
const cosmiconfig = lazyReq('cosmiconfig');
/**
 * Note that this can't be loaded lazily as `atom` doesn't export it correctly
 * for that, however as this comes from app.asar it is pre-compiled and is
 * essentially "free" as there is no expensive compilation step.
 */
import { CompositeDisposable } from 'atom';

export const config = {
  useStandard: {
    title: 'Use standard',
    description: 'Use the stylelint-config-standard lint configuration',
    type: 'boolean',
    default: false
  },
  disableWhenNoConfig: {
    title: 'Disable when no config file is found',
    description: 'Either .stylelintrc or stylelint.config.js',
    type: 'boolean',
    default: false
  }
};

let useStandard;
let presetConfig;
let disableWhenNoConfig;
let subscriptions;

function createRange(editor, data) {
  // data.line & data.column might be undefined for non-fatal invalid rules,
  // e.g.: "block-no-empty": "foo"
  // so we convert undefineds to 1, which will pass 0 to the underlying rangeFromLineNumber
  // which selects the first line of the file
  return rangeFromLineNumber(editor, (data.line || 1) - 1, (data.column || 1) - 1);
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
}

export function deactivate() {
  subscriptions.dispose();
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
      text: msg.text,
      filePath
    }));

    const warnings = result.warnings.map(warning => ({
      type: (!warning.severity || warning.severity === 'error') ? 'Error' : 'Warning',
      text: warning.text,
      filePath,
      range: createRange(editor, warning)
    }));

    return toReturn.concat(invalidOptions).concat(warnings);
  }, error => {
    // was it a code parsing error?
    if (error.line) {
      return [{
        type: 'Error',
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
    grammarScopes: [
      'source.css',
      'source.scss',
      'source.css.scss',
      'source.less',
      'source.css.less',
      'source.css.postcss'
    ],
    scope: 'file',
    lintOnFly: true,
    lint: editor => {
      const filePath = editor.getPath();
      const text = editor.getText();
      const scopes = editor.getLastCursor().getScopeDescriptor().getScopesArray();

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
        scopes.indexOf('source.css.scss') !== -1 ||
        scopes.indexOf('source.scss') !== -1
      ) {
        options.syntax = 'scss';
      }
      if (
        scopes.indexOf('source.css.less') !== -1 ||
        scopes.indexOf('source.less') !== -1
      ) {
        options.syntax = 'less';
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
