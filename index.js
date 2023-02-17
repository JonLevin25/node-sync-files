// @ts-check
"use strict";

// Recreate missing reference to require
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import _ from "lodash";
const { defaults } = _;
import fs from "fs-extra";
import path from "path";
import chokidar from "chokidar";

sync("./test.txt", "D:/test/test.txt", { watch: true }, (eventName, msg) =>
  console.log(`${eventName}: ${msg}`)
);

/**
 * @typedef {"error" | "copy" | "remove" | "watch" | "max-depth" | "no-delete" | "verbose"} WatcherEvent
 * @typedef {{depth?: number, delete?: boolean, watch?: boolean, "notify-update"?: boolean, version?: boolean, verbose?: boolean, help?: boolean}} OptsType
 * @typedef {(event: WatcherEvent, data: any) => void} NotifyFunc // polymorphism (making data right) seems like a pain.
 */

/**
 *
 * @param {string} source
 * @param {string} target
 * @param {OptsType} opts
 * @param {NotifyFunc} notify
 * @returns boolean - false if errors occurred, true otherwise
 */
export default function sync(source, target, opts, notify) {
  notify("verbose", `Starting watcher (${source} => ${target})`);
  opts = defaults(opts || {}, {
    watch: false,
    delete: false,
    depth: Infinity,
  });

  if (typeof opts.depth !== "number" || isNaN(opts.depth)) {
    notify("error", "Expected valid number for option 'depth'");
    return false;
  }

  // Initial mirror
  const mirrored = mirror(source, target, opts, notify, 0);

  if (!mirrored) {
    return false;
  }

  if (opts.watch) {
    // Watcher to keep in sync from that
    chokidar
      .watch(source, {
        persistent: true,
        depth: opts.depth,
        ignoreInitial: true,
        // TODO "ignore": opts.ignore
      })
      //.on("raw", console.log.bind(console, "raw"))
      .on("ready", notify.bind(undefined, "watch", source))
      .on("add", watcherCopy(source, target, opts, notify))
      .on("addDir", watcherCopy(source, target, opts, notify))
      .on("change", watcherCopy(source, target, opts, notify))
      .on("unlink", watcherDestroy(source, target, opts, notify))
      .on("unlinkDir", watcherDestroy(source, target, opts, notify))
      .on("error", watcherError(opts, notify));
  }

  return true;
}

/**
 *
 * @param {string} source
 * @param {string} target
 * @param {OptsType} opts
 * @param {NotifyFunc} notify

 */
function watcherCopy(source, target, opts, notify) {
  return function (f, stats) {
    copy(f, path.join(target, path.relative(source, f)), notify);
  };
}

/**
 * @param {string} source
 * @param {string} target
 * @param {OptsType} opts
 * @param {NotifyFunc} notify
 */
function watcherDestroy(source, target, opts, notify) {
  return function (f) {
    deleteIfOpts(path.join(target, path.relative(source, f)), opts, notify);
  };
}

/**
 * @param {OptsType} opts
 * @param {NotifyFunc} notify
 */
function watcherError(opts, notify) {
  return function (err) {
    notify("error", err);
  };
}

/**
 * @param {string} source
 * @param {string} target
 * @param {OptsType} opts
 * @param {NotifyFunc} notify
 * @param {number} depth
 * @returns {boolean} false if errors occurred, true otherwise
 */
function mirror(source, target, opts, notify, depth) {
  // Specifc case where the very source is gone
  let sourceStat;
  try {
    sourceStat = fs.statSync(source);
  } catch (e) {
    // Source not found: destroy target?
    if (fs.existsSync(target)) {
      return deleteIfOpts(target, opts, notify);
    }
    return false; // source missing and no delete is invalid
  }

  let targetStat;
  try {
    targetStat = fs.statSync(target);
  } catch (e) {
    // Target not found? good, direct copy
    return copy(source, target, notify);
  }

  if (sourceStat.isDirectory() && targetStat.isDirectory()) {
    if (depth === opts.depth) {
      notify("max-depth", source);
      return true;
    }

    // copy from source to target
    const copied = fs.readdirSync(source).every(function (f) {
      return mirror(
        path.join(source, f),
        path.join(target, f),
        opts,
        notify,
        depth + 1
      );
    });

    // check for extraneous
    const deletedExtra = fs.readdirSync(target).every(function (f) {
      return (
        fs.existsSync(path.join(source, f)) ||
        deleteIfOpts(path.join(target, f), opts, notify)
      );
    });

    return copied && deletedExtra;
  } else if (sourceStat.isFile() && targetStat.isFile()) {
    // compare update-time before overwriting
    if (sourceStat.mtime > targetStat.mtime) {
      return copy(source, target, notify);
    } else {
      return true;
    }
  } else if (opts.delete) {
    // incompatible types: destroy target and copy
    return destroy(target, notify) && copy(source, target, notify);
  } else if (sourceStat.isFile() && targetStat.isDirectory()) {
    // incompatible types
    notify(
      "error",
      "Cannot copy file '" + source + "' to '" + target + "' as existing folder"
    );
    return false;
  } else if (sourceStat.isDirectory() && targetStat.isFile()) {
    // incompatible types
    notify(
      "error",
      "Cannot copy folder '" + source + "' to '" + target + "' as existing file"
    );
    return false;
  } else {
    throw new Error("Unexpected case: WTF?");
  }
}

/**
 *
 * @param {string} fileordir
 * @param {OptsType} opts
 * @param {NotifyFunc} notify
 * @returns
 */
function deleteIfOpts(fileordir, opts, notify) {
  if (opts.delete) {
    return destroy(fileordir, notify);
  } else {
    notify("no-delete", fileordir);
    return true;
  }
}

/**
 *
 * @param {string} source
 * @param {string} target
 * @param {NotifyFunc} notify
 * @returns
 */
function copy(source, target, notify) {
  notify("copy", [source, target]);
  try {
    fs.copySync(source, target);
    return true;
  } catch (e) {
    notify("error", e);
    return false;
  }
}

/**
 * @param {string} fileordir
 * @param {NotifyFunc} notify
 * @returns
 */
function destroy(fileordir, notify) {
  notify("remove", fileordir);
  try {
    fs.remove(fileordir);
    return true;
  } catch (e) {
    notify("error", e);
    return false;
  }
}
