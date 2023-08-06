import { fflate } from "../dep.ts";


/** Compress multiple files into a single zip archive.
 *  @param data - Key-value pairs with keys the paths inside the resulting 
 *  archive and value is the file itself.
 *  @param filename - Name for the output zip archive
 * 
 *  @returns Promise that resolves with the zip archive file object or an error. */
export function zip_files(data:Record<string, File>, filename:string): Promise<File|Error> {

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
            const zippath = new fflate.ZipPassThrough(path);
            zip.add(zippath);
            zippath.push(
                new Uint8Array( await file.arrayBuffer() ), true
            );
        }
        zip.end()
    })
    return promise;
}
