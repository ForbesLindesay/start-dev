import {createHash} from 'crypto';
import {getModuleAPI} from './rpc-client';

if (process.env.POPULATE_SNOWPACK_CACHE === 'true') {
  require('rimraf').sync(`${__dirname}/../snowpack-cache`);
}

export default async function handleRequest(request: any): Promise<any> {
  if (request.type === 'method-call') {
    return await getModuleAPI(request.moduleID)[request.methodName](
      ...request.args,
    );
  }
  if (request.type === 'long-poll') {
    const observable = getModuleAPI(request.moduleID)[request.exportName];
    const etag = createHash('sha1')
      .update(JSON.stringify(observable.getValue()))
      .digest('base64');
    if (etag !== request.etag) {
      return {
        etag,
        value: observable.getValue(),
      };
    }
    const unsubscribe: (() => void)[] = [];
    return await Promise.race([
      new Promise((resolve) => {
        const t = setTimeout(() => {
          for (const u of unsubscribe) {
            u();
          }
          resolve({etag});
        }, request.timeout);
        unsubscribe.push(() => clearTimeout(t));
      }),
      new Promise((resolve) => {
        unsubscribe.push(
          observable.subscribe(() => {
            for (const u of unsubscribe) {
              u();
            }
            const etag = createHash('sha1')
              .update(JSON.stringify(observable.getValue()))
              .digest('base64');
            resolve({
              etag,
              value: observable.getValue(),
            });
          }),
        );
      }),
    ]);
  }
  if (
    request.type === 'frontend-loaded' &&
    process.env.POPULATE_SNOWPACK_CACHE === 'true'
  ) {
    require('rimraf').sync(`${__dirname}/../snowpack-cache`);
    require('copy-dir').sync(
      `${__dirname}/../node_modules/.cache/snowpack/development`,
      `${__dirname}/../snowpack-cache`,
    );
    require('rimraf').sync(
      `${__dirname}/../node_modules/.cache/snowpack/development`,
    );
    process.exit(0);
  }
}

// import {createHash}
// import { ObservableState } from ".";

// export default async function longPoll<T>(state: ObservableState<T>, lastToken?: string) {
//   if (JSON.stringify(state.getValue())) {

//   }
// }
