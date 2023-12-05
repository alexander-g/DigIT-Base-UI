//@deno-types="https://esm.sh/v135/onnxruntime-common@1.16.3/dist/esm/index.d.ts"
import ort from "https://esm.run/onnxruntime-web@1.16.3"

import * as util from "../util.ts"

const ORT_VERSION:string = ort.env.versions.common

const WASM_PATH = new URL(
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
)
const WASM_URL = new URL(
    `ort-wasm-simd.wasm`, WASM_PATH
)
const ASSET_DIR = './assets'


function check_permissions(): true|Error {
    if(!util.is_deno())
        return true;
    
    if(
        Deno.permissions.querySync({name:"net", host:WASM_URL.host}).state != 'granted'
     || Deno.permissions.querySync({name:"write", path:ASSET_DIR}).state != 'granted'
     || Deno.permissions.querySync({name:"read",  path:ASSET_DIR}).state != 'granted'
    ){
        return new Error(
            `Required permissions:\n`
            +`--allow-net=${WASM_URL.host}`
            +`--allow-read=${ASSET_DIR}`
            +`--allow-write=${ASSET_DIR}`
        );
    }
    else return true;
}


/** Replace the original fetch with a cached version for requests that match `pattern` */
function monkeypatch_fetch(pattern:RegExp) {
    const _original_fetch: typeof fetch = self.fetch;

    self.fetch = async function(
        ...x: Parameters<typeof fetch>
    ): ReturnType<typeof fetch>{
        const request: RequestInfo|URL = x[0]
        let url_string:string;
        if(request instanceof URL){
            url_string = request.href
        } else if(request instanceof Request){
            url_string = request.url
        } else {
            url_string = request;
        }
    
        if(pattern.test(url_string)){
            const cache:Cache = await caches.open("default")
            const response:Response|undefined = await cache.match(request)
            if(response != undefined){
                return response;
            }
            else {
                const response:Response = await _original_fetch(...x)
                await cache.put(request, response)
                return response
            }
        }
        else return _original_fetch(...x)
    }
}

function set_ort_env(wasmpath:string): true|Error {
    //NOTE: threaded wasm currently doesnt work. fix it to single-threaded
    ort.env.wasm.numThreads = 1;

    ort.env.wasm.wasmPaths = wasmpath;
    //TODO: do this only once?
    monkeypatch_fetch(new RegExp('^'+wasmpath))

    return true;
}


async function load_file(path:string): Promise<ArrayBuffer|Error> {
    if(util.is_deno()){
        try{
            return Deno.readFileSync(path).buffer
        }
        catch(error) {
            return error; 
        }
    } else {
        const response: Response|Error = await util.fetch_no_throw(path)
        if(response instanceof Error){
            return response as Error;
        }
        return await response.arrayBuffer()
    }
}


export class Session {
    #ortsession: ort.InferenceSession;

    constructor(ortsession:ort.InferenceSession) {
        this.#ortsession = ortsession;
    }

    /** Factory function returning a new {@link Session} instance or `Error`.*/
    static async initialize(modelpath:string): Promise<Session|Error> {
        let status:true|Error = check_permissions()
        if(status instanceof Error)
            return status as Error;

        status = set_ort_env(WASM_PATH.href)
        if(status instanceof Error)
            return status as Error;
        
        try{
            const onnx_bytes: ArrayBuffer|Error = await load_file(modelpath);
            if(onnx_bytes instanceof Error){
                return onnx_bytes as Error;
            }
            const options:ort.InferenceSession.SessionOptions = {
                executionProviders:['wasm'],
            }
            const ortsession:ort.InferenceSession 
                = await ort.InferenceSession.create(onnx_bytes, options)
            return new Session(ortsession)
        } catch(error) {
            return error;
        }
    }

    async process_image_from_path(imagepath:string): Promise<unknown> {
        return new Error('Not Implemented')
    }

    async process_image_from_blob(blob:Blob): Promise<unknown> {
        return new Error('Not Implemented')
    }
}

