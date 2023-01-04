import * as vscode from 'vscode';
import { DocumentInfoProvider } from './../../documentInfoProvider';
import { SymbolProvider, SymbolTree } from './../symbolProvider';
import { Token, TokenType } from '../tokens';
import { EndpointInfo, IEndpointExtractor, SymbolInfo } from '../extractors';
import { EndpointSchema } from '../../analyticsProvider';

export class FastapiEndpointExtractor implements IEndpointExtractor
{
    async extractEndpoints(
        document: vscode.TextDocument,
        symbolInfo: SymbolInfo[],
        tokens: Token[],
        symbolTrees: SymbolTree[] | undefined,
        symbolProvider: SymbolProvider,
    ): Promise<EndpointInfo[]> {
        // Ensure fastapi module was imported
        if(!tokens.any(t => t.text == 'fastapi' && t.type == TokenType.module))
            return [];
        
        let prefix = '';

        // Search for "@app.get" decorators
        const results: EndpointInfo[] = [];
        for(let i=0; i<tokens.length-1; i++)
        {
            const appToken = tokens[i];
            const methodToken = tokens[i+1];

            //Check if this is a router variable
            if ( appToken.type === TokenType.variable 
                    && methodToken.type === TokenType.class && methodToken.text==='APIRouter' ){
               
                const routerLine = document.getText(new vscode.Range(
                    appToken.range.start, 
                    new vscode.Position(methodToken.range.end.line, 1000)));
                
                //extract the prefix
                let match = new RegExp(`^${appToken.text}\\s*=\\s*\\APIRouter\\s*\\((.*=.*,\\s*)*prefix=\\s*["'](.*?)["'](ֿֿֿ\\s*,.*=.*)*\\)*\\)`).exec(routerLine);
                if (match){
                    prefix = match[2];
                }

                //Future: use the references to extract the 'include' statement to the router if it contains a prefix
                
                // const position  =new vscode.Position(appToken.range.start.line,appToken.range.start.character );

                // let references : vscode.Location[] = await vscode.commands.executeCommand("vscode.executeReferenceProvider", document.uri,position);
                // references = references.filter(x=>x.uri.fsPath!==document.uri.fsPath);
                // if (references.length>0){
                //     let referencedDocument = vscode.workspace.openTextDocument(references[0].uri);
                //     let text = (await referencedDocument).getText(references[0].range);
                //     console.log(text);

                // }


            }
                

            if ((appToken.text != 'app' && appToken.text != 'router') || appToken.type != TokenType.variable || methodToken.type != TokenType.method)
                continue;

            const method = methodToken.text;
            if (!['post', 'get', 'put', 'delete', 'options', 'head', 'patch', 'trace'].includes(method))
                continue;
            
            const lineText = document.getText(new vscode.Range(
                appToken.range.start, 
                new vscode.Position(methodToken.range.end.line, 1000)));
            
            let index = 2;
            let match = new RegExp(`^(app|router)\\.${method}\\(["'](\/.*?)["']`).exec(lineText);
            if (!match){
                //Different regex for optional params (named)
                match  =  new RegExp(`^(app|router)\\.${method}\\((.*=.*,\\s*)*path=\\s*["'](\\/.*?)["'](ֿֿֿ\\s*,.*=.*)*\\)`).exec(lineText);
                index =3;
            }

            if (!match)
                continue;
            
            const relevantFunc = symbolInfo.firstOrDefault(s => s.range.contains(methodToken.range))
            if (!relevantFunc)
                continue;
            
            const path = match[index];
            let folder = vscode.workspace.getWorkspaceFolder(document.uri);
            let folderPrefix = folder?.uri.path.split('/').slice(0,-1).join('/');
            let relevantPath = document.uri.path.substring(folderPrefix!.length);
            let pathParts = relevantPath.split('/').filter(x=>x);
            for (let j=0;j<pathParts.length-1;j++){
                let possibleRoot = pathParts[j];
                results.push(new EndpointInfo(
                    possibleRoot + '$_$' + EndpointSchema.HTTP + method.toUpperCase() + ' ' + prefix + path,
                    method, 
                    path,
                    relevantFunc.range,
                    document.uri));
            }

        }
        return results;
    }
}