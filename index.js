'use babel';

import path from 'path';
import { Range } from 'atom';
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
    enum: ['stylelint-config-suitcss', 'stylelint-config-cssrecipes', 'stylelint-config-wordpress']
  }
};

const usePreset = () => atom.config.get('linter-stylelint.usePreset');
const presetConfig = () => atom.config.get('linter-stylelint.presetConfig');

export const activate = () => {
  require('atom-package-deps').install('linter-stylelint');
};

const runStylelint = (options, filePath) => {
  return stylelint.lint(options).then(data => {
    const result = data.results.shift();

    if (!result) {
      return [];
    }

    return result.warnings.map(warning => {
      const range = new Range(
        [warning.line - 1, warning.column - 1],
        [warning.line - 1, warning.column + 1000]
      );

      return {
        type: (warning.severity === 2) ? 'Error' : 'Warning',
        text: warning.text,
        filePath,
        range
      };
    });
  }).catch(error => {
    if (error.line && error.reason) {
      atom.notifications.addWarning(`CSS Syntax Error`, {
        detail: `${error.reason} on line ${error.line}`,
        dismissable: true
      });
    }
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

      return new Promise((resolve) => {
        cosmiconfig('stylelint', {
          cwd: path.dirname(filePath)
        }).then(result => {
          if (result) {
            options.config = assign(rules, result.config);
            options.configBasedir = path.dirname(result.filepath);
          }

          resolve(runStylelint(options, filePath));
        }).catch(error => {
          atom.notifications.addWarning(`Invalid config file`, {
            detail: error.message || `Failed to parse config file`,
            dismissable: true
          });

          if (usePreset()) {
            resolve(runStylelint(options, filePath));
          } else {
            resolve([]);
          }
        });
      });
    }
  };
};
