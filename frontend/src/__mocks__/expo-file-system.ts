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
  bytes() { return Promise.resolve(new TextEncoder().encode(this.content)); }
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
