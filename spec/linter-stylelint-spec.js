'use babel';

import * as path from 'path';

const badDir = path.join(__dirname, 'fixtures', 'bad');
const configStandardPath = path.join(badDir, 'stylelint-config-standard.css');
const warn = path.join(__dirname, 'fixtures', 'warn', 'warn.css');
const good = path.join(__dirname, 'fixtures', 'good', 'good.css');
const ignorePath = path.join(__dirname, 'fixtures', 'ignore-files', 'styles.css');
const invalidPath = path.join(__dirname, 'fixtures', 'invalid', 'invalid.css');
const invalidRulePath = path.join(__dirname, 'fixtures', 'invalid-rule', 'styles.css');
const invalidExtendsPath = path.join(__dirname, 'fixtures', 'invalid-extends', 'styles.css');
const invalidConfigPath = path.join(__dirname, 'fixtures', 'invalid-config', 'styles.css');
const lessDir = path.join(__dirname, 'fixtures', 'less');
const goodLess = path.join(lessDir, 'good.less');
const configStandardLessPath = path.join(lessDir, 'stylelint-config-standard.less');
const goodPostCSS = path.join(__dirname, 'fixtures', 'postcss', 'styles.pcss');
const issuesPostCSS = path.join(__dirname, 'fixtures', 'postcss', 'issues.pcss');

describe('The stylelint provider for Linter', () => {
  const lint = require(path.join('..', 'lib', 'index.js')).provideLinter().lint;

  beforeEach(() => {
    atom.workspace.destroyActivePaneItem();
    atom.config.set('linter-stylelint.useStandard', true);
    atom.config.set('linter-stylelint.disableWhenNoConfig', false);

    waitsForPromise(() =>
      Promise.all([
        atom.packages.activatePackage('linter-stylelint'),
        atom.packages.activatePackage('language-css')
      ])
    );
  });

  it('bundles and works with stylelint-config-standard', () => {
    waitsForPromise(() =>
      atom.workspace.open(configStandardPath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBeGreaterThan(0);

        // test only the first error
        expect(messages[0].type).toBe('Error');
        expect(messages[0].text).toBe('Unexpected empty block (block-no-empty)');
        expect(messages[0].filePath).toBe(configStandardPath);
        expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
      })
    );
  });

  it('reports rules set as warnings as a Warning', () => {
    atom.config.set('linter-stylelint.useStandard', false);

    waitsForPromise(() =>
      atom.workspace.open(warn).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBeGreaterThan(0);

        // test only the first error
        expect(messages[0].type).toBe('Warning');
        expect(messages[0].text).toBe('Unexpected empty block (block-no-empty)');
        expect(messages[0].filePath).toMatch(/.+warn\.css$/);
        expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
      })
    );
  });

  it('finds nothing wrong with a valid file', () => {
    waitsForPromise(() =>
      atom.workspace.open(good).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBe(0);
      })
    );
  });

  it('shows CSS syntax errors with an invalid file', () => {
    waitsForPromise(() =>
      atom.workspace.open(invalidPath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBe(1);

        expect(messages[0].type).toBe('Error');
        expect(messages[0].text).toBe('Unknown word (CssSyntaxError)');
        expect(messages[0].filePath).toBe(invalidPath);
        expect(messages[0].range).toEqual([[0, 0], [0, 3]]);
      })
    );
  });

  it('shows an error on non-fatal stylelint runtime error', () => {
    const text = 'Unexpected option value "foo" for rule "block-no-empty"';
    atom.config.set('linter-stylelint.useStandard', false);
    waitsForPromise(() =>
      atom.workspace.open(invalidRulePath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBe(1);

        expect(messages[0].type).toBe('Error');
        expect(messages[0].text).toBe(text);
        expect(messages[0].filePath).toBe(invalidRulePath);
        expect(messages[0].range).not.toBeDefined();
      })
    );
  });

  it('show error notification on fatal stylelint runtime error', () => {
    atom.config.set('linter-stylelint.useStandard', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));
    const addError = atom.notifications.addError;

    waitsForPromise(() =>
      atom.workspace.open(invalidExtendsPath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBe(0);

        const args = addError.mostRecentCall.args;
        expect(addError.calls.length).toBe(1);
        expect(args[0]).toBe('Unable to run stylelint');
        expect(args[1].detail).toContain('Could not find "some-module-that-will-never-exist".');
        expect(args[1].dismissable).toBe(true);
      })
    );
  });

  it('show error notification on an broken syntax configuration', () => {
    atom.config.set('linter-stylelint.useStandard', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));
    const addError = atom.notifications.addError;

    waitsForPromise(() =>
      atom.workspace.open(invalidConfigPath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBe(0);

        const args = addError.mostRecentCall.args;
        expect(addError.calls.length).toBe(1);
        expect(args[0]).toBe('Unable to parse stylelint configuration');
        expect(args[1].detail).toContain('>>>');
        expect(args[1].dismissable).toBe(true);
      })
    );
  });

  it('disable when no config file is found', () => {
    atom.config.set('linter-stylelint.disableWhenNoConfig', true);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    waitsForPromise(() =>
      atom.workspace.open(configStandardPath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBe(0);
        expect(atom.notifications.addError.calls.length).toBe(0);
      })
    );
  });

  it('ignore files when files are specified in ignoreFiles', () => {
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    waitsForPromise(() =>
      atom.workspace.open(ignorePath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBe(1);

        expect(messages[0].type).toBe('Warning');
        expect(messages[0].text).toBe('This file is ignored');
        expect(messages[0].filePath).toBe(ignorePath);
        expect(messages[0].range).toEqual([[0, 0], [0, 7]]);
        expect(atom.notifications.addError.calls.length).toBe(0);
      })
    );
  });

  it("doesn't persist settings across runs", () => {
    waitsForPromise(() =>
      // The config for this folder breaks the block-no-empty rule
      atom.workspace.open(invalidRulePath).then(editor => lint(editor))
    );
    waitsForPromise(() =>
      // While this file uses that rule
      atom.workspace.open(configStandardPath).then(editor => lint(editor)).then(messages => {
        expect(messages.length).toBeGreaterThan(0);

        // test only the first error
        expect(messages[0].type).toBe('Error');
        expect(messages[0].text).toBe('Unexpected empty block (block-no-empty)');
        expect(messages[0].filePath).toBe(configStandardPath);
        expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
      })
    );
  });

  describe('works with Less files and', () => {
    it('works with stylelint-config-standard', () => {
      waitsForPromise(() =>
        atom.workspace.open(configStandardLessPath).then(editor => lint(editor)).then(messages => {
          expect(messages.length).toBeGreaterThan(0);

          // test only the first error
          expect(messages[0].type).toBe('Error');
          expect(messages[0].text).toBe('Unexpected empty block (block-no-empty)');
          expect(messages[0].filePath).toBe(configStandardLessPath);
          expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
        })
      );
    });

    it('finds nothing wrong with a valid file', () => {
      waitsForPromise(() =>
        atom.workspace.open(goodLess).then(editor => lint(editor)).then(messages => {
          expect(messages.length).toBe(0);
        })
      );
    });
  });

  describe('works with PostCSS files and', () => {
    it('works with stylelint-config-standard', () => {
      waitsForPromise(() =>
        atom.workspace.open(issuesPostCSS).then(editor => lint(editor)).then(messages => {
          expect(messages.length).toBeGreaterThan(0);

          // test only the first error
          expect(messages[0].type).toBe('Error');
          expect(messages[0].text).toBe('Unexpected empty block (block-no-empty)');
          expect(messages[0].filePath).toBe(issuesPostCSS);
          expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
        })
      );
    });

    it('finds nothing wrong with a valid file', () => {
      waitsForPromise(() =>
        atom.workspace.open(goodPostCSS).then(editor => lint(editor)).then(messages => {
          expect(messages.length).toBe(0);
        })
      );
    });
  });
});
