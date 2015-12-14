'use babel';

import fs from 'fs';
import path from 'path';
import { Range } from 'atom';
import stylelint from 'stylelint';
import * as helper from 'atom-linter';
import assign from 'deep-assign';
import strip from 'strip-json-comments';
import cosmiconfig from 'cosmiconfig';

export const config = {
  usePreset: {
    title: 'Use preset',
    description: 'Use preset lint config',
    type: 'boolean',
    default: true
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
const configFiles = ['.stylelintrc', 'stylelint.config.js', 'package.json'];

export const activate = () => {
  require('atom-package-deps').install('linter-stylelint');
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
      let rules = usePreset() ? require(presetConfig()) : {};

      // .stylelintrc is preferred if exists
      const configPath = helper.find(filePath, configFiles);

      return new Promise((resolve) => {

        cosmiconfig('stylelint', {
          configPath : configPath
        }).then(result => {

          const options = {
            code: text,
            config: assign(rules, result.config),
            configBasedir: path.dirname(configPath)
          };

          if (scopes.indexOf('source.css.scss') !== -1) {
            options.syntax = 'scss';
          }

          stylelint.lint(options).then(data => {
            const result = data.results.shift();

            if (!result) {
              resolve([]);
            }

            resolve(result.warnings.map(warning => {
              const range = new Range(
                [warning.line - 1, warning.column - 1],
                [warning.line - 1, warning.column + 1000]
              );

              return {
                type: (warning.severity === 2) ? 'Error' : 'Warning',
                text: warning.text,
                filePath: filePath,
                range: range
              };
            }));
          }).catch(error => {
            if (error.line && error.reason) {
              atom.notifications.addWarning(`CSS Syntax Error`, {
                detail: `${error.reason} on line ${error.line}`,
                dismissable: true
              });
            }
          });

        }).catch(error => {
          atom.notifications.addWarning(`Invalid ${path.basename(configPath)}`, {
            detail: `Failed to parse ${path.basename(configPath)}`,
            dismissable: true
          });
        });
      });
    }
  };
};
