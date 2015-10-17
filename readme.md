# linter-stylelint [![Dependency Status](https://david-dm.org/AtomLinter/linter-stylelint.svg)](https://david-dm.org/AtomLinter/linter-stylelint)

The plugin for [Atom Linter](https://github.com/AtomLinter/atom-linter) provides an interface to [stylelint](https://github.com/stylelint/stylelint).

![demo](https://raw.githubusercontent.com/1000ch/linter-stylelint/master/capture.png)

## Installation

```bash
$ apm install linter-stylelint
```

## Config

You can configure from following ways.

- Put `.stylelintrc`.
- Select from presets on settings.
    - [stylelint-config-cssrecipes](https://github.com/stylelint/stylelint-config-cssrecipes)
    - [stylelint-config-suitcss](https://github.com/stylelint/stylelint-config-suitcss)
    - [stylelint-config-wordpress](https://github.com/stylelint/stylelint-config-wordpress)

`.stylelintrc` is preferred always. If you checked `Use preset` on and put `.stylelintrc`, setting based on selected preset extends put `.stylelintrc`.

## License

MIT: http://1000ch.mit-license.org/
