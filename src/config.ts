/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as picomatch from 'picomatch';
import { URI } from 'vscode-uri';

export interface LsConfiguration {
	/**
	 * List of file extensions should be considered markdown.
	 *
	 * These should not include the leading `.`.
	 *
	 * The first entry is treated as the default file extension.
	 */
	readonly markdownFileExtensions: readonly string[];

	/**
	 * List of file extension for files that are linked to from markdown .
	 *
	 * These should not include the leading `.`.
	 *
	 * These are used to avoid duplicate checks when resolving links without
	 * a file extension.
	 */
	readonly knownLinkedToFileExtensions: readonly string[];

	/**
	 * List of path globs that should be excluded from cross-file operations.
	 */
	readonly excludePaths: readonly string[];

	/**
	 * Preferred style for file paths to {@link markdownFileExtensions markdown files}.
	 * 
	 * This is used for paths added by the language service, such as for path completions and on file renames.
	 * 
	 * Valid values:
	 * 
	 * - `auto` — Try to maintain the existing of the path.
	 * - `includeExtension` — Include the file extension when possible.
	 * - `removeExtension` — Drop the file extension when possible.
	 */
	readonly preferredMdPathExtensionStyle?: 'auto' | 'includeExtension' | 'removeExtension';
}

export const defaultMarkdownFileExtension = 'md';

const defaultConfig: LsConfiguration = {
	markdownFileExtensions: [defaultMarkdownFileExtension],
	knownLinkedToFileExtensions: [
		'jpg',
		'jpeg',
		'png',
		'gif',
		'webp',
		'bmp',
		'tiff',
	],
	excludePaths: [
		'**/.*',
		'**/node_modules/**',
	]
};

export function getLsConfiguration(overrides: Partial<LsConfiguration>): LsConfiguration {
	return {
		...defaultConfig,
		...overrides,
	};
}

export function isExcludedPath(configuration: LsConfiguration, uri: URI): boolean {
	return configuration.excludePaths.some(excludePath => picomatch.isMatch(uri.path, excludePath));
}
