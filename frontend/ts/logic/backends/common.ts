import { type Files }  from "../zip.ts"
import * as util       from "../../util.ts"

export const DataTypeMap  = {
    uint8:   Uint8Array,
    int64:   BigInt64Array,
    float32: Float32Array,
}

/** Supported data types */
export type DType      = keyof typeof DataTypeMap;
/** The corresponding array constructors */
export type DTypeArray = InstanceType<typeof DataTypeMap[DType]>;

export type Tensor<T extends DType> = {
    data:  InstanceType<typeof DataTypeMap[T]>;
    dtype: T;
    shape: number[];
}

export type TensorDict = Record<string, Tensor<DType>>;


//TODO: code re-use


/** Internal description of an input feed or state (e.g. weights) tensor. 
 *  Stored in a .schema.json */
export type SchemaItem = {
    shape: number[];
    dtype: DType;
    /** Path within the zip file to the file containing the weights.
     *  If not defined, then this is a model input (e.g. image) */
    path?: string;
}


export async function unpack_tensordict_from_zip_contents(
    contents:Files
): Promise<TensorDict|Error> {
    const paths:string[] = Object.keys(contents)
    
    //make sure we have a single top level folder
    const top_folders:(string|undefined)[] = paths.map( 
        (p:string) => p.split('/')[0] 
    )
    if(new Set(top_folders).size != 1 || top_folders[0] == undefined){
        return new Error('.pt.zip file does not contain a single top folder')
    }

    const base:string = top_folders[0];
    // deno-lint-ignore no-inferrable-types
    const schemafile:string = `${base}/onnx/inference.schema.json`
    if(contents[schemafile] == undefined)
        return new Error(`.pt.zip file does not contain "${schemafile}" `)
    
    const schema:unknown|Error = JSON.parse(await contents[schemafile]!.text())
    if(schema instanceof Error || !util.is_object(schema))
        return new Error('.pt.zip contains invalid inference schema')

    const tensors:TensorDict|Error 
        = await validate_tensordict(schema, contents, true)
    if(tensors instanceof Error)
        return tensors as Error;

    return tensors as TensorDict;
}


async function validate_tensordict(
    schema:      Record<string, unknown>, 
    zipcontents: Files,
    strict:      boolean,
): Promise<TensorDict|Error> {
    const tensordict:TensorDict = {}
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
        } else if (strict) {
            return new Error(`Schema item ${name} not stored in zip file`)
        }

        const tensor:Tensor<DType>|Error = create_tensor(
            buffer, schemaitem.dtype, schemaitem.shape
        )
        if(tensor instanceof Error)
            return tensor as Error;
        
        tensordict[name] = tensor;
    }
    return tensordict;
}


export function validate_schema_item(x:unknown): SchemaItem|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'shape', util.validate_number_array)
    && util.has_property_of_type(x, 'dtype', validate_dtype)){
        return x;
    }
    else return null;
}

/** Make sure the input is one of the supported dtype identifiers */
function validate_dtype(x:unknown): DType|null {
    if(util.is_string(x) 
    && ((x == 'uint8') || ( x == 'float32') || (x == 'int64')) ) {
        return x;
    }
    else return null;
}

export function create_tensor(
    /** Raw tensor data. If null, will create a new buffer. */
    x:     ArrayBuffer|null, 
    dtype: DType, 
    shape: number[]
): Tensor<DType>|Error {
    try{
        const buf_or_size: ArrayBuffer|number = x ?? shape_to_size(shape)
        const x_typed: DTypeArray = to_dtype_array(buf_or_size, dtype)
        return { dtype, shape, data:x_typed }
    } catch(error) {
        return error;
    }
}

/** Compute the total number of elements for a shape */
export function shape_to_size(shape:number[]) {
    return shape.reduce(
        (previous:number, current:number) => previous*current
    )
}

/** Convert a buffer to a typed array or create a new one */
function to_dtype_array(x:ArrayBuffer|number, dtype:DType): DTypeArray {
    // NOTE: no-op to make typescript happy
    // otherwise it complains that it cannot find a call signature
    x = x as ArrayBuffer

    return new DataTypeMap[dtype](x);
}
