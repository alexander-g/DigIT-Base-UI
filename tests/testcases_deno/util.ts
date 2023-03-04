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

/** Replace the fetch function with a stub for tests */
export function mock_fetch( fn?: () => Promise<Response> ): mock.Spy {
    const spy: mock.Spy = mock.spy( fn ?? (() => {}) )
    globalThis.fetch = mock.stub(globalThis, 'fetch', spy)
    return spy;
}

/** Replace fetch with one that throws an error to simulate connection failures */
export function mock_fetch_connection_error(msg?:string): mock.Spy {
    return mock_fetch( () => { throw new Error(msg) } )
}

/** Replace fetch with a function that returns a HTTP 404 response */
export function mock_fetch_404(): mock.Spy {
    return mock_fetch(
        async () => await new Response('', {status:404})
    )
}

/** Check if a HTML element is visible  */
export function is_hidden(element: HTMLElement): boolean {
    return (element.style.display == 'none')
}
