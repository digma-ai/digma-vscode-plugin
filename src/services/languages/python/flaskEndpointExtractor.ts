import * as vscode from 'vscode';
import { DocumentInfoProvider } from './../../documentInfoProvider';
import { SymbolProvider, SymbolTree } from './../symbolProvider';
import { Token, TokenType } from '../tokens';
import { EndpointInfo, IEndpointExtractor, SymbolInfo } from '../extractors';
import { EndpointSchema } from '../../analyticsProvider';
import { CodeInspector } from '../../codeInspector';

export class FlaskEndpointExtractor implements IEndpointExtractor
{
    readonly routeMethods = ['route', 'get','post', 'patch'];
    readonly genericRouteMethod = 'route';
    readonly flaskAppType = 'Flask';


    constructor(private _codeInspector: CodeInspector) {}
    
    async extractEndpoints(
        document: vscode.TextDocument,
        symbolInfo: SymbolInfo[],
        tokens: Token[],
        symbolTrees: SymbolTree[] | undefined,
        symbolProvider: SymbolProvider
    ): Promise<EndpointInfo[]> {

        // Ensure flask module was imported
        if(!tokens.any(t => t.text == 'flask' && t.type == TokenType.module))
            return [];
        
        // Search for "@app.get" decorators
        const results: EndpointInfo[] = [];
        for(let i=0; i<tokens.length-1; i++)
        {
            const appToken = tokens[i];
            const methodToken = tokens[i+1];
            let route = '';
            let method = '';
            
            //Check if this is a router variable
            if ( appToken.type === TokenType.variable 
                    && methodToken.type === TokenType.method && this.routeMethods.includes( methodToken.text) ){
               
                const routerLine = document.getText(new vscode.Range(
                    appToken.range.start, 
                    new vscode.Position(methodToken.range.end.line, 1000)));
                    
                //extract the prefix
                let match = new RegExp(`^(?:${appToken.text}.(route|get|post|update|patch))\\s*\\((?:'|")(.*?)(?:'|")(?:.*[\\s,]*\\bmethods\\b\\s*=\\s*\\[(.*?)\\])?`).exec(routerLine);

                if (!match || match.length<3){
                    return [];
                }
                const tracerDefTypeDef = await this._codeInspector.getTypeFromSymbolProvider(document, appToken.range.start,symbolProvider,x=>true);

                if (!tracerDefTypeDef || tracerDefTypeDef!=this.flaskAppType){
                    return [];
                }

               
                route = match[2];
                method = match[1];

                if (method==this.genericRouteMethod){

                    //Handle form of @app.route('/', methods: ["POST", "GET"])
                    //In this scenario the regex would capture the methods 
                    //As the fourth group
                    if (match.length==4 && match[3]){
                        const methods = match[3].replaceAll('"','');
                        method=methods;
                    }
                    //Otherwise the default for the "route" form is GET
                    else{
                        method='GET';

                    }
                }
                

            }
            else{
                continue;
            }
                            
            const relevantFunc = symbolInfo.firstOrDefault(s => s.range.contains(methodToken.range));
            if (!relevantFunc){
                continue;
            }
            
            let folder = vscode.workspace.getWorkspaceFolder(document.uri);
            let folderPrefix = folder?.uri.path.replaceAll('\\',"/").split('/').slice(0,-1).join('/');
            let relevantPath = document.uri.path.substring(folderPrefix!.length);
            let pathParts = relevantPath.split('/').filter(x=>x);
            const methods = method.split(",").map(x=>x.toUpperCase().trim());

            for (var apiMethod of methods){
                for (let j=0;j<pathParts.length-1;j++){
                    let possibleRoot = pathParts[j];
                    results.push(new EndpointInfo(
                        possibleRoot + '$_$' + EndpointSchema.HTTP + "HTTP " + apiMethod + ' ' + route,
                        apiMethod, 
                        route,
                        relevantFunc.range,
                        document.uri));
                }
            }
  

        }
        return results;
    }
}