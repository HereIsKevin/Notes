export {
  exists,
  listDirectory,
  createDirectory,
  rename,
  writeFile,
  readFile,
  deleteFile,
  stats,
};

import * as logger from "./logger";
import { promises as fs, constants as fsConstants, Stats } from "fs";

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listDirectory(path: string): Promise<string[] | undefined> {
  try {
    const files = await fs.readdir(path);
    return files;
  } catch {
    logger.error(`failed to read directory ${path}`);
  }
}

async function createDirectory(path: string): Promise<void> {
  try {
    await fs.mkdir(path, { recursive: true });
    logger.log(`created directories to ${path}`);
  } catch {
    logger.error(`failed to create directories to ${path}`);
  }
}

async function rename(oldPath: string, newPath: string): Promise<void> {
  try {
    await fs.rename(oldPath, newPath);
    logger.log(`renamed ${oldPath} to ${newPath}`);
  } catch {
    logger.error(`failed to rename ${oldPath} to ${newPath}`);
  }
}

async function writeFile(path: string, content: string): Promise<void> {
  try {
    await fs.writeFile(path, content);
    logger.log(`wrote ${path}`);
  } catch {
    logger.error(`failed to write ${path}`);
  }
}

async function readFile(path: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(path);
    logger.log(`read ${path}`);
    return content.toString();
  } catch {
    logger.error(`failed to read ${path}`);
  }
}

async function deleteFile(path: string): Promise<void> {
  try {
    await fs.unlink(path);
    logger.log(`deleted ${path}`);
  } catch {
    logger.error(`failed to delete ${path}`);
  }
}

async function stats(path: string): Promise<Stats | undefined> {
  try {
    const fileStats = await fs.stat(path);
    return fileStats;
  } catch {
    logger.error(`failed to get stats for ${path}`);
  }
}
