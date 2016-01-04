'use babel';

import * as path from 'path';

describe('The stylelint provider for Linter', () => {
  const lint = require(path.join('..', 'index.js')).provideLinter().lint;

  beforeEach(() => {
    atom.workspace.destroyActivePaneItem();
    atom.config.set('linter-stylelint.usePreset', true);
    atom.config.set('linter-stylelint.disableWhenNoConfig', false);

    waitsForPromise(() => {
      return atom.packages.activatePackage('linter-stylelint').then(() => {
        return atom.packages.activatePackage('language-css');
      });
    });
  });

  it('detects invalid coding style in bad.css and report as error', () => {
    waitsForPromise(() => {
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'bad', 'bad.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
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
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'warn', 'warn.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
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
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'good', 'good.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
        expect(messages.length).toEqual(0);
      });
    });
  });

  it('show CSS syntax error with an invalid file (invalid.css)', () => {
    waitsForPromise(() => {
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'invalid', 'invalid.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
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
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'invalid-rule', 'styles.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
        expect(messages.length).toEqual(1);

        expect(messages[0].type).toEqual('Error');
        expect(messages[0].text).toEqual('Unexpected option value "foo" for rule "block-no-empty"');
        expect(messages[0].filePath).toMatch(/.+styles\.css$/);
        expect(messages[0].range).toEqual([[0, 0], [0, 6]]);
      });
    });
  });

  it('show error notification on fatal stylelint runtime error', () => {
    atom.config.set('linter-stylelint.usePreset', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => {});

    waitsForPromise(() => {
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'invalid-extends', 'styles.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
        expect(messages.length).toEqual(0);

        expect(atom.notifications.addError.calls.length).toEqual(1);
        expect(atom.notifications.addError.mostRecentCall.args[0]).toEqual('Unable to run stylelint');
        expect(atom.notifications.addError.mostRecentCall.args[1].detail).toContain('Could not find "some-module-that-will-never-exist". Do you need a `configBasedir`?');
        expect(atom.notifications.addError.mostRecentCall.args[1].dismissable).toEqual(true);
      });
    });
  });

  it('show error notification on an broken syntax configuration', () => {
    atom.config.set('linter-stylelint.usePreset', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => {});

    waitsForPromise(() => {
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'invalid-config', 'styles.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
        expect(messages.length).toEqual(0);

        expect(atom.notifications.addError.calls.length).toEqual(1);
        expect(atom.notifications.addError.mostRecentCall.args[0]).toEqual('Unable to parse stylelint configuration');
        expect(atom.notifications.addError.mostRecentCall.args[1].detail).toContain('>>>');
        expect(atom.notifications.addError.mostRecentCall.args[1].dismissable).toEqual(true);
      });
    });
  });

  it('disable when no config file is found', () => {
    atom.config.set('linter-stylelint.disableWhenNoConfig', true);
    spyOn(atom.notifications, 'addError').andCallFake(() => {});

    waitsForPromise(() => {
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'bad', 'bad.css')).then(editor => {
        return lint(editor);
      }).then(messages => {
        expect(messages.length).toEqual(0);
        expect(atom.notifications.addError.calls.length).toEqual(0);
      });
    });
  });
});
