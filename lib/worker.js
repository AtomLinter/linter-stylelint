'use babel';

/* global emit */

// import { lint } from 'stylelint';
const { lint } = require('stylelint');

export default function () {
  process.on('message', (options) => {
    const result = { data: null, error: null };
    lint(options).then(data => {
      result.data = data;
    }).catch(err => {
      // Some of these are inherited properties, manually access them
      result.error = {};
      if (err.message) {
        result.error.message = err.message;
      }
      if (err.reason) {
        result.error.reason = err.reason;
      }
      if (err.line) {
        result.error.line = err.line;
      }
    }).then(() => {
      emit('linter-stylelint:results', result);
    });
  });
}
