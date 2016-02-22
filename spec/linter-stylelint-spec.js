'use babel';

import * as path from 'path';

describe('The stylelint provider for Linter', () => {
  const lint = require(path.join('..', 'lib', 'index.js')).provideLinter().lint;

  beforeEach(() => {
    atom.workspace.destroyActivePaneItem();
    atom.config.set('linter-stylelint.usePreset', true);
    atom.config.set('linter-stylelint.disableWhenNoConfig', false);

    waitsForPromise(() =>
      Promise.all([
        atom.packages.activatePackage('linter-stylelint'),
        atom.packages.activatePackage('language-css')
      ])
    );
  });

  it('detects invalid coding style in bad.css and report as error', () => {
    waitsForPromise(() => {
      const bad = path.join(__dirname, 'fixtures', 'bad', 'bad.css');
      return atom.workspace.open(bad).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBeGreaterThan(0);

        // test only the first error
        expect(messages[0].type).toEqual('Error');
        expect(messages[0].text).toEqual('Unexpected empty block (block-no-empty)');
        expect(messages[0].filePath).toMatch(/.+bad\.css$/);
        expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
      });
    });
  });

  it('detects invalid coding style in warn.css and report as warning', () => {
    atom.config.set('linter-stylelint.usePreset', false);

    waitsForPromise(() => {
      const warn = path.join(__dirname, 'fixtures', 'warn', 'warn.css');
      return atom.workspace.open(warn).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBeGreaterThan(0);

        // test only the first error
        expect(messages[0].type).toEqual('Warning');
        expect(messages[0].text).toEqual('Unexpected empty block (block-no-empty)');
        expect(messages[0].filePath).toMatch(/.+warn\.css$/);
        expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
      });
    });
  });

  it('finds nothing wrong with a valid file (good.css)', () => {
    waitsForPromise(() => {
      const good = path.join(__dirname, 'fixtures', 'good', 'good.css');
      return atom.workspace.open(good).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toEqual(0);
      });
    });
  });

  it('show CSS syntax error with an invalid file (invalid.css)', () => {
    waitsForPromise(() => {
      const invalid = path.join(__dirname, 'fixtures', 'invalid', 'invalid.css');
      return atom.workspace.open(invalid).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toEqual(1);

        expect(messages[0].type).toEqual('Error');
        expect(messages[0].text).toEqual('Unknown word');
        expect(messages[0].filePath).toMatch(/.+invalid\.css$/);
        expect(messages[0].range).toEqual([[0, 0], [0, 3]]);
      });
    });
  });

  it('show error on non-fatal stylelint runtime error', () => {
    atom.config.set('linter-stylelint.usePreset', false);

    waitsForPromise(() => {
      const invalid = path.join(__dirname, 'fixtures', 'invalid-rule', 'styles.css');
      return atom.workspace.open(invalid).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toEqual(1);

        expect(messages[0].type).toEqual('Error');
        const text = 'Unexpected option value "foo" for rule "block-no-empty"';
        expect(messages[0].text).toEqual(text);
        expect(messages[0].filePath).toMatch(/.+styles\.css$/);
        expect(messages[0].range).toEqual([[0, 0], [0, 6]]);
      });
    });
  });

  it('show error notification on fatal stylelint runtime error', () => {
    atom.config.set('linter-stylelint.usePreset', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    waitsForPromise(() => {
      const invalid = path.join(__dirname, 'fixtures', 'invalid-extends', 'styles.css');
      return atom.workspace.open(invalid).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toEqual(0);

        const addError = atom.notifications.addError;
        const args = addError.mostRecentCall.args;
        expect(addError.calls.length).toEqual(1);
        expect(args[0]).toEqual('Unable to run stylelint');
        expect(args[1].detail).toContain('Could not find "some-module-that-will-never-exist".');
        expect(args[1].dismissable).toEqual(true);
      });
    });
  });

  it('show error notification on an broken syntax configuration', () => {
    atom.config.set('linter-stylelint.usePreset', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    waitsForPromise(() => {
      const invalid = path.join(__dirname, 'fixtures', 'invalid-config', 'styles.css');
      return atom.workspace.open(invalid).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toEqual(0);

        const addError = atom.notifications.addError;
        const args = addError.mostRecentCall.args;
        expect(addError.calls.length).toEqual(1);
        expect(args[0]).toEqual('Unable to parse stylelint configuration');
        expect(args[1].detail).toContain('>>>');
        expect(args[1].dismissable).toEqual(true);
      });
    });
  });

  it('disable when no config file is found', () => {
    atom.config.set('linter-stylelint.disableWhenNoConfig', true);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    waitsForPromise(() => {
      const bad = path.join(__dirname, 'fixtures', 'bad', 'bad.css');
      return atom.workspace.open(bad).then(editor => lint(editor))
      .then(messages => {
        expect(messages.length).toEqual(0);
        expect(atom.notifications.addError.calls.length).toEqual(0);
      });
    });
  });

  it('ignore files when files are specified in ignoreFiles', () => {
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    waitsForPromise(() => {
      const ignore = path.join(__dirname, 'fixtures', 'ignore-files', 'styles.css');
      return atom.workspace.open(ignore).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toEqual(0);
        expect(atom.notifications.addError.calls.length).toEqual(0);
      });
    });
  });
});
