import { Settings }         from "./logic/settings.ts";
import { Input, Result }    from "./logic/files.ts";


export type TypeConfig<
    IF extends Input        = Input,
    R  extends Result       = Result,
    MT extends string       = any,
    S  extends Settings     = Settings,
> = {
    Input:      IF;
    Result:     R;
    /** Union of model type names, e.g `"detection"|"tracking"` */
    ModelTypes: MT;
    Settings:   S;
}

export type BaseConfig = TypeConfig<Input, Result, 'detection', Settings>

