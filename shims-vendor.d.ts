declare module 'comlink' {
  const Comlink: any;
  export default Comlink;
}

declare module 'rfc6902' {
  export function applyPatch(obj: any, patches: any[]): any;
}

declare module '*?url' {
  const url: string;
  export default url;
}
