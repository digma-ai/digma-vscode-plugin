import { ISymbolAliasExtractor, SymbolInfo } from "../extractors";

export class PythonSymbolAliasExtractor implements ISymbolAliasExtractor{
    public extractAliases(symbol: SymbolInfo): string[] {
        const aliases = [];

        const folderAndName = symbol.id.split("$_$");
        if (folderAndName.length<2){
            return [];
        }
        const folderOnly = folderAndName[0];
        const folders = folderOnly.split("/");

        if (symbol.name!=symbol.displayName){
            aliases.push(folderOnly + "$_$" + symbol.displayName);
        }  
              //aliases.push(symbol.id);
        for (let i=1;i<folders.length;i++){
            aliases.push(folders.slice(i, folders.length).join("/") + "$_$" + symbol.name);
            if (symbol.name!=symbol.displayName){
                aliases.push(folders.slice(i, folders.length).join("/") + "$_$" + symbol.displayName);

            }
        }

        
        return aliases;
    }
}