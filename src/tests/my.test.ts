
import { mock, instance } from 'ts-mockito';
import { DocumentInfoProvider } from '../services/documentInfoProvider';
import { IAnalyticsProvider } from '../services/analyticsProvider';
import { ISymbolProvider } from '../services/symbolProvider';
import { Writeable } from '../services/utils';
import { Uri, TextDocument} from 'vscode';
import { IVscodeApi } from '../vscodeEnv';

describe('Config', () => 
{
	let vscodeApi = mock<IVscodeApi>();

	let textDoc = mock<Writeable<TextDocument>>();
	textDoc.uri = Uri.file('/user/repo-1/src/main.py');

	let analyticsProvider = mock<IAnalyticsProvider>();	
	let symbolProvider = mock<ISymbolProvider>();
    let documentInfoProvider:DocumentInfoProvider;

	beforeEach(() => 
	{
		vscodeApi.workspace.workspaceFolders = [
			{ uri: Uri.file('/user/repo-1'), name: 'repo-1', index: 0 },
			{ uri: Uri.file('/user/repo-2'), name: 'repo-2', index: 1 }
		];
	
		documentInfoProvider = new DocumentInfoProvider(analyticsProvider, symbolProvider);
	});

	afterEach(()=>
	{
		// documentInfoProvider.dispose();
	})

    it('Return nothing for files outside the workspace', async () => 
	{
		// let textDoc = mock<Writeable<TextDocument>>();
		// textDoc.uri = Uri.file('/user/repo-999/src/main.py');

		// const docInfo = await documentInfoProvider.getDocumentInfo(textDoc);
		// expect(docInfo).toBeUndefined();
	});
});