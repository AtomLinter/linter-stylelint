'use babel';

const hasValidScope = (editor, validScopes) => editor.getCursors()
  .some(cursor => cursor.getScopeDescriptor()
    .getScopesArray()
    .some(scope => validScopes.includes(scope)));

export default hasValidScope;
