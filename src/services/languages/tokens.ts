import * as vscode from 'vscode';

export interface Token {
    range: vscode.Range;
    type: TokenType;
    text: string;
    modifiers: string[];
}

export enum TokenType {
    class = 'class',
    interface = 'interface',
    enum = 'enum',
    enumMember = 'enumMember',
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
    namespace = 'namespace'
}
