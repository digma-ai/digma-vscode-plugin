import * as vscode from "vscode";
import { AnalyticsProvider } from "./analyticsProvider";
import { DocumentInfoProvider, MethodInfo } from "./documentInfoProvider";
import {
  CodeObjectLocationInfo,
  EndpointInfo,
  IParametersExtractor,
  ISymbolAliasExtractor,
  ServerDiscoveredSpan,
  SpanLocationInfo,
  SymbolInfo
} from "./languages/extractors";
import { SymbolProvider } from "./languages/symbolProvider";
import { Token, TokenType } from "./languages/tokens";

type DocumentCacheInfo = {
  uri: vscode.Uri;
  tokens: Token[],
  symbolInfos: SymbolInfo[],
  endpoints: EndpointInfo[],
  spans: SpanLocationInfo[];
  paramsExtractor: IParametersExtractor,
  symbolAliasExtractor: ISymbolAliasExtractor,
  methodInfos: MethodInfo[];
};

const isPromiseFulfilled = <T>(
  result: PromiseSettledResult<T>
): result is PromiseFulfilledResult<T> => result.status === "fulfilled";

const getValuesOfFulfilledPromises = <T>(
  promiseResults: PromiseSettledResult<T>[]
): T[] => promiseResults.filter(isPromiseFulfilled).map((item) => item.value);

export class DocumentInfoCache {
  static batchSize = 10;
  static statusBarPriority = 10000;
  static supportedFileExtensions = [
    // JavaScript
    "js",
    "jsx",
    "cjs",
    "mjs"
  ];
  static commonExcludedFolders = [
    "bower_components",
    "node_modules"
  ];
  
  private _fileSystemWatcher: vscode.FileSystemWatcher;
  private _documentInfoProvider: DocumentInfoProvider;
  private _symbolProvider: SymbolProvider;
  private _serverDiscoveredSpans: ServerDiscoveredSpan[];
  private documents: Record<string, DocumentCacheInfo>;

  constructor(
    documentInfoProvider: DocumentInfoProvider,
    symbolProvider: SymbolProvider,
    analyticsProvider: AnalyticsProvider,
    serverDiscoveredSpans: ServerDiscoveredSpan[]
  ) {
    this._documentInfoProvider = documentInfoProvider;
    this._symbolProvider = symbolProvider;
    this._serverDiscoveredSpans = serverDiscoveredSpans;
    this.documents = {};

    // Create file watcher for all files in workspace
    this._fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      `**/*.{${DocumentInfoCache.supportedFileExtensions.join(",")}}`
    );

    // Scan file on its creation
    this._fileSystemWatcher.onDidCreate(async (uri) => {
      try {
        if (this.isInsideExcludedFolder(uri)) {
          return;
        }
        const doc = await vscode.workspace.openTextDocument(uri);
        if (doc && symbolProvider.supportsDocument(doc)) {
          const docInfo = await this.getDocumentInfo(doc);
          this.documents[uri.toModulePath()] = docInfo;
        }
      } catch (e) {
        console.error("Unable to get document info on file create");
        console.error(e);
      }
    });

    // Scan file on its change
    this._fileSystemWatcher.onDidChange(async (uri) => {
      try {
        if (this.isInsideExcludedFolder(uri)) {
          return;
        }
        const doc = await vscode.workspace.openTextDocument(uri);
        if (doc && symbolProvider.supportsDocument(doc)) {
          const docInfo = await this.getDocumentInfo(doc);
          this.documents[uri.toModulePath()] = docInfo;
        }
      } catch (e) {
        console.error("Unable to get document info on file change");
        console.error(e);
      }
    });

    // Delete file from cache on its deletion
    this._fileSystemWatcher.onDidDelete((uri) => {
      delete this.documents[uri.toModulePath()];
    });

    // Scan document on opening of the new editor
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      void Promise.allSettled(
        editors.map(async (editor) => {
          const document = editor.document;
          const filePath = document.uri.toModulePath();
          if (
            !this.documents[filePath] &&
            this.hasSupportedFileExtension(document.uri) &&
            !this.isInsideExcludedFolder(document.uri) &&
            symbolProvider.supportsDocument(document)
          ) {
            const docInfo = await this.getDocumentInfo(document);
            this.documents[filePath] = docInfo;
          }
        })
      );
    });

    this.init();
  }

  private isInsideExcludedFolder(uri: vscode.Uri): boolean {
   return DocumentInfoCache.commonExcludedFolders.some(
      folderName => uri.fsPath.includes(`${folderName}/`)
    );
   
  }

  private hasSupportedFileExtension(uri: vscode.Uri): boolean {
    return DocumentInfoCache.supportedFileExtensions.some(
      extension => uri.fsPath.endsWith(`.${extension}`)
    );
  }

  private async init() {
    console.log("spans from server");
    console.log(this._serverDiscoveredSpans);

    await this.scanOpenedDocuments();
    
    void this.scanFilesInBackground();
  }

  private async scanOpenedDocuments() {
    const docInfosPromises = vscode.workspace.textDocuments
      .filter((doc) =>
        this.hasSupportedFileExtension(doc.uri) &&
        !this.isInsideExcludedFolder(doc.uri) &&
        this._symbolProvider.supportsDocument(doc)
      )
      .map((doc) => this.getDocumentInfo(doc));

    const docInfosPromisesResults = await Promise.allSettled(docInfosPromises);
    const docInfos = getValuesOfFulfilledPromises(docInfosPromisesResults);

    docInfos.forEach((docInfo) => {
      const filePath = docInfo.uri.toModulePath();
      this.documents[filePath] = docInfo;
    });
  }

  private async scanFilesInBackground() {
    const includePatter = `**/*.{${DocumentInfoCache.supportedFileExtensions.join(",")}}`;
    const excludePattern = `**/{${DocumentInfoCache.commonExcludedFolders.join(",")}}/**`;

    let files: vscode.Uri[] = [];
    try {
      files = await vscode.workspace.findFiles(includePatter, excludePattern);
    } catch (e) {
      console.error("Failed to find files");
      console.error(e);
    }

    const statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      DocumentInfoCache.statusBarPriority,
    );
    statusBar.text = "$(sync~spin) Scanning files for spans";
    statusBar.show();

    while (files.length) {
      const filesToScan = files
        .splice(0, DocumentInfoCache.batchSize)
        .filter((uri) => !this.documents[uri.fsPath]);
      
      const docPromises = filesToScan.map((file) =>
        vscode.workspace.openTextDocument(file)
      );
      const docsPromisesResults = await Promise.allSettled(docPromises);
      const docs = getValuesOfFulfilledPromises(docsPromisesResults)
        .filter((doc) =>
          this._symbolProvider.supportsDocument(doc)
        );
      
      const docInfosResults = await Promise.allSettled(
        docs.map((doc) => this.getDocumentInfo(doc))
      );
      const docInfos = getValuesOfFulfilledPromises(docInfosResults);

      docInfos.forEach((docInfo) => {
        const filePath = docInfo.uri.toModulePath();
        this.documents[filePath] = docInfo;
      });
    }

    statusBar.hide();
  }

  public async getDocumentCachedInfo(doc: vscode.TextDocument): Promise<DocumentCacheInfo> {
    const filePath = doc.uri.toModulePath();
    let cachedInfo = this.documents[filePath];

    if (!cachedInfo) {
      cachedInfo = await this.getDocumentInfo(doc);
      this.documents[filePath] = cachedInfo;
    }

    return this.documents[filePath];
  }

  private async getDocumentInfo(
    doc: vscode.TextDocument
  ): Promise<DocumentCacheInfo> {
    const [symbolTrees, tokens] = await Promise.all([
      this._symbolProvider.getSymbolTree(doc),
      this._symbolProvider.getTokens(doc)
    ]);
    const symbolInfos = await this._symbolProvider.getMethods(
      doc,
      tokens,
      symbolTrees
    );
    const spans = await this._symbolProvider.getSpans(doc, symbolInfos, tokens, this._serverDiscoveredSpans);
    const [endpoints, paramsExtractor, symbolAliasExtractor] =
      await Promise.all([
        this._symbolProvider.getEndpoints(
          doc,
          symbolInfos,
          tokens,
          symbolTrees
        ),
        this._symbolProvider.getParametersExtractor(doc),
        this._symbolProvider.getSymbolAliasExtractor(doc)
      ]);

    const methodInfos = await this.createMethodInfos(
      doc,
      paramsExtractor,
      symbolAliasExtractor,
      symbolInfos,
      tokens,
      spans,
      endpoints
    );

    return {
      uri: doc.uri,
      tokens,
      symbolInfos,
      endpoints,
      spans,
      paramsExtractor,
      symbolAliasExtractor,
      methodInfos,
    };
  }

  private async createMethodInfos(
    document: vscode.TextDocument,
    parametersExtractor: IParametersExtractor,
    symbolAliasExtractor: ISymbolAliasExtractor,
    symbols: SymbolInfo[],
    tokens: Token[],
    spans: SpanLocationInfo[],
    endpoints: EndpointInfo[]
  ): Promise<MethodInfo[]> {
    const methods: MethodInfo[] = [];
    for (const symbol of symbols) {
      const aliases = symbolAliasExtractor.extractAliases(symbol);
      const method = new MethodInfo(
        symbol.id,
        symbol.name,
        undefined,
        symbol.displayName,
        symbol.range,
        [],
        symbol,
        aliases,
        ([] as CodeObjectLocationInfo[])
          .concat(spans.filter((s) => s.range.intersection(symbol.range)))
          .concat(endpoints.filter((e) => e.range.intersection(symbol.range))),
        document.uri
      );
      methods.push(method);

      const methodTokens = tokens.filter((t) =>
        symbol.range.contains(t.range.start)
      );
      for (const token of methodTokens) {
        const name = token.text; // document.getText(token.range);

        if (
          (token.type === TokenType.method ||
            token.type === TokenType.function ||
            token.type === TokenType.member) &&
          !method.nameRange &&
          name === symbol.name
        ) {
          method.nameRange = token.range;
        }
      }
      method.parameters = await parametersExtractor.extractParameters(
        symbol.name,
        methodTokens
      );

      if (parametersExtractor.needToAddParametersToCodeObjectId()) {
        this.modifyMethodCodeObjectId(method);
      }
    }

    return methods;
  }

  private modifyMethodCodeObjectId(method: MethodInfo) {
    if (method.id.endsWith(")")) {
      return;
    }

    if (method.parameters.length > 0) {
      const argsPart: string =
        "(" + method.parameters.map((x) => x.type).join(",") + ")";

      const newId = method.id + argsPart;
      method.id = newId;
      method.symbol.id = newId;
    }
  }
}
