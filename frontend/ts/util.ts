export function is_string(x:unknown): x is string {
    return (x instanceof String || typeof x === "string")
}

/** Perform a full copy of an object */
export function deepcopy<T extends Record<string|number, unknown>>(x:T): T {
    return JSON.parse(JSON.stringify(x))
}

/** Send a file to the flask backend */
export function upload_file_no_throw(
    file: File, 
    // deno-lint-ignore no-inferrable-types
    url:  string  = 'file_upload',
): Promise<Response|Error> {
    const data = new FormData()
    data.append('files', file);
    return fetch_no_throw(url, {method: 'POST', body: data})
}

/** fetch() that returns an error if it doesn't succeed (also on 404) */
export async function fetch_no_throw(...x: Parameters<typeof fetch>): Promise<Response|Error> {
    let response: Response;
    try {
        response = await fetch(...x)
    } catch (error) {
        return error;
    }

    if(!response.ok) {
        return new Error(response.statusText)
    }
    return response;
}

/** Construct the url to download an image from the backend, 
 *  optionally with a cachebuster to prevent caching */
export function url_for_image(imagename:string, cachebuster = true): string {
    return `images/${imagename}` + (cachebuster? `?_=${Date.now()}` : '')
}

/** Request image from backend, returning a blob */
export async function fetch_image_as_blob(imagename:string): Promise<Blob|Error> {
    const response:Response|Error = await fetch_no_throw(url_for_image(imagename));
    if(response instanceof Error)
        return response;
    
    const blob:Blob         = await response.blob()
    return blob;
}

/** Request image from backend, returning a blob object url */
export async function fetch_image_as_object_url(imagename:string): Promise<string|Error> {
    const blob:Blob|Error = await fetch_image_as_blob(imagename)
    if(blob instanceof Error)
        return blob;
    
    return URL.createObjectURL(blob)
}


/** `JSON.parse` but returns an error instead of throwing it  */
export function parse_json_no_throw(x:string): unknown|Error {
    let raw:unknown;
    try {
        raw = JSON.parse(x)
    } catch (error: unknown) {
        return (error as Error);
    }
    return raw;
}

export async function parse_json_response(response:Response): Promise<unknown|Error> {
    return parse_json_no_throw(await response.text())
}



export type Point = {
    x:number, 
    y:number
};

export type Vector = Point;

export type Size = {
    width:  number;
    height: number;
}

export type ImageSize = Size;


/** Compute the euclidean length of a vector */
export function vector_length(v:Vector): number {
    return Math.sqrt(v.x**2 + v.y**2);
}

/** Normalize input vector `v` to have length `1.0` */
export function normalize_vector(v:Vector): Vector {
    const length:number = vector_length(v)
    return {
        x: v.x/length,
        y: v.y/length,
    }
}

/** Compute the direction vector from point `p0` to `p1` */
export function direction_vector(p0:Point, p1:Point): Vector {
    return {x:p1.x-p0.x, y:p1.y-p0.y}
}

/** Compute the vector orthogonal to `v` */
export function orthogonal_vector(v:Vector): Vector {
    return {x:v.y, y:-v.x}
}



export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve: (x:unknown) => void) => {
        setTimeout(() => resolve(0), ms)
    })
}


/** Recursive Partial<T>. Makes all members of T optional including children */
export type DeepPartial<T> = T extends Record<string, unknown> ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;


/**
 * Remove the file extension from a given file name.
 * @param fileName The name of the file to remove the extension from.
 * @returns The file name without its extension.
 */
export function remove_file_extension(filename: string): string {
    const last_dot:number   = filename.lastIndexOf(".");
    if (last_dot === -1) {
        // The file name doesn't have an extension.
        return filename;
    } else {
        return filename.slice(0, last_dot);
    }
}

/** Return the base name of a file given its path. */
export function file_basename(filename:string): string {
    return filename.slice(filename.lastIndexOf('/')+1)
}


/** Check if the input has a property with name @param `key` 
 * @returns A boolean indicating whether the object has the property or not
*/
export function has_property<K extends string, T extends Record<never, unknown>>(
    x:      T, 
    key:    K
): x is T & Record<K, unknown> {
    return (key in x)
}
/** Check if the input has a property with name @param `key` and it matches a specific type 
 *  @param validate_fn - The function used to validate the property value
*/
export function has_property_of_type<K extends string, T extends Record<never, unknown>, P>(
    x:              T, 
    key:            K,
    validate_fn:    (x:unknown) => P | null
): x is T & Record<K, P> {
    return has_property(x, key) && (validate_fn(x[key]) != null)
}

/** Validate if the input is a string. @returns either the string or null */
export function validate_string(x:unknown): string | null {
    if(is_string(x)){
        return x;
    }
    else return null;
}

/** Validate if the input is a number. @returns either the number or null */
export function validate_number(x: unknown): number|null {
    return (typeof x == "number") ? x : null;
}

/** Validate if the input is a boolean. @returns either the number or null */
export function validate_boolean(x: unknown): boolean|null {
    return (typeof x == 'boolean') ? x : null;
}

/** Check if the input has a property with name @param `key` and it is a string */
export function has_string_property<K extends string, T extends Record<never, unknown>>(
    x:      T, 
    key:    K
): x is T & Record<K, string>  {
    return has_property_of_type(x, key, validate_string)
}

/** Check if the input has a property with name @param `key` and it is a number */
export function has_number_property<K extends string, T extends Record<never, unknown>>(
    x:      T, 
    key:    K
): x is T & Record<K, number>  {
    return has_property_of_type(x, key, validate_number)
}

/** Check if the input has a property with name @param `key` and it is a boolean */
export function has_boolean_property<K extends string, T extends Record<never, unknown>>(
    x:      T,
    key:    K,
): x is T & Record<K, boolean> {
    return has_property_of_type(x, key, validate_boolean)
}

/** Type guard converting to an empty object.
 *  
 *  NOTE: Using `Record<never, unknown>` for more type safety. */
export function is_object(x:unknown): x is Record<never, unknown> {
    return (typeof x === 'object') && (x !== null) && !Array.isArray(x)
}

/** Validates if the unknown input is an array of a specific type
 *  @param x unknown   - input to be validated
 *  @param validate_fn - function that takes an unknown input and returns either the same object if it is of the specified type or null otherwise
 *  @returns           - type guard that returns true if x is an array of T objects
 */
export function is_array_of_type<T>(
    x:              unknown,
    validate_fn:    (x: unknown) => T | null
): x is T[] {
    if (!Array.isArray(x)) {
        return false;
    }
    return x.every( (x:unknown) => validate_fn(x) != null)
}

export function is_number_array(x: unknown): x is number[] {
    return is_array_of_type(x, validate_number)
}

export function validate_number_array(x: unknown): number[]|null {
    if(is_number_array(x))
        return x;
    else return null;
}

export function validate_string_array(x: unknown): string[]|null {
    if(is_array_of_type(x, validate_string)){
        return x
    }
    else return null;
}

export function validate_file(x:unknown): File|null {
    return (x instanceof File) ? x : null;
}

export function validate_imagesize(x:unknown): ImageSize|null {
    if(is_object(x)
    && has_number_property(x, 'width')
    && has_number_property(x, 'height')){
        return x;
    }
    else return null;
}




/** From https://github.com/sindresorhus/type-fest/blob/5374588a88ee643893784f66367bc26b8e6509ec/source/basic.d.ts (Importing doesnt work for some reason) */
// deno-lint-ignore no-explicit-any
export type Constructor<T, Arguments extends unknown[] = any[]>
    = new(...arguments_: Arguments) => T;

// deno-lint-ignore no-explicit-any
export type Class<T, Arguments extends unknown[] = any[]> = Constructor<T, Arguments> & {prototype: T};


export type HasValidate<R> = {validate: (raw:unknown) => R|null|Promise<R|null>}

// deno-lint-ignore no-explicit-any
export type ClassWithValidate<R, Arguments extends unknown[] = any[]> 
    = Class<R, Arguments> & HasValidate<R>


export function is_browser(): boolean {
    return (typeof document == 'object')
}

export function is_deno(): boolean {
    return !is_browser()
}
