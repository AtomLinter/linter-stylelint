'use babel';

import path from 'path';
// eslint-disable-next-line no-unused-vars, import/no-extraneous-dependencies
import { it, fit, wait, beforeEach, afterEach } from 'jasmine-fix';
import * as helpers from '../lib/helpers';

const fixtures = path.join(__dirname, 'fixtures');

describe('Helpers', () => {
  describe('getStylelintPath', () => {
    it('finds a local stylelint when available', () => {
      const foundStylelint = helpers.getStylelintPath(path.join(fixtures, 'local-stylelint', 'good.css'));
      const expectedStylelintPath = path.join(fixtures, 'local-stylelint', 'node_modules', 'stylelint', 'lib', 'index.js');
      expect(foundStylelint).toBe(expectedStylelintPath);
    });

    it('falls back to the packaged stylelint when no local stylelint is found', () => {
      const filePath = 'not/a/real/path';
      const foundStylelint = helpers.getStylelintPath(filePath);
      const expectedBundledPath = require.resolve('stylelint');
      expect(foundStylelint).toBe(expectedBundledPath);
    });
  });

  describe('getStylelintInstance', () => {
    it('tries to find a local stylelint', () => {
      const stylelint = helpers.getStylelintInstance(path.join(fixtures, 'local-stylelint', 'good.css'));
      expect(stylelint).toBe('located');
    });
  });
});
