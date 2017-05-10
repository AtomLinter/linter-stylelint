'use babel';

import * as path from 'path';
// eslint-disable-next-line no-unused-vars, import/no-extraneous-dependencies
import { it, fit, wait, beforeEach, afterEach } from 'jasmine-fix';

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
const goodSugarSS = path.join(__dirname, 'fixtures', 'sugarss', 'good.sss');
const badSugarSS = path.join(__dirname, 'fixtures', 'sugarss', 'bad.sss');

const blockNoEmpty = 'Unexpected empty block (<a href="http://stylelint.io/user-guide/rules/block-no-empty">block-no-empty</a>)';

describe('The stylelint provider for Linter', () => {
  const lint = require('../lib/index.js').provideLinter().lint;

  beforeEach(async () => {
    atom.workspace.destroyActivePaneItem();
    atom.config.set('linter-stylelint.useStandard', true);

    await atom.packages.activatePackage('language-css');
    await atom.packages.activatePackage('linter-stylelint');
  });

  it('bundles and works with stylelint-config-standard', async () => {
    atom.config.set('linter-stylelint.disableWhenNoConfig', false);
    const editor = await atom.workspace.open(configStandardPath);
    const messages = await lint(editor);
    expect(messages.length).toBeGreaterThan(0);

    // test only the first error
    expect(messages[0].type).toBe('Error');
    expect(messages[0].severity).toBe('error');
    expect(messages[0].text).not.toBeDefined();
    expect(messages[0].html).toBe(blockNoEmpty);
    expect(messages[0].filePath).toBe(configStandardPath);
    expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
  });

  it('reports rules set as warnings as a Warning', async () => {
    atom.config.set('linter-stylelint.useStandard', false);
    const editor = await atom.workspace.open(warn);
    const messages = await lint(editor);

    expect(messages.length).toBeGreaterThan(0);

    // test only the first error
    expect(messages[0].type).toBe('Warning');
    expect(messages[0].severity).toBe('warning');
    expect(messages[0].text).not.toBeDefined();
    expect(messages[0].html).toBe(blockNoEmpty);
    expect(messages[0].filePath).toMatch(/.+warn\.css$/);
    expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
  });

  it('finds nothing wrong with a valid file', async () => {
    const editor = await atom.workspace.open(good);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);
  });

  it('shows CSS syntax errors with an invalid file', async () => {
    atom.config.set('linter-stylelint.disableWhenNoConfig', false);
    const editor = await atom.workspace.open(invalidPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(1);

    expect(messages[0].type).toBe('Error');
    expect(messages[0].severity).toBe('error');
    expect(messages[0].text).not.toBeDefined();
    expect(messages[0].html).toBe('Unknown word (CssSyntaxError)');
    expect(messages[0].filePath).toBe(invalidPath);
    expect(messages[0].range).toEqual([[0, 0], [0, 3]]);
  });

  it('shows an error on non-fatal stylelint runtime error', async () => {
    const text = 'Unexpected option value "foo" for rule "block-no-empty"';
    atom.config.set('linter-stylelint.useStandard', false);
    const editor = await atom.workspace.open(invalidRulePath);
    const messages = await lint(editor);
    expect(messages.length).toBe(1);

    expect(messages[0].type).toBe('Error');
    expect(messages[0].severity).toBe('error');
    expect(messages[0].text).toBe(text);
    expect(messages[0].html).not.toBeDefined();
    expect(messages[0].filePath).toBe(invalidRulePath);
    expect(messages[0].range).not.toBeDefined();
  });

  it('shows an error notification for a fatal stylelint runtime error', async () => {
    atom.config.set('linter-stylelint.useStandard', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));
    const addError = atom.notifications.addError;

    const editor = await atom.workspace.open(invalidExtendsPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);

    const args = addError.mostRecentCall.args;
    expect(addError.calls.length).toBe(1);
    expect(args[0]).toBe('Unable to parse stylelint configuration');
    expect(args[1].detail).toContain('Could not find "some-module-that-will-never-exist".');
    expect(args[1].dismissable).toBe(true);
  });

  it('shows an error notification with a broken syntax configuration', async () => {
    atom.config.set('linter-stylelint.useStandard', false);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));
    const addError = atom.notifications.addError;

    const editor = await atom.workspace.open(invalidConfigPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);

    const args = addError.mostRecentCall.args;
    expect(addError.calls.length).toBe(1);
    expect(args[0]).toBe('Unable to parse stylelint configuration');
    expect(args[1].detail).toContain('>>>');
    expect(args[1].dismissable).toBe(true);
  });

  it('disables when no configuration file is found', async () => {
    atom.config.set('linter-stylelint.disableWhenNoConfig', true);
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    const editor = await atom.workspace.open(configStandardPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);
    expect(atom.notifications.addError.calls.length).toBe(0);
  });

  describe('ignores files when files are specified in ignoreFiles and', () => {
    it('shows a message when asked to', async () => {
      atom.config.set('linter-stylelint.showIgnored', true);
      const editor = await atom.workspace.open(ignorePath);
      const messages = await lint(editor);
      expect(messages.length).toBe(1);

      expect(messages[0].type).toBe('Warning');
      expect(messages[0].severity).toBe('warning');
      expect(messages[0].text).toBe('This file is ignored');
      expect(messages[0].html).not.toBeDefined();
      expect(messages[0].filePath).toBe(ignorePath);
      expect(messages[0].range).not.toBeDefined();
    });

    it("doesn't show a message when not asked to", async () => {
      atom.config.set('linter-stylelint.showIgnored', false);
      const editor = await atom.workspace.open(ignorePath);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });

  it("doesn't persist settings across runs", async () => {
    atom.config.set('linter-stylelint.disableWhenNoConfig', false);
    // The config for this folder breaks the block-no-empty rule
    const invalidEditor = await atom.workspace.open(invalidRulePath);
    await lint(invalidEditor);

    // While this file uses that rule
    const editor = await atom.workspace.open(configStandardPath);
    const messages = await lint(editor);
    expect(messages.length).toBeGreaterThan(0);

    // test only the first error
    expect(messages[0].type).toBe('Error');
    expect(messages[0].severity).toBe('error');
    expect(messages[0].text).not.toBeDefined();
    expect(messages[0].html).toBe(blockNoEmpty);
    expect(messages[0].filePath).toBe(configStandardPath);
    expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
  });

  describe('works with Less files and', () => {
    beforeEach(async () => {
      atom.config.set('linter-stylelint.disableWhenNoConfig', false);
      await atom.packages.activatePackage('language-less');
    });

    it('works with stylelint-config-standard', async () => {
      const editor = await atom.workspace.open(configStandardLessPath);
      const messages = await lint(editor);
      expect(messages.length).toBeGreaterThan(0);

      // test only the first error
      expect(messages[0].type).toBe('Error');
      expect(messages[0].severity).toBe('error');
      expect(messages[0].text).not.toBeDefined();
      expect(messages[0].html).toBe(blockNoEmpty);
      expect(messages[0].filePath).toBe(configStandardLessPath);
      expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
    });

    it('finds nothing wrong with a valid file', async () => {
      const editor = await atom.workspace.open(goodLess);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });

  describe('works with PostCSS files and', () => {
    beforeEach(async () => {
      atom.config.set('linter-stylelint.disableWhenNoConfig', false);
      await atom.packages.activatePackage('language-postcss');
    });

    it('works with stylelint-config-standard', async () => {
      const editor = await atom.workspace.open(issuesPostCSS);
      const messages = await lint(editor);
      expect(messages.length).toBeGreaterThan(0);

      // test only the first error
      expect(messages[0].type).toBe('Error');
      expect(messages[0].severity).toBe('error');
      expect(messages[0].text).not.toBeDefined();
      expect(messages[0].html).toBe(blockNoEmpty);
      expect(messages[0].filePath).toBe(issuesPostCSS);
      expect(messages[0].range).toEqual([[0, 5], [0, 7]]);
    });

    it('finds nothing wrong with a valid file', async () => {
      const editor = await atom.workspace.open(goodPostCSS);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });

  describe('works with SugarSS files and', () => {
    beforeEach(async () => {
      atom.config.set('linter-stylelint.disableWhenNoConfig', false);
      await atom.packages.activatePackage('language-postcss');
    });

    it('works with stylelint-config-standard', async () => {
      const nlzMessage = 'Expected a leading zero (<a href="http://stylelint.io/user-guide/rules/number-leading-zero">number-leading-zero</a>)';
      const editor = await atom.workspace.open(badSugarSS);
      const messages = await lint(editor);
      expect(messages[0].type).toBe('Error');
      expect(messages[0].severity).toBe('error');
      expect(messages[0].text).not.toBeDefined();
      expect(messages[0].html).toBe(nlzMessage);
      expect(messages[0].filePath).toBe(badSugarSS);
      expect(messages[0].range).toEqual([[1, 38], [1, 40]]);
    });

    it('finds nothing wrong with a valid file', async () => {
      const editor = await atom.workspace.open(goodSugarSS);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });
});
