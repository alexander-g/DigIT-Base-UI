import * as errors                      from "../components/errors.ts";
import * as util                        from "../util.ts"



/** Basic information about a model */
export type ModelInfo = {
    name:           string,
    properties?:    {                    //TODO: make this required + null instead of undefined
        known_classes:  string[];
    },
}

export type Settings = {
    /** Currently set model names by type */
    active_models: ActiveModels
}


/** Currently set model names by type */
export type ActiveModels<MODELTYPES extends string = 'detection'> = {
    [key in MODELTYPES] : string;
}

/** Available models and their properties by type */
export type AvailableModels<MODELTYPES extends string = 'detection'> = {
    [key in MODELTYPES] : ModelInfo[];
}




/** Request current settings from backend */
export async function load_settings(
    on_error:errors.error_fn = errors.show_error_toast
): Promise<SettingsResponse> {
    //TODO: use util.fetch_no_throw()
    const response: Response = await util.fetch_with_error(
        ['settings'], () => on_error('Loading settings failed.')
    )

    const settingsresponse:SettingsResponse|Error
        = validate_settings_response(await response.text())

    if(settingsresponse instanceof Error){
        on_error('Loading settings failed. Invalid response data.')
        throw(settingsresponse)
    }
    
    return settingsresponse;
}

/** Search for a model name in a list of modelinfos */
export function find_modelinfo(models:ModelInfo[], modelname:string): ModelInfo|undefined {
    const matches:ModelInfo[] = models.filter( (m:ModelInfo) => m.name == modelname )
    return matches[0]
}





function validate_model_info(x:unknown): ModelInfo|null {
    if(util.is_object(x) && util.has_string_property(x, 'name')) {
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
    if(util.is_object(x)
    && util.has_property_of_type(x, 'detection', util.validate_string)) {
        return x;
    }
    else return null;
}

export function validate_available_models(x:unknown): AvailableModels|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'detection', validate_model_info_array)) {
        return x;
    }
    else return null;
}

export function validate_settings(x:unknown): Settings|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'active_models', validate_active_models)) {
        return x;
    } 
    else return null
}



export type SettingsResponse<
    S  extends Settings        = Settings, 
    AM extends AvailableModels = AvailableModels
> = {
    settings:           S;
    available_models:   AM;
}



export function validate_settings_response(raw_data:string): SettingsResponse|Error {
    let parsed_data: unknown;
    try {
        parsed_data = JSON.parse(raw_data)
    } catch {
        return new Error(`Response is not in JSON format`)
    }

    if(!util.is_object(parsed_data))
        return new Error(`Unexpected settings format: ${parsed_data}`)
    
    if(util.has_property_of_type(parsed_data, 'settings', validate_settings)
    && util.has_property_of_type(parsed_data, 'available_models', validate_available_models)){
        return parsed_data;
    }
    else return new Error(`Unexpected settings format: ${parsed_data}`)
}


