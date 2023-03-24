export function is_string(x:unknown): x is string {
    return (x instanceof String || typeof x === "string")
}

/** Perform a full copy of an object */
export function deepcopy<T extends Record<string|number, unknown>>(x:T): T {
    return JSON.parse(JSON.stringify(x))
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
        throw( new Error(response.statusText) )
    }
    return response;
}

/** Construct the url to download an image from the backend, 
 *  optionally with a cachebuster to prevent caching */
export function url_for_image(imagename:string, cachebuster = true): string {
    return `/images/${imagename}` + (cachebuster? `?_=${Date.now()}` : '')
}
  


export type Point = {
    x:number, 
    y:number
};

export type Size = {
    width:  number;
    height: number;
}

export type ImageSize = Size;


export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve: (x:unknown) => void) => {
        setTimeout(() => resolve(0), ms)
    })
}


/** Recursive Partial<T>. Makes all members of T optional including children */
export type DeepPartial<T> = T extends Record<string, unknown> ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

