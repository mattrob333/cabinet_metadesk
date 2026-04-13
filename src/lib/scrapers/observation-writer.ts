/**
 * Observation Writer Utility
 *
 * Shared utility for writing observation files to the data directory.
 * Handles frontmatter formatting and ensures consistent file structure.
 */

import fs from 'fs/promises';
import path from 'path';
import * as yaml from 'js-yaml';
import type { Observation, ObservationFrontmatter } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Write an observation to a markdown file
 *
 * @param subdir - Subdirectory under data/observations/ (e.g., 'onchain/dexscreener')
 * @param filename - Filename without extension (e.g., '2026-04-11T14-30-00')
 * @param frontmatter - Observation metadata
 * @param body - Markdown content
 * @returns Path to created file
 */
export async function writeObservation(
  subdir: string,
  filename: string,
  frontmatter: ObservationFrontmatter,
  body: string
): Promise<string> {
  const observation: Observation = { frontmatter, body };

  // Ensure directory exists
  const dirPath = path.join(DATA_DIR, 'observations', subdir);
  await fs.mkdir(dirPath, { recursive: true });

  // Build file path
  const filePath = path.join(dirPath, `${filename}.md`);

  // Format frontmatter as YAML
  const frontmatterYaml = yaml.dump(frontmatter);

  // Combine frontmatter + body
  const content = `---\n${frontmatterYaml}---\n\n${body}`;

  // Write file
  await fs.writeFile(filePath, content, 'utf-8');

  return filePath;
}

/**
 * Read an observation from a markdown file
 *
 * @param filePath - Full path to observation file
 * @returns Parsed observation with frontmatter and body
 */
export async function readObservation(filePath: string): Promise<Observation> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Split frontmatter and body
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid observation file format: ${filePath}`);
  }

  const [, frontmatterRaw, body] = match;
  const frontmatter = yaml.load(frontmatterRaw) as ObservationFrontmatter;

  return { frontmatter, body };
}

/**
 * Get latest observation file from a directory
 *
 * @param subdir - Subdirectory under data/observations/ (e.g., 'onchain/dexscreener')
 * @returns Path to latest observation file, or null if none found
 */
export async function getLatestObservation(subdir: string): Promise<string | null> {
  const dirPath = path.join(DATA_DIR, 'observations', subdir);

  try {
    const files = await fs.readdir(dirPath);
    const mdFiles = files.filter((f) => f.endsWith('.md') && f !== 'index.md');

    if (mdFiles.length === 0) {
      return null;
    }

    // Sort by filename (ISO timestamps sort lexicographically)
    mdFiles.sort().reverse();

    return path.join(dirPath, mdFiles[0]);
  } catch (error) {
    // Directory doesn't exist or can't be read
    return null;
  }
}

/**
 * List all observation files in a directory
 *
 * @param subdir - Subdirectory under data/observations/
 * @returns Array of file paths, sorted newest to oldest
 */
export async function listObservations(subdir: string): Promise<string[]> {
  const dirPath = path.join(DATA_DIR, 'observations', subdir);

  try {
    const files = await fs.readdir(dirPath);
    const mdFiles = files.filter((f) => f.endsWith('.md') && f !== 'index.md');

    // Sort by filename (newest first)
    mdFiles.sort().reverse();

    return mdFiles.map((f) => path.join(dirPath, f));
  } catch (error) {
    return [];
  }
}

/**
 * Format current timestamp for observation filenames
 *
 * @returns ISO timestamp formatted for filenames (e.g., '2026-04-11T14-30-00')
 */
export function formatTimestampForFilename(): string {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z') // Remove milliseconds
    .replace(/:/g, '-') // Replace colons with hyphens for Windows compatibility
    .replace(/Z$/, ''); // Remove trailing Z
}

/**
 * Format timestamp for frontmatter (ISO 8601)
 *
 * @returns ISO timestamp (e.g., '2026-04-11T14:30:00Z')
 */
export function formatTimestampForFrontmatter(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
