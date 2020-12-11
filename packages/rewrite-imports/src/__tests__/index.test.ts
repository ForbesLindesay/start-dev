import rewriteImports from '../';

const testFile = `// awesome file
import hello from 'hello';
import {a, b} from 'world';
import * as c from 'england';
export {d, e} from 'london';
export * from 'germany';
const f = await import('berlin');
`;
test('rewriteImports', async () => {
  expect(
    await rewriteImports({name: 'testFile', source: testFile}, async (path) =>
      [...path].reverse().join(''),
    ),
  ).toMatchInlineSnapshot(`
    "// awesome file
    import hello from 'olleh';
    import {a, b} from 'dlrow';
    import * as c from 'dnalgne';
    export {d, e} from 'nodnol';
    export * from 'ynamreg';
    const f = await import('nilreb');
    "
  `);
});
