import { ParameterInfo } from "../documentInfoProvider";
import { IParametersExtractor } from "./extractors";
import { Token, TokenType } from "./tokens";


export class BasicParametersExtractor implements IParametersExtractor {
    
    public needToAddParametersToCodeObjectId(): boolean {
        return false;
    }

    public async extractParameters(methodName: string, methodTokens: Token[]): Promise<ParameterInfo[]> {
        const params: ParameterInfo[] = [];

        for (const token of methodTokens) {
            const name = token.text;// document.getText(token.range);
            if (token.type === TokenType.parameter) {
                if (params.some(p => p.name === name)) {
                    continue;
                }

                params.push({ name, range: token.range, token, type: "unknown" });
            }
        }
        return params;
    }
}
