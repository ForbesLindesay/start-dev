import {resolve, join} from 'path';
import {readFileSync, createReadStream} from 'fs';
import {createHash, randomBytes} from 'crypto';
import {createBrotliDecompress} from 'zlib';
import {startDevServer, createConfiguration} from 'snowpack';
import handleRequest from './handleRequest';
import getRpcClient from './rpc-client';

const APP_DIR = resolve(`${__dirname}/../app`);
// const CACHE_DIR = resolve(`${__dirname}/../snowpack-cache`);
export default async function startServer(cwd: string, entry: string) {
  const CSRF_TOKEN = randomBytes(128).toString('base64');
  const TAILWIND_ETAG = createHash('sha1')
    .update(readFileSync(`${APP_DIR}/tailwind.css.br`))
    .digest('hex');

  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  const config = createConfiguration({
    // plugins: [require.resolve('./br-plugin')],
    plugins: [
      [require.resolve('./rpc-server-plugin'), {directory: resolve(cwd)}],
    ],
    experiments: {
      routes: [
        {
          src: '/_csrf',
          match: 'all',
          dest: (_req, res) => {
            res.setHeader('Content-Type', 'text/javascript');
            res.end(`while(true);${CSRF_TOKEN}`);
          },
        },
        {
          src: '/_api/api-client.js',
          match: 'all',
          dest: async (_req, res) => {
            res.setHeader('Content-Type', 'text/javascript');
            createReadStream(`${APP_DIR}/api-client.js`).pipe(res);
          },
        },
        {
          src: '/_api/.+\\.api\\.js',
          match: 'all',
          dest: async (req, res) => {
            try {
              res.setHeader('Content-Type', 'text/javascript');
              const src = await getRpcClient(
                cwd,
                req.url!.substr('/_api/'.length),
              );
              res.end(src);
            } catch (ex) {
              console.error(ex.stack || ex.message || ex);
              res.statusCode = 500;
              res.end(ex.stack || ex.message || ex);
            }
          },
        },
        {
          src: '/_api',
          match: 'all',
          dest: async (req, res) => {
            if (req.method?.toUpperCase() !== 'POST') {
              res.statusCode = 400;
              res.end('Invalid method');
              return;
            }
            if (req.headers['x-csrf-token'] !== CSRF_TOKEN) {
              res.statusCode = 400;
              res.end('Invalid csrf token');
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            try {
              const requestString = await new Promise<string>(
                (resolve, reject) => {
                  const body: Buffer[] = [];
                  req.on('error', reject);
                  req.on('data', (data) => {
                    body.push(data);
                  });
                  req.on('end', () => {
                    resolve(Buffer.concat(body).toString('utf8'));
                  });
                },
              );
              const request = JSON.parse(requestString);
              res.end(
                JSON.stringify(
                  (await handleRequest(request)) ?? null,
                  null,
                  '  ',
                ),
              );
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
            }
          },
        },
        {
          src: '/tailwind.css',
          match: 'all',
          dest: (req, res) => {
            if (req.headers['if-none-match'] === TAILWIND_ETAG) {
              res.statusCode = 304;
              res.end();
              return;
            }
            res.setHeader('ETag', TAILWIND_ETAG);
            res.setHeader('Content-Type', 'text/css');
            if (
              `${req.headers['accept-encoding'] || ''}`
                .split(', ')
                .includes('br')
            ) {
              res.setHeader('Content-Encoding', 'br');
              createReadStream(`${APP_DIR}/tailwind.css.br`).pipe(res);
            } else {
              createReadStream(`${APP_DIR}/tailwind.css.br`)
                .pipe(createBrotliDecompress())
                .pipe(res);
            }
          },
        },
      ],
    },
  });
  if (config[0]) {
    for (const err of config[0]) {
      console.error(err.message);
    }
    process.exit(1);
  }

  const alias: Record<string, string> = {};
  // try {
  //   for (const filename of readdirSync(resolve(CACHE_DIR))) {
  //     if (filename.endsWith('.js')) {
  //       alias[filename.replace(/\.js$/, '')] = join(CACHE_DIR, filename);
  //     }
  //   }
  // } catch (ex) {
  //   if (ex.code !== 'ENOENT') {
  //     throw ex;
  //   }
  // }
  alias['@graphical-scripts/app'] = join(cwd, entry);

  await startDevServer({
    cwd,

    config: {
      install: [],
      exclude: [
        '**/node_modules/**/*',
        '**/web_modules/**/*',
        '**/.types/**/*',
        `**/*.api.*`,
      ],

      knownEntrypoints: [],
      webDependencies: {},
      mount: {
        // [CACHE_DIR]: {
        //   url: '/__prebuilt__/',
        //   static: false,
        //   resolve: true,
        // },
        [APP_DIR]: {
          url: '/',
          static: false,
          resolve: true,
        },
        [cwd]: {
          url: '/__app__/',
          static: false,
          resolve: true,
        },
      },
      alias,
      // alias: {
      //   react: 'http://example.com/prebuilt/react',
      //   'react-dom': 'http://example.com/prebuild/react-dom',
      // },
      installOptions: {
        // externalPackage: ['./prebuilt/react', './prebuilt/react-dom'],
        // externalPackageEsm: ['./prebuilt/react', './prebuilt/react-dom'],
        packageLookupFields: [],
        rollup: {plugins: []},
      },
      scripts: {},
      plugins: config[1].plugins, // .slice().reverse(),
      _extensionMap: config[1]._extensionMap,
      devOptions: {
        secure: false,
        hostname: 'localhost',
        // TODO: choose a port
        port: 3001,
        fallback: `index.html`,
        open: 'default',
        // "stream" is useful when Snowpack is run in parallel with other commands,
        // where clearing the shell would clear important output of other commands
        // running in the same shell.
        // output: 'dashboard',
        output: 'stream',
        hmr: true,
        hmrErrorOverlay: true,
        hmrDelay: 0,
        hmrPort: undefined,
      },
      buildOptions: {
        out: resolve(`${__dirname}/../__snowpack__/out`),
        metaDir: resolve(`${__dirname}/../__snowpack__/meta`),
        baseUrl: '/',
        webModulesUrl: '/web_modules',
        clean: false,
        sourceMaps: false,
        minify: false,
        watch: true,
        htmlFragments: false,
      },
      testOptions: {
        files: ['__tests__/**/*', '**/*.@(spec|test).*'],
      },
      proxy: [],
      //   /** EXPERIMENTAL - This section is experimental and not yet finalized. May change across minor versions. */
      experiments: config[1].experiments,
    },
    lockfile: null, // ImportMap | null;
    pkgManifest: {},
    // JSON.parse(
    //   readFileSync(`${__dirname}/../app/package.json`, 'utf8'),
    // ),
  });

  // export interface CommandOptions {
  //   cwd: string;
  //   config: SnowpackConfig;
  //   lockfile: ImportMap | null;
  //   pkgManifest: any;
  // }
}
