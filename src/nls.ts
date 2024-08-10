import * as vscode from 'vscode';
import nlsEn from '../package.nls.json';
import nlsJa from '../package.nls.ja.json';

export type nlsKeyType = keyof typeof nlsEn;

interface nlsEntry {
  [key: string]: string;
}

const locale = vscode.env.language;
const localeTable = Object.assign(nlsEn, ((<{ [key: string]: nlsEntry }>{
  ja: nlsJa
})[locale] || {}));

export const nls = (key: string): string => localeTable[key] || key;
