# What happened

You arrived here after clicking on a stylelint plugin's rule name from a
linting error message.

Normally, clicking on a stylelint rule name in an error message takes you
to the [stylelint.io](http://stylelint.io/user-guide/rules/) or plugin's page
for that rule, so you can learn more about it. Unfortunately the plugin that
implements the rule you clicked on is not in the current list of plugins known
to the `linter-stylelint` package, so there is no way of knowing how to
automatically link to the rule's documentation.

## How you can help

Would you mind submitting a PR to add a mapping for the plugin you're using that
redirected you here? That way you, and everyone else using that plugin with
`linter-stylelint`, will be able to click the name and get to the documentation
quickly.

To do so simply add a new case to the `switch` statement in the
`generateHTMLMessage()` function, and send in your PR!
