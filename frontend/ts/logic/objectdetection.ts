import { Result as BaseResult, ExportType } from "./files.ts";
import { Input as BaseInput }               from "./files.ts";
import * as files                   from "./files.ts"
import * as util                    from "../util.ts"
import * as boxes                   from "./boxes.ts";
import { FlaskProcessing }          from "./flask_processing.ts";
import { ModelInfo }                from "../logic/settings.ts";


/** The input for object detection is a single file */
export class Input extends File implements BaseInput  {}

/** Immutable array of Instance to avoid unintentional modification.
 *  Can be also null to indicate that no boxes are available. */
export type MaybeInstances = readonly boxes.Instance[] | null;

/** Object detection result */
export class ObjectdetectionResult extends BaseResult {
    /** Boxes and labels of objects */
    instances:  MaybeInstances = null;

    constructor(...args:[
        ...baseargs: ConstructorParameters<typeof BaseResult>,
        instances?:  MaybeInstances,
    ]) {
        super(args[0], args[1], args[2])
        this.instances = args[3] ?? null;
    }

    /** @override */
    async export(what:ExportType = 'annotations'): Promise<Record<string, File>|null> {
        const exports: Record<string, File>|null = await super.export(what) ?? {}
        if(this.status != 'processed')
            return null;
        
        const jsondata:string  = export_as_labelme_json(this)
        // deno-lint-ignore no-inferrable-types
        const filename:string  = `${this.inputname}.json`
        exports[filename] = new File([jsondata], filename)
        return exports;
    }

    /** @override */
    // deno-lint-ignore require-await
    static async export_combined(
        results: BaseResult[],
        format:  ExportType,
    ): Promise<Record<string, File> | null> {
        if(format != 'statistics')
            return super.export_combined(results, format)
        
        const objdet_results: ObjectdetectionResult[] = []
        for(const result of results)
            if(result instanceof this)
                objdet_results.push(result)
        if(objdet_results.length != results.length)
            return null;                                 //TODO: return an error
        
        const f = new File([export_results_as_csv(objdet_results)], 'statistics.csv')
        return {[f.name]: f}
    }

    static async validate<T extends BaseResult>(
        this: util.ClassWithValidate<T, ConstructorParameters<typeof ObjectdetectionResult> >,
        raw:  unknown
    ): Promise<T|null> {
        const baseresult: BaseResult|null = await super.validate(raw)
        if( baseresult == null )
            return null;

        //format provided by the backend
        if(util.is_object(raw)
        && util.has_property_of_type(raw, 'boxes', boxes.validate_4_number_arrays)
        && util.has_property_of_type(raw, 'labels', util.validate_string_array)) {
            const instances: MaybeInstances = raw.boxes.map(
                (boxarray:boxes.FourNumbers, i:number) => ({
                    box     : boxes.Box.from_array(boxarray), 
                    label   : raw.labels[i]!
                })
            );
            return new this('processed', raw, baseresult.inputname, instances);
        }
        //LabelMe json format as exported by {@link export_as_labelme_json()}
        if(util.is_object(raw)
        && util.has_property_of_type(raw, 'shapes', validate_labelme_shapes)){
            const instances: MaybeInstances = raw.shapes.map( (shape:LabelMeShape) => ({
                    label: shape.label,
                    box:   {
                        x0: shape.points[0][0], 
                        y0: shape.points[0][1], 
                        x1: shape.points[1][0], 
                        y1: shape.points[1][1], 
                    }
                })
            )
            return new this('processed', raw, baseresult.inputname, instances);
        }

        //format {file:File, input:BaseInput}; load file
        if(util.is_object(raw)
        && util.has_property_of_type(raw, 'file',  util.validate_file)
        && util.has_property_of_type(raw, 'input', files.validate_baseinput_type)){
            const match:boolean 
                = files.match_resultfile_to_inputfile(raw.input, raw.file, ['.json'])
            if(match){
                let jsondata:unknown;
                try {
                    jsondata = JSON.parse(await raw.file.text())
                } catch (_error) {
                    return null
                }
                return await this.validate(jsondata)
            }
            else return null;
        }
        else return null;
    }
}

export class ObjectdetectionFlaskProcessing extends FlaskProcessing<ObjectdetectionResult> {
    constructor(){
        super(ObjectdetectionResult)
    }
}



//TODO: confidence + metadata
/** Export a {@link ObjectdetectionResult} to the LabelMe format 
 *  (https://github.com/wkentaro/labelme) */
export function export_as_labelme_json(result:ObjectdetectionResult): string {
    // deno-lint-ignore no-explicit-any
    const shapes: any[] = []
    for(const instance of result.instances ?? []) {
        const shape = {
            label:      instance.label,
            line_color: null,
            fill_color: null,
            points: [ [ instance.box.x0, instance.box.y0 ],
                      [ instance.box.x1, instance.box.y1 ] ],
            shape_type: "rectangle",
            flags: {}
        }
        shapes.push(shape)
    }
    const jsondata = {
        //version: "3.16.2",
        flags:     {},
        shapes:    shapes,
        lineColor: [ 0, 255, 0, 128 ],
        fillColor: [255,  0, 0, 128 ],
        imagePath: result.inputname,
        imageData: null
    }
    return JSON.stringify(jsondata, null, 2)
}

type LabelMeBox = [[number, number], [number, number]]

type LabelMeShape = {
    label:  string;
    points: LabelMeBox;
}

function validate_labelme_shapes(x:unknown): LabelMeShape[]|null {
    if(util.is_array_of_type(x, validate_labelme_shape)){
        return x;
    }
    else return null;
}

function validate_labelme_shape(x:unknown): LabelMeShape|null {
    if(util.is_object(x)
    && util.has_string_property(x, 'label')
    && util.has_property_of_type(x, 'points', validate_labelme_box)){
        return x;
    }
    else return null;
}

function validate_labelme_box(x:unknown): LabelMeBox|null {
    if(util.is_array_of_type(x, validate_2_number_array)
    && x.length == 2){
        return x as LabelMeBox;
    }
    else return null;
}

function validate_2_number_array(x:unknown): [number, number]|null {
    if(util.is_number_array(x)
    && x.length == 2) {
        return x as [number, number];
    }
    else return null;
}





export function collect_all_classes(
    results:       ObjectdetectionResult[], 
    active_model?: ModelInfo
): string[] {
    const labelset = new Set<string>(active_model?.properties?.known_classes);
    labelset.delete('background')
  
    for (const result of results) {
        for (const instance of result.instances ?? []) {
            labelset.add(instance.label);
        }
    }
    labelset.delete('')
    return Array.from(labelset);
}


/** Export a list of {@link ObjectdetectionResult} to a tabular CSV format 
 *  @example
 *  Filename, Bananas, Potatos
 *  image0.jpg, 65, 0
 *  image1.jpg, 99, 2
 *  */
export function export_results_as_csv(results:ObjectdetectionResult[]): string {
    const all_classes:string[] = collect_all_classes(results)
    const header = `Filename, ${ all_classes.join(', ') }`
    const lines:string[] = [header]

    for(const result of results) {
        const counts:number[] = Array(all_classes.length).fill(0)
        for(const instance of result?.instances ?? []) {
            const index:number = all_classes.indexOf(instance.label)
            if(index >= 0 && index <= counts.length)
                counts[index] += 1
            //else should not happen
        }
        const line = `${result.inputname}, ${counts.join(', ')}`
        lines.push(line)
    }
    return lines.join('\n')
}
