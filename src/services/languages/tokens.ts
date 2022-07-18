import * as vscode from 'vscode';

export interface Token {
    range: vscode.Range;
    type: TokenType;
    text: string;
    modifiers: string[];
}

export interface TokenMatcher {
    type?: TokenType;
    text?: string;
}

export enum TokenType {
    class = 'class',
    interface = 'interface',
    enum = 'enum',
    enumMember = 'enumMember',
    delegate = 'delegate',
    typeParameter = 'typeParameter',
    function = 'function',
    method = 'method',
    property = 'property',
    variable = 'variable',
    parameter = 'parameter',
    module = 'module',
    intrinsic = 'intrinsic',
    selfParameter = 'selfParameter',
    clsParameter = 'clsParameter',
    magicFunction = 'magicFunction',
    builtinConstant = 'builtinConstant',
    field = 'field',
    operator = 'operator',
    member = 'member',
    punctuation = 'punctuation',
    string = 'string',
    plainKeyword = 'plainKeyword',
    namespace = 'namespace',
    keyword = 'keyword',
    struct = 'struct',
    type = 'type'
}

export function matchTokenSequence(tokens: Token[], matchers: TokenMatcher[]): boolean {
    if(!tokens || !matchers) {
        return false;
    }

    if(tokens.length === 0 && matchers.length === 0) {
        return true;
    }

    if(tokens.length === 0 || matchers.length === 0) {
        return false;
    }

    for(let tokenIndex = 0; tokenIndex < tokens.length - matchers.length; tokenIndex++) {
        let isPartialMatch = true;
        for(let matcherIndex = 0; matcherIndex < matchers.length; matcherIndex++) {
            const token = tokens[tokenIndex + matcherIndex];
            const matcher = matchers[matcherIndex];
            if(!matchToken(token, matcher)) {
                isPartialMatch = false;
                break;
            }
        }
        if(isPartialMatch) {
            return true;
        }
    }

    return false;
}

export function matchToken(token: Token, match: TokenMatcher) {
    if(!token || !match) {
        return false;
    }

    if(token === match) {
        return true;
    }

    if(match.text && match.text !== token.text) {
        return false;
    }

    if(match.type && match.type !== token.type) {
        return false;
    }

    return true;
}
