// deno-lint-ignore no-explicit-any
export function is_string(x:any): boolean {
    return (x instanceof String || typeof x === "string")
}

/** Send a file to the flask backend */
export function upload_file(
    file        :   File, 
    error_fn    :   () => void,
    // deno-lint-ignore no-inferrable-types
    url         :   string  = '/file_upload',
): Promise<Response> {
    const data = new FormData()
    data.append('files', file);

    return fetch_with_error([url, {method: 'POST', body: data}], error_fn)
}

/** fetch() that calls an error callback */
export async function fetch_with_error(
    x:          Parameters<typeof fetch>, 
    error_fn:   () => void,
): Promise<Response> {
    let response:Response;
    try {
        response = await fetch(...x)
    } catch (error) {
        error_fn()
        throw(error)
    }

    if(!response.ok) {
        error_fn()
        throw( new Error() )
    }
    return response;
}

/** Construct the url to download an image from the backend, 
 *  optionally with a cachebuster to prevent caching */
export function url_for_image(imagename:string, cachebuster = true): string {
    return `/images/${imagename}` + (cachebuster? `?_=${Date.now()}` : '')
}