
// deno-lint-ignore no-explicit-any
type jQueryMock = (x:string|HTMLElement) => any;

declare global {
    // deno-lint-ignore no-var
    var jQuery: jQueryMock;
    // deno-lint-ignore no-var
    var $:      jQueryMock;
}

export function set_jQ(x:jQueryMock) {
    globalThis.$      = x;
    globalThis.jQuery = x
}

if(globalThis.Deno) {
    set_jQ( () => {} )
}
