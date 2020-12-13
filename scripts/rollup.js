'use strict';

const {readFileSync} = require('fs');
const {rollup} = require('rollup');
const prettier = require('rollup-plugin-prettier');
const {parse} = require('toml');
const isNodeBuiltin = require('is-builtin-module');
const pluginCommonJS = require('@rollup/plugin-commonjs');
const {default: pluginNodeResolve} = require('@rollup/plugin-node-resolve');

function readRollupConfigFile() {
  try {
    return readFileSync('rollup.toml', 'utf8');
  } catch (ex) {
    return null;
  }
}
async function run() {
  const tomlConfigStr = readRollupConfigFile();
  if (tomlConfigStr === null) return;
  const config = parse(tomlConfigStr);
  if (config.exports !== 'named' && config.exports !== 'default') {
    throw new Error('config.exports must be either "named" or "default"');
  }
  const pkgStr = readFileSync('package.json', 'utf8');
  const pkg = JSON.parse(pkgStr);
  if (!pkg.exports) {
    throw new Error('You need to define package.json "exports"');
  }
  const input = config.input || {};
  if (!config.input) {
    Object.entries(pkg.exports).forEach(([key, value]) => {
      if (key.endsWith('/')) {
        throw new Error(`"exports" key shouldn't end with "/": "${key}"`);
      }
      const v = typeof value === 'string' ? value : value.default;
      if (typeof v !== 'string') {
        throw new Error(`Invaid package export "${key}"`);
      }
      if (!v.startsWith('./dist/')) {
        return;
      }
      if (!v.endsWith('.cjs')) {
        throw new Error(`Expected default export "${key}" to be .cjs`);
      }

      input[v.substr('./dist/'.length).replace(/\.cjs/g, '')] = `lib/${v
        .substr('./dist/'.length)
        .replace(/\.cjs/g, '')}`;
    });
  }
  let packageBundle;
  try {
    packageBundle = await rollup({
      input,
      external: config.external || [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
        'react',
      ],
      plugins: [
        prettier({
          tabWidth: 2,
          singleQuote: true,
          parser: 'babel',
        }),
        pluginNodeResolve({
          mainFields: ['module', 'main'],
          extensions: ['.mjs', '.cjs', '.js', '.json'], // Default: [ '.mjs', '.js', '.json', '.node' ]
          // whether to prefer built-in modules (e.g. `fs`, `path`) or local ones with the same names
          preferBuiltins: true,
          dedupe: [],
          exportConditions: ['import', 'module', 'require', 'default', 'node'],
        }),
        // TODO: update pluginCommonJS to support: {".": [{"module": "..."}, "./default.js"]}
        pluginCommonJS({
          extensions: ['.js', '.cjs'],
          // esmExternals: externalPackageEsm,
          requireReturnsDefault: 'auto',
        }),
        rollupPluginCatchUnresolved(),
      ],
      onwarn(warning) {
        const {loc, message} = warning;
        const logMessage = loc
          ? `${loc.file}:${loc.line}:${loc.column} ${message}`
          : message;
        console.error(logMessage);
        if (warning.code !== 'CIRCULAR_DEPENDENCY') {
          process.exitCode = 1;
        }
      },
    });
  } catch (ex) {
    if (ex.code !== 'PARSE_ERROR') {
      throw ex;
    }
    console.error(ex.message);
    console.error(`${ex.loc.file} ${ex.loc.line}:${ex.loc.column}`);
    console.error(ex.frame);
    process.exit(1);
  }
  await packageBundle.write({
    dir: 'dist/',
    entryFileNames: '[name].cjs',
    chunkFileNames: '[name]-[hash].cjs',
    format: 'cjs',
    exports: config.exports,
  });
  await packageBundle.write({
    dir: 'dist/',
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name]-[hash].mjs',
    format: 'es',
  });
}
run().catch((ex) => {
  console.error(ex.stack);
  process.exitCode = 1;
});

/**
 * rollup-plugin-catch-unresolved
 *
 * Catch any unresolved imports to give proper warnings (Rollup default is to ignore).
 */
function rollupPluginCatchUnresolved() {
  return {
    name: 'rollup-plugin-catch-unresolved',
    resolveId(id, importer) {
      if (isNodeBuiltin(id)) {
        return {
          id,
          external: true,
        };
      } else {
        throw new Error(
          `Module "${id}" could not be resolved from "${importer}".`,
        );
      }
      return false;
    },
  };
}
