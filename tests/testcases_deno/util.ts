import { jsdom, mock } from "./dep.ts";
import { set_jQ } from "../../frontend/ts/jquery_mock.ts"



export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(0), ms)
    })
}

export async function setup_jsdom(): Promise<Document> {
    const dom = new jsdom.JSDOM('');
    const document: Document = dom.window.document;
    globalThis.document = document;
    await wait(2);          //NOTE: required with t.step() for some reason
    return document;
}

export function mock_jQ(returnvalue: any): void {
    set_jQ(
        (query: string | HTMLElement) => returnvalue
    )
}

export function mock_fetch( fn: () => Promise<Response> ): mock.Spy {
    const spy: mock.Spy = mock.spy( fn )
    globalThis.fetch = mock.stub(globalThis, 'fetch', spy)
    return spy;
}
