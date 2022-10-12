export enum CodeObjectType 
{
    method = "method",
    span = "span",
}

export class CodeObjectId {
   
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

    public static getSpanName(spanCodeObjectId: string): string {

        const ix = spanCodeObjectId.lastIndexOf(this.codeObjectSeparator);
        if (ix < 0) {
            return spanCodeObjectId;
        }
        return spanCodeObjectId.substring(ix + this.codeObjectSeparator.length);
    }

}