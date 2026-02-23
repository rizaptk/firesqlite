declare module 'comlink' {
  const Comlink: any;
  export = Comlink;
}

declare module 'rfc6902' {
  export function applyPatch(obj: any, patches: any[]): any;
}

declare module '*?url' {
  const url: string;
  export default url;
}
