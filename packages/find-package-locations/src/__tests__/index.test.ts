import findPackageLocations from '..';

type Symlink = {kind: 'symlink'; path: string[]};
type FileContent = {kind: 'file'; content: string};
type DirectoryMarker = {kind: 'directory'};
type MockFileSystemEntry = [string[], Symlink | FileContent | DirectoryMarker];
type MockFileSystem = {sep: string; entries: MockFileSystemEntry[]};

const log: string[] = [];
const fs: MockFileSystem = {
  sep: '/',
  // prettier-ignore
  entries: [
    [
      ['foo', 'bar', 'node_modules', 'package-a', 'package.json'],
      {kind: 'file', content: '{"name": "package-a", "version": "1.0.0"}'},
    ],
    [
      ['foo', 'bar', 'node_modules', 'package-a', 'node_modules', 'package-a-dep', 'package.json'],
      {kind: 'file', content: '{"name": "package-a-dep", "version": "1.0.0"}'},
    ],
    // alternative location for package-a-dep that should be ignored:
    [
      ['foo', 'node_modules', 'package-a-dep', 'package.json'],
      {kind: 'file', content: '{"name": "package-a-dep", "version": "1.0.0"}'},
    ],
    [
      ['foo', 'node_modules', 'package-c', 'package.json'],
      {kind: 'file', content: '{"name": "package-c", "version": "1.0.0"}'},
    ],
    [
      ['foo', 'bar', 'node_modules', 'package-b-dirname', 'package.json'],
      {kind: 'file', content: '{"name": "package-b", "version": "2.0.0"}'},
    ],
    [
      ['foo', 'bar', 'node_modules', 'broken-package-no-name', 'package.json'],
      {kind: 'file', content: '{"version": "2.0.0"}'},
    ],
    [
      ['foo', 'bar', 'node_modules', 'broken-package-no-version', 'package.json'],
      {kind: 'file', content: '{"name": "broken-package-no-version"}'},
    ],
    [
      ['foo', 'bar', 'node_modules', 'broken-package-not-json', 'package.json'],
      {kind: 'file', content: '{"name": "broken-package-not-json", "version": "2.0.0"'},
    ],
    [
      ['foo', 'bar', 'node_modules', 'symlink-package'],
      {kind: 'symlink', path: ['foo', 'bing']},
    ],
    [
      ['foo', 'bing', 'package.json'],
      {kind: 'file', content: '{"name": "bing", "version": "2.5.0"}'},
    ],
    [
      ['foo', 'bing', 'node_modules', 'package.json'],
      {kind: 'file', content: '{"name": "bing-dep", "version": "3.0.0"}'},
    ],
  ]
};
function* mockGetEntries(
  searchPath: string[],
): Generator<
  {
    relative: string[];
    realPath: string[];
    entryType: FileContent | DirectoryMarker | Symlink;
  },
  void,
  unknown
> {
  for (const [entryPath, entryType] of fs.entries) {
    if (
      entryType.kind === 'symlink' &&
      entryPath.length <= searchPath.length &&
      entryPath.every((p, i) => p === searchPath[i])
    ) {
      yield* mockGetEntries([
        ...entryType.path,
        ...searchPath.slice(entryPath.length),
      ]);
    } else if (
      entryPath.length >= searchPath.length &&
      searchPath.every((part, i) => part === entryPath[i])
    ) {
      yield {
        relative: entryPath.slice(searchPath.length),
        realPath: entryPath,
        entryType,
      };
    }
  }
}

// import {readdir, readFile, realpath} from 'fs';
jest.mock('fs', () => ({
  readdir: (basedir: string, cb: (err: any, children?: string[]) => void) => {
    log.push(`readdir: ${basedir}`);
    setTimeout(() => {
      const separated = basedir.split(fs.sep);
      const entries = [...mockGetEntries(separated)];
      if (!entries.length) {
        cb(new Error('Invalid directory'));
        return;
      }
      const names = new Set(
        entries.flatMap(({relative}) => (relative.length ? [relative[0]] : [])),
      );
      cb(null, [...names]);
    }, Math.floor(Math.random() * 100));
  },
  readFile: (
    filename: string,
    encoding: string,
    cb: (err: any, content?: string) => void,
  ) => {
    log.push(`readFile: ${filename}`);
    setTimeout(() => {
      if (filename === 'foo/bar/node_modules/symlink-package/package.json') {
        debugger;
      }
      expect(encoding).toBe('utf8');
      const separated = filename.split(fs.sep);
      const entries = [...mockGetEntries(separated)];
      const file = entries.find(({relative}) => relative.length === 0);
      if (file?.entryType.kind === 'file') {
        cb(null, file.entryType.content);
      } else if (entries.length) {
        cb(new Error('Cannot read directory as if it was a file'));
      } else {
        cb(new Error('File not found'));
      }
    }, Math.floor(Math.random() * 100));
  },
  realpath: (filename: string, cb: (err: any, realPath?: string) => void) => {
    log.push(`realpath: ${filename}`);
    setTimeout(() => {
      const separated = filename.split(/\\|\//);
      const entries = [...mockGetEntries(separated)];
      const file = entries.find(() => true);
      if (file) {
        cb(
          null,
          file.realPath
            .slice(0, file.realPath.length - file.relative.length)
            .join(fs.sep),
        );
      } else {
        cb(new Error('Path not found'));
      }
    }, Math.floor(Math.random() * 100));
  },
}));

// import {join, relative, dirname, sep, win32, posix} from 'path';
jest.mock('path', () => ({
  join: (a: string, b: string) => `${a}${fs.sep}${b}`,
  relative: (a: string, b: string) => {
    const as = a.split(fs.sep);
    const bs = b.split(fs.sep);
    if (bs.length <= as.length || !as.every((p, i) => bs[i] === p)) {
      throw new Error(
        'This mock does not support relative paths that require navigating up the directory tree',
      );
    }
    return bs.slice(as.length).join(fs.sep);
  },
  dirname: (a: string) => {
    if (a === fs.sep) return fs.sep;
    return a.split(fs.sep).slice(0, -1).join(fs.sep);
  },
  get sep() {
    return fs.sep;
  },
  win32: {sep: '\\'},
  posix: {sep: '/'},
}));

test('posix', async () => {
  fs.sep = '/';
  expect(await findPackageLocations('foo/bar')).toMatchInlineSnapshot(`
    Map {
      "bing@2.5.0" => Object {
        "alternativeLocations": Array [],
        "name": "bing",
        "relativePackageDirectory": "node_modules/symlink-package",
        "resolvedPackageDirectory": "foo/bing",
        "sourceDirectory": "foo/bar",
        "version": "2.5.0",
      },
      "package-a-dep@1.0.0" => Object {
        "alternativeLocations": Array [
          Object {
            "relativePackageDirectory": "node_modules/package-a-dep",
            "resolvedPackageDirectory": "foo/node_modules/package-a-dep",
            "sourceDirectory": "foo",
          },
        ],
        "name": "package-a-dep",
        "relativePackageDirectory": "node_modules/package-a/node_modules/package-a-dep",
        "resolvedPackageDirectory": "foo/bar/node_modules/package-a/node_modules/package-a-dep",
        "sourceDirectory": "foo/bar",
        "version": "1.0.0",
      },
      "package-a@1.0.0" => Object {
        "alternativeLocations": Array [],
        "name": "package-a",
        "relativePackageDirectory": "node_modules/package-a",
        "resolvedPackageDirectory": "foo/bar/node_modules/package-a",
        "sourceDirectory": "foo/bar",
        "version": "1.0.0",
      },
      "package-b@2.0.0" => Object {
        "alternativeLocations": Array [],
        "name": "package-b",
        "relativePackageDirectory": "node_modules/package-b-dirname",
        "resolvedPackageDirectory": "foo/bar/node_modules/package-b-dirname",
        "sourceDirectory": "foo/bar",
        "version": "2.0.0",
      },
      "package-c@1.0.0" => Object {
        "alternativeLocations": Array [],
        "name": "package-c",
        "relativePackageDirectory": "node_modules/package-c",
        "resolvedPackageDirectory": "foo/node_modules/package-c",
        "sourceDirectory": "foo",
        "version": "1.0.0",
      },
    }
  `);
  expect(log.sort()).toMatchInlineSnapshot(`
    Array [
      "readFile: /package.json",
      "readFile: foo/bar/node_modules/broken-package-no-name/package.json",
      "readFile: foo/bar/node_modules/broken-package-no-version/package.json",
      "readFile: foo/bar/node_modules/broken-package-not-json/package.json",
      "readFile: foo/bar/node_modules/package-a/node_modules/package-a-dep/package.json",
      "readFile: foo/bar/node_modules/package-a/package.json",
      "readFile: foo/bar/node_modules/package-b-dirname/package.json",
      "readFile: foo/bar/node_modules/symlink-package/node_modules/package.json/package.json",
      "readFile: foo/bar/node_modules/symlink-package/package.json",
      "readFile: foo/bar/package.json",
      "readFile: foo/node_modules/package-a-dep/package.json",
      "readFile: foo/node_modules/package-c/package.json",
      "readFile: foo/package.json",
      "readdir: /node_modules",
      "readdir: foo/bar/node_modules",
      "readdir: foo/bar/node_modules/broken-package-no-name/node_modules",
      "readdir: foo/bar/node_modules/broken-package-no-version/node_modules",
      "readdir: foo/bar/node_modules/broken-package-not-json/node_modules",
      "readdir: foo/bar/node_modules/package-a/node_modules",
      "readdir: foo/bar/node_modules/package-a/node_modules/package-a-dep/node_modules",
      "readdir: foo/bar/node_modules/package-b-dirname/node_modules",
      "readdir: foo/bar/node_modules/symlink-package/node_modules",
      "readdir: foo/bar/node_modules/symlink-package/node_modules/package.json/node_modules",
      "readdir: foo/node_modules",
      "readdir: foo/node_modules/package-a-dep/node_modules",
      "readdir: foo/node_modules/package-c/node_modules",
      "realpath: foo/bar",
      "realpath: foo/bar/node_modules/package-a",
      "realpath: foo/bar/node_modules/package-a/node_modules/package-a-dep",
      "realpath: foo/bar/node_modules/package-b-dirname",
      "realpath: foo/bar/node_modules/symlink-package",
      "realpath: foo/node_modules/package-a-dep",
      "realpath: foo/node_modules/package-c",
    ]
  `);
  log.splice(0, log.length);
});

test('win32', async () => {
  fs.sep = '\\';
  expect(await findPackageLocations('foo\\bar')).toMatchInlineSnapshot(`
    Map {
      "bing@2.5.0" => Object {
        "alternativeLocations": Array [],
        "name": "bing",
        "relativePackageDirectory": "node_modules/symlink-package",
        "resolvedPackageDirectory": "foo\\\\bing",
        "sourceDirectory": "foo\\\\bar",
        "version": "2.5.0",
      },
      "package-a-dep@1.0.0" => Object {
        "alternativeLocations": Array [
          Object {
            "relativePackageDirectory": "node_modules/package-a-dep",
            "resolvedPackageDirectory": "foo\\\\node_modules\\\\package-a-dep",
            "sourceDirectory": "foo",
          },
        ],
        "name": "package-a-dep",
        "relativePackageDirectory": "node_modules/package-a/node_modules/package-a-dep",
        "resolvedPackageDirectory": "foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep",
        "sourceDirectory": "foo\\\\bar",
        "version": "1.0.0",
      },
      "package-a@1.0.0" => Object {
        "alternativeLocations": Array [],
        "name": "package-a",
        "relativePackageDirectory": "node_modules/package-a",
        "resolvedPackageDirectory": "foo\\\\bar\\\\node_modules\\\\package-a",
        "sourceDirectory": "foo\\\\bar",
        "version": "1.0.0",
      },
      "package-b@2.0.0" => Object {
        "alternativeLocations": Array [],
        "name": "package-b",
        "relativePackageDirectory": "node_modules/package-b-dirname",
        "resolvedPackageDirectory": "foo\\\\bar\\\\node_modules\\\\package-b-dirname",
        "sourceDirectory": "foo\\\\bar",
        "version": "2.0.0",
      },
      "package-c@1.0.0" => Object {
        "alternativeLocations": Array [],
        "name": "package-c",
        "relativePackageDirectory": "node_modules/package-c",
        "resolvedPackageDirectory": "foo\\\\node_modules\\\\package-c",
        "sourceDirectory": "foo",
        "version": "1.0.0",
      },
    }
  `);
  expect(log.sort()).toMatchInlineSnapshot(`
    Array [
      "readFile: \\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-no-name\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-no-version\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-not-json\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-a\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-b-dirname\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules\\\\package.json\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\package.json",
      "readFile: foo\\\\bar\\\\package.json",
      "readFile: foo\\\\node_modules\\\\package-a-dep\\\\package.json",
      "readFile: foo\\\\node_modules\\\\package-c\\\\package.json",
      "readFile: foo\\\\package.json",
      "readdir: \\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-no-name\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-no-version\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-not-json\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-b-dirname\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules\\\\package.json\\\\node_modules",
      "readdir: foo\\\\node_modules",
      "readdir: foo\\\\node_modules\\\\package-a-dep\\\\node_modules",
      "readdir: foo\\\\node_modules\\\\package-c\\\\node_modules",
      "realpath: foo\\\\bar",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-a",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-b-dirname",
      "realpath: foo\\\\bar\\\\node_modules\\\\symlink-package",
      "realpath: foo\\\\node_modules\\\\package-a-dep",
      "realpath: foo\\\\node_modules\\\\package-c",
    ]
  `);
  log.splice(0, log.length);
  expect(await findPackageLocations('foo/bar')).toEqual(
    await findPackageLocations('foo\\bar'),
  );
  expect(log.sort()).toMatchInlineSnapshot(`
    Array [
      "readFile: \\\\package.json",
      "readFile: \\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-no-name\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-no-name\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-no-version\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-no-version\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-not-json\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\broken-package-not-json\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-a\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-a\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-b-dirname\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\package-b-dirname\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules\\\\package.json\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules\\\\package.json\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\package.json",
      "readFile: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\package.json",
      "readFile: foo\\\\bar\\\\package.json",
      "readFile: foo\\\\bar\\\\package.json",
      "readFile: foo\\\\node_modules\\\\package-a-dep\\\\package.json",
      "readFile: foo\\\\node_modules\\\\package-a-dep\\\\package.json",
      "readFile: foo\\\\node_modules\\\\package-c\\\\package.json",
      "readFile: foo\\\\node_modules\\\\package-c\\\\package.json",
      "readFile: foo\\\\package.json",
      "readFile: foo\\\\package.json",
      "readdir: \\\\node_modules",
      "readdir: \\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-no-name\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-no-name\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-no-version\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-no-version\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-not-json\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\broken-package-not-json\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-b-dirname\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\package-b-dirname\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules\\\\package.json\\\\node_modules",
      "readdir: foo\\\\bar\\\\node_modules\\\\symlink-package\\\\node_modules\\\\package.json\\\\node_modules",
      "readdir: foo\\\\node_modules",
      "readdir: foo\\\\node_modules",
      "readdir: foo\\\\node_modules\\\\package-a-dep\\\\node_modules",
      "readdir: foo\\\\node_modules\\\\package-a-dep\\\\node_modules",
      "readdir: foo\\\\node_modules\\\\package-c\\\\node_modules",
      "readdir: foo\\\\node_modules\\\\package-c\\\\node_modules",
      "realpath: foo/bar",
      "realpath: foo\\\\bar",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-a",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-a",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-a\\\\node_modules\\\\package-a-dep",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-b-dirname",
      "realpath: foo\\\\bar\\\\node_modules\\\\package-b-dirname",
      "realpath: foo\\\\bar\\\\node_modules\\\\symlink-package",
      "realpath: foo\\\\bar\\\\node_modules\\\\symlink-package",
      "realpath: foo\\\\node_modules\\\\package-a-dep",
      "realpath: foo\\\\node_modules\\\\package-a-dep",
      "realpath: foo\\\\node_modules\\\\package-c",
      "realpath: foo\\\\node_modules\\\\package-c",
    ]
  `);
  log.splice(0, log.length);
});
