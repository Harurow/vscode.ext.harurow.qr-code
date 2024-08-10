import * as vscode from 'vscode';
import { nls } from './nls';
import validator, { toString } from 'validator';
import path from 'path';
import qrcode from 'qrcode';

// ユーザー設定から取得するフォントに関する情報の型
type UserSettings = {
  fontFamily: string;    // エディタのフォントファミリー。例: 'Courier New', 'Arial'
  fontSize: string;      // エディタのフォントサイズ。例: '14px', '1em'
};

// WebViewのコンテンツ情報を含む型
type ContentInfo = {
  userSettings: UserSettings; // ユーザーのフォント設定
  locale: string;             // ユーザーのロケール
  title: string;              // WebViewのタイトル
  lines: string[];            // ドキュメントの行リスト
};

/**
 * 指定されたドキュメントに基づいてQRコードを表示するWebViewパネルを作成します。
 * 
 * @param document - WebViewパネルを作成するための基となるテキストドキュメント。
 * @returns WebViewパネルのインスタンス。
 */
function createWebViewPanel(document: vscode.TextDocument): vscode.WebviewPanel {
  return vscode.window.createWebviewPanel(
    'Harurow/QR Code View',
    `${path.basename(document.fileName)} - ${nls('msg.info.qr-code-view')}`,
    {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: true,
    }
  );
}

/**
 * VS Codeのユーザー設定からフォント情報を非同期で取得します。
 * 
 * @returns Promiseで、フォントファミリー、フォントサイズ、文字間隔、行間を含むUserSettingsオブジェクト。
 */
async function getUserSettings(): Promise<UserSettings> {
  const config = vscode.workspace.getConfiguration('editor');

  const fontFamily = config.get<string>('fontFamily', 'default-font-family');
  const fontSize = config.get<string>('fontSize', 'default-font-size');

  return {
    fontFamily,
    fontSize,
  };
}

/**
 * WebViewパネルのコンテンツを更新し、指定されたドキュメントの内容を表示します。
 * 
 * @param webViewPanel - コンテンツを更新する対象のWebViewパネル。
 * @param document - WebViewに表示する内容を取得するためのテキストドキュメント。
 * @param userSettings - ユーザーのフォント設定。
 */
function updateWebView(webViewPanel: vscode.WebviewPanel, document: vscode.TextDocument, userSettings: UserSettings): void {
  const documentText = document.getText();

  const lines = documentText
    .split(/\r\n|\r|\n/)
    .filter(line => line.trim().length > 0);

  const content: ContentInfo = {
    userSettings,
    locale: vscode.env.language,
    title: path.basename(document.fileName),
    lines,
  };

  updateHtml(webViewPanel.webview, content);
}

/**
 * WebViewのHTMLコンテンツを更新し、指定された設定を適用します。
 * 
 * @param webView - 更新対象のWebView。
 * @param content - WebViewに表示する内容を含むContentInfoオブジェクト。
 */
async function updateHtml(webView: vscode.Webview, content: ContentInfo): Promise<void> {
  const style = `font-family: ${content.userSettings.fontFamily.replaceAll('"', "'")}; `
              + `font-size: ${content.userSettings.fontSize}px; `
              ;

  let htmlContent = '';

  for (let i = 0; i < content.lines.length; i++) {
    const line = content.lines[i];
    const sanitizedLine = validator.escape(line);

    try {
      const qrcodeDataUrl = await qrcode.toDataURL(line);
      htmlContent += `
        <div style='margin-bottom: 3em;'>
          <h3>${sanitizedLine}</h3>
          <div>
            <img src="${qrcodeDataUrl}" alt="${sanitizedLine}"/>
          </div>
        </div>
      `;
    } catch (err: any) {
      console.error(err);
      htmlContent += `
        <div style='margin-bottom: 3em;'>
          <h3>${sanitizedLine}</h3>
          <div style='color: red;'>${validator.escape(err?.message)}</div>
        </div>
      `;
    }
  }
  
  webView.html = `<!DOCTYPE html>
<html lang="${content.locale}">
<head>
  <meta charset="UTF-8">
  <title>${content.title}</title>
</head>
<body>
  <div style="${style}">
    ${htmlContent}
  </div>
</body>
</html>
`;
}

/**
 * QRコードを表示するWebViewパネルを作成し、ドキュメントの変更に応じて更新を行います。
 * 
 * @param context - 拡張機能のライフサイクルを管理するためのコンテキスト。
 * @param textEditor - 現在のアクティブなテキストエディタ。
 */
export async function createQRCodeView(context: vscode.ExtensionContext, textEditor: vscode.TextEditor): Promise<void> {
  const userSettings = await getUserSettings();
  const document = textEditor.document;

  const qrCodeWebViewPanel = createWebViewPanel(document);
  context.subscriptions.push(qrCodeWebViewPanel);

  const documentChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document === document) {
      console.log('Document has been changed.');
      updateWebView(qrCodeWebViewPanel, document, userSettings);
    }
  });
  context.subscriptions.push(documentChangeListener);

  const webViewDisposeListener = qrCodeWebViewPanel.onDidDispose(() => {
    console.log('WebView panel has been disposed.');
    documentChangeListener.dispose();
  });
  context.subscriptions.push(webViewDisposeListener);

  updateWebView(qrCodeWebViewPanel, document, userSettings);
}
