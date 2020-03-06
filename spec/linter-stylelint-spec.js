'use babel';

import * as path from 'path';
import * as fs from 'fs';
import { tmpdir } from 'os';
import rimraf from 'rimraf';
import {
  // eslint-disable-next-line no-unused-vars
  it, fit, wait, beforeEach, afterEach
} from 'jasmine-fix';

const fixtures = path.join(__dirname, 'fixtures');
const configStandardPath = path.join(fixtures, 'bad', 'stylelint-config-standard.css');
const warningPath = path.join(fixtures, 'warn', 'warn.css');
const invalidRulePath = path.join(fixtures, 'invalid-rule', 'styles.css');
const autofixablePath = path.join(fixtures, 'autofix');

const blockNoEmpty = 'Unexpected empty block (block-no-empty)';
const blockNoEmptyUrl = 'http://stylelint.io/user-guide/rules/block-no-empty';

/**
 * Async helper to copy a file from one place to another on the filesystem.
 * @param  {string} fileToCopyPath  Path of the file to be copied
 * @param  {string} destinationDir  Directory to paste the file into
 * @return {string}                 Full path of the file in copy destination
 */
function copyFileToDir(fileToCopyPath, destinationDir) {
  return new Promise((resolve) => {
    const destinationPath = path.join(destinationDir, path.basename(fileToCopyPath));
    const ws = fs.createWriteStream(destinationPath);
    ws.on('close', () => resolve(destinationPath));
    fs.createReadStream(fileToCopyPath).pipe(ws);
  });
}

/**
 * Utility helper to copy a file into the OS temp directory.
 *
 * @param  {string} fileToCopyPath  Path of the file to be copied
 * @return {string}                 Full path of the file in copy destination
 */
// eslint-disable-next-line import/prefer-default-export
export async function copyFileToTempDir(fileToCopyPath) {
  const tempFixtureDir = fs.mkdtempSync(tmpdir() + path.sep);
  return copyFileToDir(fileToCopyPath, tempFixtureDir);
}

describe('The stylelint provider for Linter', () => {
  const { lint } = require('../lib/index.js').provideLinter();

  beforeEach(async () => {
    atom.workspace.destroyActivePaneItem();

    await atom.packages.activatePackage('language-css');
    await atom.packages.activatePackage('linter-stylelint');
  });

  it('bundles and works with stylelint-config-standard', async () => {
    atom.config.set('linter-stylelint.useStandard', true);
    const editor = await atom.workspace.open(configStandardPath);
    const messages = await lint(editor);
    expect(messages.length).toBeGreaterThan(0);

    // test only the first error
    expect(messages[0].severity).toBe('error');
    expect(messages[0].excerpt).toBe(blockNoEmpty);
    expect(messages[0].url).toBe(blockNoEmptyUrl);
    expect(messages[0].location.file).toBe(configStandardPath);
    expect(messages[0].location.position).toEqual([[0, 5], [0, 7]]);
  });

  it('reports rules set as warnings as a Warning', async () => {
    const editor = await atom.workspace.open(warningPath);
    const messages = await lint(editor);

    expect(messages.length).toBeGreaterThan(0);

    // test only the first error
    expect(messages[0].severity).toBe('warning');
    expect(messages[0].excerpt).toBe(blockNoEmpty);
    expect(messages[0].url).toBe(blockNoEmptyUrl);
    expect(messages[0].location.file).toMatch(/.+warn\.css$/);
    expect(messages[0].location.position).toEqual([[0, 5], [0, 7]]);
  });

  it('finds nothing wrong with a valid file', async () => {
    const goodPath = path.join(fixtures, 'good', 'good.css');
    const editor = await atom.workspace.open(goodPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);
  });

  it('shows CSS syntax errors with an invalid file', async () => {
    const invalidPath = path.join(fixtures, 'invalid', 'invalid.css');
    const editor = await atom.workspace.open(invalidPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(1);

    expect(messages[0].severity).toBe('error');
    expect(messages[0].excerpt).toBe('Unknown word (CssSyntaxError)');
    expect(messages[0].location.file).toBe(invalidPath);
    expect(messages[0].location.position).toEqual([[0, 0], [0, 3]]);
  });

  it('shows an error on non-fatal stylelint runtime error', async () => {
    const text = 'Invalid option ""foo"" for rule block-no-empty';
    const editor = await atom.workspace.open(invalidRulePath);
    const messages = await lint(editor);
    expect(messages.length).toBe(1);

    expect(messages[0].severity).toBe('error');
    expect(messages[0].excerpt).toBe(text);
    expect(messages[0].location.file).toBe(invalidRulePath);
    expect(messages[0].location.position).toEqual([[0, 0], [0, 6]]);
  });

  it('shows an error notification for a fatal stylelint runtime error', async () => {
    const invalidExtendsPath = path.join(fixtures, 'invalid-extends', 'styles.css');

    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));
    const { addError } = atom.notifications;

    const editor = await atom.workspace.open(invalidExtendsPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);

    const { args } = addError.mostRecentCall;
    expect(addError.calls.length).toBe(1);
    expect(args[0]).toBe('Unable to parse stylelint configuration');
    expect(args[1].detail).toContain('Could not find "some-module-that-will-never-exist".');
    expect(args[1].dismissable).toBe(true);
  });

  it('shows an error notification with a broken syntax configuration', async () => {
    const invalidConfigPath = path.join(fixtures, 'invalid-config', 'styles.css');

    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));
    const { addError } = atom.notifications;

    const editor = await atom.workspace.open(invalidConfigPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);

    const { args } = addError.mostRecentCall;
    expect(addError.calls.length).toBe(1);
    expect(args[0]).toBe('Unable to parse stylelint configuration');
    expect(args[1].detail).toContain('>>>');
    expect(args[1].dismissable).toBe(true);
  });

  it('disables when no configuration file is found', async () => {
    spyOn(atom.notifications, 'addError').andCallFake(() => ({}));

    const editor = await atom.workspace.open(configStandardPath);
    const messages = await lint(editor);
    expect(messages.length).toBe(0);
    expect(atom.notifications.addError.calls.length).toBe(0);
  });

  describe('ignores files when files are specified in ignoreFiles and', () => {
    const ignorePath = path.join(fixtures, 'ignore-files', 'styles.css');

    it('shows a message when asked to', async () => {
      atom.config.set('linter-stylelint.showIgnored', true);
      const editor = await atom.workspace.open(ignorePath);
      const messages = await lint(editor);
      expect(messages.length).toBe(1);

      expect(messages[0].severity).toBe('warning');
      expect(messages[0].excerpt).toBe('This file is ignored');
      expect(messages[0].location.file).toBe(ignorePath);
      expect(messages[0].location.position).toEqual([[0, 0], [0, 7]]);
    });

    it("doesn't show a message when not asked to", async () => {
      atom.config.set('linter-stylelint.showIgnored', false);
      const editor = await atom.workspace.open(ignorePath);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });

  it("doesn't persist settings across runs", async () => {
    // The config for this folder breaks the block-no-empty rule
    const invalidEditor = await atom.workspace.open(invalidRulePath);
    await lint(invalidEditor);

    // While this file uses that rule
    const editor = await atom.workspace.open(warningPath);
    const messages = await lint(editor);
    expect(messages.length).toBeGreaterThan(0);

    // test only the first error
    expect(messages[0].severity).toBe('warning');
    expect(messages[0].excerpt).toBe(blockNoEmpty);
    expect(messages[0].url).toBe(blockNoEmptyUrl);
    expect(messages[0].location.file).toBe(warningPath);
    expect(messages[0].location.position).toEqual([[0, 5], [0, 7]]);
  });

  describe('works with Less files and', () => {
    const lessDir = path.join(fixtures, 'less');
    const goodLess = path.join(lessDir, 'good.less');
    const badLess = path.join(lessDir, 'bad.less');

    beforeEach(async () => {
      await atom.packages.activatePackage('language-less');
    });

    it('shows lint messages when found', async () => {
      const editor = await atom.workspace.open(badLess);
      const messages = await lint(editor);
      expect(messages.length).toBeGreaterThan(0);

      // test only the first error
      expect(messages[0].severity).toBe('error');
      expect(messages[0].excerpt).toBe(blockNoEmpty);
      expect(messages[0].url).toBe(blockNoEmptyUrl);
      expect(messages[0].location.file).toBe(badLess);
      expect(messages[0].location.position).toEqual([[0, 5], [0, 7]]);
    });

    it('finds nothing wrong with a valid file', async () => {
      const editor = await atom.workspace.open(goodLess);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });

  describe('works with PostCSS files and', () => {
    const goodPostCSS = path.join(fixtures, 'postcss', 'styles.pcss');
    const issuesPostCSS = path.join(fixtures, 'postcss', 'issues.pcss');

    beforeEach(async () => {
      await atom.packages.activatePackage('language-postcss');
    });

    it('shows lint messages when found', async () => {
      const editor = await atom.workspace.open(issuesPostCSS);
      const messages = await lint(editor);
      expect(messages.length).toBeGreaterThan(0);

      // test only the first error
      expect(messages[0].severity).toBe('error');
      expect(messages[0].excerpt).toBe(blockNoEmpty);
      expect(messages[0].url).toBe(blockNoEmptyUrl);
      expect(messages[0].location.file).toBe(issuesPostCSS);
      expect(messages[0].location.position).toEqual([[0, 5], [0, 7]]);
    });

    it('finds nothing wrong with a valid file', async () => {
      const editor = await atom.workspace.open(goodPostCSS);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });

  describe('works with SugarSS files and', () => {
    const goodSugarSS = path.join(fixtures, 'sugarss', 'good.sss');
    const badSugarSS = path.join(fixtures, 'sugarss', 'bad.sss');

    beforeEach(async () => {
      await atom.packages.activatePackage('language-postcss');
    });

    it('shows lint messages when found', async () => {
      const editor = await atom.workspace.open(badSugarSS);
      const messages = await lint(editor);

      expect(messages[0].severity).toBe('error');
      expect(messages[0].excerpt).toBe('Expected a leading zero (number-leading-zero)');
      expect(messages[0].url).toBe('http://stylelint.io/user-guide/rules/number-leading-zero');
      expect(messages[0].location.file).toBe(badSugarSS);
      expect(messages[0].location.position).toEqual([[1, 38], [1, 40]]);
    });

    it('finds nothing wrong with a valid file', async () => {
      const editor = await atom.workspace.open(goodSugarSS);
      const messages = await lint(editor);
      expect(messages.length).toBe(0);
    });
  });

  describe('the fixOnSave option', () => {
    it('lint updates the editor for autofixable rules when shouldFix is true', async () => {
      const tempPath = await copyFileToTempDir(path.join(autofixablePath, 'bad.css'));
      const tempDir = path.dirname(tempPath);
      const editor = await atom.workspace.open(tempPath);
      const oldText = editor.getText();
      await copyFileToDir(path.join(autofixablePath, '.stylelintrc'), tempDir);
      const messages = await lint(editor);
      expect(messages.length).toBe(3);
      const messagesAfterFixing = await lint(editor, { shouldFix: true });
      expect(messagesAfterFixing.length).toBe(0);
      expect(editor.getText()).not.toEqual(oldText);
      rimraf.sync(tempDir);
    });

    it('applies autofixes when saving', async () => {
      const tempPath = await copyFileToTempDir(path.join(autofixablePath, 'bad.css'));
      const tempDir = path.dirname(tempPath);
      const editor = await atom.workspace.open(tempPath);
      const oldText = editor.getText();
      atom.config.set('linter-stylelint.fixOnSave', true);
      await copyFileToDir(path.join(autofixablePath, '.stylelintrc'), tempDir);
      const messages = await lint(editor);
      expect(messages.length).toBe(3);
      await editor.save();
      expect(editor.getText()).not.toEqual(oldText);
      const messagesAfterFixing = await lint(editor);
      expect(messagesAfterFixing.length).toBe(0);
      rimraf.sync(tempDir);
    });

    it('does not update the editor if fixOnSave is disabled', async () => {
      const tempPath = await copyFileToTempDir(path.join(autofixablePath, 'bad.css'));
      const tempDir = path.dirname(tempPath);
      const editor = await atom.workspace.open(tempPath);
      const oldText = editor.getText();
      atom.config.set('linter-stylelint.fixOnSave', false);
      await copyFileToDir(path.join(autofixablePath, '.stylelintrc'), tempDir);
      const messages = await lint(editor);
      expect(messages.length).toBe(3);
      await editor.save();
      expect(editor.getText()).toEqual(oldText);
      const messagesAfterFixing = await lint(editor);
      expect(messagesAfterFixing.length).toBe(3);
      rimraf.sync(tempDir);
    });
  });
});
