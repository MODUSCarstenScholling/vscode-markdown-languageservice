/**
 * Demonstrates how to use vscode-markdown-languageservice to process a markdown file.
 */
// @ts-check
const mdls = require('.');
const MarkdownIt = require('markdown-it');
const { URI } = require('vscode-uri');
const { CancellationTokenSource, Emitter } = require('vscode-languageserver');
const { TextDocument } = require('vscode-languageserver-textdocument');

// First we need to create the services that the markdown language service depends on.
// This allows vscode-markdown-languageservice to work with as many use cases as possible.

// Create an instance of markdown it to analyze files.
const mdIt = MarkdownIt({ html: true });

/** @type {mdls.IMdParser} */
const parser = new class {
	slugifier = mdls.githubSlugifier

	async tokenize(document) {
		return mdIt.parse(document.getText(), {});
	}
}

// Create a virtual document that holds our file content
const myDocument = TextDocument.create(
	URI.file('/path/to/file.md').toString(), // file path
	'markdown', // file lanaguage
	1, // version
	[ // File contents
		'# Hello',
		'from **Markdown**',
		'',
		'## World!',
	].join('\n')
);

// Create a simple virtual workspace. This is required as many markdown language features
// operate across files.

/** @type {mdls.IWorkspace} */
const workspace = new class {
	/** @returns {readonly URI[]} */
	get workspaceFolders() {
		return [];
	}

	/** @returns { Promise<Iterable<mdls.ITextDocument>>} */
	async getAllMarkdownDocuments() {
		return [myDocument];
	}

	hasMarkdownDocument(/** @type {URI} */ resource) {
		return resource.toString() === myDocument.uri;
	}

	/** @returns {Promise<mdls.ITextDocument | undefined>} */
	async getOrLoadMarkdownDocument(/** @type {URI} */resource) {
		if (resource.toString() === myDocument.uri) {
			return myDocument;
		}
		return undefined;
	}

	/** @returns {Promise<mdls.FileStat | undefined>} */
	async stat(/** @type {URI} */ resource) {
		if (resource.toString() === myDocument.uri) {
			return {};
		}
		return undefined;
	}

	/** @type {Emitter<mdls.ITextDocument>} */
	#onDidChangeMarkdownDocument = new Emitter();
	onDidChangeMarkdownDocument = this.#onDidChangeMarkdownDocument.event;

	/** @type {Emitter<mdls.ITextDocument>} */
	#onDidCreateMarkdownDocument = new Emitter();
	onDidCreateMarkdownDocument = this.#onDidCreateMarkdownDocument.event;

	/** @type {Emitter<URI>} */
	#onDidDeleteMarkdownDocument = new Emitter();
	onDidDeleteMarkdownDocument = this.#onDidDeleteMarkdownDocument.event;
};

/** @type { mdls.ILogger} */
const consoleLogger = {
	verbose(title, message, data) {
		console.log(title, message, data);
	}
};

async function main() {
	// Create an instance of the language service the services we just created.
	// You should do this once and then re-use the language service object for subsequent calls.
	const languageService = mdls.createLanguageService({ workspace, parser, logger: consoleLogger });

	// Request document symbols from the language service
	const cts = new CancellationTokenSource();
	try {
		const symbols = await languageService.provideDocumentSymbols(myDocument, cts.token);
		console.log(JSON.stringify(symbols, null, 2))
	} finally {
		cts.dispose();
	}
}

main();