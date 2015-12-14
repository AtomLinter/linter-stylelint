'use babel';

import * as path from 'path';

describe('The stylelint provider for Linter', () => {
  const lint = require(path.join('..', 'index.js')).provideLinter().lint;

  beforeEach(() => {
    atom.workspace.destroyActivePaneItem();
    waitsForPromise(() => {
      atom.packages.activatePackage('linter-stylelint');
      return atom.packages.activatePackage('language-css').then(() =>
        atom.workspace.open(path.join(__dirname, 'fixtures', 'good.css'))
      );
    });
  });

  describe('checks bad.css and', () => {
    let editor = null;
    beforeEach(() => {
      waitsForPromise(() => {
        return atom.workspace.open(path.join(__dirname, 'fixtures', 'bad.css')).then(openEditor => {
          editor = openEditor;
        });
      });
    });

    it('finds at least one message', () => {
      waitsForPromise(() => {
        return lint(editor).then(messages => {
          expect(messages.length).toBeGreaterThan(0);
        });
      });
    });

    it('verifies the first message', () => {
      waitsForPromise(() => {
        return lint(editor).then(messages => {
          expect(messages[0].type).toBeDefined();
          expect(messages[0].type).toEqual('Warning');
          expect(messages[0].text).toBeDefined();
          expect(messages[0].text).toEqual('Unexpected empty block (block-no-empty)');
          expect(messages[0].filePath).toBeDefined();
          expect(messages[0].filePath).toMatch(/.+bad\.css$/);
          expect(messages[0].range).toBeDefined();
          expect(messages[0].range).toEqual({
            start: { row: 0, column: 5 },
            end: { row: 0, column: 1006 }
          });
        });
      });
    });
  });

  it('finds nothing wrong with a valid file', () => {
    waitsForPromise(() => {
      return atom.workspace.open(path.join(__dirname, 'fixtures', 'good.css')).then(editor => {
        return lint(editor).then(messages => {
          expect(messages.length).toEqual(0);
        });
      });
    });
  });
});
