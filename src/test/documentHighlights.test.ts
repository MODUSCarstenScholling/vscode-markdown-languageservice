/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as lsp from 'vscode-languageserver-types';
import { getLsConfiguration } from '../config';
import { MdDocumentHighlightProvider } from '../languageFeatures/documentHighlights';
import { MdLinkProvider } from '../languageFeatures/documentLinks';
import { MdTableOfContentsProvider } from '../tableOfContents';
import { makeRange } from '../types/range';
import { noopToken } from '../util/cancellation';
import { DisposableStore } from '../util/dispose';
import { IWorkspace } from '../workspace';
import { createNewMarkdownEngine } from './engine';
import { InMemoryDocument } from './inMemoryDocument';
import { InMemoryWorkspace } from './inMemoryWorkspace';
import { nulLogger } from './nulLogging';
import { assertRangeEqual, joinLines, withStore, workspacePath } from './util';


function getDocumentHighlights(store: DisposableStore, doc: InMemoryDocument, pos: lsp.Position, workspace: IWorkspace) {
	const engine = createNewMarkdownEngine();
	const tocProvider = store.add(new MdTableOfContentsProvider(engine, workspace, nulLogger));
	const config = getLsConfiguration({});
	const linkProvider = store.add(new MdLinkProvider(config, engine, workspace, tocProvider, nulLogger));
	const provider = new MdDocumentHighlightProvider(tocProvider, linkProvider);
	return provider.getDocumentHighlights(doc, pos, noopToken);
}

function assertHighlightsEqual(actualHighlights: readonly lsp.DocumentHighlight[], ...expectedHighlights: { range: lsp.Range }[]) {
	assert.strictEqual(actualHighlights.length, expectedHighlights.length, 'Highlight counts should match');

	for (let i = 0; i < actualHighlights.length; ++i) {
		const actual = actualHighlights[i];
		const expected = expectedHighlights[i];
		assertRangeEqual(actual.range, expected.range, `Highlight range ${i} should match`);
	}
}

suite('Document highlights', () => {
	test('Should highlight fragment when on header', withStore(async (store) => {
		const doc = new InMemoryDocument(workspacePath('doc.md'), joinLines(
			`# A b C`,
			``,
			`text [link](#a-b-c)`,
			`text [link](#a-B-c "title")`,
			`text [link](doc.md#a-B-c "title")`,
			``,
			`[ref]: #a-B-c "title"`,
		));
		const workspace = store.add(new InMemoryWorkspace([doc]));

		const highlights = await getDocumentHighlights(store, doc, { line: 0, character: 1 }, workspace);
		assertHighlightsEqual(highlights,
			{ range: makeRange(0, 0, 0, 7) },
			{ range: makeRange(2, 12, 2, 18) },
			{ range: makeRange(3, 12, 3, 18) },
			{ range: makeRange(4, 18, 4, 24) },
			{ range: makeRange(6, 7, 6, 13) },
		);
	}));

	test('Should highlight links and header when on link fragment', withStore(async (store) => {
		const doc = new InMemoryDocument(workspacePath('doc.md'), joinLines(
			`# A b C`,
			``,
			`text [link](#a-b-c)`, // trigger 1
			`text [link](#a-B-c "title")`,
			`text [link](doc.md#a-B-c "title")`, // trigger 2
			``,
			`[ref]: #a-B-c "title"`, // trigger 3
		));
		const workspace = store.add(new InMemoryWorkspace([doc]));

		const expected = [
			{ range: makeRange(0, 0, 0, 7) },
			{ range: makeRange(2, 12, 2, 18) },
			{ range: makeRange(3, 12, 3, 18) },
			{ range: makeRange(4, 18, 4, 24) },
			{ range: makeRange(6, 7, 6, 13) },
		];

		{
			const highlights = await getDocumentHighlights(store, doc, { line: 2, character: 14 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
		{
			const highlights = await getDocumentHighlights(store, doc, { line: 4, character: 20 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
		{
			const highlights = await getDocumentHighlights(store, doc, { line: 6, character: 10 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
	}));

	test('Should highlight links when on link path', withStore(async (store) => {
		const doc = new InMemoryDocument(workspacePath('doc.md'), joinLines(
			`# A b C`,
			``,
			`text [link](other.md)`, // trigger 1
			`text [link](./other.md)`, // trigger 2
			`text [link](/other.md)`, // trigger 3
			`text [link](other.md#frag)`, // trigger 4
			``,
			`[ref]: other.md`, // trigger 5

		));
		const workspace = store.add(new InMemoryWorkspace([doc]));

		const expected = [
			{ range: makeRange(2, 12, 2, 20) },
			{ range: makeRange(3, 12, 3, 22) },
			{ range: makeRange(4, 12, 4, 21) },
			{ range: makeRange(5, 12, 5, 20) }, // should not include fragment range
			{ range: makeRange(7, 7, 7, 15) },
		];

		{
			const highlights = await getDocumentHighlights(store, doc, { line: 2, character: 14 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
		{
			const highlights = await getDocumentHighlights(store, doc, { line: 3, character: 14 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
		{
			const highlights = await getDocumentHighlights(store, doc, { line: 4, character: 14 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
		{
			const highlights = await getDocumentHighlights(store, doc, { line: 5, character: 14 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
		{
			const highlights = await getDocumentHighlights(store, doc, { line: 7, character: 8 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
	}));

	test('Should highlight reference links when on link reference or definition', withStore(async (store) => {
		const doc = new InMemoryDocument(workspacePath('doc.md'), joinLines(
			`[text][def]`, // trigger 1 
			`[def]`,
			`[def][]`,
			`[def][def]`,
			``,
			`[def]: http://example.com`, // trigger 2

		));
		const workspace = store.add(new InMemoryWorkspace([doc]));

		const expected = [
			{ range: makeRange(0, 7, 0, 10) },
			{ range: makeRange(1, 1, 1, 4) },
			{ range: makeRange(2, 1, 2, 4) },
			{ range: makeRange(3, 6, 3, 9) },
			{ range: makeRange(5, 1, 5, 4) },
		];

		{
			const highlights = await getDocumentHighlights(store, doc, { line: 0, character: 8 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
		{
			const highlights = await getDocumentHighlights(store, doc, { line: 5, character: 1 }, workspace);
			assertHighlightsEqual(highlights, ...expected);
		}
	}));
});