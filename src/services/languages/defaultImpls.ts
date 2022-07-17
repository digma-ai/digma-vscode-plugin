import { ParameterInfo } from "../documentInfoProvider";
import { IParametersExtractor } from "./extractors";
import { Token, TokenType } from "./tokens";


export class BasicParametersExtractor implements IParametersExtractor {

    public async extractParameters(methodTokens: Token[]): Promise<ParameterInfo[]> {
        var params: ParameterInfo[] = new Array();

        for (let token of methodTokens) {
            const name = token.text;// document.getText(token.range);
            if (token.type === TokenType.parameter) {
                if (params.any(p => p.name === name)) {
                    continue;
                }

                params.push({ name, range: token.range, token, type: "unknown" });
            }
        }
        return params;
    }
}
