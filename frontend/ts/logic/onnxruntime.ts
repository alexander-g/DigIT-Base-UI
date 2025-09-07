import { ort, denolibs }   from "../dep.ts"
import * as imagetools from "./imagetools.ts"
import * as zip  from "./zip.ts"
import * as util from "../util.ts"
import { 
    shape_to_size,
    validate_dtype,
    validate_inference_schema,
    validate_typed_array,
    load_tensors_from_zipcontents,
    InferenceSchema,
    InputSchemaItem,
    DType,
    DTypeArray,
} from "./backends/common.ts"


const ORT_VERSION:string = ort.env.versions.common


const WASM_PATH_DENO = new URL(
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd-threaded.wasm`
)
const WASM_PATH_BROWSER = new URL(
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd-threaded.jsep.wasm`
)
const ASSET_DIR = './assets'





let _cached_wasm: Uint8Array|undefined;

async function get_ort_wasm_binary(): Promise<Uint8Array|Error> {
    if(_cached_wasm != undefined)
        return _cached_wasm;

    if(util.is_deno()){
        // check if wasm file is present in assets
        let maybe_wasm:Uint8Array|Error = try_load_cached_wasm()
        if(maybe_wasm instanceof Uint8Array)
            return maybe_wasm;
        
        // try to fetch otherwise
        maybe_wasm = await try_fetch_wasm_deno()
        if(maybe_wasm instanceof Error)
            return maybe_wasm as Error;
        
        return maybe_wasm;
    } else if(util.is_browser()) {
        // fetch from url and cache into _cached_wasm
        return try_fetch_wasm_browser()
    } else {
        return new Error('Cannot determine runtime');
    }
}

/** Try to read onnxruntime wasm file from file system (Deno only) */
function try_load_cached_wasm(): Uint8Array|Error {
    const permission:Deno.PermissionState = 
        Deno.permissions.querySync({name:'read', path:ASSET_DIR}).state;
    if(permission != 'granted') {
        return new Error(`No permission to read ${ASSET_DIR}`)
    }
    const basename:string = denolibs.path.basename(WASM_PATH_DENO.pathname);
    const path:string = denolibs.path.join(ASSET_DIR, basename);
    
    try {
        const wasmbytes:Uint8Array = Deno.readFileSync(path)
        _cached_wasm = wasmbytes;
        return wasmbytes;
    } catch {
        return new Error(`Failed to read ${path}`)
    }
}

async function try_fetch_wasm_deno(): Promise<Uint8Array|Error> {
    const permission0:Deno.PermissionState = 
        Deno.permissions.querySync({name:'net', host:WASM_PATH_DENO.host}).state;
    if(permission0 != 'granted')
        return new Error(`No permission to fetch ${WASM_PATH_DENO}`)
    
    const response: Response|Error = await util.fetch_no_throw(WASM_PATH_DENO);
    if(response instanceof Error)
        return response as Error;
    
    const wasmbytes = new Uint8Array(await response.arrayBuffer())
    _cached_wasm = wasmbytes;

    const permission1:Deno.PermissionState = 
        Deno.permissions.querySync({name:'write', path:ASSET_DIR}).state;
    if(permission1 == 'granted'){
        const basename:string = denolibs.path.basename(WASM_PATH_DENO.pathname);
        const path:string = denolibs.path.join(ASSET_DIR, basename);
        Deno.writeFileSync(path, wasmbytes);
    }
    return wasmbytes;
}

async function try_fetch_wasm_browser(): Promise<Uint8Array|Error> {
    const response: Response|Error = await util.fetch_no_throw(WASM_PATH_BROWSER);
    if(response instanceof Error)
        return response as Error;
    
    const wasmbytes = new Uint8Array(await response.arrayBuffer())
    _cached_wasm = wasmbytes;
    
    return wasmbytes;
}



/** Replace the original fetch with a cached version for requests that match `pattern` */
function _monkeypatch_fetch(pattern:RegExp) {
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

async function set_ort_env(): Promise<true|Error> {
    // //NOTE: threaded wasm currently doesnt work. fix it to single-threaded
    // ort.env.wasm.numThreads = 1;

    // ort.env.wasm.wasmPaths = wasmpath;
    // //TODO: do this only once?
    // monkeypatch_fetch(new RegExp('^'+wasmpath))

    const wasmbytes:Uint8Array|Error = await get_ort_wasm_binary()
    if(wasmbytes instanceof Error)
        return wasmbytes as Error;
    
    ort.env.wasm.wasmBinary = wasmbytes;
    return true;
}


/** Load a file from disk (in deno) or fetch it from server (in browser) */
async function load_file(path:string): Promise<ArrayBuffer|Error> {
    if(util.is_deno()){
        try{
            return Deno.readFileSync(path).buffer
        }
        catch(error) {
            return error as Error; 
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

export type ModelDescriptor = {
    onnx_bytes:  Uint8Array;
    state_dict:  TensorDict;
    //inputschema: Record<string, InputSchemaItem>
}


/** Convert a buffer to a typed array or create a new one */
function to_dtype_array(x:ArrayBufferLike|number, dtype:DType): DTypeArray {
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
    x:     ArrayBufferLike|null, 
    dtype: DType, 
    shape: number[]
): ort.Tensor|Error {
    try{
        const buf_or_size: ArrayBufferLike|number = x ?? shape_to_size(shape)
        const x_typed: DTypeArray = to_dtype_array(buf_or_size, dtype)
        return new ort.Tensor(dtype, x_typed, shape)
    } catch(error) {
        return error as Error;
    }
}



async function validate_pt_zip_contents(contents:zip.Files): Promise<ModelDescriptor|Error> {
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
        schema.state_schema, 
        contents, 
        create_ort_tensor
    )
    if(state_dict instanceof Error)
        return state_dict as Error;
    
    return {onnx_bytes, state_dict}
    
    
}

export async function load_pt_zip(path:string): Promise<ModelDescriptor|Error> {
    const buffer:ArrayBuffer|Error = await load_file(path)
    if(buffer instanceof Error)
        return buffer as Error;
    
    const contents: zip.Files|Error = await zip.unzip(new Blob([buffer]))
    if(contents instanceof Error)
        return contents as Error;
    
    return await validate_pt_zip_contents(contents)
}

export async function load_onnx(path:string): Promise<ModelDescriptor|Error> {
    const buffer:ArrayBuffer|Error = await load_file(path)
    if(buffer instanceof Error)
        return buffer as Error;
    
    return {
        onnx_bytes:  new Uint8Array(buffer),
        state_dict:  {},
    }
}

export async function load_model(path:string): Promise<ModelDescriptor|Error> {
    await 0;
    if(path.endsWith('.onnx'))
        return load_onnx(path)
    else if(path.endsWith('.zip'))
        return load_pt_zip(path)
    else
        return new Error('Unknown model type')
}



export type ValueMeta = ort.InferenceSession.ValueMetadata;
export type InputSchema = Record<string, InputSchemaItem>;

export type SessionOutput = {
    /** Raw onnx output */
    raw: unknown;

    /** Time it took to run the model */
    processing_time?: number;
}

export type SingleImageSessionOutput = SessionOutput & {
    /** The original size of the image */
    imagesize: util.ImageSize;

    /** The input size as fed to the model */
    inputsize: util.ImageSize;
}

export class Session {
    #ortsession:  ort.InferenceSession;
    #onnx_bytes:  Uint8Array;

    protected _state_dict:  TensorDict;
    protected _inputschema: InputSchema;

    constructor(
        ortsession:  ort.InferenceSession, 
        model_dsc:   ModelDescriptor,
        inputschema: InputSchema
    ) {
        this.#ortsession  = ortsession;
        this._state_dict  = model_dsc.state_dict
        this.#onnx_bytes  = model_dsc.onnx_bytes
        this._inputschema = inputschema
    }

    /** Factory function returning a new {@link Session} instance or `Error`.*/
    static async initialize<T extends typeof Session>(
        this: T,
        modelpath:string
    ): Promise<InstanceType<T>|Error> {
        const status: true|Error = await set_ort_env()
        if(status instanceof Error)
            return status as Error;
        
        const model_dsc:ModelDescriptor|Error = await load_model(modelpath)
        if(model_dsc instanceof Error)
            return model_dsc as Error;
        
        const options:ort.InferenceSession.SessionOptions = {
            executionProviders: ['wasm'],
            logSeverityLevel:   3,
        }
        try{
            const ortsession:ort.InferenceSession 
                = await ort.InferenceSession.create(
                    model_dsc.onnx_bytes, 
                    options
                )
            console.log('onnx initialized')

            const inputschema: InputSchema|Error = 
                this.validate_inputs(ortsession.inputMetadata)
            if(inputschema instanceof Error)
                return inputschema as Error;
            

            //TODO: verifiy inputnames in ortsession with state_dict
            return new this(ortsession, model_dsc, inputschema) as InstanceType<T>
        } catch(error) {
            console.warn('ONNX session error:', error, typeof error)
            if(error instanceof Error)
                return error as Error;
            else
                return new Error( `${error}` )
        }
    }

    async process_inputfeed(
        inputfeed: TensorDict,
        force_mainthread:boolean = false,
    ): Promise<SessionOutput|Error> {
        try {
            const t0:number = performance.now()
            let output: unknown;
            if(util.is_deno() || force_mainthread){
                output = await this.#ortsession.run(inputfeed)
            } else {
                output = await run_in_worker(this.#onnx_bytes, inputfeed)
            }
            const t1:number = performance.now()
            return {
                raw:    output,
                processing_time: (t1 - t0)
            }
        } catch(error) {
            console.error('ONNX runtime error: ', error)
            return error as Error;
        }
    }

    async release(): Promise<void> {
        return await this.#ortsession.release()
    }

    /** @virtual Check if the onnx model expects the correct inputs */
    static validate_inputs(_schema:readonly ValueMeta[]): InputSchema|Error {
        return new Error('Not implemented. Need to override.')
    }
}


export class SingleImageSession extends Session {

    static override validate_inputs(schema:readonly ValueMeta[]): InputSchema|Error {
        const schemamap:Record<string, ValueMeta> = 
            Object.fromEntries( schema.map( (v:ValueMeta) => [v.name, v] ) )
        
        // currently supported input is only 1x HWC uint8 RGB
        const x:ValueMeta|undefined = schemamap['x'];
        if(!x
        || !x.isTensor
        || x.shape.length != 4
        || x.shape[0] != 1
        || x.shape[3] != 3
        || x.type != 'uint8'){
            return new Error('Input not in 1x HWC uint8 RGB format')
        }
        // else
        return {
            x: {
                shape: x.shape.map( 
                    (i:string|number) => (typeof i == 'string')? null : i 
                ),
                dtype: x.type,
            }
        }
    }
    
    async process_image_from_path(imagepath:string): Promise<SingleImageSessionOutput|Error> {
        const image_bytes: ArrayBuffer|Error = await load_file(imagepath);
        if(image_bytes instanceof Error)
            return image_bytes as Error;
        
        return this.process_image_from_blob( new Blob([image_bytes]) )
    }

    async process_image_from_blob(blob:Blob): Promise<SingleImageSessionOutput|Error> {
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
            = create_ort_tensor(rgb.buffer, 'uint8', xshape)
        if(x instanceof Error)
            return x as Error;

        const extras:TensorDict|Error = this.#empty_tensors_for_extra_inputs()
        if(extras instanceof Error)
            return extras as Error;

        let infeed:TensorDict = {...{x}, ...extras};
        infeed = this.#filter_inputfeed(infeed)
        infeed = {...this._state_dict, ...infeed};

        const output:SessionOutput|Error = await this.process_inputfeed(infeed)
        if(output instanceof Error)
            return output as Error;
        //else
        return {
            imagesize: imagetools.get_image_size(image),
            inputsize: {width:rgb.width, height:rgb.height},
            ...output
        }
    }

    async process_inputfeed_single_image(
        inputfeed: TensorDict,
        extras:    Pick<SingleImageSessionOutput, 'imagesize'|'inputsize'>
    ): Promise<SingleImageSessionOutput | Error> {
        const base_output: SessionOutput|Error = 
            await super.process_inputfeed(inputfeed)
        if(base_output instanceof Error)
            return base_output as Error;
        
        return {
            ...base_output,
            ...extras,
        }
    }

    
    /** Return either the height and width that is expected by the onnx model,
     *  or null if both are expected to be dynamic, or else an error. */
    #input_image_size(): util.ImageSize|null|Error {
        const height:number|null|undefined = this._inputschema['x']?.shape[1]
        const width:number|null|undefined  = this._inputschema['x']?.shape[2]
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
        for(const [name, schema] of Object.entries(this._inputschema)) {
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
        const schemakeys:string[] = Object.keys(this._inputschema)
        const filtered:TensorDict = {}
        for(const [name, tensor] of Object.entries(feed)) {
            if(schemakeys.includes(name)) {
                filtered[name] = tensor;
            }
        }
        return filtered;
    }
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
