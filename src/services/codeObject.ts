export enum CodeObjectType 
{
    method = "method",
    span = "span",
}

export class CodeObjectId{
   
    static readonly codeObjectSeparator: string = "$_$";

    public static isSpan(codeObjectId: string): boolean{
        const codeObjectType = this.getType(codeObjectId);
        if(codeObjectType && codeObjectType === CodeObjectType.span){
            return true;
        }
        return false;
    }

    private static getType(codeObjectId: string): CodeObjectType| undefined{
        const parts = codeObjectId.split(":", 2);
        if ( parts.length < 2){
            return undefined;
        }
        var codeObjectType: string = parts[0];
        return (<any>CodeObjectType)[codeObjectType];
    }
    
}