import { show_error_toast } from "../components/errors.ts";
import { STATE }            from "../state.ts";


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



type error_fn = (msg:string) => void;

export async function load_settings(on_error:error_fn = show_error_toast): Promise<void> {
    let response:Response;
    try {
        response = await fetch('/settings')
    } catch (error) {
        //no connection to server
        on_error('Loading settings failed. No connection to backend.')
        throw(error)
    }

    if(!response.ok){
        //server responded with error
        on_error('Loading settings failed.')
        //console.error('Loading settings failed.', response)
        throw( new Error(`Loading settings response code: ${response.status}`) )
    }

    validate_settings_response(await response.text())
}


function validate_settings_response(raw_data: string): void {
    const data: SettingsResponseData = JSON.parse(raw_data)
    if(data.settings)
        STATE.settings.value = data.settings;

    if(data.available_models)
        STATE.available_models.value = data.available_models
}
