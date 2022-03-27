
declare var acquireVsCodeApi: any;
export const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
    window.addEventListener('message', event => {

        const message = <IMessage>event.data; // The JSON data our extension sent
        
        for(let consumer of consumers){
            if(message.type === consumer.messageType){
                consumer.handler(message.data);
            }
        }
    });
}

export type MessageReceivedHandler<T> = (n: T) => any;

export interface IMessage{
    type: string;
    data: any;
}

export interface IConsumer{
    messageType: string;
    handler: MessageReceivedHandler<any>;
    volatile: boolean;
}

const consumers: IConsumer[] = [];

export function consume<T>(type: { new(): T ;}, handler: MessageReceivedHandler<T>)
{
    consumers.push({
        messageType: type.name,
        handler: handler,
        volatile: false
    });
}

export function publish<T extends object>(message: T)
{
    vscode.postMessage(<IMessage>{
        type: message.constructor.name,
        data: message
    });
}
