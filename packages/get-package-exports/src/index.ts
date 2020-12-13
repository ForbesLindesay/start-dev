import {readdir, readFile, realpath} from 'fs';
import {join} from 'path';
const resolveNode = require('resolve');

// we don't want to overwhelm the file system, and some unix systems
// limit the number of open file handles, so we queue requests beyond
// this limit
const MAX_PARALLEL_TASKS = 20;

function tryParse(
  str: string,
): undefined | null | string | boolean | number | {[key: string]: unknown} {
  try {
    return JSON.parse(str);
  } catch (ex) {
    return undefined;
  }
}
export interface NormalizedExport {
  exportName: string;
  resolvedPath: string;
}

const defaultIgnore = new Set([
  'config.gypi',
  'CVS',
  'npm-debug.log',
  'node_modules',
]);
interface PackageExportOptions {
  allowedExportKeys: string[];
  overrideExports?: {[key: string]: string};
}
export default async function getPackageExports(
  packageDirectory: string,
  options: PackageExportOptions,
) {
  return new Promise<NormalizedExport[]>((resolve, reject) => {
    let inFlight = 0;
    let pending: ((cb: (err?: Error) => void) => void)[] = [];
    let errored = false;
    const normalizedExports: NormalizedExport[] = [];
    function task(fn: (cb: (err?: Error) => void) => void) {
      if (errored) return;
      if (inFlight === MAX_PARALLEL_TASKS) {
        pending.push(fn);
      } else {
        inFlight++;
        let called = false;
        fn((err) => {
          if (called) throw new Error(`Called callback multiple times!!!`);
          called = true;
          if (errored) return;
          if (err) {
            errored = true;
            reject(err);
            return;
          }
          inFlight--;
          if (pending.length) {
            task(pending.pop()!);
          } else if (inFlight === 0) {
            resolve(
              normalizedExports.sort((a, b) =>
                a.exportName < b.exportName ? -1 : 1,
              ),
            );
          }
        });
      }
    }

    function onExport(e: NormalizedExport) {
      task((cb) => {
        resolveNode(
          e.resolvedPath,
          {
            basedir: packageDirectory,
          },
          (err: any, result: string) => {
            if (!err && result) {
              realpath(result, (err, result) => {
                if (!err) {
                  e.resolvedPath = result;
                }
                normalizedExports.push(e);
                cb();
              });
            } else {
              normalizedExports.push(e);
              cb();
            }
          },
        );
      });
      // TODO: handle widcards??
      // task((cb) => {
      //   const exportName = e.exportName.split('*');
      //   const resolvedPath = e.resolvedPath.split('*');
      //   if (exportName.length !== resolvedPath.length) {
      //     cb(
      //       new Error(
      //         `Cannot resolve ${e.exportName} => ${e.resolvedPath} because they have different numbers of wildcards`,
      //       ),
      //     );
      //     return;
      //   }
      //   function recurse(
      //     exportNameStart: string,
      //     resolvedPathStart: string,
      //     remainingExportName: string[],
      //     remainingResolvedPath: string[],
      //   ) {
      //     if (remainingExportName.length === 0) {
      //       normalizedExports.push({
      //         exportName: exportNameStart,
      //         resolvedPath: resolvedPathStart,
      //       });
      //       return;
      //     }
      //     const [dir, prefix] = [
      //       resolvedPathStart.split('/').slice(0, -1).join('/'),
      //       resolvedPathStart.split('/').slice(-1).join('/'),
      //     ];
      //     task(cb => {
      //       readdir(dir, (err, fileNames) => {
      //         if (err) {
      //           cb(err);
      //           return;
      //         }
      //         for (const fileName of fileNames) {
      //           if (!fileName.startsWith(prefix)) {
      //             continue;
      //           }
      //           recurse(exportNameStart)
      //         }
      //         cb();
      //       })
      //     })
      //   }
      //   recurse(
      //     exportName[0],
      //     resolvedPath[0],
      //     exportName.slice(1),
      //     resolvedPath.slice(1),
      //   );
      //   cb();
      // });
    }

    function onExports(
      resolvedPackageDirectory: string,
      parts: string[],
      exports: {
        [key: string]:
          | string
          | {[key: string]: string}
          | (string | {[key: string]: string})[];
      },
      cb: (err?: Error) => void,
    ) {
      const pkgFileName = join(resolvedPackageDirectory, 'package.json');
      for (const [exportName, $exportPathArray] of Object.entries(exports)) {
        if (exportName === './') {
          // you need to use `.` for the default export, and we don't support using "./": "./" to expose everything yet
          continue;
        }
        if (!exportName.startsWith('./') && exportName !== '.') {
          cb(
            new Error(
              `${pkgFileName} has "exports" that do not start with "./"`,
            ),
          );
          return;
        }

        const exportPathArray = Array.isArray($exportPathArray)
          ? $exportPathArray
          : [$exportPathArray];
        for (const exportPath of exportPathArray) {
          let exportPathString = exportPath;
          if (typeof exportPathString !== 'string') {
            const matchingCondition = Object.entries(
              exportPathString,
            ).find(([key]) => options.allowedExportKeys.includes(key));
            if (matchingCondition === undefined) {
              continue;
            }
            const [key, value] = matchingCondition;
            if (typeof value !== 'string') {
              cb(
                new Error(
                  `${pkgFileName} has "exports.${key}", but it is not a string`,
                ),
              );
              return;
            } else {
              exportPathString = value;
            }
          }
          onExport({
            exportName:
              exportName === '.' || exportName === './'
                ? parts.join('/')
                : [...parts, exportName.substr('./'.length)].join('/'),
            resolvedPath: join(resolvedPackageDirectory, exportPathString),
          });
          break;
        }
      }
      cb();
    }

    function testDirectory(dir: string, parts: string[]) {
      if (!options.overrideExports) {
        task((cb) => {
          readdir(dir, (err, directoryNames) => {
            if (err) {
              cb();
              return;
            }
            for (const directoryName of directoryNames) {
              if (
                !defaultIgnore.has(directoryName) &&
                !directoryName.startsWith('.')
              ) {
                testDirectory(join(dir, directoryName), [
                  ...parts,
                  directoryName,
                ]);
              }
            }
            cb();
          });
        });
      }
      const pkgFileName = join(dir, 'package.json');
      task((cb) => {
        readFile(pkgFileName, 'utf8', (err, result) => {
          if (err) {
            cb();
            return;
          }
          const pkg = tryParse(result);
          if (!pkg || typeof pkg !== 'object') {
            cb();
            return;
          }
          const exports = options.overrideExports ?? pkg.exports;
          const module = pkg.module;
          const browser = pkg.browser;
          const main = pkg.main;
          realpath(dir, (err, resolvedPackageDirectory) => {
            if (err) {
              cb(err);
              return;
            }
            if (exports) {
              if (typeof exports !== 'object' || exports === null) {
                cb(
                  new Error(
                    `${pkgFileName} has an "exports" property that is not an object`,
                  ),
                );
                return;
              }
              onExports(resolvedPackageDirectory, parts, exports as any, cb);
            } else if (module) {
              if (typeof module !== 'string') {
                cb(
                  new Error(
                    `${pkgFileName} has a "module" property that is not a string`,
                  ),
                );
                return;
              }
              onExports(
                resolvedPackageDirectory,
                parts,
                {'.': module, './package.json': './package.json'},
                cb,
              );
            } else if (browser && typeof browser === 'string') {
              onExports(
                resolvedPackageDirectory,
                parts,
                {'.': browser, './package.json': './package.json'},
                cb,
              );
            } else if (main) {
              if (typeof main !== 'string') {
                cb(
                  new Error(
                    `${pkgFileName} has a "main" property that is not a string`,
                  ),
                );
                return;
              }
              onExports(
                resolvedPackageDirectory,
                parts,
                {'.': main, './package.json': './package.json'},
                cb,
              );
            } else {
              onExports(
                resolvedPackageDirectory,
                parts,
                {'.': './index.js', './package.json': './package.json'},
                cb,
              );
            }
          });
        });
      });
    }
    task((cb) => {
      realpath(packageDirectory, (err, resolvedPath) => {
        if (err) {
          cb(err);
          return;
        }
        testDirectory(resolvedPath, []);
        cb();
      });
    });
  });
}
