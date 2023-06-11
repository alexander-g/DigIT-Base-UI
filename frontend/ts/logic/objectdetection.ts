import { Result as BaseResult, MaybeInstances } from "./files.ts";
import * as util                from "../util.ts"
import type {  ClassWithValidate }  from "../util.ts";
import * as boxes                   from "./boxes.ts";
import { FlaskProcessing }          from "./flask_processing.ts";

export class Input extends File {}

export function ObjectdetectionResultMixin<R extends ClassWithValidate<BaseResult>>(BaseClass: R) {
    return class ObjectdetectionResult extends BaseClass {
        /** Boxes and labels of objects */
        instances:  MaybeInstances = null;

        // deno-lint-ignore no-explicit-any
        constructor(...args:any[]) {
            super(...args)

            this.apply(this.raw)
        }

        /** @override */
        async export(): Promise<Record<string, File>|null> {
            const exports: Record<string, File>|null = await super.export() ?? {}
            exports['instances'] = new File([], 'TODO.csv')
            return exports;
        }

        /** @override */
        static validate(raw: unknown): ObjectdetectionResult | null {
            return (new ObjectdetectionResult()).apply(raw)
        }
        
        apply(raw:unknown): ObjectdetectionResult | null {
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
}

/** Object detection result */
export class ObjectdetectionResult extends ObjectdetectionResultMixin(BaseResult){}

export class ObjectdetectionFlaskProcessing extends FlaskProcessing<ObjectdetectionResult> {
    ResultClass: util.ClassWithValidate<ObjectdetectionResult> = ObjectdetectionResult;
}



