import {URL} from 'url';
import {resolve, relative, dirname, join} from 'path';
import {promises} from 'fs';
import {randomBytes} from 'crypto';
import {createServer, IncomingMessage, ServerResponse} from 'http';
import {transform} from 'sucrase';
import {getType} from 'mime';
import bundleDependency from '@graphical-scripts/bundle';
import rewriteImports from '@graphical-scripts/rewrite-imports';
import findPackageLocations, {
  PackageLocation,
} from '@graphical-scripts/find-package-locations';
import getPackageExports, {
  NormalizedExport,
} from '@graphical-scripts/get-package-exports';
import chalk from 'chalk';
import createWebsocketServer from '@graphical-scripts/websocket-rpc/server';
import findCacheDir from 'find-cache-dir';
import rimraf from 'rimraf';

const CSRF_TOKEN = randomBytes(128).toString('base64');

const FRAME_DIRECTORY = resolve(`${__dirname}/../app`);
const htmlFileName = join(FRAME_DIRECTORY, 'index.html');
interface Options {
  appDirectory: string;
  appEntrypoint?: string;
  portNumber: number;
  cacheDirectory?: string;
  packageExportsOverrides?: {
    [key: string]: undefined | {[key: string]: string};
  };
}

createGraphicalServer({
  appDirectory: resolve(`${__dirname}/../../example/scripts`),
  appEntrypoint: 'index.js',
  portNumber: 3001,
});

export default function createGraphicalServer({
  appDirectory,
  appEntrypoint = 'index.js',
  cacheDirectory: $cacheDirectory,
  portNumber,
  packageExportsOverrides,
}: Options) {
  const start = Date.now();
  const fullAppEntrypointPath = resolve(appDirectory, appEntrypoint);
  const relativeAppEntrypointPath = relative(appDirectory, appEntrypoint);
  if (relativeAppEntrypointPath.startsWith('.')) {
    throw new Error(
      `The app entrypoint "${fullAppEntrypointPath}" must be inside the app directory, "${appDirectory}"`,
    );
  }
  const builtinDependencies: {[key: string]: string} = {
    '@graphical-scripts/app': `/app/${relativeAppEntrypointPath.replace(
      /\\/g,
      '/',
    )}`,
  };

  const ORIGIN = `http://localhost:${portNumber}`;
  const DISABLE_CACHE = process.env.DISABLE_CACHE === 'true';

  const cacheDirectory =
    $cacheDirectory ??
    findCacheDir({
      name: '@graphical-scripts/core',
      cwd: appDirectory,
      create: true,
    }) ??
    resolve('.graphical-scripts');

  const APP_EXTENSIONS = [
    '',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.ts',
    '.tsx',
    '/index.js',
    '/index.jsx',
    '/index.mjs',
    '/index.cjs',
    '/index.ts',
    '/index.tsx',
  ];

  const PACKAGE_EXTENSIONS = [
    '',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '/index.js',
    '/index.jsx',
    '/index.mjs',
    '/index.cjs',
  ];

  const packageExportOverrides: {
    [key: string]: undefined | {[key: string]: string};
  } = {
    scheduler: {'.': './', './tracing': './tracing.js'},
    '@graphical-scripts/websocket-rpc': {'./client': './dist/client.mjs'},
    ...packageExportsOverrides,
  };

  const packageExportsByDirectory = new Map<
    string,
    Promise<NormalizedExport[]>
  >();
  async function getPackageExportsCached(directory: string, packageID: string) {
    const cached = packageExportsByDirectory.get(directory);
    if (cached) return await cached;
    const packageName = packageID.split('@').slice(0, -1).join('@');
    const fresh = getPackageExports(directory, {
      overrideExports: packageExportOverrides[packageName],
      allowedExportKeys: ['browser', 'module', 'import', 'default'],
    });
    packageExportsByDirectory.set(directory, fresh);
    return await fresh;
  }

  let packageLocationsPromise:
    | Promise<Map<string, PackageLocation>>
    | undefined;
  // id is of the form "name@version"
  async function getPackageLocationsCached() {
    if (packageLocationsPromise) {
      return await packageLocationsPromise;
    }
    try {
      packageLocationsPromise = findPackageLocations(appDirectory);
      return await packageLocationsPromise;
    } catch (ex) {
      packageLocationsPromise = undefined;
      throw ex;
    }
  }
  async function getPackageLocationCached(
    id: string,
  ): Promise<PackageLocation | undefined> {
    return (await getPackageLocationsCached()).get(id);
  }

  function warnTimeout<T>(p: Promise<T>, time: number, message: string) {
    const t = setTimeout(() => {
      console.warn(message);
    }, time);
    p.then(
      () => clearTimeout(t),
      () => clearTimeout(t),
    );
    return p;
  }
  async function bundlePackage(
    packageID: string,
  ): Promise<{bundledDirectory: string} | null> {
    const bundledDirectory = join(cacheDirectory, packageID);
    if (
      await promises.stat(bundledDirectory).then(
        (s) => s.isDirectory(),
        () => false,
      )
    ) {
      if (DISABLE_CACHE) {
        await new Promise<void>((resolve, reject) =>
          rimraf(bundledDirectory, (err) => {
            if (err) reject(err);
            else resolve();
          }),
        );
      } else {
        return {bundledDirectory};
      }
    }
    const packageDirectory = await warnTimeout(
      getPackageLocationCached(packageID),
      500,
      `getPackageLocationCached(${packageID}) has taken over 500ms!`,
    );
    if (!packageDirectory) {
      return null;
    }

    const inputs: {[key: string]: string} = {};
    for (const e of await warnTimeout(
      getPackageExportsCached(
        packageDirectory.resolvedPackageDirectory,
        packageID,
      ),
      500,
      `getPackageExportsCached(${packageID}) has taken over 500ms!`,
    )) {
      inputs[`${e.exportName.replace(/\.js$/, '') || 'index'}`] =
        e.resolvedPath;
    }

    await warnTimeout(
      bundleDependency(inputs, bundledDirectory),
      5_000,
      `bundleDependency(${packageID}) has taken over 5 seconds!`,
    );

    return {bundledDirectory};
  }

  const bundledPackagesCache = new Map<
    string,
    Promise<{bundledDirectory: string} | null>
  >();
  async function bundlePackageCached(packageID: string) {
    const cached = bundledPackagesCache.get(packageID);
    if (cached) return await cached;
    const fresh = bundlePackage(packageID);
    bundledPackagesCache.set(packageID, fresh);
    Promise.race([
      fresh.then(() => true),
      new Promise<false>((r) => setTimeout(() => r(false), 4000)),
    ])
      .then((result) => {
        if (!result) {
          console.warn(
            `${packageID} has still not fnished bundling after 4 seconds`,
          );
        }
      })
      .catch(() => {
        // this error is reported elsewhere
      });
    return await fresh;
  }

  // GET _csrf => CSRF TOKEN
  // POST _api => API calls
  // GET /app/* => get modules from the actual app
  // GET /frame/* => get modules from the pre-provided frame
  // GET /packages/* => get packages
  // GET /dependencies/* => get package dependencies
  const server = createServer(async (req, res) => {
    // console.log(chalk.gray(`${req.method} ${req.url}`));
    const originalEnd = (res as any).end;
    const start = Date.now();
    res.end = (...args: any[]) => {
      const time = Date.now() - start;
      console.info(
        `${
          res.statusCode === 304
            ? chalk.green('304')
            : res.statusCode >= 400
            ? chalk.red(`${res.statusCode}`)
            : chalk.blue(`${res.statusCode}`)
        } ${req.method} ${req.url} in ${
          time < 10
            ? chalk.green(`${time}ms`)
            : time < 100
            ? chalk.yellow(`${time}ms`)
            : chalk.red(`${time}ms`)
        }`,
      );
      return originalEnd.call(res, ...args);
    };
    const referer = req.headers['referer'];
    let refererURL: URL | null = null;
    try {
      refererURL = referer !== undefined ? new URL(referer) : null;
    } catch (ex) {
      // ignore error parsing referer
    }
    if (req.method === 'POST' && req.url === '/_csrf') {
      if (!refererURL || refererURL.origin !== ORIGIN) {
        res.statusCode = 400;
        res.end(`Invalid referer for CSRF request, expected ${ORIGIN}`);
        return;
      }
      res.setHeader('Content-Type', 'text/javascript');
      res.end(`while(true);console.log(${JSON.stringify(CSRF_TOKEN)})`);
      return;
    }
    if (req.method !== 'GET') {
      res.statusCode = 403;
      res.end(`Unexpected POST request`);
      return;
    }
    try {
      if (req.url!.startsWith('/app/')) {
        if (req.url!.endsWith('.js')) {
          for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
            const path = join(
              appDirectory,
              req.url!.substr('/app/'.length),
            ).replace(/\.js$/, ext);
            if (await servePath(path, req, res)) {
              return;
            }
          }
        }

        const path = join(appDirectory, req.url!.substr('/app/'.length));
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

      if (req.url!.startsWith('/dependencies/')) {
        const path = req.url!.substr('/dependencies/'.length).split('/');
        let parentID = path[0];
        let dep = path.slice(1);
        if (parentID.startsWith('@')) {
          parentID += `/${dep[0]}`;
          dep = dep.slice(1);
        }
        let childName = dep[0];
        let entrypoint = dep.slice(1);
        if (childName.startsWith('@')) {
          childName += `/${entrypoint[0]}`;
          entrypoint = entrypoint.slice(1);
        }
        let parentDirectory =
          parentID === '_'
            ? appDirectory
            : (await getPackageLocationCached(parentID))
                ?.resolvedPackageDirectory;
        if (!parentDirectory) {
          res.statusCode = 404;
          res.end(`Dependency not found`);
          return;
        }
        let pkgStr: string | null = null;
        while (parentDirectory && pkgStr === null) {
          pkgStr = await promises
            .readFile(
              join(parentDirectory, 'node_modules', childName, 'package.json'),
              'utf8',
            )
            .catch(() => null);

          if (parentDirectory === dirname(parentDirectory)) {
            break;
          }
          parentDirectory = dirname(parentDirectory);
        }
        if (pkgStr === null) {
          res.statusCode = 404;
          res.end(`Dependency not found`);
          return;
        }
        const pkg = JSON.parse(pkgStr);
        if (handledUsingCache(`${pkg.name}@${pkg.version}`, req, res)) return;
        const source = `/packages/${pkg.name}@${pkg.version}/${
          entrypoint.length
            ? `${entrypoint.join('/').replace(/\.js$/, '')}`
            : `index`
        }.js`;
        res.setHeader('Content-Type', 'text/javascript');
        res.end(
          `import * as p from '${source}';\nexport default p.default;\nexport * from '${source}';\n`,
        );
        return;
      }

      if (req.url!.startsWith('/packages/')) {
        if (handledUsingCache(req.url!, req, res)) {
          return;
        }

        const path = req.url!.substr('/packages/'.length).split('/');
        let packageID = path[0];
        let entrypoint = path.slice(1);
        if (packageID.startsWith('@')) {
          packageID += `/${entrypoint[0]}`;
          entrypoint = entrypoint.slice(1);
        }

        const bundled = await bundlePackageCached(packageID);
        if (!bundled) {
          res.statusCode = 404;
          res.end('Could not find the requested package');
          return;
        }
        if (
          await servePackageFile(
            {
              packageID,
              packageDirectory: bundled.bundledDirectory,
              entryPoint: entrypoint.join('/'),
            },
            req,
            res,
          )
        ) {
          return;
        }
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

      const etag = (await promises.stat(htmlFileName)).mtime.toISOString();
      if (handledUsingCache(etag, req, res)) return;
      res.setHeader('Content-Type', 'text/html');
      res.end(await promises.readFile(htmlFileName));
    } catch (ex) {
      console.error(ex.stack);
      res.statusCode = 500;
      res.end('Internal sever error');
    }
  });
  const websocketServer = createWebsocketServer({
    server,
    token: CSRF_TOKEN,
    clientName: 'client',
  });
  server.listen(portNumber, () => {
    // Prepopulate the cache. This cache typically takes ~200ms - 300ms to build,
    // and is by far the slowest part of the entire process of starting a graphical-scripts
    // app
    getPackageLocationsCached()
      .catch(() => {
        // ignore this for now, it can be re-thrown when the locations are actually requested
      })
      .then(() => {
        const runningLine = `  Dashboard running: ${ORIGIN}  `;
        console.log(` -${'-'.repeat(runningLine.length)}-`);
        console.log(` |${' '.repeat(runningLine.length)}|`);
        console.log(` |  Dashboard running: ${chalk.cyan(ORIGIN)}  |`);
        console.log(` |${' '.repeat(runningLine.length)}|`);
        console.log(` -${'-'.repeat(runningLine.length)}-`);
        console.log(``);
        console.log(
          chalk.green(`Started in ${Date.now() - start} milliseconds`),
        );
      });
  });

  function handledUsingCache(
    etag: string,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    if (DISABLE_CACHE) return false;
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
    const stat = await promises.stat(path).then(
      (s) => (s.isFile() ? s : null),
      (ex) => (ex.code === 'ENOENT' ? null : Promise.reject(ex)),
    );
    if (stat) {
      const isApiClient = /\.api\.[a-z]+$/.test(path);
      if (isApiClient) {
        const src = `import client from '/frame/api-client.js';\n${await websocketServer.getClient(
          path,
        )}`;
        res.setHeader('Content-Type', 'text/javascript');
        res.end(src);
        return true;
      }
      const etag = stat.mtime.toISOString();
      if (handledUsingCache(etag, req, res)) return true;

      const transformed = transform(
        await promises.readFile(path, 'utf8'),
        path.endsWith('.tsx')
          ? {transforms: ['typescript', 'jsx'], filePath: req.url}
          : path.endsWith('.ts')
          ? {transforms: ['typescript'], filePath: req.url}
          : {transforms: ['flow', 'jsx'], filePath: req.url},
      ).code;
      const javaScript = await rewriteImports(
        {source: transformed, name: path},
        async (dep) => {
          if (dep[0] === '.') {
            const absolutePath = await findPath(
              join(dirname(path), dep),
              APP_EXTENSIONS,
            );
            let relativePath = relative(FRAME_DIRECTORY, absolutePath);
            if (relativePath[0] !== '.') {
              return `/frame/${relativePath
                .replace(/\.(jsx|ts|tsx)$/, '.js')
                .replace(/\\/g, '/')}`;
            }
            relativePath = relative(appDirectory, absolutePath);
            if (relativePath[0] !== '.') {
              return `/app/${relativePath
                .replace(/\.(jsx|ts|tsx)$/, '.js')
                .replace(/\\/g, '/')}`;
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

          return resolvePackage(dep, '_');
        },
      );

      res.setHeader('Content-Type', 'text/javascript');
      res.end(javaScript);
      return true;
    }
    return false;
  }

  async function servePackageFile(
    file: {packageID: string; packageDirectory: string; entryPoint: string},
    _req: IncomingMessage,
    res: ServerResponse,
  ) {
    const entryPointFileName = join(file.packageDirectory, file.entryPoint);
    const source = await promises
      .readFile(entryPointFileName, 'utf8')
      .catch((ex) => (ex.code === 'ENOENT' ? null : Promise.reject(ex)));
    if (source !== null) {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(
        await rewriteImports(
          {source, name: entryPointFileName},
          async (dep) => {
            if (dep[0] === '.') {
              const absolutePath = await findPath(
                join(dirname(entryPointFileName), dep),
                PACKAGE_EXTENSIONS,
              );
              const relativePath = relative(
                file.packageDirectory,
                absolutePath,
              );
              if (relativePath[0] !== '.') {
                return `/packages/${file.packageID}/${relativePath.replace(
                  /\\/g,
                  '/',
                )}`;
              }
              if (relativePath[0] === '.') {
                throw new Error(
                  `Cannot import ${absolutePath} because it is outside the package directory.`,
                );
              }
            }
            if (dep in builtinDependencies) {
              return builtinDependencies[dep];
            }

            return resolvePackage(dep, file.packageID);
          },
        ),
      );
      return true;
    }
    console.log(`NOT FOUND: ${entryPointFileName}`);
    return false;
  }

  function resolvePackage(importSpecifier: string, parentPackageID: string) {
    return `/dependencies/${parentPackageID}/${importSpecifier}`;
  }

  async function findPath(base: string, possibleExtensions: string[]) {
    for (const possibility of possibleExtensions) {
      const absolutePath = base.replace(/(?:\\|\/)$/, '') + possibility;
      if (
        await promises.stat(absolutePath).then(
          (s) => s.isFile(),
          () => false,
        )
      ) {
        return absolutePath;
      }
    }
    throw new Error(
      `Unable to resolve "${relative(
        process.cwd(),
        base,
      )}", tried:\n\n${possibleExtensions
        .map((ext) => ` - ${base}${ext}`)
        .join('\n')}`,
    );
  }
}
