'use babel';

import path from 'path';
import { rangeFromLineNumber } from 'atom-linter';
import stylelint from 'stylelint';
import assign from 'deep-assign';
import cosmiconfig from 'cosmiconfig';

export const config = {
  usePreset: {
    title: 'Use preset',
    description: 'Use preset lint config',
    type: 'boolean',
    default: false
  },
  presetConfig: {
    title: 'Preset config',
    description: 'Select lint style if you select from presets',
    type: 'string',
    default: 'stylelint-config-suitcss',
    enum: [
      'stylelint-config-suitcss',
      'stylelint-config-cssrecipes',
      'stylelint-config-wordpress'
    ]
  },
  disableWhenNoConfig: {
    title: 'Disable when no config file is found',
    description: 'Either .stylelintrc or stylelint.config.js',
    type: 'boolean',
    default: false
  }
};

const usePreset = () => atom.config.get('linter-stylelint.usePreset');
const presetConfig = () => atom.config.get('linter-stylelint.presetConfig');
const disableWhenNoConfig = () => atom.config.get('linter-stylelint.disableWhenNoConfig');

function createRange(editor, data) {
  // data.line & data.column might be undefined for non-fatal invalid rules,
  // e.g.: "block-no-empty": "foo"
  // so we convert undefineds to 1, which will pass 0 to the underlying rangeFromLineNumber
  // which selects the first line of the file
  return rangeFromLineNumber(editor, (data.line || 1) - 1, (data.column || 1) - 1);
}

export const activate = () => {
  require('atom-package-deps').install('linter-stylelint');
};

const runStylelint = (editor, options, filePath) => {
  return stylelint.lint(options).then(data => {
    const result = data.results.shift();

    if (!result) {
      return [];
    }

    return result.warnings.map(warning => {
      return {
        type: (!warning.severity || warning.severity === 'error') ? 'Error' : 'Warning',
        text: warning.text,
        filePath,
        range: createRange(editor, warning)
      };
    });
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
  });
};

export const provideLinter = () => {
  return {
    name: 'stylelint',
    grammarScopes: ['source.css', 'source.css.scss'],
    scope: 'file',
    lintOnFly: true,
    lint: (editor) => {
      const filePath = editor.getPath();
      const text = editor.getText();
      const scopes = editor.getLastCursor().getScopeDescriptor().getScopesArray();

      if (!text) {
        return [];
      }

      // setup base config which is based on selected preset if usePreset() is true
      const rules = usePreset() ? require(presetConfig()) : {};

      const options = {
        code: text,
        config: rules,
        configBasedir: path.dirname(filePath)
      };

      if (scopes.indexOf('source.css.scss') !== -1) {
        options.syntax = 'scss';
      }

      return cosmiconfig('stylelint', {
        cwd: path.dirname(filePath)
      }).then(result => {
        if (result) {
          options.config = assign(rules, result.config);
          options.configBasedir = path.dirname(result.filepath);
        }

        if (!result && disableWhenNoConfig()) {
          return [];
        }

        return runStylelint(editor, options, filePath);
      }, error => {
        // if we got here, cosmiconfig failed to parse the configuration
        // there's no point of re-linting if usePreset is true, because the user does not have
        // the complete set of desired rules parsed
        atom.notifications.addError('Unable to parse stylelint configuration', {
          detail: error.message,
          dismissable: true
        });
      }).then(result => result || []);
    }
  };
};
