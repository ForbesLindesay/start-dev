import {resolve} from 'path';
import {existsSync} from 'fs';

// require('esm');
// require('esbuild-register');
const modules = new Map<string, any>();
export default async function getRpcClient(filename: string) {
  require('sucrase/register');
  const moduleID = resolve(
    `${__dirname}/../app/`,
    filename.replace(/\.js$/, ''),
  );
  const sourceExtension =
    ['.mjs', '.ts', '.tsx', '.js', '.jsx'].find((ext) =>
      existsSync(`${moduleID}${ext}`),
    ) ?? '.js';
  const pkg = await import(`${moduleID}${sourceExtension}`);
  modules.set(moduleID, pkg);
  const output = [];
  output.push(`import {asyncMethod} from '/_api/api-client.js';`);
  for (const methodName of Object.keys(pkg)) {
    if (typeof pkg[methodName] === 'function') {
      output.push(
        `export const ${methodName} = asyncMethod(${JSON.stringify(
          moduleID,
        )}, ${JSON.stringify(methodName)})`,
      );
    }
  }
  return output.join('\n');
  // console.log('pkg=', pkg);
  // return `console.log('loading rpc module', ${JSON.stringify(
  //   filename,
  // )})\nexport const readFile = async (...args) => args`;
}

export function getModuleAPI(moduleID: string): any {
  const result = modules.get(moduleID);
  if (!result) {
    throw new Error(`Unrecognized module ID: ${moduleID}`);
  }
  return result;
}
