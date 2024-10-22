import { 
    Result as BaseResult,
    InputFile,
 } from "./files.ts";
import * as files               from "./files.ts";
import * as util                from "../util.ts";


export class GraphDetectionInput extends InputFile {}


/** Color in RGB space */
type RGB = {
    r:number;
    g:number;
    b:number;
}

/** A Node in a graph, represented by x,y coordinates and width. */
export type PathNode = util.Point & {
    width: number;
}

/** A series of nodes */
export type Path  = PathNode[];

/** A series of paths belonging to the same instance */
export type Graph = {
    paths: Path[];
    color: RGB;
}


export class GraphDetectionResult extends BaseResult {
    graphs: Graph[]|null;

    constructor(...args:[
        ...baseargs: ConstructorParameters<typeof BaseResult>,
        graphs?:     Graph[],
    ]) {
        const [_status, raw, inputname] = args;
        super(_status, raw, inputname)
        this.graphs = args[3] ?? null;
    }


    /** @override */
    async export(): Promise<Record<string, File> | null> {
        if(this.graphs === null){
            return null;
        }

        const exports: Record<string, File> = {};
        if(exports != null){
            //exports['graphs.json'] 
            exports[`${this.inputname}.json`] 
                = new File([JSON.stringify(this.graphs)], `${this.inputname}.json`);
        }
        //TODO:
        // - instancemap
        // - that one format used by other tools
        return exports;
    }

    /** @override */
    static async validate<T extends BaseResult>(
        this: util.ClassWithValidate<T, ConstructorParameters<typeof GraphDetectionResult> >,
        raw:  unknown,
    ): Promise<T|null> {
        const baseresult:BaseResult|null = await super.validate(raw)
        if(baseresult == null)
            return null;
        
        if(raw instanceof File
        && raw.name.endsWith('.json')) {
            const jsonstr:string  = await raw.text()
            const jsonobj:unknown = util.parse_json_no_throw(jsonstr)
            const graphs:Graph[]|null = validate_graphs(jsonobj)
            if(graphs == null)
                return null;
            
            return new this(
                'processed',
                raw,
                baseresult.inputname,
                graphs,
            )
        }

        //TODO: code re-use
        //format {file:File, input:BaseInput}; load file
        if(util.is_object(raw)
        && util.has_property_of_type(raw, 'file',  util.validate_file)
        && util.has_property_of_type(raw, 'input', files.validate_baseinput_type)){
            const match:boolean 
                = files.match_resultfile_to_inputfile(raw.input, raw.file, ['.json'])
            if(match){
                return await this.validate(raw.file)
            }
            else return null;
        }
        else return null;
    }
}


function validate_rgb(x:unknown): RGB|null {
    if(util.is_object(x)
    && util.has_number_property(x, 'r')
    && util.has_number_property(x, 'g')
    && util.has_number_property(x, 'b')){
        return x;
    }
    return null;
}

function validate_pathnode(x:unknown): PathNode|null {
    const p:util.Point|null = util.validate_point(x)
    if(p != null && util.has_number_property(p, 'width')){
        return p;
    }
    return null;
}

function validate_path(x:unknown): Path|null {
    if(util.is_array_of_type(x, validate_pathnode)){
        return x;
    }
    else return null;
}

function validate_paths(x:unknown): Path[]|null {
    if(util.is_array_of_type(x, validate_path)){
        return x;
    }
    else return null;
}

function validate_graph(x:unknown): Graph|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'color', validate_rgb)
    && util.has_property_of_type(x, 'paths', validate_paths)){
        return x;
    }
    else return null;
}

function validate_graphs(x:unknown): Graph[]|null {
    if(util.is_array_of_type(x, validate_graph)){
        return x;
    }
    else return null;
}

