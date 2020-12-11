import path from 'path';
import {Plugin} from 'rollup';
import cjsAutoDetectExports, {
  initCommonJsModuleLexer,
} from './cjsAutoDetectExports';

const WRAPPER_MODULE_PREFIX = 'rollup-plugin-wrap-commonjs-entrypoints:';

export default function rollupPluginWrapCommmonJsEntrypoints(): Plugin {
  const cjsScannedNamedExports = new Map<string, string[]>();

  return {
    name: 'rollup-plugin-wrap-commonjs-entrypoints',
    async buildStart(inputOptions) {
      await initCommonJsModuleLexer();

      const input = inputOptions.input as {[entryAlias: string]: string};
      for (const [key, val] of Object.entries(input)) {
        const normalizedFileLoc = val
          .split(path.win32.sep)
          .join(path.posix.sep);

        if (
          !val.endsWith('.js') &&
          !val.endsWith('.cjs') &&
          !val.endsWith('.jsx')
        ) {
          continue;
        }
        const cjsExports = cjsAutoDetectExports(val);
        if (cjsExports && cjsExports.length > 0) {
          cjsScannedNamedExports.set(normalizedFileLoc, cjsExports);
          input[key] = `${WRAPPER_MODULE_PREFIX}${val}`;
        }
      }
    },
    resolveId(source) {
      if (source.startsWith(WRAPPER_MODULE_PREFIX)) {
        return source;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(WRAPPER_MODULE_PREFIX)) {
        return null;
      }
      const fileLoc = id.substring(WRAPPER_MODULE_PREFIX.length);
      const normalizedFileLoc = fileLoc
        .split(path.win32.sep)
        .join(path.posix.sep);

      const scannedNamedExports = cjsScannedNamedExports.get(normalizedFileLoc);
      const uniqueNamedExports = scannedNamedExports || [];
      const result = `
        export * from '${normalizedFileLoc}';
        import __default_export__ from '${normalizedFileLoc}'; export default __default_export__;
        ${`export {${uniqueNamedExports.join(
          ',',
        )}} from '${normalizedFileLoc}';`}
      `;
      return result;
    },
  };
}
