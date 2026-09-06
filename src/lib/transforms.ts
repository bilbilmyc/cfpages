export type Operation =
  | 'format'
  | 'minify'
  | 'base64-encode'
  | 'base64-decode'
  | 'url-encode'
  | 'url-decode'
  | 'sha256'
  | 'timestamp';
export async function transform(operation: Operation, input: string): Promise<string> {
  switch (operation) {
    case 'format':
    case 'minify': {
      if (!input.trim()) throw Error('请输入 JSON 内容。');
      return JSON.stringify(JSON.parse(input), null, operation === 'format' ? 2 : undefined);
    }
    case 'base64-encode':
      return btoa(
        Array.from(new TextEncoder().encode(input), (byte) => String.fromCharCode(byte)).join(''),
      );
    case 'base64-decode':
      return new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(atob(input.trim()), (c) => c.charCodeAt(0)),
      );
    case 'url-encode':
      return encodeURIComponent(input);
    case 'url-decode':
      return decodeURIComponent(input);
    case 'sha256':
      return Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('');
    case 'timestamp': {
      const s = input.trim();
      let date: Date;
      if (/^-?\d{1,10}$/.test(s)) date = new Date(Number(s) * 1000);
      else if (/^-?\d{13}$/.test(s)) date = new Date(Number(s));
      else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s))
        date = new Date(s);
      else
        throw Error(
          '请输入秒级时间戳、13 位毫秒时间戳，或带时区的 ISO 日期（如 2026-09-06T12:00:00+08:00）。',
        );
      if (Number.isNaN(date.getTime())) throw Error('日期无效，请检查输入。');
      return `UTC：${date.toISOString()}\n本地：${date.toLocaleString()}\n秒：${Math.floor(date.getTime() / 1000)}\n毫秒：${date.getTime()}`;
    }
  }
}
