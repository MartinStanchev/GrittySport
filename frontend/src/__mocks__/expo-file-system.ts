export const EncodingType = {
  Base64: 'base64',
  UTF8: 'utf8',
};

export async function readAsStringAsync(_uri: string, _options?: any): Promise<string> {
  return '';
}

export async function writeAsStringAsync(_uri: string, _contents: string, _options?: any): Promise<void> {}

export async function deleteAsync(_uri: string, _options?: any): Promise<void> {}

export const documentDirectory = '/mock/document/';
export const cacheDirectory = '/mock/cache/';

// SDK 54 new-style API
export class File {
  uri: string;
  exists = false;
  private content = '';

  constructor(...uris: any[]) {
    const last = uris[uris.length - 1];
    this.uri = `file:///mock/${typeof last === 'string' ? last : 'file'}`;
  }

  create() { this.exists = true; }
  write(content: string) { this.content = content; }
  delete() { this.exists = false; this.content = ''; }
  text() { return Promise.resolve(this.content); }
}

export class Directory {
  uri: string;
  constructor(...uris: any[]) {
    this.uri = `file:///mock/${uris.map(String).join('/')}/`;
  }
}

export const Paths = {
  cache: new Directory('cache'),
  document: new Directory('document'),
};
