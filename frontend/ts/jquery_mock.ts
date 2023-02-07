
type jQueryMock = (x:string|HTMLElement) => any;

declare global {
    var jQuery: jQueryMock;
    var $:      jQueryMock;
}

export function set_jQ(x:jQueryMock) {
    globalThis.$      = x;
    globalThis.jQuery = x
}

if(globalThis.Deno) {
    set_jQ( () => {} )
}
