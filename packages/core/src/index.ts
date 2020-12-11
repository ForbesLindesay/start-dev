import {resolve, relative, dirname, join} from 'path';
import {promises, readFileSync, writeFileSync} from 'fs';
import {randomBytes} from 'crypto';
// import {createBrotliDecompress} from 'zlib';
import {createServer, IncomingMessage, ServerResponse} from 'http';
import {transform} from 'sucrase';
import {getType} from 'mime';
import getBundler from '@graphical-scripts/bundle';
import rewriteImports from '@graphical-scripts/rewrite-imports';
import getRpcClient from './rpc-client';
import handleRequest from './handleRequest';
const resolveNode = require('resolve');

// we intentionally wait until after we've loaded all the internal modules before registering sucrase to
// handle any server side modules
require('sucrase/register');

const CSRF_TOKEN = randomBytes(128).toString('base64');

const builtinDependencies: {[key: string]: string} = {
  // '@graphical-scripts/dark-mode-selector':
  //   '/@graphical-scripts/dark-mode-selector',
  // '@graphical-scripts/state': '/@graphical-scripts/state',
  '@graphical-scripts/app': '/app/index.js',
};
// const standardDependencies: {[key: string]: string} = {
//   'react-dom':
//     'https://cdn.skypack.dev/pin/react-dom@v17.0.1-FZxWEnre1YpJlruVUxMM/react-dom.js',
//   react:
//     'https://cdn.skypack.dev/pin/react@v17.0.1-POc2QItJkO3bjziOktDB/react.js',
//   beamwind:
//     'https://cdn.skypack.dev/pin/beamwind@v2.0.2-2a2uwoX8I3NyVQ5qsyQ0/beamwind.js',
// };

const APP_DIRECTORY = resolve(`${__dirname}/../../example/scripts`);
const FRAME_DIRECTORY = resolve(`${__dirname}/../app`);
// const CACHE_DIR = resolve(`${__dirname}/../snowpack-cache`);
const htmlFileName = join(FRAME_DIRECTORY, 'index.html');

function readEntryPoints() {
  try {
    return new Map<string, string[]>(
      JSON.parse(
        readFileSync(`${__dirname}/../package-entry-points.json`, 'utf8'),
      ),
    );
  } catch (ex) {
    return new Map<string, string[]>();
  }
}
const entrypoints = readEntryPoints();
const bundle = getBundler({
  prefix: '/_bundle_',
  cwd: APP_DIRECTORY,
  output: `${__dirname}/../bundle-cache`,
  getEntrypoints: (dep) => entrypoints.get(dep) ?? [],
  onEntryPoint: (dep, entrypoint) => {
    const es = entrypoints.get(dep) ?? [];
    entrypoints.set(dep, es);
    if (!es.includes(entrypoint)) {
      es.push(entrypoint);
      es.sort();
      writeFileSync(
        `${__dirname}/../package-entry-points.json`,
        JSON.stringify([...entrypoints], null, '  '),
      );
    }
  },
});

createServer(async (req, res) => {
  if (!req.url?.endsWith('.map')) {
    const originalEnd = (res as any).end;
    const start = Date.now();
    res.end = (...args: any[]) => {
      console.info(
        `${res.statusCode} ${req.method} ${req.url} in ${Date.now() - start}ms`,
      );
      return originalEnd.call(res, ...args);
    };
  }
  try {
    if (req.url === '/_csrf') {
      if (!req.headers.referer?.startsWith('http://localhost:3001/')) {
        res.statusCode = 400;
        res.end('Invalid referer for CSRF request');
        return;
      }
      res.setHeader('Content-Type', 'text/javascript');
      res.end(`while(true);console.log(${JSON.stringify(CSRF_TOKEN)})`);
      return;
    }
    if (req.method !== 'GET' && req.headers['x-csrf-token'] !== CSRF_TOKEN) {
      res.statusCode = 403;
      res.end(`Missing or invalid CSRF token`);
      return;
    }
    if (req.method === 'POST' && req.url === '/_api') {
      res.setHeader('Content-Type', 'application/json');
      try {
        const requestString = await new Promise<string>((resolve, reject) => {
          const body: Buffer[] = [];
          req.on('error', reject);
          req.on('data', (data) => {
            body.push(data);
          });
          req.on('end', () => {
            resolve(Buffer.concat(body).toString('utf8'));
          });
        });
        const request = JSON.parse(requestString);
        res.end(
          JSON.stringify((await handleRequest(request)) ?? null, null, '  '),
        );
        return;
      } catch (ex) {
        console.error(ex.stack || ex);
        try {
          res.statusCode = 500;
          res.end(
            JSON.stringify(
              {
                message: ex.message,
                stack: (ex.stack || '').split('\n'),
              },
              null,
              '  ',
            ),
          );
        } catch (ex) {
          // ignore error within error
        }
        return;
      }
    }
    if (req.url === '/@graphical-scripts/app') {
      res.end('');
      return;
    }
    if (req.url!.startsWith('/app/')) {
      if (req.url!.endsWith('.api.js')) {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(
          await getRpcClient(APP_DIRECTORY, req.url!.substr('/app/'.length)),
        );
        return;
      }
      if (req.url!.endsWith('.js')) {
        for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
          const path = join(
            APP_DIRECTORY,
            req.url!.substr('/app/'.length),
          ).replace(/\.js$/, ext);
          if (await servePath(path, req, res)) {
            return;
          }
        }
      }

      const path = join(APP_DIRECTORY, req.url!.substr('/app/'.length));
      const stat = await promises
        .stat(path)
        .catch((ex) => (ex.code === 'ENOENT' ? null : Promise.reject(ex)));
      if (stat) {
        const etag = stat.mtime.toISOString();
        if (handledUsingCache(etag, req, res)) return;
        res.setHeader('Content-Type', getType(path)!);
        res.end(await promises.readFile(path));
        return;
      }
    }
    if (req.url!.startsWith('/frame/')) {
      if (req.url!.endsWith('.api.js')) {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(
          await getRpcClient(
            FRAME_DIRECTORY,
            req.url!.substr('/frame/'.length),
          ),
        );
        return;
      }
      if (req.url!.endsWith('.js')) {
        for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
          const path = join(
            FRAME_DIRECTORY,
            req.url!.substr('/frame/'.length),
          ).replace(/\.js$/, ext);
          if (await servePath(path, req, res)) {
            return;
          }
        }
      }

      const path = join(FRAME_DIRECTORY, req.url!.substr('/frame/'.length));
      const stat = await promises
        .stat(path)
        .catch((ex) => (ex.code === 'ENOENT' ? null : Promise.reject(ex)));
      if (stat) {
        const etag = stat.mtime.toISOString();
        if (handledUsingCache(etag, req, res)) return;
        res.setHeader('Content-Type', getType(path)!);
        res.end(await promises.readFile(path));
        return;
      }
    }

    const bundleResult = await bundle.handle(req.url!);
    if (bundleResult?.kind === 'entrypoint') {
      if (handledUsingCache(bundleResult.id, req, res)) return;
      res.setHeader('Content-Type', 'text/javascript');
      res.end(await bundleResult.getContent());
      return;
    }
    if (bundleResult?.kind === 'dependency') {
      if (handledUsingCache(bundleResult.path, req, res)) return;
      res.setHeader('Content-Type', 'text/javascript');
      res.end(
        `import * as e from '${bundleResult.path}';\n` +
          `export default e.default;\n` +
          `export * from '${bundleResult.path}';`,
      );
      return;
    }

    const path = join(FRAME_DIRECTORY, req.url!.substr(1));
    const stat = await promises
      .stat(path)
      .catch((ex) => (ex.code === 'ENOENT' ? null : Promise.reject(ex)));
    if (stat?.isFile()) {
      const etag = stat.mtime.toISOString();
      if (handledUsingCache(etag, req, res)) return;
      res.setHeader('Content-Type', getType(path)!);
      res.end(await promises.readFile(path));
      return;
    }

    if (req.method === 'GET') {
      const etag = (await promises.stat(htmlFileName)).mtime.toISOString();
      if (handledUsingCache(etag, req, res)) return;
      res.setHeader('Content-Type', 'text/html');
      res.end(await promises.readFile(htmlFileName));
      return;
    }
    res.statusCode = 404;
    res.end('Page not found');
  } catch (ex) {
    console.error(ex.stack);
    res.statusCode = 500;
    res.end('Internal sever error');
  }
}).listen(3001);

function handledUsingCache(
  etag: string,
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (process.env.DISABLE_CACHE === 'true') return false;
  if (req.headers['if-none-match'] === etag) {
    res.statusCode = 304;
    res.end();
    return true;
  }
  res.setHeader('ETag', etag);
  return false;
}

async function servePath(
  path: string,
  req: IncomingMessage,
  res: ServerResponse,
) {
  const stat = await promises
    .stat(path)
    .catch((ex) => (ex.code === 'ENOENT' ? null : Promise.reject(ex)));
  if (stat) {
    const etag = stat.mtime.toISOString();
    if (handledUsingCache(etag, req, res)) return true;
    res.setHeader('Content-Type', 'text/javascript');
    const transformed = transform(
      await promises.readFile(path, 'utf8'),
      path.endsWith('.tsx')
        ? {transforms: ['typescript', 'jsx'], filePath: req.url}
        : path.endsWith('.ts')
        ? {transforms: ['typescript'], filePath: req.url}
        : {transforms: ['flow', 'jsx'], filePath: req.url},
    ).code;
    res.end(
      await rewriteImports({source: transformed, name: path}, async (dep) => {
        if (dep[0] === '.') {
          const absolutePath = await new Promise<string>((resolve, reject) => {
            resolveNode(
              dep,
              {
                basedir: dirname(path),
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
              },
              (err: any, result: any) => {
                if (err) reject(err);
                else resolve(result);
              },
            );
          });
          let relativePath = relative(FRAME_DIRECTORY, absolutePath);
          if (relativePath[0] !== '.') {
            return `/${relativePath.replace(/\.(jsx|ts|tsx)$/, '.js')}`;
          }
          relativePath = relative(APP_DIRECTORY, absolutePath);
          if (relativePath[0] !== '.') {
            return `/app/${relativePath.replace(/\.(jsx|ts|tsx)$/, '.js')}`;
          }
          if (relativePath[0] === '.') {
            throw new Error(
              `Cannot import ${absolutePath} because it is outside the app directory.`,
            );
          }
        }
        if (dep in builtinDependencies) {
          return builtinDependencies[dep];
        }

        return bundle.resolve(dep);
      }),
    );
    return true;
  }
  return false;
}
