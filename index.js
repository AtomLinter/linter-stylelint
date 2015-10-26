'use babel';

import fs        from 'fs';
import { Range } from 'atom';
import postcss   from 'postcss';
import stylelint from 'stylelint';
import helper    from 'atom-linter';
import assign    from 'deep-assign';

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
  let fileContents = fs.readFileSync(configFile);
  let config;

  try {
    config = JSON.parse(fileContents);
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

      let path = editor.getPath();
      let text = editor.getText();
      let config = {};

      if (usePreset()) {
        config = preset;
      }

      // .stylelintrc is preferred if exists
      let configFile = helper.findFile(path, configFiles);
      if (configFile) {
        try {
          let stylelintrc = getConfig(configFile);
          config = assign(config, stylelintrc);
        } catch (e) {
          console.log(e);
          atom.notifications.addWarning(`Invalid .stylelintrc`, {
            detail: `Failed to parse .stylelintrc JSON`,
            dismissable: true
          });
        }
      }

      return new Promise((resolve, reject) => {

        postcss([
          stylelint(config)
        ]).process(text, {
          from: path
        }).then((data) => {

          resolve(data.messages.map(message => {

            let range = new Range(
              [message.line - 1, message.column - 1],
              [message.line - 1, message.column + 1000]
            );

            return {
              type: message.type,
              text: message.text,
              filePath: path,
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
