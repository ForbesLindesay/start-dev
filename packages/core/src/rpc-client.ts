import {join} from 'path';
import {existsSync} from 'fs';
import {createHash} from 'crypto';

export async function loadModule(absoluteFilename: string) {
  const sourceExtension =
    ['.mjs', '.ts', '.tsx', '.js', '.jsx'].find((ext) =>
      existsSync(`${absoluteFilename.replace(/\.m?js/, '')}${ext}`),
    ) ?? '.js';
  const pkg = await import(
    `${absoluteFilename.replace(/\.m?js/, '')}${sourceExtension}`
  );
  return pkg;
}
export default async function getRpcClient(appDir: string, filename: string) {
  const pkg = await loadModule(join(appDir, filename));
  const output = [];
  output.push(`import {asyncMethod, observableState} from '/api-client.js';`);
  output.push(`const filename = ${JSON.stringify(join(appDir, filename))};`);
  for (const methodName of Object.keys(pkg)) {
    if (typeof pkg[methodName] === 'function') {
      output.push(
        `export const ${methodName} = asyncMethod(filename, ${JSON.stringify(
          methodName,
        )})`,
      );
    } else if (
      pkg[methodName] &&
      typeof pkg[methodName].getValue === 'function' &&
      typeof pkg[methodName].subscribe === 'function'
    ) {
      const initialValue = pkg[methodName].getValue();
      const etag = createHash('sha1')
        .update(JSON.stringify(initialValue))
        .digest('base64');
      output.push(
        `export const ${methodName} = observableState(filename, ${JSON.stringify(
          methodName,
        )}, ${JSON.stringify(initialValue)}, ${JSON.stringify(etag)})`,
      );
    }
  }
  return output.join('\n');
}
