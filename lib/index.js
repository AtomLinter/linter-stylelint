'use babel';

// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import { CompositeDisposable } from 'atom';

// Dependencies
let helpers;
let dirname;
let stylelint;
let assignDeep;
let presetConfig;

function loadDeps() {
  if (!helpers) {
    helpers = require('./helpers');
  }
  if (!dirname) {
    dirname = require('path').dirname;
  }
  if (!stylelint) {
    stylelint = require('stylelint');
  }
  if (!assignDeep) {
    assignDeep = require('assign-deep');
  }
  if (!presetConfig) {
    presetConfig = require('stylelint-config-standard');
  }
}

export default {
  activate() {
    this.idleCallbacks = new Set();
    let depsCallbackID;
    const installLinterStylelintDeps = () => {
      this.idleCallbacks.delete(depsCallbackID);
      if (!atom.inSpecMode()) {
        require('atom-package-deps').install('linter-stylelint');
      }
      loadDeps();
    };
    depsCallbackID = window.requestIdleCallback(installLinterStylelintDeps);
    this.idleCallbacks.add(depsCallbackID);

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('linter-stylelint.useStandard', (value) => {
        this.useStandard = value;
      }),
      atom.config.observe('linter-stylelint.disableWhenNoConfig', (value) => {
        this.disableWhenNoConfig = value;
      }),
      atom.config.observe('linter-stylelint.showIgnored', (value) => {
        this.showIgnored = value;
      })
    );

    this.baseScopes = [
      'source.css',
      'source.scss',
      'source.css.scss',
      'source.less',
      'source.css.less',
      'source.css.postcss',
      'source.css.postcss.sugarss'
    ];
  },

  deactivate() {
    this.idleCallbacks.forEach(callbackID => window.cancelIdleCallback(callbackID));
    this.idleCallbacks.clear();
    this.subscriptions.dispose();
  },

  provideLinter() {
    return {
      name: 'stylelint',
      grammarScopes: this.baseScopes,
      scope: 'file',
      lintOnFly: true,
      lint: async (editor) => {
        // Force the dependencies to load if they haven't already
        loadDeps();

        helpers.startMeasure('linter-stylelint: Lint');
        const scopes = editor.getLastCursor().getScopeDescriptor().getScopesArray();

        const filePath = editor.getPath();
        const text = editor.getText();

        if (!text) {
          helpers.endMeasure('linter-stylelint: Lint');
          return [];
        }

        // Setup base config if useStandard() is true
        const defaultConfig = {
          rules: {}
        };

        // Base the config in the project directory
        let [configBasedir] = atom.project.relativizePath(filePath);
        if (configBasedir === null) {
          // Falling back to the file directory if no project is found
          configBasedir = dirname(filePath);
        }

        const rules = this.useStandard ? assignDeep({}, presetConfig) : defaultConfig;

        const options = {
          code: text,
          codeFilename: filePath,
          config: rules,
          configBasedir
        };

        if (scopes.includes('source.css.scss') || scopes.includes('source.scss')) {
          options.syntax = 'scss';
        }
        if (scopes.includes('source.css.less') || scopes.includes('source.less')) {
          options.syntax = 'less';
        }
        if (scopes.includes('source.css.postcss.sugarss')) {
          options.syntax = 'sugarss';
          // `stylelint-config-standard` isn't fully compatible with SugarSS
          // See here for details:
          // https://github.com/stylelint/stylelint-config-standard#using-the-config-with-sugarss-syntax
          options.config.rules['block-closing-brace-empty-line-before'] = null;
          options.config.rules['block-closing-brace-newline-after'] = null;
          options.config.rules['block-closing-brace-newline-before'] = null;
          options.config.rules['block-closing-brace-space-before'] = null;
          options.config.rules['block-opening-brace-newline-after'] = null;
          options.config.rules['block-opening-brace-space-after'] = null;
          options.config.rules['block-opening-brace-space-before'] = null;
          options.config.rules['declaration-block-semicolon-newline-after'] = null;
          options.config.rules['declaration-block-semicolon-space-after'] = null;
          options.config.rules['declaration-block-semicolon-space-before'] = null;
          options.config.rules['declaration-block-trailing-semicolon'] = null;
        }

        helpers.startMeasure('linter-stylelint: Create Linter');
        const stylelintLinter = await stylelint.createLinter();
        helpers.endMeasure('linter-stylelint: Create Linter');

        helpers.startMeasure('linter-stylelint: Config');
        let foundConfig;
        try {
          foundConfig = await stylelintLinter.getConfigForFile(filePath);
        } catch (error) {
          if (!/No configuration provided for .+/.test(error.message)) {
            helpers.endMeasure('linter-stylelint: Config');
            // If we got here, stylelint failed to parse the configuration
            // there's no point of re-linting if useStandard is true, because the
            // user does not have the complete set of desired rules parsed
            atom.notifications.addError('Unable to parse stylelint configuration', {
              detail: error.message,
              dismissable: true
            });
            helpers.endMeasure('linter-stylelint: Lint');
            return [];
          }
        }
        helpers.endMeasure('linter-stylelint: Config');

        if (foundConfig) {
          options.config = assignDeep(rules, foundConfig.config);
          options.configBasedir = dirname(foundConfig.filepath);
        }

        if (!foundConfig && this.disableWhenNoConfig) {
          helpers.endMeasure('linter-stylelint: Lint');
          return [];
        }

        helpers.startMeasure('linter-stylelint: Check ignored');
        let fileIsIgnored;
        try {
          fileIsIgnored = await stylelintLinter.isPathIgnored(filePath);
        } catch (error) {
          // Do nothing, configuration errors should have already been caught and thrown above
        }
        helpers.endMeasure('linter-stylelint: Check ignored');

        if (fileIsIgnored) {
          helpers.endMeasure('linter-stylelint: Lint');
          if (this.showIgnored) {
            return [{
              type: 'Warning',
              severity: 'warning',
              text: 'This file is ignored',
              filePath
            }];
          }
          return [];
        }
        const settings = {
          showIgnored: this.showIgnored
        };

        return helpers.runStylelint(editor, options, filePath, settings);
      }
    };
  }
};
