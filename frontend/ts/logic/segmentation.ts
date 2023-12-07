import { Result as BaseResult } from "./files.ts";
import * as util                from "../util.ts"
import { FlaskProcessing }      from "./flask_processing.ts";


export class Input extends File {}


export class SegmentationResult extends BaseResult {
    /** URL to a classmap (segmentation result) */
    classmap: string|null = null;

    constructor(
        ...args:[
            ...baseargs:  ConstructorParameters<typeof BaseResult>, 
            classmap?:     string,
        ]
    ){
        super(args[0], args[1], args[2])
        this.classmap = args[3] ?? null
    }

    async export(): Promise<Record<string, File>|null> {
        const exports: Record<string, File>|null = await super.export() ?? {}
        
        if(this.classmap != null) {
            const classmap: Blob|Error = await util.fetch_image_as_blob(this.classmap)
            if(!(classmap instanceof Error))
                exports['classmap.png'] = new File([classmap], 'classmap.png')
        }
        return exports;
    }

    static async validate<T extends BaseResult>(
        this: new (...args:ConstructorParameters<typeof SegmentationResult>) => T, 
        raw:  unknown
    ): Promise<T|null> {
        const baseresult:BaseResult|null = await super.validate(raw)
        if(baseresult == null)
            return null;
        
        if(util.is_object(raw)
        && util.has_string_property(raw, 'classmap')) {
            return new this('processed', raw, baseresult.inputname, raw.classmap)
        }
        else return null;
    }
}

export class SegmentationFlaskProcessing extends FlaskProcessing<SegmentationResult> {
    constructor(){
        super(SegmentationResult)
    }
}

