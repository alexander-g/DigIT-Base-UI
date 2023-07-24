import { fflate } from "../dep.ts";


/** Compress multiple files into a single zip archive.
 *  @param data - Key-value pairs with keys the paths inside the resulting 
 *  archive and value is the file itself.
 * 
 *  @returns Promise that resolves with the compressed data as a Uint8Array. */
export async function zip_files(data:Record<string, File>): Promise<Uint8Array> {
    const uint8_data: fflate.Zippable = {};
    for(const [path, file] of Object.entries(data)) {
        uint8_data[path] = new Uint8Array(await file.arrayBuffer())
    }

    const promise = new Promise<Uint8Array>(
        (resolve:(x:Uint8Array) => void, reject: () => void) => {
            fflate.zip(uint8_data, (error: fflate.FlateError|null, data:Uint8Array) => {
                if(error){
                    reject()
                } else {
                    resolve(data)
                }
            })
        }
    )
    return promise;
}
