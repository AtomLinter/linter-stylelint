'use babel';

import { CompositeDisposable } from 'atom';
import PostCSS from 'postcss';
import StyleLint from 'stylelint';
import AtomLinter from 'atom-linter';

export let config = {

};

let subscriptions;

export const activate = () => {
  subscriptions = new CompositeDisposable();
};

export const deactivate = () => {
  if (subscriptions) {
    subscriptions.dispose();
  }
};

export const provideLinter = () => {
  return {
    grammarScopes: ['source.css'],
    scope: 'file',
    lintOnFly: true,
    lint: (editor) => {
      let path = editor.getPath();
      let text = editor.getText();

      return new Promise((resolve, reject) => {
        PostCSS([StyleLint()])
          .then((data) => {
            console.log(data);
            resolve([{
              type: 'type',
              text: 'text',
              filePath: 'filePath',
              range: [[1, 1]]
            }]);
          }).catch((error) => console.error(error));
      });
    }
  };
};
