import { ort }   from "../dep.ts"
import * as imagetools from "./imagetools.ts"
import * as zip  from "./zip.ts"
import * as util from "../util.ts"
import { 
    shape_to_size, 
    validate_schema_item, 
    SchemaItem,
    DType,
    DTypeArray,
} from "./backends/common.ts"


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


type StateDict = Record<string, ort.Tensor>

export type PT_ZIP = {
    onnx_bytes: Uint8Array;
    state_dict: StateDict;
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
    
    // currently supported input is only 1x HWC uint8 RGB
    if(!state_dict['x']
    || state_dict['x'].dims.length != 4
    || state_dict['x'].dims[0] != 1
    || state_dict['x'].dims[3] != 3
    || state_dict['x'].type != 'uint8'){
        return new Error('Input not in 1x HWC uint8 RGB format')
    }
    
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

export type SessionOutput = {
    /** The original size of the image */
    imagesize: util.ImageSize;

    /** The input size as fed to the model */
    inputsize: util.ImageSize;

    /** Raw onnx output */
    output:    unknown;
}

export class Session {
    #ortsession: ort.InferenceSession;
    #state_dict: StateDict;

    constructor(ortsession:ort.InferenceSession, state_dict:StateDict) {
        this.#ortsession = ortsession;
        this.#state_dict = state_dict
    }

    /** Factory function returning a new {@link Session} instance or `Error`.*/
    static async initialize(modelpath:string): Promise<Session|Error> {
        let status:true|Error = check_permissions()
        if(status instanceof Error)
            return status as Error;

        status = set_ort_env(WASM_PATH.href)
        if(status instanceof Error)
            return status as Error;
        
        const loaded_pt_zip:PT_ZIP|Error = await load_pt_zip(modelpath)
        if(loaded_pt_zip instanceof Error)
            return loaded_pt_zip as Error;
        
        const options:ort.InferenceSession.SessionOptions = {
            executionProviders:['wasm'],
        }
        try{
            const ortsession:ort.InferenceSession 
                = await ort.InferenceSession.create(
                    loaded_pt_zip.onnx_bytes, options
                )
            //TODO: verifiy inputnames in ortsession with state_dict
            return new Session(ortsession, loaded_pt_zip.state_dict)
        } catch(error) {
            return error;
        }
    }

    async process_image_from_path(imagepath:string): Promise<SessionOutput|Error> {
        const image_bytes: ArrayBuffer|Error = await load_file(imagepath);
        if(image_bytes instanceof Error)
            return image_bytes as Error;
        
        return this.process_image_from_blob( new Blob([image_bytes]) )
    }

    async process_image_from_blob(blob:Blob): Promise<SessionOutput|Error> {
        const imagesize:util.ImageSize|Error = this.#input_image_size()
        if(imagesize instanceof Error)
            return imagesize as Error
        
        const image: imagetools.Image|Error = await imagetools.blob_to_image(blob)
        if(image instanceof Error)
            return image as Error;
        
        const rgb: imagetools.ImageData|Error 
            = await imagetools.image_to_rgb(image, imagesize)
        if(rgb instanceof Error)
            return rgb as Error;
        
        const x = this.#state_dict['x']!
        const x_ = new ort.Tensor(x.type, new Uint8Array(rgb.buffer), x.dims)
        try{
            const output: Record<string, ort.OnnxValue> 
                = await this.#ortsession.run({...this.#state_dict, x:x_})
            return {
                output:    output, 
                imagesize: imagetools.get_image_size(image),
                inputsize: {width:rgb.width, height:rgb.height},
            }
        } catch(error) {
            return error;
        }
    }

    #input_image_size(): util.ImageSize|Error {
        const height:number|undefined = this.#state_dict['x']?.dims[1]
        const width:number|undefined  = this.#state_dict['x']?.dims[2]
        if(height == undefined || width == undefined)
            //should not happen if the inputfeed validation is correct
            return new Error('Unexpected input tensor after initialization')
        return {height, width}
    }
}



export function validate_typed_array(x:unknown): DTypeArray|null {
    if(x instanceof Uint8Array
    || x instanceof Float32Array
    || x instanceof BigInt64Array){
        return x;
    }
    else return null;
}

export function validate_dtype(x:unknown): DType|null {
    if(typeof x == 'string' 
    && (   x == 'uint8' 
        || x == 'float32' 
        || x == 'int64')
    ){
        return x;
    }
    else return null;
}

export type PartialTensor = Pick<ort.Tensor, 'data'|'dims'|'type'>;

export function validate_ort_tensor(x:unknown): PartialTensor|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'type', validate_dtype)
    && util.has_property_of_type(x, 'dims', util.validate_number_array)
    && util.has_property_of_type(x, 'data', validate_typed_array)){
        return x;
    }
    else return null;
}
