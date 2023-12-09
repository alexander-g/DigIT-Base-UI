//@deno-types="https://esm.sh/v135/onnxruntime-common@1.16.3/dist/esm/index.d.ts"
import ort from "https://esm.run/onnxruntime-web@1.16.3"

import * as zip  from "./zip.ts"
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


/** Load a file from disk (in deno) or fetch it from server (in browser) */
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

/** Supported dtypes */
type DType = 'uint8' | 'float32' | 'int64'
type DTypeArray = Uint8Array | Float32Array | BigInt64Array;

type StateDict = Record<string, ort.Tensor>

export type PT_ZIP = {
    onnx_bytes: Uint8Array;
    state_dict: StateDict;
}

/** Internal description of a input feed tensor. Stored in a .schema.json */
type SchemaItem = {
    shape: number[];
    dtype: DType;
    /** Path within the zip file to the file containing the weights.
     *  If not defined, then this is a model input (e.g. image) */
    path?: string;
}


/** Make sure the input is one of the supported dtype identifiers */
function validate_dtype(x:unknown): DType|null {
    if(util.is_string(x) 
    && ((x == 'uint8') || ( x == 'float32') || (x == 'int64')) ) {
        return x;
    }
    else return null;
}

/** Convert a buffer to a typed array or create a new one */
function to_dtype_array(x:ArrayBuffer|number, dtype:DType): DTypeArray {
    // NOTE: no-op to make typescript happy
    // otherwise it complains that it cannot find a call signature
    x = x as ArrayBuffer

    if(dtype == 'float32'){
        return new Float32Array(x)
    } else if (dtype == 'int64') {
        return new BigInt64Array(x)
    }
    else return new Uint8Array(x);
}

/** Compute the total number of elements for a shape */
function shape_to_size(shape:number[]) {
    return shape.reduce(
        (previous:number, current:number) => previous*current
    )
}

function create_ort_tensor(
    /** Raw tensor data. If null, will create a new buffer. */
    x:     ArrayBuffer|null, 
    dtype: DType, 
    shape: number[]
): ort.Tensor|Error {
    try{
        const buf_or_size: ArrayBuffer|number = x ?? shape_to_size(shape)
        const x_typed: DTypeArray = to_dtype_array(buf_or_size, dtype)
        return new ort.Tensor(dtype, x_typed, shape)
    } catch(error) {
        return error;
    }
}

function validate_schema_item(x:unknown): SchemaItem|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'shape', util.validate_number_array)
    && util.has_property_of_type(x, 'dtype', validate_dtype)){
        return x;
    }
    else return null;
}

async function validate_inputfeed(
    schema:      Record<string, unknown>, 
    zipcontents: zip.Files
): Promise<StateDict|Error> {
    const statedict:StateDict = {}
    for(const name of Object.keys(schema) ){
        const schemaitem: SchemaItem|null = validate_schema_item(schema[name])
        if(schemaitem == null)
            return new Error(
                `Input schema has invalid format: ${JSON.stringify(schema[name])}`
            )
        
        let buffer:ArrayBuffer|null = null;
        if(schemaitem.path != undefined){
            const weightfile:File|undefined = zipcontents[schemaitem.path]
            if(weightfile == undefined)
                return new Error(`File ${schemaitem.path} not in zip file`)
        
            buffer = await weightfile.arrayBuffer()
        }
        const tensor:ort.Tensor|Error = create_ort_tensor(
            buffer, schemaitem.dtype, schemaitem.shape
        )
        if(tensor instanceof Error)
            return tensor as Error;
        
        statedict[name] = tensor;
    }
    return statedict;
}

async function validate_pt_zip_contents(contents:zip.Files): Promise<PT_ZIP|Error> {
    const paths:string[] = Object.keys(contents)
    
    //make sure we have a single top level folder
    const top_folders:(string|undefined)[] = paths.map( 
        (p:string) => p.split('/')[0] 
    )
    if(new Set(top_folders).size != 1 || top_folders[0] == undefined){
        return new Error('.pt.zip file does not contain a single folder')
    }

    const base:string = top_folders[0];
    // deno-lint-ignore no-inferrable-types
    const onnxfile:string   = `${base}/onnx/inference.onnx`
    // deno-lint-ignore no-inferrable-types
    const schemafile:string = `${base}/onnx/inference.schema.json`
    if(contents[onnxfile] == undefined)
        return new Error(`.pt.zip file does not contain "${onnxfile}" `)
    if(contents[schemafile] == undefined)
        return new Error(`.pt.zip file does not contain "${schemafile}" `)
    
    const onnx_bytes:Uint8Array = new Uint8Array(
        await contents[onnxfile]!.arrayBuffer()
    )
    const schema:unknown|Error = JSON.parse(await contents[schemafile]!.text())
    if(schema instanceof Error || !util.is_object(schema))
        return new Error('.pt.zip contains invalid inference schema')

    const state_dict:StateDict|Error = await validate_inputfeed(schema, contents)
    if(state_dict instanceof Error)
        return state_dict as Error;
    
    return {onnx_bytes, state_dict}
}

export async function load_pt_zip(path:string): Promise<PT_ZIP|Error> {
    const buffer:ArrayBuffer|Error = await load_file(path)
    if(buffer instanceof Error)
        return buffer as Error;
    
    const contents: zip.Files|Error = await zip.unzip(new Blob([buffer]))
    if(contents instanceof Error)
        return contents as Error;
    
    return await validate_pt_zip_contents(contents)
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
            //const onnx_bytes: ArrayBuffer|Error = await load_file(modelpath);
            const loaded_pt_zip:PT_ZIP|Error = await load_pt_zip(modelpath)
            if(loaded_pt_zip instanceof Error){
                return loaded_pt_zip as Error;
            }
            const options:ort.InferenceSession.SessionOptions = {
                executionProviders:['wasm'],
            }
            const ortsession:ort.InferenceSession 
                = await ort.InferenceSession.create(loaded_pt_zip.onnx_bytes, options)
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

