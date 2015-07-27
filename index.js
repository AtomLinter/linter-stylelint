'use babel';

import { Range, Point } from 'atom';
import postcss from 'postcss';
import stylelint from 'stylelint';
import helper from 'atom-linter';

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
    enum: ['stylelint-config-suitcss', 'stylelint-config-cssrecipes']
  }
};

const usePreset    = () => atom.config.get('linter-stylelint.usePreset');
const presetConfig = () => atom.config.get('linter-stylelint.presetConfig');

export const provideLinter = () => {

  let config = usePreset() ? require(presetConfig()) : {};

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

          resolve(data.messages.map((message) => {

            let start  = message.node.source.start;
            let end    = message.node.source.end;
            let object = helper.parse(message.text, 'line (?<line>[0-9]+)').shift();

            let sl = start.line !== undefined   ? start.line - 1   : object.range[0][0];
            let sc = start.column !== undefined ? start.column - 1 : object.range[0][1];
            let el = end.line !== undefined     ? end.line - 1     : object.range[1][0];
            let ec = end.column !== undefined   ? end.column - 1   : object.range[1][1];

            return {
              type: message.type,
              text: message.text,
              filePath: path,
              range: new Range([sl, sc], [el, ec])
            };
          }));

        }).catch((error) => console.error(error));
      });
    }
  };
};
