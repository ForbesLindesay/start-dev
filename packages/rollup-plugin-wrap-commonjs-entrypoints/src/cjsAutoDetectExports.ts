import path from 'path';
import fs from 'fs';
import {VM as VM2} from 'vm2';
import {init, parse} from 'cjs-module-lexer';

export {init as initCommonJsModuleLexer};

/**
 * Static analysis: Lower Fidelity, but safe to run on anything.
 *
 * Get the exports that we scanned originally using static analysis. This is meant to run on
 * any file (not only CJS) but it will only return an array if CJS exports were found.
 *
 * If static analysis does not find any exports, we then load in VM2, which should provide a
 * moderately secure sandbox.
 */
export default function cjsAutoDetectExports(
  filename: string,
  visited = new Set(),
): string[] | undefined {
  const isMainEntrypoint = visited.size === 0;
  // Prevent infinite loops via circular dependencies.
  if (visited.has(filename)) {
    return [];
  } else {
    visited.add(filename);
  }
  const fileContents = fs.readFileSync(filename, 'utf-8');
  try {
    // Attempt 1 - CJS: Run cjs-module-lexer to statically analyze exports.
    const parsed = parse(fileContents);
    let exports: string[] = parsed.exports;
    const reexports: string[] = parsed.reexports;
    // If re-exports were detected (`exports.foo = require(...)`) then resolve them here.
    const resolvedReexports = reexports.flatMap(
      (e) =>
        cjsAutoDetectExports(
          require.resolve(e, {paths: [path.dirname(filename)]}),
          visited,
        ) ?? [],
    );

    // Attempt 2 - UMD: Run the file in a sandbox to dynamically analyze exports.
    // This will only work on UMD and very simple CJS files (require not supported).
    // Uses VM2 to run safely sandbox untrusted code (no access no Node.js primitives, just JS).
    if (isMainEntrypoint && exports.length === 0 && reexports.length === 0) {
      console.warn(
        `Loading ${filename} in VM2 to attempt to find CommonJS imports`,
      );
      const vm = new VM2({wasm: false, fixAsync: false});
      exports = Object.keys(
        vm.run(
          'const exports={}; const module={exports}; ' +
            fileContents +
            ';; module.exports;',
        ),
      );
    }

    // Resolve and flatten all exports into a single array, and remove invalid exports.
    return Array.from(new Set([...exports, ...resolvedReexports])).filter(
      (imp) => imp !== 'default' && imp !== '__esModule',
    );
  } catch (err) {
    // Safe to ignore, this is usually due to the file not being CJS.
    return undefined;
  }
}
