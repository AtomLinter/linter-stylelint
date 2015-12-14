'use babel';

import fs from 'fs';
import path from 'path';
import { Range } from 'atom';
import stylelint from 'stylelint';
import * as helper from 'atom-linter';
import assign from 'deep-assign';
import strip from 'strip-json-comments';

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
const configFiles = ['.stylelintrc'];

export const activate = () => {
  require('atom-package-deps').install('linter-stylelint');
};

const getConfig = (configFile) => {
  const contents = fs.readFileSync(configFile, 'utf8');
  let currentConfig;

  try {
    currentConfig = JSON.parse(strip(contents));
  } catch (e) {
    currentConfig = require(configFile);
  }

  return currentConfig;
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
      let rules = usePreset() ? require(presetConfig()) : {};

      if (!text) {
        return [];
      }

      // .stylelintrc is preferred if exists
      const configFile = helper.find(filePath, configFiles);
      if (configFile) {
        try {
          const stylelintrc = getConfig(configFile);
          rules = assign(rules, stylelintrc);
        } catch (error) {
          atom.notifications.addWarning(`Invalid .stylelintrc`, {
            detail: `Failed to parse .stylelintrc JSON`,
            dismissable: true
          });

          console.error(error);
        }
      }

      return new Promise((resolve) => {
        const options = {
          code: text,
          rules,
          configBasedir: path.dirname(configFile)
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

          console.error(error);
        });
      });
    }
  };
};
