import { CodeObjectInfo, ICodeObjectIdParser } from './../../codeObject';

export class JSCodeObjectInfo implements CodeObjectInfo {    
    constructor(
        public id: string,
        public packageName: string,
        public modulePath: string,
        public symbol: string,
    ) {
    }

    get displayName(): string {
        return this.symbol || '';
    }

    get ids(): string[] {
        return [this.id];
    }

    get idsWithType(): string[] {
        return this.ids;
    }
}

export class JSCodeObjectIdParser implements ICodeObjectIdParser {
    parse(codeObjectId: string): JSCodeObjectInfo {
        const pattern = /([\w@/-]+):(.+)\$_\$(.*)/;
        const matches = codeObjectId.match(pattern);
        const [ , packageName, modulePath, symbol ] = matches ?? ['', '', '', ''];
        return new JSCodeObjectInfo(
            codeObjectId,
            packageName,
            modulePath,
            symbol,
        );
    }
}
