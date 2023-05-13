import { Settings } from "./logic/settings.ts";
import { InputFile, Result } from "./logic/files.ts";


export type TypeConfig<
    IF extends InputFile    = InputFile,
    R  extends Result       = Result,
    MT extends string       = any,
    S  extends Settings     = Settings,
> = {
    InputFile:  IF;
    Result:     R;
    /** Union of model type names, e.g `"detection"|"tracking"` */
    ModelTypes: MT;
    Settings:   S;
}

export type BaseConfig = TypeConfig<InputFile, Result, 'detection', Settings>

