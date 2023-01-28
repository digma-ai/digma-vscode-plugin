// import { CancellationToken, Event, FileDecoration, FileDecorationProvider, ProviderResult, Uri } from "vscode";
// import { Disposable } from "vscode-languageclient";

// export class DigmaFileDecorator implements FileDecorationProvider{
    
//     private readonly disposables: Disposable[] = [];

//     onDidChangeFileDecorations?: Event<Uri | Uri[] | undefined> | undefined;
    

//     provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration> {
//        if (uri.fsPath.endsWith("controller.go")){
//             return new FileDecoration('🔍',"insight");
//        }
//        return new FileDecoration();

//     }

//     dispose (): void {
//         this.disposables.forEach(d => d.dispose());
//       }

// }