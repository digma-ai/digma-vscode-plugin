import { ISymbolAliasExtractor, SymbolInfo } from "../extractors";

export class PythonSymbolAliasExtractor implements ISymbolAliasExtractor{
    public extractAliases(symbol: SymbolInfo): string[] {
        var folders = symbol.id.split("/");
        let aliases = [];
        //aliases.push(symbol.id);
        for (let i=1;i<folders.length;i++){
            aliases.push(folders.slice(i, folders.length).join("/"));
        }
        return aliases;
    }
}