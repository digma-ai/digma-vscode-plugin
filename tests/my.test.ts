import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { mock } from 'jest-mock-extended';
import { DocumentInfoProvider } from '../src/services/documentInfoProvider';
import { IAnalyticsProvider } from '../src/services/analyticsProvider';
import { ISymbolProvider } from '../src/services/symbolProvider';
import { TextDocument, Uri } from 'vscode';

describe('Config', () => 
{
	vscode.workspace.workspaceFolders = [
		{ uri: Uri.file('/user/repo-1'), index: 0 },
		{ uri: Uri.file('/user/repo-2'), index: 1 }
	];

	let textDoc = mock<vscode.Writeable<TextDocument>>();
	textDoc.uri = Uri.file('/user/repo-1/src/main.py');

	let analyticsProvider = mock<IAnalyticsProvider>();	
	let symbolProvider = mock<ISymbolProvider>();
    let documentInfoProvider:DocumentInfoProvider;

	beforeEach(() => 
	{
		documentInfoProvider = new DocumentInfoProvider(analyticsProvider, symbolProvider);
	});

	afterEach(()=>
	{
		documentInfoProvider.dispose();
	})

    it('Return nothing for files outside the workspace', async () => 
	{
		let textDoc = mock<vscode.Writeable<TextDocument>>();
		textDoc.uri = Uri.file('/user/repo-999/src/main.py');

		const docInfo = await documentInfoProvider.getDocumentInfo(textDoc);
		expect(docInfo).toBeUndefined();
	});
});