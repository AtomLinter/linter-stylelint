'use babel';

// eslint-disable-next-line import/extensions, import/no-extraneous-dependencies
import { CompositeDisposable } from 'atom';

// Dependencies
let helpers;
let dirname;
let stylelint;
let assignDeep;

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
      atom.config.observe('linter-stylelint.disableWhenNoConfig', (value) => {
        this.disableWhenNoConfig = value;
        if (this.useStandard && this.disableWhenNoConfig) {
          // Disable using the standard if it is desired to stop linting with
          // no configuration
          atom.config.set('linter-stylelint.useStandard', false);
        }
      }),
      atom.config.observe('linter-stylelint.useStandard', (value) => {
        this.useStandard = value;
        if (this.useStandard && this.disableWhenNoConfig) {
          // Disable disabling linting when there is no configuration as the
          // standard configuration will always be available.
          atom.config.set('linter-stylelint.disableWhenNoConfig', false);
        }
      }),
      atom.config.observe('linter-stylelint.showIgnored', (value) => {
        this.showIgnored = value;
      }),
      atom.config.observe('core.excludeVcsIgnoredPaths', (value) => {
        this.coreIgnored = value;
      }),
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
      lintsOnChange: true,
      lint: async (editor) => {
        // Force the dependencies to load if they haven't already
        loadDeps();

        helpers.startMeasure('linter-stylelint: Lint');

        const filePath = editor.getPath();
        const text = editor.getText();

        if (!text) {
          helpers.endMeasure('linter-stylelint: Lint');
          return [];
        }

        const rules = {};
        const options = {
          code: text,
          codeFilename: filePath,
          config: { rules }
        };

        const scopes = editor.getLastCursor().getScopeDescriptor().getScopesArray();
        if (scopes.includes('source.css.scss') || scopes.includes('source.scss')) {
          options.syntax = 'scss';
        } else if (scopes.includes('source.css.less') || scopes.includes('source.less')) {
          options.syntax = 'less';
        } else if (scopes.includes('source.css.postcss.sugarss')) {
          options.syntax = 'sugarss';
        }

        if (this.coreIgnored) {
          // When Atom (and thus Linter) is set to allow ignored files, tell
          // Stylelint to do the same.
          options.disableDefaultIgnores = true;
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
          // We have a configuration from Stylelint
          options.config = assignDeep(rules, foundConfig.config);
          options.configBasedir = dirname(foundConfig.filepath);
        } else if (this.disableWhenNoConfig) {
          // No configuration, and linting without one is disabled
          helpers.endMeasure('linter-stylelint: Lint');
          return [];
        } else if (this.useStandard) {
          // No configuration, but using the standard is enabled
          const defaultConfig = helpers.getDefaultConfig(options.syntax, filePath);
          assignDeep(rules, defaultConfig.rules);
          if (defaultConfig.extends) {
            options.config.extends = defaultConfig.extends;
          }
          options.configBasedir = defaultConfig.configBasedir;
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
              severity: 'warning',
              excerpt: 'This file is ignored',
              location: {
                file: filePath,
                position: helpers.createRange(editor)
              }
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
