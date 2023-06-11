import { Result as BaseResult } from "./files.ts";
import * as util                from "../util.ts"
import type {  ClassWithValidate } from "../util.ts";
import { FlaskProcessing }      from "./flask_processing.ts";


export class Input extends File {}


export function SegmentationResultMixin<R extends ClassWithValidate<BaseResult>>(BaseClass: R) {
    return class SegmentationResult extends BaseClass {
        /** URL to a classmap (segmentation result) */
        classmap: string|null = null;

        async export(): Promise<Record<string, File>|null> {
            const exports: Record<string, File>|null = await super.export() ?? {}
            exports['classmap'] = new File([], 'TODO.jpg')
            return exports;
        }

        static validate(raw: unknown): SegmentationResult | null {
            return ( new SegmentationResult() ).apply(raw)
        }

        apply(raw:unknown): SegmentationResult | null {
            if(super.apply(raw) == null)
                return null
            
            if(util.is_object(raw)
            && util.has_string_property(raw, 'classmap')) {
                this.classmap = raw.classmap
                return this;
            }
            else return null;
        }
    }
}

export class SegmentationResult extends SegmentationResultMixin(BaseResult){}

export class SegmentationFlaskProcessing extends FlaskProcessing<SegmentationResult> {
    ResultClass: util.ClassWithValidate<SegmentationResult> = SegmentationResult;
}

