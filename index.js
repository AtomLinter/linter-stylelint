'use babel';

import { CompositeDisposable } from 'atom';
import postcss       from 'postcss';
import AtomLinter    from 'atom-linter';
import stylelint     from 'stylelint';
import configSuitcss from 'stylelint-config-suitcss';

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
    enum: ['stylelint-config-suitcss']
  }
};

const usePreset    = () => atom.config.get('linter-stylelint.usePreset');
const presetConfig = () => atom.config.get('linter-stylelint.presetConfig');

export let subscriptions = null;

export const activate = () => {
  this.subscriptions = new CompositeDisposable();
};

export const deactivate = () => {
  if (this.subscriptions) {
    this.subscriptions.dispose();
  }
};

export const provideLinter = () => {

  let config = usePreset() ? configSuitcss : {};

  return {
    grammarScopes: ['source.css'],
    scope: 'file',
    lintOnFly: true,
    lint: (editor) => {

      let path = editor.getPath();
      let text = editor.getText();

      return new Promise((resolve, reject) => {

        postcss([
          stylelint(config)
        ]).process(text, {
          from: path
        }).then((data) => {

          console.log(data);

          let errors = data.messages.map((message) => {
            return {
              type: message.type,
              text: message.text,
              filePath: path,
              range: [[1, 1]]
            }
          });

          console.log(errors);

          resolve(errors);

        }).catch((error) => console.error(error));
      });
    }
  };
};
