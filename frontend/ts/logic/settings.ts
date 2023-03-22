import * as errors                      from "../components/errors.ts";
import * as util                        from "../util.ts"
import { STATE }                        from "../state.ts"; //TODO: hard-coded




/** Basic information about a model */
export type ModelInfo = {
    name:           string,
    properties?:    {                    //TODO: make this required + null instead of undefined
        known_classes:  string[];
    },
}

export type Settings = {
    /** Currently set models by type */
    active_models: ActiveModels
}

export type ActiveModels = {
    /** Currently set model name for detection */
    detection:  string;
}

/** Available models and their properties by type */
export type AvailableModels = {
    /** Available models for detection */
    detection : ModelInfo[]
}




/** Request current settings from backend */
export async function load_settings(
    on_error:errors.error_fn = errors.show_error_toast
): Promise<void> {
    const response: Response = await util.fetch_with_error(
        ['/settings'], () => on_error('Loading settings failed.')
    )
    try {
        set_settings_from_response_default(await response.text())
    } catch (error) {
        on_error('Loading settings failed. Invalid response data.')
        throw(error)
    }
    
}


export function find_modelinfo(models:ModelInfo[], modelname:string): ModelInfo|undefined {
    const matches:ModelInfo[] = models.filter( (m:ModelInfo) => m.name == modelname )
    return matches[0]
}



function has_property<K extends string, T extends Record<never, unknown>>(x:T, key:K): x is T & Record<K, unknown> {
    return (key in x)
}

function has_property_of_type<K extends string, T extends Record<never, unknown>, P>(
    x:T, 
    key:K,
    validate_fn: (x:unknown) => P | null
): x is T & Record<K, P> {
    return has_property(x, key) && (validate_fn(x[key]) != null)
}

function validate_string(x:unknown): string | null {
    if(util.is_string(x)){
        return x;
    }
    else return null;
}

function has_string_property<K extends string, T extends Record<never, unknown>>(x:T, key:K): x is T & Record<K, string>  {
    return has_property_of_type(x, key, validate_string)
}

/** Type guard converting to an empty object.
 *  
 *  NOTE: Using `Record<never, unknown>` for more type safety. */
export function is_object(x:unknown): x is Record<never, unknown> {
    return (typeof x === 'object') && (x !== null) && !Array.isArray(x)
}

function validate_model_info(x:unknown): ModelInfo|null {
    if(is_object(x) && has_string_property(x, 'name')) {
        return x;
    }
    else return null;
}

function validate_model_info_array(x:unknown): ModelInfo[]|null {
    if(Array.isArray(x) && x.every((i:unknown) => validate_model_info(i)!=null )) {
        return x;
    }
    else return null;
}


function validate_active_models(x:unknown): ActiveModels|null {
    if(is_object(x)
    && has_property_of_type(x, 'detection', validate_string)) {
        return x;
    }
    else return null;
}

export function validate_available_models(x:unknown): AvailableModels|null {
    if(is_object(x)
    && has_property_of_type(x, 'detection', validate_model_info_array)) {
        return x;
    }
    else return null;
}

export function validate_settings(x:unknown): Settings|null {
    if(is_object(x)
    && has_property_of_type(x, 'active_models', validate_active_models)) {
        return x;
    } 
    else return null
}



type SettingsResponse = {
    settings:           Settings, 
    available_models:   AvailableModels
}

export function validate_settings_response(raw_data: string): SettingsResponse {
    const parsed_data: unknown = JSON.parse(raw_data)
    if(!is_object(parsed_data))
        throw new Error(`Unexpected settings format: ${parsed_data}`)
    
    console.log(parsed_data)

    let settings:Settings|null = null;
    if(has_property_of_type(parsed_data, 'settings', validate_settings))
        settings = parsed_data.settings;
    else
        throw new Error('Cannot parse settings')

    let available_models:AvailableModels|null = null;
    if(has_property_of_type(parsed_data, 'available_models', validate_available_models))
        available_models = parsed_data.available_models
    else
        throw new Error('Cannot parse available models')
    
    return {settings, available_models}
}


/** Update global STATE with new settings from backend */
export function set_settings_from_response_default(raw_data:string): void {
    const response:SettingsResponse         = validate_settings_response(raw_data)
    globalThis.STATE.settings.value         = response.settings;
    globalThis.STATE.available_models.value = response.available_models;
}
