import rollupPluginCommonjs, {
  RollupCommonJSOptions,
} from '@rollup/plugin-commonjs';
import rollupPluginJson from '@rollup/plugin-json';
import rollupPluginNodeResolve from '@rollup/plugin-node-resolve';
// import {init as initESModuleLexer} from 'es-module-lexer';
// import * as colors from 'kleur/colors';
// import mkdirp from 'mkdirp';
import path from 'path';
// import rimraf from 'rimraf';
import {
  InputOption,
  InputOptions,
  OutputOptions,
  rollup,
  // RollupError,
} from 'rollup';
import rollupPluginNodePolyfills from 'rollup-plugin-node-polyfills';
import rollupPluginReplace from '@rollup/plugin-replace';
// import util from 'util';
import rollupPluginNativeFetch from '@graphical-scripts/rollup-plugin-native-fetch';
import rollupPluginStripSourceMapping from '@graphical-scripts/rollup-plugin-strip-source-mapping';
import rollupPluginWrapCommmonJsEntrypoints from '@graphical-scripts/rollup-plugin-wrap-commonjs-entrypoints';
// import validatePackageName from 'validate-npm-package-name';
// import {rollupPluginCatchFetch} from './rollup-plugins/rollup-plugin-catch-fetch';
// import {rollupPluginCatchUnresolved} from './rollup-plugins/rollup-plugin-catch-unresolved';
// import {rollupPluginCss} from './rollup-plugins/rollup-plugin-css';
// import {rollupPluginNodeProcessPolyfill} from './rollup-plugins/rollup-plugin-node-process-polyfill';
// import {rollupPluginDependencyStats} from './rollup-plugins/rollup-plugin-stats';

const FAILED_INSTALL_MESSAGE = 'Install failed.';

export default async function install(
  entrypoints: InputOption,
  destLoc: string,
): Promise<any> {
  let isFatalWarningFound = false;
  const inputOptions: InputOptions = {
    input: entrypoints,
    external: (id) => {
      if (path.isAbsolute(id)) return false;
      if (id[0] === '.') return false;
      return true;
    },
    treeshake: {moduleSideEffects: 'no-external'},
    plugins: [
      rollupPluginWrapCommmonJsEntrypoints(),
      rollupPluginNativeFetch(),
      rollupPluginCommonjs({
        extensions: ['.js', '.cjs'],
        // esmExternals: externalPackageEsm,
        requireReturnsDefault: 'auto',
      } as RollupCommonJSOptions),
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
