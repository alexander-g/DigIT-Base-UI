import { fflate } from "../dep.ts";


export type Files = Record<string, File>

/** Compress multiple files into a single zip archive.
 *  @param data - Key-value pairs with keys the paths inside the resulting 
 *  archive and value is the file itself.
 *  @param filename - Name for the output zip archive
 *  @param compress - Whether or not to compress the data with DEFLATE. (Default: false)
 * 
 *  @returns Promise that resolves with the zip archive file object or an error. */
export function zip_files(
    data:     Files, 
    filename: string, 
    // deno-lint-ignore no-inferrable-types
    compress: boolean = false
): Promise<File|Error> {

    // deno-lint-ignore no-async-promise-executor
    const promise = new Promise<File|Error>( async (resolve:(x:File|Error) => void) => {
        const chunks: Uint8Array[] = []

        /** Called from `fflate` when a chunk is ready */
        const progress_cb:fflate.AsyncFlateStreamHandler = 
            (error: fflate.FlateError|null, chunk:Uint8Array, final:boolean) => {
                if(error) {
                    resolve(error)
                } else {
                    chunks.push(chunk)
                    if(final)
                        resolve(new File(chunks, filename))
                }
            }
        
        const zip = new fflate.Zip(progress_cb)
        for(const [path, file] of Object.entries(data)) {
            const zipstream: fflate.ZipPassThrough|fflate.ZipDeflate 
                = compress? 
                    new fflate.ZipDeflate(path, {level:9}) 
                    : new fflate.ZipPassThrough(path);
            zip.add(zipstream);
            zipstream.push(
                new Uint8Array( await file.arrayBuffer() ), true
            );
        }
        zip.end()
    })
    return promise;
}



export async function unzip(data:Blob|Uint8Array): Promise<Files|Error> {
    if(data instanceof Blob)
        data = new Uint8Array( await data.arrayBuffer() )
    
    let unzipped:fflate.Unzipped;
    try {
        unzipped = fflate.unzipSync(data)
    } catch (error) {
        return error;
    }
    const files:Files = {}
    for(const [path, data] of Object.entries(unzipped)) {
        files[path] = new File([data], path)
    }
    return files;
}
