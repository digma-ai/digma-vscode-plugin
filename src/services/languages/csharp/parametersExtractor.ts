import { integer } from "vscode-languageclient";
import { ParameterInfo } from '../../documentInfoProvider';
import { IParametersExtractor } from "../extractors";
import { Token, TokenType } from '../tokens';


export class CSharpParametersExtractor implements IParametersExtractor {

    public needToAddParametersToCodeObjectId(): boolean {
        return true;
    }

    public async extractParameters(methodName: string, methodTokens: Token[]): Promise<ParameterInfo[]> {
        var params: ParameterInfo[] = new Array();

        // skip the method attributes, etc...
        var methodNameIx = methodTokens.length;
        for (let ix = 0; ix < methodTokens.length; ix++) {
            const token = methodTokens[ix];
            if ((token.type === TokenType.method
                || token.type === TokenType.function
                || token.type === TokenType.member
            ) && token.text === methodName) {
                methodNameIx = ix;
                break;
            }
        }

        var firstParameter: boolean = true;
        var parameterStartIx: integer = -1;

        for (let ix = methodNameIx + 1; ix < methodTokens.length; ix++) {
            const token = methodTokens[ix];
            if (token.type === TokenType.punctuation) {
                if (token.text === "(") {
                    if (firstParameter) {
                        parameterStartIx = ix + 1;
                        firstParameter = false;
                    } else {
                        // stop looping since found '(' within '('
                        break;
                    }
                }
                if (token.text === ")") {
                    // stop looping, so won't enter inside method body
                    break;
                }
            }

            if (token.type === TokenType.parameter) {
                const paramInfo = this.processSingleParameter(methodTokens, parameterStartIx, ix);
                if (paramInfo) {
                    params.push(paramInfo);
                }
                parameterStartIx = ix + 2;
            }
        }

        return params;
    }


    protected processSingleParameter(methodTokens: Token[], parameterStartIx: integer, parameterEndIx: integer): ParameterInfo | undefined {
        const state = new TypeParsingState();
        for (let ix = parameterStartIx; ix <= parameterEndIx; ix++) {
            let token = methodTokens[ix];
            let txt = token.text;
            if (token.type === TokenType.parameter) {
                return this.buildParamInfo(state, token);
                //break;
            }
            if (token.type === TokenType.plainKeyword // for example int, long, string
                || token.type === TokenType.interface // for example IList, ICollection
                || token.type === TokenType.class     // for example 
                || token.type === TokenType.struct    // for example Int32 (int), Int64 (long)
                || token.type === TokenType.delegate  // for example Func<>
            ) {
                if (state.withinSomeScope() || state.genericsCount > 0) {
                    // skip
                } else {
                    state.addPlainKeyword(txt);
                }
            }
            if (token.type === TokenType.punctuation) {
                if (txt === "(") {
                    // this is the first parameter ending
                }
                if (txt === ",") {
                    if (!state.withinBrackets) {
                        state.increaseGenericsCountIfNeeded();
                    }
                    state.handleMultiDimArrayIfNeeded();
                }
                if (txt === "[") {
                    if (!state.withinGenerics()) {
                        // handle/skip attributes
                        if (state.hasTypeStrAlready()) {
                            state.arrayBegin();
                        } else {
                            state.withinAttribute = true;
                        }
                    }
                }
                if (txt === "]") {
                    if (!state.withinGenerics()) {
                        // handle/skip attributes
                        if (state.hasTypeStrAlready()) {
                            state.arrayEnd();
                        } else {
                            state.withinAttribute = false;
                        }
                    }
                }
                if (txt === "<") {
                    if (!state.withinBrackets()) {
                        state.genericsLevel++;
                        state.increaseGenericsCountIfNeeded();
                    }
                }
                if (txt === ">") {
                    if (!state.withinBrackets()) {
                        state.genericsLevel--;
                    }
                }
            }
        }
    }

    private buildParamInfo(state: TypeParsingState, tokenOfParameter: Token): ParameterInfo {
        const theType = state.evalType();

        return {
            name: tokenOfParameter.text,
            range: tokenOfParameter.range,
            token: tokenOfParameter,
            type: theType
        };
    }

}



export class TypeParsingState {
    withinArray: boolean = false;
    withinAttribute: boolean = false; // Dotnet Attribute is equivalent to Java Annotation
    genericsLevel: integer = 0;
    genericsCount: integer = 0;
    multiDimensionalArrayDelimiterCount: integer = 0;

    kindStr: string = "";
    typeNameStr: string = "";
    arraysPart: string[] = new Array;

    public reset() {
        this.withinArray = false;
        this.withinAttribute = false;
        this.genericsLevel = 0;
        this.genericsCount = 0;
        this.multiDimensionalArrayDelimiterCount = 0;
        this.kindStr = "";
        this.typeNameStr = "";
        this.arraysPart = new Array;
    }

    constructor() {
        this.reset();
    }

    public withinGenerics(): boolean {
        return this.genericsLevel > 0;
    }

    public withinBrackets(): boolean {
        return this.withinArray
            || this.withinAttribute;
    }

    public withinSomeScope(): boolean {
        return this.withinBrackets()
            || this.withinGenerics()
            ;
    }

    public increaseGenericsCountIfNeeded() {
        if (this.genericsLevel === 1) {
            this.genericsCount++;
        }
    }

    public handleMultiDimArrayIfNeeded() {
        if (this.withinArray) {
            this.multiDimensionalArrayDelimiterCount++;
        }
    }

    public arrayBegin() {
        this.withinArray = true;
        this.multiDimensionalArrayDelimiterCount = 0;
    }

    // multi dimension array encoding using semi-colon (;) instead of comma (,).
    // the reason is that comma is used to separate between parameters themselves
    static readonly MULTI_DIMENSIONAL_ARRAY_DELIMITER: string = ";";

    public arrayEnd() {
        var singleArrayPart: string = "[]";
        if (this.multiDimensionalArrayDelimiterCount > 0) {
            singleArrayPart = "["
                + TypeParsingState.MULTI_DIMENSIONAL_ARRAY_DELIMITER.repeat(this.multiDimensionalArrayDelimiterCount)
                + "]";
        }
        this.arraysPart.push(singleArrayPart)

        this.withinArray = false;
        this.multiDimensionalArrayDelimiterCount = 0;
    }

    public hasTypeStrAlready(): boolean {
        return this.typeNameStr !== "";
    }

    public addPlainKeyword(value: string) {
        if (this.typeNameStr !== "") {
            this.kindStr = this.typeNameStr;
        }
        this.typeNameStr = value;
    }

    public typeNameShortOnly(): string {
        var typeFqn = BuiltIn.resolveIfPossible(this.typeNameStr);
        // take only the last part
        var shortName: string;
        const lastIndexOfDot = typeFqn.lastIndexOf('.');
        if (lastIndexOfDot >= 0) {
            shortName = typeFqn.substring(lastIndexOfDot + 1);
        } else {
            shortName = typeFqn;
        }
        return shortName;
    }

    public refSignIfNeeded(): string {
        if (this.kindStr === "ref"
            || this.kindStr === "out") {
            return "&";
        }
        return "";
    }

    public genericsSignIfNeeded(): string {
        if (this.genericsCount > 0) {
            return "`" + this.genericsCount;
        }
        return "";
    }

    public arraysPartIfNeeded(): string {
        if (this.arraysPart.length < 1) {
            return "";
        }
        // reversing the array - since thats how dotnet refers it.
        // for example, when parameter is written as long[,,][,,,][][,] 
        // the actual is reveresed and looks like    long[,][][,,,][,,]
        const localArraysPart: string[] = this.arraysPart.slice(); // make a local copy since reverse method changes the array itself
        return localArraysPart.reverse().join("");
    }

    public evalType(): string {
        var theVal: string = "";
        theVal += this.typeNameShortOnly();
        theVal += this.genericsSignIfNeeded();
        theVal += this.arraysPartIfNeeded();
        theVal += this.refSignIfNeeded();
        return theVal;
    }
}

class BuiltIn {

    // see https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/built-in-types
    static primitiveMap: Map<string, string> = new Map();

    static {
        //
        BuiltIn.primitiveMap.set("bool", "System.Boolean");
        BuiltIn.primitiveMap.set("byte", "System.Byte");
        BuiltIn.primitiveMap.set("sbyte", "System.SByte");
        BuiltIn.primitiveMap.set("char", "System.Char");
        BuiltIn.primitiveMap.set("decimal", "System.Decimal");
        BuiltIn.primitiveMap.set("double", "System.Double");
        BuiltIn.primitiveMap.set("float", "System.Single");
        BuiltIn.primitiveMap.set("int", "System.Int32");
        BuiltIn.primitiveMap.set("uint", "System.UInt32");
        BuiltIn.primitiveMap.set("nint", "System.IntPtr");
        BuiltIn.primitiveMap.set("nuint", "System.UIntPtr");
        BuiltIn.primitiveMap.set("long", "System.Int64");
        BuiltIn.primitiveMap.set("ulong", "System.UInt64");
        BuiltIn.primitiveMap.set("short", "System.Int16");
        BuiltIn.primitiveMap.set("ushort", "System.UInt16");
        //
        BuiltIn.primitiveMap.set("object", "System.Object");
        BuiltIn.primitiveMap.set("string", "System.String");
        BuiltIn.primitiveMap.set("dynamic", "System.Object");
    }

    public static resolveIfPossible(shortName: string): string {
        var resolved = BuiltIn.primitiveMap.get(shortName);
        if (resolved) {
            return resolved;
        }
        return shortName;
    }

}
