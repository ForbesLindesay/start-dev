import {readdir, readFile, realpath} from 'fs';
import {join, relative, dirname, sep, win32, posix} from 'path';

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
export interface BasePackageLocation {
  sourceDirectory: string;
  relativePackageDirectory: string;
  resolvedPackageDirectory: string;
}
export interface PackageLocation extends BasePackageLocation {
  name: string;
  version: string;
  alternativeLocations: BasePackageLocation[];
}
export default async function findPackageLocations(cwd: string) {
  return new Promise<Map<string, PackageLocation>>((resolve, reject) => {
    const pkgLocations = new Map<string, PackageLocation>();
    let inFlight = 0;
    let pending: ((cb: (err?: Error) => void) => void)[] = [];
    let errored = false;
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
              new Map([...pkgLocations].sort(([a], [b]) => (a < b ? -1 : 1))),
            );
          }
        });
      }
    }
    function testDirectory(sourceDirectory: string, dir: string) {
      const node_modules = join(dir, 'node_modules');
      task((cb) => {
        readdir(node_modules, (err, directoryNames) => {
          if (err) {
            cb();
            return;
          }
          for (const directoryName of directoryNames) {
            if (directoryName[0] === '@') {
              const scopeDir = join(node_modules, directoryName);
              task((cb) => {
                readdir(scopeDir, (err, directoryNames) => {
                  if (err) {
                    cb();
                    return;
                  }
                  for (const directoryName of directoryNames) {
                    testDirectory(
                      sourceDirectory,
                      join(scopeDir, directoryName),
                    );
                  }
                  cb();
                });
              });
            } else if (directoryName !== '.bin' && directoryName !== '.cache') {
              testDirectory(sourceDirectory, join(node_modules, directoryName));
            }
          }
          cb();
        });
      });
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
          const name = pkg.name;
          const version = pkg.version;
          if (
            typeof name !== 'string' ||
            typeof version !== 'string' ||
            !name ||
            !version
          ) {
            cb();
            return;
          }
          const relativePackageDirectory = relative(sourceDirectory, dir)
            .split(win32.sep)
            .join(posix.sep);
          realpath(dir, (err, resolvedPackageDirectory) => {
            if (err) {
              cb(err);
              return;
            }
            const id = `${name}@${version}`;
            const existingLocation = pkgLocations.get(id);
            if (
              existingLocation &&
              // always prefer locations that are closer to the cwd
              (existingLocation.sourceDirectory.split(sep).length >
                sourceDirectory.split(sep).length ||
                // always prefer directories that are less deeply nested in node_modules
                (existingLocation.sourceDirectory.split(sep).length ===
                  sourceDirectory.split(sep).length &&
                  existingLocation.relativePackageDirectory.split(sep).length <
                    relativePackageDirectory.split(sep).length))
            ) {
              // the existing package is a better match
              existingLocation.alternativeLocations.push({
                sourceDirectory,
                relativePackageDirectory,
                resolvedPackageDirectory,
              });
            } else if (existingLocation) {
              const {
                alternativeLocations,
                name,
                version,
                ...existingLocationProps
              } = existingLocation;
              pkgLocations.set(id, {
                name,
                version,
                sourceDirectory,
                relativePackageDirectory,
                resolvedPackageDirectory,
                alternativeLocations: [
                  ...alternativeLocations,
                  existingLocationProps,
                ],
              });
            } else {
              pkgLocations.set(id, {
                name,
                version,
                sourceDirectory,
                relativePackageDirectory,
                resolvedPackageDirectory,
                alternativeLocations: [],
              });
            }
            cb();
          });
        });
      });
    }
    task((cb) => {
      realpath(cwd, (err, resolvedPath) => {
        if (err) {
          cb(err);
          return;
        }
        testDirectory(resolvedPath, resolvedPath);
        let nextParent = resolvedPath;
        while (nextParent && dirname(nextParent) !== nextParent) {
          nextParent = dirname(nextParent);
          testDirectory(nextParent, nextParent);
        }
        cb();
      });
    });
  });
}
