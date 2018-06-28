'use babel';

import path from 'path';
import {
  // eslint-disable-next-line no-unused-vars
  it, fit, wait, beforeEach, afterEach
} from 'jasmine-fix';
import * as helpers from '../lib/helpers';

const fixturesLocal = path.join(__dirname, 'fixtures', 'local-stylelint');

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
});
