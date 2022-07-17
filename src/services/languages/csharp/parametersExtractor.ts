import { integer } from "vscode-languageclient";
import { ParameterInfo } from '../../documentInfoProvider';
import { IParametersExtractor } from "../extractors";
import { Token, TokenType } from '../tokens';


export class CSharpParametersExtractor implements IParametersExtractor {

    public async extractParameters(methodTokens: Token[]): Promise<ParameterInfo[]> {
        var params: ParameterInfo[] = new Array();

        var firstParameter: boolean = true;
        var parameterStartIx: integer = -1;

        for (let ix = 0; ix < methodTokens.length; ix++) {
            let token = methodTokens[ix];
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
        //TODO: impl
        return new Array();
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
            if (token.type === TokenType.plainKeyword) {
                state.addPlainKeyword(txt);
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
                    }
                }
                if (txt === "]") {
                    // handle/skip attributes
                    if (state.hasTypeStrAlready()) {
                        state.withinArray = false;
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
    genericsLevel: integer = 0;
    genericsCount: integer = 0;

    kindStr: string = "";
    typeNameStr: string = "";


    constructor() {
        this.reset();
    }

    public withinGenerics(): boolean {
        return this.genericsCount > 0;
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
        if (this.typeNameStr === "") {
            this.kindStr = this.typeNameStr;
        }
        this.typeNameStr = value;
    }

    public reset() {
        this.withinArray = false;
        this.genericsLevel = 0;
        this.genericsCount = 0;
        this.kindStr = "";
        this.typeNameStr = "";
    }

    public evalType(): string {
        //TODO: real impl
        return this.typeNameStr;
    }
}
