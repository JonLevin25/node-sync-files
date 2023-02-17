# Fork changes (@JonLevin25)

- Fixed `ReferenceError: primordials is not defined` by updating:
  - `fs-extra`
  - `update-notifier`
- Upgraded project to be an ESModule (Required by `update-notifier`)
- Fixed various import issues
- Upgraded all packages to latest (as of 17/2/23)
- added name to default function
- convert vars to let/const
- added JSDoc types to index.js + @ts-check / tsconfig for checking

# node-sync-files

Synchronize files or folders locally, with a watch option

## Install

```sh
npm i -g sync-files
```

## Usage

![](help-screen.png)

### In your `package.json`

You may have some build script in your package.json involving mirroring folders (let's say, static assets), that's a good use-case for `sync-files`:

```js
// Before
{
  "scripts": {
    "build": "cp -rf src/images dist/",
    "watch": "???"
  }
}

// After
{
  "devDependencies": {
    "sync-files": "^1.0.3"
  },
  "scripts": {
    "build": "sync-files src/images dist/images",
    "watch": "sync-files --watch src/images dist/images"
  }
}
```

## Sample

![](sample-screen.png)

# Acknoledgements

Node-Sync-Files by Nicolas Chambrier was used as a starting point for this.
https://github.com/lmtm/node-sync-files.git

Fork of that with some updated packages/fixes:
https://github.com/JonLevin25/node-sync-files
