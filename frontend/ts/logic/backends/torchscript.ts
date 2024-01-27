import { DetectionModule, InputResultPair, Result } from "../files.ts";
import * as zip                         from "../zip.ts";
import * as util                        from "../../util.ts";
import * as common                      from "./common.ts"
import type { TensorDict, SchemaItem  } from "./common.ts"
import * as imagetools                  from "../imagetools.ts"
import { denolibs }                     from "../../dep.ts"


export class TS_Backend<R extends Result> extends DetectionModule<File,R> {   

    /** Shared library object */
    static lib:TS_Lib|undefined;

    /** Flag indicating whether the module in the settings has been loaded */
    // deno-lint-ignore no-inferrable-types
    #module_initialized:boolean = false;

    
    //TODO: not in downstream!
    TS_LIB_FILE_URL:string = import.meta.resolve('../../../../assets/libTSinterface.so')
    /** Directory where models are located. Overridden in tests. */
    MODELS_DIR:string = import.meta.resolve('../../../../models/')

    // constructor(...args: ConstructorParameters<typeof DetectionModule<File,R>>){
    //     super(...args)
        
    //     const modelname:string = this.settings.active_models.detection;

    // }

    async process(
        input:        File, 
        on_progress?: (x:InputResultPair<File,R>) => void,
    ): Promise<R> {
        if(!util.is_deno())
            return new this.ResultClass(
                'failed', new Error('FFI backend only supported in Deno.')
            )

        //TODO: ffi and module initialization should be performed in constructor
        if(TS_Backend.lib == undefined){
            const tslib_path:string = denolibs.path.fromFileUrl(this.TS_LIB_FILE_URL)
            const lib: TS_Lib|Error = initialize_ffi(tslib_path)
            if(lib instanceof Error){
                return new this.ResultClass('failed', lib as Error);
            }
            TS_Backend.lib = lib;
        }

        if(!this.#module_initialized){
            const modelname:string = this.settings.active_models.detection;
            const modelpath:string = this._modelname_to_modelpath(modelname)
            const status:true|Error 
                = initialize_module(modelpath, TS_Backend.lib)
            if(status instanceof Error){
                return new this.ResultClass('failed', status as Error);
            }
            this.#module_initialized = true;
        }

        const imagedata: imagetools.ImageData|Error 
            = await imagetools.blob_to_rgb(input)
        if(imagedata instanceof Error)
            return new this.ResultClass('failed', imagedata as Error);
        const rgb_f32:Float32Array = imagetools.rgb_u8_to_f32(imagedata)
        
        const imagetensor: common.AnyTensor|Error = common.create_tensor(
            rgb_f32, "float32", [1,3,imagedata.height, imagedata.width]
        )
        if(imagetensor instanceof Error)
            return new this.ResultClass('failed', imagetensor as Error);
        
        const inputfeed:TensorDict = {x:imagetensor}
        const output:TensorDict|Error 
            = await run_module(inputfeed, TS_Backend.lib)
        if(output instanceof Error)
            return new this.ResultClass('failed', output as Error)
        
        return this.validate_result(output)
    }

    /** Convert the name of a model as stored in settings to the path to file.*/
    _modelname_to_modelpath(modelname:string): string {
        const modelsdir:string = denolibs.path.fromFileUrl(this.MODELS_DIR)
        return denolibs.path.join(modelsdir, modelname+'.torchscript')
    }
}



type TS_Lib = {
    symbols: {
        /** Initialize a torchscript module from binary data. */
        initialize_module: (data:ArrayBuffer, size:number) => number;
        
        /** Run a previously loaded module with inputs. */
        run_module: (
            data:         ArrayBuffer, 
            size:         number, 
            outputbuffer: ArrayBuffer, 
            outputsize:   ArrayBuffer,
            debug:        number,
        ) => number;

        /** Deallocate memory returned by `run_module` */
        free_memory: (p:bigint) => void;
    };
    close: () => void;
}

// adding dlopen etc to Deno because otherwise always get errors during checks
// --unstable does not help
declare global {
    namespace Deno {
        // all optional because undefined if run without --unstable

        // deno-lint-ignore no-explicit-any
        const dlopen: ((path:string, def:any) => any) | undefined;
      
        const UnsafePointer: {
            create: (p:number|bigint) => unknown;
        }

        const UnsafePointerView: new (p:unknown) => {
            getArrayBuffer: (size:number|bigint) => ArrayBuffer;
        };
    }
}

/** Load the shared library libTSinterface.so, as an interface to torchscript */
export function initialize_ffi(path:string): TS_Lib|Error {
    if(!util.is_deno())
        return new Error('FFI backend only supported in Deno.')
    if(Deno.dlopen == undefined)
        return new Error('Deno probably running without the --unstable flag.');
    if(Deno.permissions.querySync({name:'ffi', path:path}).state != 'granted')
        return new Error(`No FFI permissions to open ${path} (--allow-ffi).`);

    try {
        const lib:TS_Lib = Deno.dlopen(
            path,
            {
                "initialize_module": { 
                    parameters: ["buffer", "usize"], 
                    result:     "i32" 
                },
                "run_module":  { 
                    //TODO: async
                    parameters: ["buffer", "usize", "buffer", "buffer", "u8"],
                    result:     "i32" 
                },
                "free_memory": { 
                    parameters: ["u64"], 
                    result:     "void" 
                },
            } as const,
        );
        return lib;
    } catch (e) {
        return e;
    }
}


/** Convert inputs into a zipfile format, as expected by the backend. */
export
async function pack_tensordict(tensordict:TensorDict): Promise<File|Error> {
    const files:  zip.Files = {};
    const schema: Record<string, SchemaItem> = {};

    // deno-lint-ignore no-inferrable-types
    let i:number = 0;
    for(const [key, tensor] of Object.entries(tensordict)){
        // deno-lint-ignore no-inferrable-types
        const path:string = `./.data/${i}.storage`
        schema[key] = {
            dtype: tensor.dtype,
            shape: tensor.shape,
            path:  path,
        }

        files[path] = new File([tensor.data.buffer], path)
        i++;
    }
    files['./onnx/inference.schema.json'] = new File(
        [JSON.stringify(schema)], 'inference.schema.json'
    )
    return await zip.zip_files(files, 'inputfeed.zip')
}


/** Initialize a torchscript module in the backend lib */
export function initialize_module(path:string, lib:TS_Lib): true|Error {
    //should be deno anyway, but better safe than sorry
    if(!util.is_deno())
        return new Error('FFI backend only supported in Deno.')
    
    const modulebytes:Uint8Array = Deno.readFileSync(path);
    const status:number = 
        lib.symbols.initialize_module(modulebytes, modulebytes.length)
    if(status != 0)
        return new Error(`Could not initialize module ${path}`)
    
    return true;
}

/** Perform inference on previously initialized torchscript module */
export async function run_module(
    inputfeed: TensorDict, 
    lib:       TS_Lib,
): Promise<TensorDict|Error> {
    const packed:File|Error = await pack_tensordict(inputfeed)
    if(packed instanceof Error)
        return packed as Error;
    
    const inputbuffer:Uint8Array = new Uint8Array(await packed.arrayBuffer())
    const p_outputbuffer = new BigUint64Array(1)
    const p_outputsize   = new BigUint64Array(1)
    const status:number  = lib.symbols.run_module(
        inputbuffer,
        inputbuffer.length,
        p_outputbuffer,
        p_outputsize,
        0,  //debug
    )
    if(status != 0)
        return new Error('Running module failed')

    const unsafe_p:unknown = Deno.UnsafePointer.create(p_outputbuffer[0]!)
    const arraybuffer:ArrayBuffer = 
        new Deno.UnsafePointerView(unsafe_p).getArrayBuffer(p_outputsize[0]!)

    const unzipped: zip.Files|Error = await zip.unzip(new Blob([arraybuffer]))
    if(unzipped instanceof Error)
        return unzipped as Error;
    
    lib.symbols.free_memory( p_outputbuffer[0]! )

    return common.unpack_tensordict_from_zip_contents(unzipped)
}
