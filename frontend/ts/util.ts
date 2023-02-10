// deno-lint-ignore no-explicit-any
export function is_string(x:any): boolean{
    return (x instanceof String || typeof x === "string")
}