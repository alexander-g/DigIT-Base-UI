import { DetectionModule, InputResultPair, Result } from "../files.ts";
import * as zip                         from "../zip.ts";
import * as util                        from "../../util.ts";
import * as common                      from "./common.ts"
import type { TensorDict, SchemaItem  } from "./common.ts"


// export class TS_Backend<R extends Result> extends DetectionModule<File,R> {   

//     /** Shared library object */
//     static lib:TS_Lib|undefined;

// }



type TS_Lib = {
    symbols: {
        /** Initialize a torchscript module from binary data. */
        initialize_module: (data:ArrayBuffer, size:number) => number;
        
        /** Run a previously loaded module with inputs. */
        run_module: (
            data:         ArrayBuffer, 
            size:         number, 
            outputbuffer: ArrayBuffer, 
            outputsize:   ArrayBuffer
            //debug
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
                    parameters: ["buffer", "usize", "buffer", "buffer"],
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

/** Perfom inference on previously initialized torchscript module */
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
