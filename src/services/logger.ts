// See https://github.com/microsoft/vscode/blob/main/extensions/typescript-language-features/src/utils/logger.ts

import * as vscode from 'vscode';

enum LogLevel{
	Trace,
	Info,
	Error
}

export class Logger {

	private static readonly output = vscode.window.createOutputChannel('Digma');

	private static data2String(data: any): string {
		if (data instanceof Error) {
			return data.stack || data.message;
		}
		if (data.success === false && data.message) {
			return data.message;
		}
		return data.toString();
	}

	public static info(message: string, data?: any): void {
		this.logLevel(LogLevel.Info, message, data);
	}

	public static error(message: string, data?: any): void {
		// See https://github.com/microsoft/TypeScript/issues/10496
		if (data && data.message === 'No content available.') {
			return;
		}
		this.logLevel(LogLevel.Error, message, data);
	}

	public static logLevel(level: LogLevel, message: string, data?: any): void {

		this.output.appendLine(`[${level}  - ${this.now()}] ${message}`);
		if (data) {
			this.output.appendLine(this.data2String(data));
		}
	}

	private static now(): string {
		const now = new Date();
		return padLeft(now.getUTCHours() + '', 2, '0')
			+ ':' + padLeft(now.getMinutes() + '', 2, '0')
			+ ':' + padLeft(now.getUTCSeconds() + '', 2, '0') + '.' + now.getMilliseconds();
	}
}

function padLeft(s: string, n: number, pad = ' ') {
	return pad.repeat(Math.max(0, n - s.length)) + s;
}