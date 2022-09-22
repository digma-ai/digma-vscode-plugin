import { Position } from 'vscode';
import { MethodInfo } from '../../documentInfoProvider';
import { IMethodPositionSelector } from '../methodPositionSelector';

export class JSMethodPositionSelector implements IMethodPositionSelector {
    filter(position: Position, methods: MethodInfo[]): MethodInfo | undefined {
        const candidates = methods.filter(method => method.range.contains(position));
        if (candidates.length === 0) {
            return undefined;
        }

        const method = candidates.reduce(
            (nearest, current) => current.range.start.isAfterOrEqual(nearest.range.start)
                ? current
                : nearest
        );
        return method;
    }
}
