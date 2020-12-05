// import {readFileSync} from 'fs';
import {resolve, relative} from 'path';
import {SnowpackPlugin} from 'snowpack';

// const rpcProxy = `
// export const y = 10;
// `;
module.exports = function plugin(
  _snowpackConfig: any,
  {directory}: {directory: string},
): SnowpackPlugin {
  const absoluteDirectory = resolve(directory);
  return {
    name: __filename,
    resolve: {
      input: [], // ['.js', '.mjs', '.jsx', '.ts', '.tsx'],
      output: ['.js'], // always export JS
    },
    async load({filePath, fileExt}) {
      if (
        !['.js', '.mjs', '.jsx', '.ts', '.tsx'].some((ext) =>
          filePath.endsWith(`.api${ext}`),
        )
      ) {
        return undefined;
      }
      if (!resolve(filePath).startsWith(absoluteDirectory)) {
        return undefined;
      }
      return {
        '.js': {
          // code: output.join('\n'),
          code: `export * from '/_api/${relative(
            absoluteDirectory,
            filePath.substr(0, filePath.length - fileExt.length) + '.js',
          )}';`,
        },
      };
      // const file = await import(filePath);
      // console.log(file);

      // const source = readFileSync(filePath, 'utf8');

      // const asyncMethods: string[] = [];
      // const observableMethods: string[] = [];
      // for (const line of source.split('\n').map((l) => l.trim())) {
      //   const defaultAsyncMatch = /^export\s+default\s+async\s+function/.exec(
      //     line,
      //   );
      //   if (defaultAsyncMatch) {
      //     asyncMethods.push('default');
      //     continue;
      //   }
      //   const namedAsyncMatch = /^export\s+async\s+function\s+([^(*]+)\s*\(/.exec(
      //     line,
      //   );
      //   if (namedAsyncMatch) {
      //     asyncMethods.push(namedAsyncMatch[1]);
      //     continue;
      //   }
      //   const defaultOvservableMatch = /^export\s+default\s+function/.exec(
      //     line,
      //   );
      //   if (defaultOvservableMatch) {
      //     observableMethods.push('default');
      //     continue;
      //   }
      //   const namedOvservableMatch = /^export\s+function\s+([^(*]+)\s*\(/.exec(
      //     line,
      //   );
      //   if (namedOvservableMatch) {
      //     namedOvservableMatch.push(namedOvservableMatch[1]);
      //     continue;
      //   }
      // }

      // const CSRF_TOKEN = fetch('/_csrf')
      // .then(async (r) => {
      //   if (!r.ok) throw new Error(r.statusText);
      //   return r.text();
      // })
      // .then((r) => r.substr('while(true);'.length));
      // const output = [`import x from '/_api/my-custom-path.js';`];
      // if (asyncMethods.length || observableMethods.length) {
      //   output.push(`let csrfTokenCache;`);
      //   output.push(`async function getCsrfToken() {`);
      //   output.push(`  try {`);
      //   output.push(`    csrfTokenCache = csrfTokenCache || fetch('/_csrf');`);
      //   output.push(`    const response = await csrfTokenCache`);
      //   output.push(`    if (!response.ok) {`);
      //   output.push(`      throw new Error(`);
      //   output.push(`        response.statusText + ': ' +`);
      //   output.push(`          (await response.text())`);
      //   output.push(`      );`);
      //   output.push(`    }`);
      //   output.push(`    const responseText = await response.text()`);
      //   output.push(`    return responseText.substr('while(true);'.length)`);
      //   output.push(`  } catch (ex) {`);
      //   output.push(`    csrfTokenCache = undefined;`);
      //   output.push(`    throw ex;`);
      //   output.push(`  }`);
      //   output.push(`}`);
      //   output.push(``);
      //   output.push(`async function callmethod(mode, methodName, ...args) {`);
      //   output.push(`  const response = await fetch('/_api', {`);
      //   output.push(`    method: 'post',`);
      //   output.push(`    headers: {`);
      //   output.push(`      'x-csrf-token': await getCsrfToken(),`);
      //   output.push(`      'content-type': 'application/json'`);
      //   output.push(`    },`);
      //   output.push(`    body: JSON.stringify({mode, methodName, args})`);
      //   output.push(`  });`);
      //   output.push(`  if (!response.ok) {`);
      //   output.push(
      //     `    if (response.headers.get('content-type') === 'application/json') {`,
      //   );
      //   output.push(`      const err = await response.json();`);
      //   output.push(
      //     `      throw new Error(err.stack ? \`\${err.stack.join('\\n')}\\n\\n\` : err.message);`,
      //   );
      //   output.push(`    } else {`);
      //   output.push(
      //     `      throw new Error(\`\${response.statusText}: \${await response.text()}\`);`,
      //   );
      //   output.push(`    }`);
      //   output.push(`  } else {`);
      //   output.push(`    return response.json();`);
      //   output.push(`  }`);
      //   output.push(`}`);
      // }
      // if (asyncMethods.length) {
      //   output.push(`function asyncMethod(methodName) {`);
      //   output.push(`  return async (...args) => {`);
      //   output.push(
      //     `    return await callmethod('async', methodName, ...args);`,
      //   );
      //   output.push(`  };`);
      //   output.push(`}`);
      // }
      // for (const methodName of asyncMethods) {
      //   if (methodName === 'default') {
      //     output.push(`export default asyncMethod('default');`);
      //   } else {
      //     output.push(
      //       `export const ${methodName} = asyncMethod('${methodName}');`,
      //     );
      //   }
      // }
      // if (observableMethods.length) {
      //   output.push(`function observableMethod(methodName) {`);
      //   output.push(`  return async (...args) => {`);
      //   output.push(
      //     `    const response = callmethod('observable', methodName, ...args);`,
      //   );
      //   output.push(`    return (fn) => {`);
      //   output.push(`      response.then(value => {`);
      //   output.push(`        fn(value);`);
      //   output.push(`        fn(value);`);
      //   output.push(`      });`);
      //   output.push(`    };`);
      //   output.push(`  };`);
      //   output.push(`}`);
      // }
      // for (const methodName of asyncMethods) {
      //   if (methodName === 'default') {
      //     output.push(`export default asyncMethod('default');`);
      //   } else {
      //     output.push(
      //       `export const ${methodName} = asyncMethod('${methodName}');`,
      //     );
      //   }
      // }
      // console.warn(source);
      // request/response:
      // export default async function
      // export async function

      // subscribe:
      // export default function
      // export function

      // console.warn(output.join('\n'));
    },
    cleanup() {
      // pool && pool.terminate();
    },
    config(this: SnowpackPlugin, config) {
      // if we set this before `config` is called, the default plugins don't get added
      this.resolve!.input = ['.js', '.mjs', '.jsx', '.ts', '.tsx'];

      // we need to be before the builtin plugins in the queue
      config.plugins.unshift(this);
    },
  };
};
