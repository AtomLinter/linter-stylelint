# linter-stylelint [![Dependency Status](https://david-dm.org/AtomLinter/linter-stylelint.svg)](https://david-dm.org/AtomLinter/linter-stylelint)

A plugin for [Atom Linter](https://github.com/AtomLinter/atom-linter) providing
an interface to [stylelint](https://github.com/stylelint/stylelint).

![demo](https://raw.githubusercontent.com/AtomLinter/linter-stylelint/master/demo.png)

## Installation

```ShellSession
apm install linter-stylelint
```

linter-stylelint checks both `.css` and `.scss` files. (For `.scss` files, it
automatically tells `stylelint` to use the right parser.)

## Configuration

You can pass configuration to `stylelint` in any of the following ways:

-   Place a config file (`.stylelintrc` or `stylelint.config.js`) in your
    project's root or upper directories.

-   Add a `stylelint` section in your `package.json`.

-   In the settings, check `Use standard` to automatically use [stylelint-config-standard](https://github.com/stylelint/stylelint-config-standard)

`.stylelintrc` is always prioritized. If you have checked `Use standard` in the
settings and also have a `.stylelintrc` file, your `.stylelintrc` configuration
will extend the preset, using [stylelint's extend functionality](http://stylelint.io/?/docs/user-guide/configuration.md).

## License

MIT: <http://1000ch.mit-license.org/>
