# linter-stylelint [![Dependency Status](https://david-dm.org/AtomLinter/linter-stylelint.svg)](https://david-dm.org/AtomLinter/linter-stylelint)

A plugin for [Atom Linter](https://github.com/AtomLinter/atom-linter) providing an interface to [stylelint](https://github.com/stylelint/stylelint).

![demo](https://raw.githubusercontent.com/1000ch/linter-stylelint/master/demo.png)

## Installation

```bash
$ apm install linter-stylelint
```

linter-stylelint checks both `.css` and `.scss` files. (For `.scss` files, it automatically tells stylelint to use the right parser.)

## Config

You can pass configuration to stylelint in the following ways:

- Place a config file (`.stylelintrc` or `stylelint.config.js`) in your project's root or upper directories.
- Add a `stylelint` section in your `package.json`.
- In the settings, check `Use preset` and select one of the following presets:
    - [stylelint-config-standard](https://github.com/stylelint/stylelint-config-standard)
    - [stylelint-config-cssrecipes](https://github.com/stylelint/stylelint-config-cssrecipes)
    - [stylelint-config-suitcss](https://github.com/stylelint/stylelint-config-suitcss)
    - [stylelint-config-wordpress](https://github.com/stylelint/stylelint-config-wordpress)

`.stylelintrc` is always prioritized. If you have checked `Use preset` in the settings and also have a `.stylelintrc` file, your `.stylelintrc` configuration will extend the preset, using [stylelint's extend functionality](http://stylelint.io/?/docs/user-guide/configuration.md).

## License

MIT: http://1000ch.mit-license.org/
