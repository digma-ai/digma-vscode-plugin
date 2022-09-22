import { Position } from 'vscode';
import { MethodInfo } from '../documentInfoProvider';

export interface IMethodPositionSelector {
    filter(position: Position, methods: MethodInfo[]): MethodInfo | undefined;
}

export class DefaultMethodPositionSelector implements IMethodPositionSelector {
    filter(position: Position, methods: MethodInfo[]): MethodInfo | undefined {
        return methods.firstOrDefault((m) => m.range.contains(position));
    }
}
