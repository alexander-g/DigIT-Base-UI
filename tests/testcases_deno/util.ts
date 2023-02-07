import { jsdom } from "./dep.ts";

export function setup_jsdom(): Document {
  const dom = new jsdom.JSDOM('');
  const document: Document = dom.window.document;
  globalThis.document = document;
  return document;
}

export function wait(ms:number): Promise<unknown> {
  return new Promise( (resolve) =>{
    setTimeout( () => {
        resolve(0)
    }, ms )
  } )
}
