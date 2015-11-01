'use babel';

import fs        from 'fs';
import path      from 'path';
import { Range } from 'atom';
import stylelint from 'stylelint';
import helper    from 'atom-linter';
import assign    from 'deep-assign';
import strip     from 'strip-json-comments';

export let config = {
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

const usePreset    = () => atom.config.get('linter-stylelint.usePreset');
const presetConfig = () => atom.config.get('linter-stylelint.presetConfig');
const configFiles  = ['.stylelintrc'];

export const activate = () => {
  require("atom-package-deps").install("linter-stylelint");
};

const getConfig = (configFile) => {

  let contents = fs.readFileSync(configFile);
  let config;

  try {
    config = JSON.parse(strip(contents));
  } catch (e) {
    config = require(configFile);
  }

  return config;
};

export const provideLinter = () => {

  let preset = require(presetConfig());

  return {
    name: 'stylelint',
    grammarScopes: ['source.css'],
    scope: 'file',
    lintOnFly: true,
    lint: (editor) => {

      let filePath = editor.getPath();
      let text = editor.getText();
      let config = usePreset() ? preset : {};

      // .stylelintrc is preferred if exists
      let configFile = helper.findFile(filePath, configFiles);
      if (configFile) {
        try {
          let stylelintrc = getConfig(configFile);
          config = assign(config, stylelintrc);
        } catch (e) {
          atom.notifications.addWarning(`Invalid .stylelintrc`, {
            detail: `Failed to parse .stylelintrc JSON`,
            dismissable: true
          });

          console.error(error);
        }
      }

      return new Promise((resolve, reject) => {

        stylelint.lint({
          code: text,
          config,
          configBasedir: path.dirname(configFile)
        }).then(data => {

          const result = data.results.shift();

          if (!result) {
            resolve([]);
          }

          resolve(result.warnings.map(warning => {

            let range = new Range(
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
