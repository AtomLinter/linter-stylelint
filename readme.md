# linter-stylelint [![Dependency Status](https://david-dm.org/AtomLinter/linter-stylelint.svg)](https://david-dm.org/AtomLinter/linter-stylelint)

A plugin for [Atom Linter](https://github.com/AtomLinter/atom-linter) providing
an interface to [stylelint](https://github.com/stylelint/stylelint).

![demo](https://raw.githubusercontent.com/AtomLinter/linter-stylelint/master/demo.png)

## Installation

```ShellSession
apm install linter-stylelint
```

linter-stylelint runs `stylelint` against your CSS, SCSS, Less, PostCSS,
and SugarSS files.

## Configuration

You can pass a configuration to `stylelint` in any of the following ways:

-   Place a configuration file (`.stylelintrc` or `stylelint.config.js`) in your
    project's root folder or in any parent folder.

-   Add a `stylelint` section in your `package.json`.

-   In the settings, check `Use standard` to automatically use [stylelint-config-standard](https://github.com/stylelint/stylelint-config-standard)

`.stylelintrc` is always prioritized. If you have checked `Use standard` in the
settings and also have a `.stylelintrc` file, your `.stylelintrc` configuration
will extend the preset, using [stylelint's extend functionality](http://stylelint.io/?/docs/user-guide/configuration.md).

## Notes

As of `stylelint` v7.0.0 the ability to lint embedded style code has been
removed from core, replaced with the ability for generic processors to handle
any file format. Currently one has yet to be written for pulling style code
out of HTML, if you are interested in bringing this functionality back to
`linter-stylelint`, check out [their documentation](https://github.com/stylelint/stylelint/blob/master/docs/developer-guide/processors.md)
on how to write a processor to handle HTML, and any other files that contain
style code!

## License

MIT: <http://1000ch.mit-license.org/>
