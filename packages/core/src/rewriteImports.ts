import {parseChar, isPunctuator, defaultState} from 'character-parser';

export default async function rewriteImports(
  str: string,
  resolve: (path: string) => Promise<string>,
) {
  const state = defaultState();
  let expectingPath = false;
  let inPath = false;
  let srcBeforePath = '';
  let path = '';
  for (let i = 0; i < str.length; i++) {
    parseChar(str[i], state);
    if (expectingPath && state.isString()) {
      expectingPath = false;
      inPath = true;
      srcBeforePath = state.src;
    } else if (inPath) {
      if (state.isString()) {
        path += str[i];
      } else {
        state.src = srcBeforePath + (await resolve(path)) + str[i];
        path = '';
        inPath = false;
      }
    } else if (
      str[i + 1] === 'f' &&
      str[i + 2] === 'r' &&
      str[i + 3] === 'o' &&
      str[i + 4] === 'm' &&
      !state.isNesting() &&
      (/\s/.test(str[i]) || str[i] === '}')
    ) {
      expectingPath = true;
    } else if (
      str[i + 1] === 'i' &&
      str[i + 2] === 'm' &&
      str[i + 3] === 'p' &&
      str[i + 4] === 'o' &&
      str[i + 5] === 'r' &&
      str[i + 6] === 't' &&
      !state.isComment() &&
      !state.isString() &&
      (isPunctuator(str[i]) || /\s/.test(str[i]))
    ) {
      expectingPath = true;
    }
  }
  return state.src;
}
