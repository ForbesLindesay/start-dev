import rollupPluginCommonjs, {
  RollupCommonJSOptions,
} from '@rollup/plugin-commonjs';
import rollupPluginJson from '@rollup/plugin-json';
import rollupPluginNodeResolve from '@rollup/plugin-node-resolve';
// import {init as initESModuleLexer} from 'es-module-lexer';
import fs from 'fs';
// import * as colors from 'kleur/colors';
// import mkdirp from 'mkdirp';
import path from 'path';
// import rimraf from 'rimraf';
import {
  InputOptions,
  OutputOptions,
  rollup,
  // RollupError,
} from 'rollup';
import rollupPluginNodePolyfills from 'rollup-plugin-node-polyfills';
import rollupPluginReplace from '@rollup/plugin-replace';
// import util from 'util';
import {rollupPluginCatchFetch} from './rollup-plugins/rollup-plugn-catch-fetch';
// import validatePackageName from 'validate-npm-package-name';
// import {rollupPluginCatchFetch} from './rollup-plugins/rollup-plugin-catch-fetch';
// import {rollupPluginCatchUnresolved} from './rollup-plugins/rollup-plugin-catch-unresolved';
// import {rollupPluginCss} from './rollup-plugins/rollup-plugin-css';
// import {rollupPluginNodeProcessPolyfill} from './rollup-plugins/rollup-plugin-node-process-polyfill';
// import {rollupPluginDependencyStats} from './rollup-plugins/rollup-plugin-stats';
import {rollupPluginStripSourceMapping} from './rollup-plugins/rollup-plugin-strip-source-mapping';
import {rollupPluginDependencyReference} from './rollup-plugins/rollup-plugn-dependency-reference';
import {rollupPluginWrapCommmonJS} from './rollup-plugins/rollup-plugin-wrap-commonjs';
const resolve = require('resolve');

// Add popular CJS packages here that use "synthetic" named imports in their documentation.
// CJS packages should really only be imported via the default export:
//   import React from 'react';
// But, some large projects use named exports in their documentation:
//   import {useState} from 'react';
//
// We use "/index.js here to match the official package, but not any ESM aliase packages
// that the user may have installed instead (ex: react-esm).
const CJS_PACKAGES_TO_AUTO_DETECT = [
  'react/index.js',
  'react-dom/index.js',
  'react-dom/server.js',
  'react-is/index.js',
  'prop-types/index.js',
  'scheduler/index.js',
  'react-table',
  'chai/index.js',
];

function notnull<T>(
  value: Exclude<T, undefined | null> | null | undefined,
): Exclude<T, undefined | null> {
  if (value === undefined || value === null) {
    throw new Error('Did not expect null or undefined');
  }
  return value;
}
async function resolveDependency(
  specifier: string,
  {basedir}: {basedir: string},
) {
  return new Promise<string>((fulfill, reject) => {
    resolve(
      specifier,
      {
        basedir,
        packageFilter(info: any, _pkgdir: any) {
          const mainField = [
            'browser:module',
            'module',
            'browser',
            'main',
          ].find(
            (fieldName) =>
              fieldName in info && typeof info[fieldName] === 'string',
          );

          if (mainField) {
            info.main = info[mainField];
          }

          return info;
        },
        extensions: ['.mjs', '.cjs', '.js', '.json'], // Default: [ '.mjs', '.js', '.json', '.node' ]
      },
      (err: any, result: string) => {
        if (err) reject(err);
        else fulfill(result);
      },
    );
  });
}

function findPackageLocations(cwd: string) {
  const pkgLocations = new Map<string, string>();
  let base = cwd;
  function onNodeModules(nmName: string) {
    for (const pkgName of fs.readdirSync(nmName)) {
      if (pkgName.startsWith('@')) {
        onNodeModules(path.join(nmName, pkgName));
      } else {
        let pkg;
        try {
          pkg = JSON.parse(
            fs.readFileSync(path.join(nmName, pkgName, 'package.json'), 'utf8'),
          );
        } catch (ex) {
          if (ex.code !== 'ENOENT' && ex.code !== 'ENOTDIR') throw ex;
        }
        if (pkg && pkg.name && pkg.version) {
          const id = `${pkg.name}@${pkg.version}`;
          if (!pkgLocations.has(id)) {
            pkgLocations.set(id, path.join(nmName, pkgName));
          }
          if (fs.existsSync(path.join(nmName, pkgName, 'node_modules'))) {
            onNodeModules(path.join(nmName, pkgName, 'node_modules'));
          }
        }
      }
    }
  }
  while (base && base !== path.dirname(base)) {
    if (fs.existsSync(path.join(base, 'node_modules'))) {
      onNodeModules(path.join(base, 'node_modules'));
    }
    base = path.dirname(base);
  }
  if (fs.existsSync(path.join(base, 'node_modules'))) {
    onNodeModules(path.join(base, 'node_modules'));
  }
  return pkgLocations;
}

const FAILED_INSTALL_MESSAGE = 'Install failed.';

export async function install(
  entryName: string,
  cwd: string,
  entrypoints: string[],
  destLoc: string,
  resolveDep: (name: string, entrypoint: string | null) => string,
): Promise<any> {
  let isFatalWarningFound = false;
  const inputOptions: InputOptions = {
    input: {
      index: await resolveDependency('.', {
        basedir: cwd,
      }),
      ...(
        await Promise.all(
          entrypoints.map(async (name) => {
            return [
              name.replace(/\.m?js$/, ''),
              await resolveDependency(`./${name}`, {
                basedir: cwd,
              }),
            ];
          }),
        )
      ).reduce((acc, [name, path]) => {
        acc[name] = path;
        return acc;
      }, {} as any),
    },
    // context: userDefinedRollup.context,
    // external: (id) =>
    //   externalPackage.some((packageName) => isImportOfPackage(id, packageName)),
    treeshake: {moduleSideEffects: 'no-external'},
    plugins: [
      rollupPluginWrapCommmonJS(CJS_PACKAGES_TO_AUTO_DETECT),
      rollupPluginCatchFetch(),
      rollupPluginCommonjs({
        extensions: ['.js', '.cjs'],
        // esmExternals: externalPackageEsm,
        requireReturnsDefault: 'auto',
      } as RollupCommonJSOptions),
      rollupPluginDependencyReference(entryName, resolveDep),
      rollupPluginNodeResolve({
        mainFields: ['browser:module', 'module', 'browser', 'main'],
        extensions: ['.mjs', '.cjs', '.js', '.json'], // Default: [ '.mjs', '.js', '.json', '.node' ]
        // whether to prefer built-in modules (e.g. `fs`, `path`) or local ones with the same names
        preferBuiltins: true, // Default: true
        dedupe: [], // userDefinedRollup.dedupe || [],
      }),
      rollupPluginJson({
        preferConst: true,
        indent: '  ',
        compact: false,
        namedExports: true,
      }),
      rollupPluginReplace({
        'process.env.NODE_ENV': JSON.stringify('development'),
      }),
      // rollupPluginCss(),
      // rollupPluginWrapInstallTargets(
      //   !!isTreeshake,
      //   autoDetectNamedExports,
      //   installTargets,
      //   logger,
      // ),
      // rollupPluginDependencyStats((info) => (dependencyStats = info)),
      // rollupPluginNodeProcessPolyfill(env),
      rollupPluginNodePolyfills(),
      // polyfillNode && rollupPluginNodePolyfills(),
      // ...(userDefinedRollup.plugins || []), // load user-defined plugins last
      // rollupPluginCatchUnresolved(),
      rollupPluginStripSourceMapping(),
    ].filter(Boolean) as Plugin[],
    onwarn(warning) {
      // Log "unresolved" import warnings as an error, causing Snowpack to fail at the end.
      if (
        warning.code === 'PLUGIN_WARNING' &&
        warning.plugin === 'snowpack:rollup-plugin-catch-unresolved'
      ) {
        isFatalWarningFound = true;
        // Display posix-style on all environments, mainly to help with CI :)
        if (warning.id) {
          const fileName = path.relative(cwd, warning.id).replace(/\\/g, '/');
          console.error(`${fileName}\n   ${warning.message}`);
        } else {
          console.error(
            `${warning.message}. See https://www.snowpack.dev/#troubleshooting`,
          );
        }
        return;
      }
      const {loc, message} = warning;
      const logMessage = loc
        ? `${loc.file}:${loc.line}:${loc.column} ${message}`
        : message;
      // These warnings are usually harmless in packages, so don't show them by default.
      if (
        warning.code === 'CIRCULAR_DEPENDENCY' ||
        warning.code === 'NAMESPACE_CONFLICT' ||
        warning.code === 'THIS_IS_UNDEFINED'
      ) {
        console.debug(logMessage);
      } else {
        console.warn(logMessage);
      }
    },
  };
  const outputOptions: OutputOptions = {
    dir: path.join(destLoc, ``),
    format: 'esm',
    sourcemap: true,
    exports: 'named',
    entryFileNames: (chunk) => {
      return `${chunk.name}.js`;
    },
    chunkFileNames: 'common/[name]-[hash].js',
  };

  const packageBundle = await rollup(inputOptions);
  if (isFatalWarningFound) {
    throw new Error(FAILED_INSTALL_MESSAGE);
  }
  await packageBundle.write(outputOptions);
}

interface BundleOptions {
  prefix: string;
  cwd: string;
  output: string;
  getEntrypoints: (dep: string) => string[];
  onEntryPoint: (dep: string, entrypoint: string) => void;
}
// /_/[@scope/]package_name@version/node_modules/[@dep-scope/]dep_name[/entrypoint] => resolve the dependency and return a redirect
// /_/[@scope/]package_name@version[/entrypoint] => resolve & install the dependency
export default function getBundler({
  prefix,
  cwd,
  output,
  getEntrypoints,
  onEntryPoint,
}: BundleOptions) {
  const locations = findPackageLocations(cwd);

  return {handle, resolve};
  function resolve(specifier: string) {
    return `${prefix}/_/node_modules/${specifier}`;
  }
  async function handle(requestURL: string) {
    if (!requestURL.startsWith(prefix)) return null;
    const parts = requestURL.substr(prefix.length).split('/').reverse();
    parts.pop();
    let packageID = parts.pop();
    if (packageID?.startsWith('@')) {
      packageID += `/${parts.pop()}`;
    }
    if (!packageID) {
      return null;
    }
    const nodeModulesSpecifier = parts.length ? parts.pop() : null;
    if (nodeModulesSpecifier === 'node_modules') {
      let depName = parts.pop();
      if (depName?.startsWith('@')) {
        depName += `/${parts.pop()}`;
      }
      const entrypoint = [...parts].reverse().join('/') || null;
      const pkgFilename = await resolveDependency(`${depName}/package.json`, {
        basedir: packageID === '_' ? cwd : notnull(locations.get(packageID)),
      });
      const pkg = JSON.parse(fs.readFileSync(pkgFilename, 'utf8'));

      return {
        kind: 'dependency' as const,
        id: `${pkg.name}@${pkg.version}`,
        entrypoint,
        path: entrypoint
          ? `${prefix}/${pkg.name}@${pkg.version}/${entrypoint}`
          : `${prefix}/${pkg.name}@${pkg.version}/index.js`,
      };
    } else {
      const packageName = packageID.split('@').slice(0, -1).join('@');
      const entrypoint = nodeModulesSpecifier
        ? [...parts, nodeModulesSpecifier].reverse().join('/')
        : null;
      if (
        entrypoint &&
        entrypoint !== 'index.js' &&
        entrypoint.endsWith('.js') &&
        !entrypoint.startsWith('common/')
      ) {
        onEntryPoint(packageName, entrypoint.replace(/\.m?js$/, ''));
      }
      const basedir = notnull(locations.get(packageID));
      const entrypoints = getEntrypoints(packageName);
      const outputName = `${packageID}_${entrypoints.length}`;
      const outputDir = path.join(output, outputName);
      return {
        kind: 'entrypoint' as const,
        id: outputName,
        entrypoint,
        async getContent() {
          if (
            !(await fs.promises.stat(outputDir).then(
              () => true,
              () => false,
            ))
          ) {
            await install(
              packageName,
              basedir,
              entrypoints,
              outputDir,
              (dep, entrypoint) => {
                if (entrypoint) {
                  onEntryPoint(dep, entrypoint.replace(/\.m?js$/, ''));
                  return `${prefix}/${packageID}/node_modules/${dep}/${entrypoint.replace(
                    /\.m?js$/,
                    '',
                  )}.js`;
                }
                return `${prefix}/${packageID}/node_modules/${dep}`;
              },
            );
          }
          return (
            await fs.promises.readFile(
              path.join(outputDir, entrypoint || 'index.js'),
              'utf8',
            )
          )
            .split('http://localhost:3001/')
            .join('/');
        },
      };
    }
  }
}
