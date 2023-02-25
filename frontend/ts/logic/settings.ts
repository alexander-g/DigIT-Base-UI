import * as errors                      from "../components/errors.ts";
import * as util                        from "../util.ts"
import { STATE }                        from "../state.ts"; //TODO: hard-coded


/** Recursive Partial<T>. Makes all members of T optional including children */
type DeepPartial<T> = T extends Record<string, unknown> ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;


export type Settings = DeepPartial<{
    /** Currently set models by type */
    active_models: {
        /** Currently set model name for detection */
        detection:  string,
    }
}>


/** Basic information about a model */
export type ModelInfo = {
    name:       string,
    properties: unknown,
}


/** Available models and their properties by type */
export type AvailableModels = DeepPartial<{
    /** Available models for detection */
    detection : ModelInfo[]
}>


/** The expected structure of settings returned by the server */
type SettingsResponseData = {
    /** The actual user-settings */
    settings?: DeepPartial<Settings>

    /** Available models and their properties by type */
    available_models?: AvailableModels,
}




export async function load_settings(
    on_error:errors.error_fn = errors.show_error_toast
): Promise<void> {
    const response: Response = await util.fetch_with_error(
        ['/settings'], () => on_error('Loading settings failed.')
    )
    validate_settings_response(await response.text())
}


function validate_settings_response(raw_data: string): void {
    const data: SettingsResponseData = JSON.parse(raw_data)
    if(data.settings)
        STATE.settings.value = data.settings; //TODO: hard-coded

    if(data.available_models)
        STATE.available_models.value = data.available_models //TODO: hard-coded
}
