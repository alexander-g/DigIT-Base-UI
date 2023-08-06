import { Result as BaseResult, MaybeInstances } from "./files.ts";
import * as util                    from "../util.ts"
import * as boxes                   from "./boxes.ts";
import { FlaskProcessing }          from "./flask_processing.ts";

export class Input extends File {}


/** Object detection result */
export class ObjectdetectionResult extends BaseResult {
    /** Boxes and labels of objects */
    instances:  MaybeInstances = null;

    //currently need to this.apply() after super()  //TODO: fix this
    constructor(...args:ConstructorParameters<typeof BaseResult>) {
        super(...args)
        this.apply(this.raw)
    }

    /** @override */
    async export(): Promise<Record<string, File>|null> {
        const exports: Record<string, File>|null = await super.export() ?? {}
        if(this.status != 'processed')
            return null;
        
        const jsondata:string  = export_as_labelme_json(this)
        // deno-lint-ignore no-inferrable-types
        const filename:string  = `${this.inputname}.json`
        exports[filename] = new File([jsondata], filename)
        return exports;
    }
    
    apply(raw:unknown): this | null {
        if( super.apply(raw) == null )
            return null;

        if(util.is_object(raw)
        && util.has_property_of_type(raw, 'boxes', boxes.validate_4_number_arrays)
        && util.has_property_of_type(raw, 'labels', util.validate_string_array)) {
            this.instances = raw.boxes.map(
                (boxarray:boxes.FourNumbers, i:number) => ({
                    box     : boxes.Box.from_array(boxarray), 
                    label   : raw.labels[i]!
                })
            );

            return this;
        }
        else return null;
    }
}

export class ObjectdetectionFlaskProcessing extends FlaskProcessing<ObjectdetectionResult> {
    ResultClass: util.ClassWithValidate<ObjectdetectionResult> = ObjectdetectionResult;
}


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
