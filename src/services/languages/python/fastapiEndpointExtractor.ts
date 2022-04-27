import * as vscode from 'vscode';
import * as path from 'path';
import { Token, TokenType } from "../symbolProvider";
import { EndpointInfo, IEndpointExtractor, SymbolInfo } from "../extractors";


export class FastapiEndpointExtractor implements IEndpointExtractor
{
    extractEndpoints(document: vscode.TextDocument, symbolInfo: SymbolInfo[], tokens: Token[]): EndpointInfo[] 
    {
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
            results.push(new EndpointInfo(
                vscode.workspace.getWorkspaceFolder(document.uri)!.name + '$_$' + method + ' ' + prefix + path,
                method, 
                path,
                relevantFunc.range,
                document.uri));
        }
        return results;
    }
}