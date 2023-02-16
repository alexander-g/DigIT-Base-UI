// deno-lint-ignore no-explicit-any
export function is_string(x:any): boolean {
    return (x instanceof String || typeof x === "string")
}

/** Send a file to the flask backend */
// deno-lint-ignore no-inferrable-types
export function upload_file(file:File, url:string = '/file_upload'): Promise<Response> {
    const data = new FormData()
    data.append('files', file);

    return fetch(url, {
        method: 'POST',
        body:   data,
    })
}

