import { type Files }  from "../zip.ts"
import * as util       from "../../util.ts"

export const DataTypeMap  = {
    bool:    Uint8Array,
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
    shape: readonly number[];
}

export type AnyTensor  = Tensor<DType>
export type TensorDict = Record<string, AnyTensor>;


/** Internal description of a state tensor as stored in a .schema.json file.
*   Tensor data is stored in the .pt.zip file as indicated by `path`. */
export type StateSchemaItem = {
    shape: number[];
    dtype: DType;
    /** Path within the zip file to the file containing the weights. **/
    path:  string;
}

/** Internal description of an input tensor as stored in a .schema.json file.
 *  Tensor data itself is not stored in the .pt.zip file. */
export type InputSchemaItem = {
    /** Shape of the tensor. `null` means dynamic dimension. */
    shape: (number|null)[];
    dtype: DType;
    //no path
}

export type SchemaItem = StateSchemaItem | InputSchemaItem;

export type InferenceSchema = {
    /** Tensors stored in pt zip */
    state_schema: Record<string, StateSchemaItem>;
    /** Tensors provided as input */
    input_schema: Record<string, InputSchemaItem>;
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
    
    const jsonschema:unknown|Error 
        = util.parse_json_no_throw(await contents[schemafile]!.text())
    const schema:InferenceSchema|Error = validate_inference_schema(jsonschema)
    if(schema instanceof Error)
        return schema as Error;
    
    if(Object.keys(schema.input_schema).length > 0)
        return new Error('Expected all schema items to be stored in zip file')

    const tensors:TensorDict|Error = await load_tensors_from_zipcontents(
        schema.state_schema, contents, create_tensor
    )
    if(tensors instanceof Error)
        return tensors as Error;

    return tensors as TensorDict;
}

export function validate_inference_schema(x:unknown): InferenceSchema|Error {
    if(!util.is_object(x))
        return new Error(`Not an inference schema: ${x}`);
    
    const schema:InferenceSchema = {input_schema:{}, state_schema:{}}
    for(const [k,v] of Object.entries(x)) {
        const stateschemaitem:StateSchemaItem|null = validate_state_schema_item(v)
        const inputschemaitem:InputSchemaItem|null = validate_input_schema_item(v)
        if(stateschemaitem != null)
            schema.state_schema[k] = stateschemaitem;
        else if(inputschemaitem != null)
            schema.input_schema[k] = inputschemaitem;
        else
            return new Error(`Invalid schema item: ${v}`)
    }
    return schema;
}


type TensorFactory<T> = (buffer:ArrayBuffer, dtype:DType, shape:number[]) => T|Error;

export async function load_tensors_from_zipcontents<T>(
    stateschema: Record<string, StateSchemaItem>, 
    zipcontents: Files,
    factoryfunc: TensorFactory<T>,
): Promise<Record<string,T>|Error> {
    const tensordict:Record<string,T> = {}

    for(const [name, schemaitem] of Object.entries(stateschema)) {
        const weightfile:File|undefined = zipcontents[schemaitem.path]
        if(weightfile == undefined)
            return new Error(`File ${schemaitem.path} not in zip file`)
        
        const buffer:ArrayBuffer = await weightfile.arrayBuffer()
        const tensor:T|Error = factoryfunc(
            buffer, schemaitem.dtype, schemaitem.shape
        )
        if(tensor instanceof Error)
            return tensor as Error;
        
        tensordict[name] = tensor;
    }
    return tensordict;
}


function validate_state_schema_item(x:unknown): StateSchemaItem|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'shape', util.validate_number_array)
    && util.has_property_of_type(x, 'dtype', validate_dtype)
    && util.has_string_property(x, 'path')){
        return x;
    }
    else return null;
}

function validate_input_schema_item(x:unknown): InputSchemaItem|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'shape', validate_number_or_null_array)
    && util.has_property_of_type(x, 'dtype', validate_dtype)){
        return x;
    }
    else return null;
}

/** Make sure the input is one of the supported dtype identifiers */
export function validate_dtype(x:unknown): DType|null {
    if(util.is_string(x) 
    && (   (x == 'bool') 
        || (x == 'uint8') 
        || (x == 'float32') 
        || (x == 'int64')) 
    ) {
        return x;
    }
    else return null;
}

function is_number_or_null_array(x:unknown): x is (number|null)[] {
    if (!Array.isArray(x)) {
        return false;
    }
    return x.every(
        (x:unknown) => (x==null || util.validate_number(x)!=null)
    )
}
function validate_number_or_null_array(x:unknown): (number|null)[]|null {
    return is_number_or_null_array(x)? x : null;
}



export function create_tensor(
    /** Raw tensor data. If null, will create a new buffer. */
    x:     ArrayBufferLike|null, 
    dtype: DType, 
    shape: number[]
): Tensor<DType>|Error {
    try{
        const buf_or_size: ArrayBufferLike|number = x ?? shape_to_size(shape)
        const x_typed: DTypeArray = to_dtype_array(buf_or_size, dtype)
        return { dtype, shape, data:x_typed }
    } catch(error) {
        return error as Error;
    }
}

/** Compute the total number of elements for a shape */
export function shape_to_size(shape:number[]) {
    if(shape.length == 0)
        //scalar
        return 1;
    
    return shape.reduce(
        (previous:number, current:number) => previous*current
    )
}

/** Convert a buffer to a typed array or create a new one */
function to_dtype_array(x:ArrayBufferLike|number, dtype:DType): DTypeArray {
    // NOTE: no-op to make typescript happy
    // otherwise it complains that it cannot find a call signature
    x = x as ArrayBuffer

    return new DataTypeMap[dtype](x);
}

export function validate_typed_array(x:unknown): DTypeArray|null {
    if(x instanceof Uint8Array      //for uint8 and bool
    || x instanceof Float32Array
    || x instanceof BigInt64Array){
        return x as unknown as DTypeArray;
    }
    else return null;
}

export function validate_tensor(x:unknown): AnyTensor|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'shape', util.validate_number_array)
    && util.has_property_of_type(x, 'dtype', validate_dtype)
    && util.has_property_of_type(x, 'data',  validate_typed_array)){
        return x;
    }
    else return null;
}
