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
