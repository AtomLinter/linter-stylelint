'use babel';

import path from 'path';
import {
  // eslint-disable-next-line no-unused-vars
  it, fit, wait, beforeEach, afterEach
} from 'jasmine-fix';
import * as helpers from '../lib/helpers';

const fixtures = path.join(__dirname, 'fixtures');
const fixturesLocal = path.join(fixtures, 'local-stylelint');
const autofixableBadFilePath = path.join(fixtures, 'autofix', 'bad.css');
const autofixableGoodFilePath = path.join(fixtures, 'autofix', 'good.css');


describe('Helpers', () => {
  describe('getStylelintPath', () => {
    it('finds a local stylelint when available', async () => {
      const foundStylelint = await helpers.getStylelintPath(fixturesLocal);
      const expectedStylelintPath = path.join(fixturesLocal, 'node_modules', 'stylelint', 'lib', 'index.js');
      expect(foundStylelint).toBe(expectedStylelintPath);
    });

    it('falls back to the packaged stylelint when no local stylelint is found', async () => {
      const filePath = 'not/a/real/path';
      const foundStylelint = await helpers.getStylelintPath(filePath);
      const expectedBundledPath = require.resolve('stylelint');
      expect(foundStylelint).toBe(expectedBundledPath);
    });
  });

  describe('getStylelintInstance', () => {
    it('tries to find a local stylelint', async () => {
      atom.project.addPath(fixturesLocal);
      const stylelint = await helpers.getStylelintInstance(path.join(fixturesLocal, 'good.css'));
      expect(stylelint).toBe('located');
    });
  });

  describe('applyFixedStyles', () => {
    const fixedText = `.style {
    color: blue;
    margin: 0;
}
`;
    const mockResults = {
      _postcssResult: {
        root: {
          toString: () => fixedText
        },
        opts: {
          syntax: null // Just need the right shape, we're faking our toString
        }
      }
    };

    beforeEach(async () => {
      atom.workspace.destroyActivePaneItem();
    });

    it('sets the editor text to the linting results', async () => {
      const editor = await atom.workspace.open(autofixableBadFilePath);
      await helpers.applyFixedStyles(editor, mockResults);
      expect(editor.getText()).toBe(fixedText);
      expect(editor.isModified()).toBe(true);
    });

    it('does not change the editor if results match the existing text', async () => {
      const editor = await atom.workspace.open(autofixableGoodFilePath);
      await helpers.applyFixedStyles(editor, mockResults);
      expect(editor.getText()).toBe(fixedText);
      expect(editor.isModified()).toBe(false);
    });

    it('restores multiple cursors to their positions if possible', async () => {
      const editor = await atom.workspace.open(autofixableBadFilePath);
      const firstCursorPosition = editor.getCursorBufferPosition();
      const secondCursorPosition = [1, 0];
      editor.addCursorAtBufferPosition(secondCursorPosition);
      await helpers.applyFixedStyles(editor, mockResults);
      const actualBufferPositions = editor.getCursorBufferPositions();
      expect(actualBufferPositions.length).toBe(2);
      expect(actualBufferPositions).toEqual([firstCursorPosition, secondCursorPosition]);
    });
  });
});
