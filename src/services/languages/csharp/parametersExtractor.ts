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
            if (token.type === TokenType.plainKeyword
                || token.type === TokenType.interface
                || token.type === TokenType.class
                || token.type === TokenType.struct
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
                    state.increaseGenericsCountIfNeeded();
                    if (state.withinArray) {
                        // continue
                    }
                }
                if (txt === "[") {
                    // handle/skip attributes
                    if (state.hasTypeStrAlready()) {
                        state.withinArray = true;
                    } else {
                        state.withinAttribute = true;
                    }
                }
                if (txt === "]") {
                    // handle/skip attributes
                    if (state.hasTypeStrAlready()) {
                        state.withinArray = false;
                    } else {
                        state.withinAttribute = false;
                    }
                }
                if (txt === "<") {
                    state.genericsLevel++;
                    state.increaseGenericsCountIfNeeded();
                }
                if (txt === ">") {
                    state.genericsLevel--;
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

    kindStr: string = "";
    typeNameStr: string = "";


    constructor() {
        this.reset();
    }

    public withinGenerics(): boolean {
        return this.genericsLevel > 0;
    }

    public withinSomeScope(): boolean {
        return this.withinArray
            || this.withinAttribute
            || this.withinGenerics()
            ;
    }

    public increaseGenericsCountIfNeeded() {
        if (this.genericsLevel === 1) {
            this.genericsCount++;
        }
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

    public reset() {
        this.withinArray = false;
        this.withinAttribute = false;
        this.genericsLevel = 0;
        this.genericsCount = 0;
        this.kindStr = "";
        this.typeNameStr = "";
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
        //TODO impl
        return "";
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
