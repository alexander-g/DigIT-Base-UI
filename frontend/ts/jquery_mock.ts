

declare global {
    // deno-lint-ignore no-explicit-any no-var
    var jQuery: (x:string|HTMLElement) => any;
    // deno-lint-ignore no-explicit-any no-var
    var $:      (x:string|HTMLElement) => any;
}

if(globalThis.Deno) {
    globalThis.$ = () => {}
}
