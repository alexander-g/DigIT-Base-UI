import { DetectionModule, InputResultPair, Result } from "../files.ts";
import * as zip                         from "../zip.ts";
import * as util                        from "../../util.ts";
import * as common                      from "./common.ts"
import type { TensorDict  }             from "./common.ts"
import * as imagetools                  from "../imagetools.ts"
import { denolibs }                     from "../../dep.ts"

import * as crypto                      from "../../../../backend/ts/crypto.ts"


export class TS_Backend<R extends Result> extends DetectionModule<File,R> {   

    /** Shared library object */
    static lib:TS_Lib|undefined;

    /** Internal information about the currently loaded module
     *  or null if none loaded */
    #module_info:PT_ZIP|null = null;
    
    //TODO: not in downstream!
    //TS_LIB_FILE_URL:string = import.meta.resolve('../../../../assets/libTSinterface.so')
    /** Directory where models are located. Overridden in tests. */
    //MODELS_DIR:string = import.meta.resolve('../../../../models/')

    /** Path to the c++ interface library */
    readonly ts_lib_path: string;
    /** Path to the folder with models */
    readonly models_dir:  string;

    constructor(...args: [
        ...ConstructorParameters<typeof DetectionModule<File,R>>,
        /** Path to the c++ interface library */
        path_to_ts_lib: string,
        /** Path to the folder with models */
        models_dir:     string,
    ]){
        const [resultclass, settings] = [args[0], args[1]]
        super(resultclass, settings)
        
        this.ts_lib_path = args[2];
        this.models_dir  = args[3];
    }

    async process(
        input:        File, 
        _on_progress?: (x:InputResultPair<File,R>) => void,
    ): Promise<R> {
        if(!util.is_deno())
            return new this.ResultClass(
                'failed', new Error('FFI backend only supported in Deno.')
            )

        //TODO: ffi and module initialization should be performed in constructor
        if(TS_Backend.lib == undefined){
            const lib: TS_Lib|Error = await initialize_ffi(this.ts_lib_path)
            if(lib instanceof Error){
                return new this.ResultClass('failed', lib as Error);
            }
            TS_Backend.lib = lib;
        }

        if(!this.#module_info){
            const modelname:string = this.settings.active_models.detection;
            const modelpath:string = this._modelname_to_modelpath(modelname)
            const status:PT_ZIP|Error 
                = await initialize_module(modelpath, TS_Backend.lib)
            if(status instanceof Error){
                return new this.ResultClass('failed', status as Error);
            }
            this.#module_info = status as PT_ZIP;
        }

        const inputfeed:TensorDict|Error 
            = await inputfeed_from_imageblob(input, this.#module_info)
        if(inputfeed instanceof Error)
            return new this.ResultClass('failed', inputfeed as Error);;
        
        let output:RunModuleOutput|Error 
            = await run_module(inputfeed, TS_Backend.lib)
        
        // run again if this is an multistep/iterative model
        while(!(output instanceof Error) 
        && is_multistep_output(output.output)
        && (output.output.completed.data[0] != 1) ) {
            const inputfeed: TensorDict = ts_output_to_multistep_input(
                output.output as UnknownOutput
            )
            output = await run_module(inputfeed, TS_Backend.lib)
            //console.log(output.output['i'])
        }
        
        const result:R = await this.validate_result(output)
        //TODO: not here
        result.inputname = input.name
        return result;
    }

    /** Try to guess if the argument is a path, otherwise construct one.
     *  TODO: code re-use with ort_processing.ts */
    _modelname_to_modelpath(name:string): string {
        if((name.includes('/') || name.includes('\\') ) && name.endsWith('.pt.zip')){
            return name;
        }
        return denolibs.path.join(this.models_dir, name+'.torchscript')
    }
}



type TS_Lib = {
    symbols: {
        /** Initialize a torchscript module from binary data. */
        initialize_module: (data:ArrayBufferLike, size:bigint) => number;
        
        /** Run a previously loaded module with inputs. */
        run_module: (
            data:         ArrayBufferLike, 
            size:         bigint, 
            outputbuffer: ArrayBufferLike, 
            outputsize:   ArrayBufferLike,
            debug:        number,
        ) => number;

        /** Deallocate memory returned by `run_module` */
        free_memory: (p:bigint) => void;
    };
    close: () => void;
}

// adding dlopen etc to Deno because otherwise always get errors during checks
// --unstable does not help
// declare global {
//     namespace Deno {
//         // all optional because undefined if run without --unstable

//         // deno-lint-ignore no-explicit-any
//         const dlopen: ((path:string, def:any) => any) | undefined;
      
//         const UnsafePointer: {
//             create: (p:number|bigint)     => unknown;
//             of:     (value: BufferSource) => unknown;
//             value:  (p:unknown)           => number|bigint;
//         }

//         const UnsafePointerView: new (p:unknown) => {
//             getArrayBuffer: (size:number|bigint) => ArrayBuffer;
//             copyInto(destination: BufferSource, offset?: number): void;
//         };
//     }
// }

const DLOPEN_SYMBOLS = {
    "initialize_module": { 
        parameters: ["buffer", "u64"], 
        result:     "i32" 
    },
    "run_module":  { 
        //TODO: async
        parameters: ["buffer", "u64", "buffer", "buffer", "u8"],
        result:     "i32" 
    },
    "free_memory": { 
        parameters: ["u64"], 
        result:     "void" 
    },
} as const


/** Load the shared library libTSinterface.so, as an interface to torchscript */
export async function initialize_ffi(path:string): Promise<TS_Lib|Error> {
    if(!util.is_deno())
        return new Error('FFI backend only supported in Deno.')
    if(Deno.dlopen == undefined)
        return new Error('Deno probably running without the --unstable flag.');
    if(Deno.permissions.querySync({name:'ffi', path:path}).state != 'granted')
        return new Error(`No FFI permissions to open ${path} (--allow-ffi).`);

    try {
        const lib:TS_Lib|Error = await _dlopen_maybe_encrypted(path)
        if(lib instanceof Error)
            return lib as Error;
        
        return lib;
    } catch (e) {
        return e as Error;
    }
}


export async function _dlopen_maybe_encrypted(path:string): Promise<TS_Lib|Error> {
    await 0;
    const filepattern = /\.enc$/
    if(filepattern.test(path)){
        //encrypted
        return _dlopen_encrypted(path, path.replace(filepattern, ''))
    } else {
        //not encrypted
        try {
            return Deno.dlopen!(path, DLOPEN_SYMBOLS) as TS_Lib
        } catch(error) {
            return error as Error;
        }
    }
}


/** `dlopen()` an encrypted dll/so library file. 
 *  Encrypted to prevent deletion by anti-virus software. */
async function _dlopen_encrypted(
    path_to_enc_tslib:string,
    destination_path: string,
): Promise<TS_Lib|Error> {
    _preload_torch_libs(path_to_enc_tslib)

    try{
        await crypto.decrypt_file(path_to_enc_tslib, destination_path, crypto.DEFAULT_KEY)
        const lib:TS_Lib = 
            Deno.dlopen(destination_path, DLOPEN_SYMBOLS) as unknown as TS_Lib;
        //clean up
        try {
            Deno.removeSync(destination_path)
        } catch (_error) {
            //ignore, permission denied while opened on windows
        }
        return lib;
    } catch(_error) {
        return _error as Error;
    }
}



/** I get 'Could not open library' errors although all dlls are present.
 *  As a workaround load all required libs manually before the main dll */
function _preload_torch_libs(path_to_ts_lib:string): void {
    if(Deno.build.os != 'windows')
        return;
    
    for(const libname of ['c10', 'uv', 'asmjit', 'libiomp5md', 'fbgemm', 'torch_cpu']){
        const libpath:string = denolibs.path.join(
            denolibs.path.dirname(path_to_ts_lib), `${libname}.dll`
        )
        try { Deno.dlopen!(libpath, {})} 
        // deno-lint-ignore no-empty
        catch (_error) { }
    }
}



/** Internal description of a tensor as stored in a .schema.json file.
*   Tensor data is provided via a memory address. */
type PointerSchemaItem = {
    shape:   number[];
    dtype:   common.DType;
    address: number|bigint; 
}

/** Convert inputs to a json format, as expected by the backend */
export function encode_tensordict_as_json(tensordict:TensorDict): string {
    const schema: Record<string, PointerSchemaItem> = {}
    for(const [key, tensor] of Object.entries(tensordict)){
        const pointer:Deno.PointerValue<unknown> = 
            Deno.UnsafePointer.of(tensor.data);
        schema[key] = {
            dtype:   tensor.dtype,
            shape:   tensor.shape, 
            // NOTE: might not be safe to case to number but seems to work
            address: Number( Deno.UnsafePointer.value(pointer) )
        }
    }
    return JSON.stringify(schema)
}

function validate_number_or_bigint(x:unknown): number|bigint|null {
    return util.validate_number(x) ?? ((typeof x == 'bigint') ? x: null)
}

function _validate_bigint(x:unknown): bigint|null {
    return ((typeof x == 'bigint') ? x: null)
}

function validate_pointer_schema_item(x:unknown): PointerSchemaItem|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'shape', util.validate_number_array)
    && util.has_property_of_type(x, 'dtype', common.validate_dtype)
    && util.has_property_of_type(x, 'address', validate_number_or_bigint)){
        return x;
    }
    else return null;
}

function validate_tensor_from_json(x:unknown): common.AnyTensor|null {
    const schemaitem: PointerSchemaItem|null = validate_pointer_schema_item(x)
    if(schemaitem == null)
        return null;
    
    const itemsize:number = common.DataTypeMap[schemaitem.dtype].BYTES_PER_ELEMENT;
    const nbytes:number = common.shape_to_size(schemaitem.shape) * itemsize;
    const buffer:ArrayBuffer = new ArrayBuffer(nbytes);
    const pointer:Deno.PointerValue<unknown> = 
        Deno.UnsafePointer.create(BigInt(schemaitem.address))
    if(pointer == null)
        return null;
    
    new Deno.UnsafePointerView(pointer).copyInto(buffer)

    return {
        dtype: schemaitem.dtype,
        shape: schemaitem.shape,
        data:  new common.DataTypeMap[schemaitem.dtype](buffer),
    }
}

/** Convert the output returned from the interface library into tensors. */
export function decode_tensordict_from_json(jsondata:string): TensorDict|Error {
    const jsonobject:unknown|Error = util.parse_json_no_throw(jsondata)
    const tensordict:TensorDict = {};
    if(util.is_object(jsonobject)){
        for(const [key, value] of Object.entries(jsonobject)){
            const tensor:common.AnyTensor|null = validate_tensor_from_json(value)
            if(tensor == null)
                return new Error('Invalid schema item')
            
            tensordict[key] = tensor;
        }
        return tensordict;
    }
    else return new Error('Invalid json')
}


/** Initialize a torchscript module in the backend lib */
export 
async function initialize_module(path:string, lib:TS_Lib): Promise<PT_ZIP|Error> {
    //should be deno anyway, but better safe than sorry
    if(!util.is_deno())
        return new Error('FFI backend only supported in Deno.')
    
    if(!path.endsWith('.pt.zip')){
        return new Error('Non .pt.zip currently not allowed.')
        //modulebytes = Deno.readFileSync(path);
        
    }
    const pt_zip:PT_ZIP|Error = await load_pt_zip(path)
    if(pt_zip instanceof Error)
        return pt_zip as Error;
    const modulebytes:Uint8Array = pt_zip.torchscript_bytes;
    
    const status:number = 
        lib.symbols.initialize_module(modulebytes.buffer, BigInt(modulebytes.length))
    if(status != 0)
        return new Error(`Could not initialize module ${path}`)
    
    return pt_zip;
}


//TODO: code re-use with onnxruntime.ts
export type RunModuleOutput = {
    /** The original size of the image */
    imagesize: util.ImageSize;

    /** The input size as fed to the model */
    inputsize: util.ImageSize;

    /** Raw torchscript output */
    output:    unknown;
}


/** Perform inference on previously initialized torchscript module */
export async function run_module(
    inputfeed: TensorDict, 
    lib:       TS_Lib,
): Promise<RunModuleOutput|Error> {
    await 0;
    const encoded:string|Error = encode_tensordict_as_json(inputfeed)
    if(typeof encoded != 'string')
        return encoded as Error;
    
    const inputbuffer:Uint8Array = new TextEncoder().encode(encoded)
    const p_outputbuffer = new BigUint64Array(1)
    const p_outputsize   = new BigUint64Array(1)
    const status:number  = lib.symbols.run_module(
        inputbuffer.buffer,
        BigInt(inputbuffer.length),
        p_outputbuffer.buffer,
        p_outputsize.buffer,
        0//,  //debug
    )
    if(status != 0)
        return new Error('Running module failed')

    const unsafe_p:Deno.PointerValue<unknown> 
        = Deno.UnsafePointer.create(p_outputbuffer[0]!)
    if(unsafe_p == null)
        return new Error('Could not create a pointer')
    const arraybuffer:ArrayBuffer = new ArrayBuffer(Number(p_outputsize[0]!))
    new Deno.UnsafePointerView(unsafe_p).copyInto(arraybuffer);

    const json_encoded_output:string = new TextDecoder().decode(arraybuffer)
    const tensordict_output:TensorDict|Error = 
        decode_tensordict_from_json(json_encoded_output)
    
    lib.symbols.free_memory( p_outputbuffer[0]! )

    //return tensordict_output;
    return {
        output:     tensordict_output,
        //TODO: currently unused
        inputsize:  {width: -1, height:-1},
        imagesize:  {width: -1, height:-1},
    }
}


export type PT_ZIP = {
    torchscript_bytes:  Uint8Array;
    state_dict:  TensorDict;
    inputschema: Record<string, common.InputSchemaItem>
}

//TODO: code re-use with onnxruntime.ts
async function load_pt_zip(path:string): Promise<PT_ZIP|Error> {
    const zipdata:Uint8Array    = Deno.readFileSync(path)
    const files:zip.Files|Error = await zip.unzip(zipdata);
    if(files instanceof Error)
        return files as Error;
    const ts_filepaths:string[] = Object.keys(files).filter(
        (path:string) => path.endsWith('.torchscript')
    )
    if(ts_filepaths.length == 0)
        return new Error(`${path} contains no .torchscript files`)
    if(ts_filepaths.length > 1)
        return new Error(`${path} contains multiple .torchscript files`)
    
    const ts_filepath:string = ts_filepaths[0]!
    const schemafile:string = ts_filepath.replace(
        new RegExp(`.torchscript$`), '.schema.json'
    )
    if(files[schemafile] == undefined)
        return new Error(`.pt.zip file does not contain "${schemafile}" `)
    const ts_bytes = new Uint8Array(await files[ts_filepath]!.arrayBuffer())
    
    const json:unknown|Error = JSON.parse(await files[schemafile]!.text())
    const schema: common.InferenceSchema|Error 
        = common.validate_inference_schema(json)
    if(schema instanceof Error)
        return schema as Error;

    const state_dict:TensorDict|Error = await common.load_tensors_from_zipcontents(
        schema.state_schema, files, common.create_tensor
    )
    if(state_dict instanceof Error)
        return state_dict as Error;
    
    // currently supported input is only 1x HWC uint8 RGB
    const input_x:common.InputSchemaItem|undefined = schema.input_schema['x']
    if(!input_x
    || input_x.shape.length != 4
    || input_x.shape[0] != 1
    || input_x.shape[3] != 3
    || input_x.dtype != 'uint8'){
        return new Error('Input not in 1x HWC uint8 RGB format')
    }
    
    return {torchscript_bytes:ts_bytes, state_dict, inputschema:schema.input_schema}
}


async function inputfeed_from_imageblob(
    image:     Blob, 
    modelinfo: PT_ZIP,
): Promise<TensorDict|Error> {
    const imagedata_rgb: imagetools.ImageData|Error 
        = await imagetools.blob_to_rgb(image);
    if(imagedata_rgb instanceof Error)
        return imagedata_rgb as Error;
    
    const imagetensor: common.AnyTensor|Error = common.create_tensor(
        imagedata_rgb.buffer, 
        "uint8", 
        [1,imagedata_rgb.height, imagedata_rgb.width,3]
    )
    if(imagetensor instanceof Error)
        return imagetensor as Error;

    const inputfeed:TensorDict = {};
    inputfeed['x'] = imagetensor;

    //empty tensors for the remaining inputs
    for(const [name, schema] of Object.entries(modelinfo.inputschema)){
        if(name == 'x')
            continue;
        
        // convert nulls to zeros
        const shape:number[]|null = schema.shape.map( Number )
        const t:common.AnyTensor|Error 
            = common.create_tensor(null, schema.dtype, shape)
        if(t instanceof Error)
            return t as Error;
        
        inputfeed[name] = t;
    }

    return inputfeed;
}


//TODO: code re-use with ort_processing.ts

/** An output of a model that is meant to be executed in multiple steps */
type MultistepOutput = {
    /** Flag indicating whether the to run the model again or not */
    completed: common.AnyTensor;
}

function validate_multistep_output(x:unknown): MultistepOutput|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'completed', common.validate_tensor)){
        if(x.completed.dtype == 'bool'
        && x.completed.shape.length == 0
        && x.completed.data.length == 1) {
            return x;
        }
        else return null;
    }
    else return null;
}

function is_multistep_output(x:unknown): x is MultistepOutput {
    return (validate_multistep_output(x) === x);
}


/** Utility type to make TypScript happy */
type UnknownOutput = Omit<MultistepOutput, 'completed'>


function ts_output_to_multistep_input(x:TensorDict): TensorDict {
    const result:TensorDict = {}
    for(const [k, v] of Object.entries(x)) {
        if(k != "completed")
            result[k.replace(/\.output$/, '')] = v;
    }
    return result;
}

