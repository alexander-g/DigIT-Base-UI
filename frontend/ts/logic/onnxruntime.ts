import { ort }   from "../dep.ts"
import * as imagetools from "./imagetools.ts"
import * as zip  from "./zip.ts"
import * as util from "../util.ts"
import { 
    shape_to_size,
    validate_dtype,
    validate_inference_schema, 
    load_tensors_from_zipcontents,
    InferenceSchema,
    InputSchemaItem,
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
            +` --allow-net=${WASM_URL.host}`
            +` --allow-read=${ASSET_DIR}`
            +` --allow-write=${ASSET_DIR}`
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


export type TensorDict = Record<string, ort.Tensor>

export type PT_ZIP = {
    onnx_bytes:  Uint8Array;
    state_dict:  TensorDict;
    inputschema: Record<string, InputSchemaItem>
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


export function create_ort_tensor(
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
    const json:unknown|Error = JSON.parse(await contents[schemafile]!.text())
    const schema: InferenceSchema|Error = validate_inference_schema(json)
    if(schema instanceof Error)
        return schema as Error;

    const state_dict:TensorDict|Error = await load_tensors_from_zipcontents(
        schema.state_schema, contents, create_ort_tensor
    )
    if(state_dict instanceof Error)
        return state_dict as Error;
    
    // currently supported input is only 1x HWC uint8 RGB
    const input_x:InputSchemaItem|undefined = schema.input_schema['x']
    if(!input_x
    || input_x.shape.length != 4
    || input_x.shape[0] != 1
    || input_x.shape[3] != 3
    || input_x.dtype != 'uint8'){
        return new Error('Input not in 1x HWC uint8 RGB format')
    }
    
    return {onnx_bytes, state_dict, inputschema:schema.input_schema}
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

    /** Raw onnx output */ //TODO: rename to 'raw' or something like that
    output:    unknown;

    /** Time it took to run the model */
    processing_time?: number;
}

export class Session {
    #ortsession:  ort.InferenceSession;
    #state_dict:  TensorDict;
    #onnx_bytes:  Uint8Array;
    #inputschema: Record<string, InputSchemaItem>;

    constructor(
        ortsession:   ort.InferenceSession, 
        loaded_ptzip: PT_ZIP
    ) {
        this.#ortsession  = ortsession;
        this.#state_dict  = loaded_ptzip.state_dict
        this.#onnx_bytes  = loaded_ptzip.onnx_bytes
        this.#inputschema = loaded_ptzip.inputschema
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
            executionProviders: ['wasm'],
            logSeverityLevel:   3,
        }
        try{
            const ortsession:ort.InferenceSession 
                = await ort.InferenceSession.create(
                    loaded_pt_zip.onnx_bytes, options
                )
            //TODO: verifiy inputnames in ortsession with state_dict
            return new Session(ortsession, loaded_pt_zip)
        } catch(error) {
            console.warn(error)
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
        const image: imagetools.Image|Error = await imagetools.blob_to_image(blob)
        if(image instanceof Error)
            return image as Error;
        
        const imagesize:util.ImageSize|null|Error = this.#input_image_size()
        if(imagesize instanceof Error)
            return imagesize as Error
        
        const rgb: imagetools.ImageData|Error 
            = await imagetools.image_to_rgb(image, imagesize)
        if(rgb instanceof Error)
            return rgb as Error;
        
        const xshape: number[] = [1,rgb.height,rgb.width,3]
        const x: ort.Tensor|Error 
            = create_ort_tensor(new Uint8Array(rgb.buffer), 'uint8', xshape)
        if(x instanceof Error)
            return x as Error;

        const extras:TensorDict|Error = this.#empty_tensors_for_extra_inputs()
        if(extras instanceof Error)
            return extras as Error;

        const inputfeed:TensorDict = {...{x}, ...extras};
        return this.process_image_from_statedict(
            inputfeed,
            {
                imagesize: imagetools.get_image_size(image),
                inputsize: {width:rgb.width, height:rgb.height},
            }
        )
    }

    async process_image_from_statedict(
        inputfeed: TensorDict,
        extras:    Pick<SessionOutput, 'imagesize'|'inputsize'>
    ): Promise<SessionOutput|Error> {
        inputfeed = this.#filter_inputfeed(inputfeed)
        inputfeed = {...this.#state_dict, ...inputfeed};
        try {
            const t0:number = performance.now()
            let output: unknown;
            if(util.is_deno()){
                output = await this.#ortsession.run(inputfeed)
            } else {
                output = await run_in_worker(this.#onnx_bytes, inputfeed)
            }
            const t1:number = performance.now()
            return {
                output:    output,
                processing_time: (t1 - t0),
                ...extras,
            }
        } catch(error) {
            console.error('ONNX runtime error: ', error)
            return error;
        }
    }

    /** Return either the height and width that is expected by the onnx model,
     *  or null if both are expected to be dynamic, or else an error. */
    #input_image_size(): util.ImageSize|null|Error {
        const height:number|null|undefined = this.#inputschema['x']?.shape[1]
        const width:number|null|undefined  = this.#inputschema['x']?.shape[2]
        if(height === undefined || width === undefined)
            //should not happen if the inputfeed validation is correct
            return new Error('Unexpected input tensor after initialization')
        else if(height == null && width == null)
            return null
        else if(height == null || width == null)
            return new Error('Unsupported: height or width is dynamic but not both')
        else return {height, width}
    }

    #empty_tensors_for_extra_inputs(): TensorDict|Error {
        const tensors: TensorDict = {}
        for(const [name, schema] of Object.entries(this.#inputschema)) {
            if(name == 'x')
                continue;
            
            // convert nulls to zeros
            const shape:number[]|null = schema.shape.map( Number )
            const t:ort.Tensor|Error = create_ort_tensor(null, schema.dtype, shape)
            if(t instanceof Error)
                return t as Error;
            
            tensors[name] = t;
        }
        return tensors;
    }

    #filter_inputfeed(feed:TensorDict): TensorDict {
        const schemakeys:string[] = Object.keys(this.#inputschema)
        const filtered:TensorDict = {}
        for(const [name, tensor] of Object.entries(feed)) {
            if(schemakeys.includes(name)) {
                filtered[name] = tensor;
            }
        }
        return filtered;
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


type WorkerMessage = {
    status: 'ready'|'completed'|'error',
    result?: unknown
}

function run_in_worker(
    onnx_bytes: Uint8Array, 
    inputs:     TensorDict,
): Promise< unknown > {
    const worker_src = new Blob([worker_js], {type:'text/javascript'})
    const worker = new Worker(URL.createObjectURL(worker_src), {type:'module'})

    return new Promise((
        resolve: (x:unknown) => void,
        reject:  (error:ErrorEvent) => void
    ) => {
        worker.onmessage = (event:MessageEvent<WorkerMessage>) => {
            
            if(event.data.status == 'ready') { 
                worker.postMessage({onnx_bytes, inputs});
            } else if(event.data.status == 'error') {
                console.error('Worker error:', event.data.result)
                reject(event.data.result as ErrorEvent)
                worker.terminate()
            } else {
                resolve(event.data.result);
                worker.terminate();
            }
        };
    
        worker.onerror = (error:ErrorEvent) => {
            reject(error);
            worker.terminate();
        };
      });
}


const worker_js = `
const ort = (await import("https://esm.run/onnxruntime-web@1.16.3")).default
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/";

self.onmessage = async function(event) {
    const onnx_bytes = event.data["onnx_bytes"];
    const inputs     = event.data["inputs"];

    const options = {
        executionProviders: ['wasm'],
        logSeverityLevel:   3,
    }

    let output;
    try {
        const session = await ort.InferenceSession.create(onnx_bytes, options)
        output  = await session.run(inputs)
    } catch (error) {
        self.postMessage({
            status: 'error',
            result: error
        })
        return;
    }

    self.postMessage({
        status: 'completed',
        result: output
    });
}

self.postMessage({status: 'ready'});
`
