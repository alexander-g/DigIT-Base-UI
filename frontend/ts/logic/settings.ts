import * as util from "../util.ts"



/** Basic information about a model */
export type ModelInfo = {
    name:           string,
    properties?:    {                    //TODO: make this required + null instead of undefined
        known_classes:  string[];
    },
}

export type Settings<MODELTYPES extends string = never> = {
    /** Currently set model names by type */
    active_models: ActiveModels<MODELTYPES>;
}

type ModelTypesOfSettings<S extends Settings> = keyof S['active_models']

/** Currently set model names by type */
export type ActiveModels<MODELTYPES extends string> = Record<MODELTYPES, string>

/** Available models and their properties by type */
export type AvailableModels<S extends Settings> 
    = Record<ModelTypesOfSettings<S>, ModelInfo[]>

export type SettingsResponse<
    S  extends Settings = Settings
> = {
    settings:           S;
    available_models:   AvailableModels<S>;
}


export type BaseModelTypes       = 'detection'
export type BaseSettings         = Settings<BaseModelTypes>;
export type BaseActiveModels     = ActiveModels<BaseModelTypes>;
export type BaseAvailableModels  = AvailableModels<BaseSettings>
export type BaseSettingsResponse = SettingsResponse<BaseSettings>



/** Search for a model name in a list of modelinfos. Returns `null` on error. */
export 
function find_modelinfo(models:ModelInfo[], modelname:string): ModelInfo|null {
    const matches:ModelInfo[] = models.filter( 
        (m:ModelInfo) => m.name == modelname
    )
    return matches[0] ?? null;
}

/** Abstract interface for an object that knows how to store settings
 *  persistently and load them back */
export abstract class SettingsHandler<S  extends Settings = Settings> {
    abstract load(): Promise<SettingsResponse<S>|Error>;
    abstract store(settings:S): Promise<true|Error>;
}


export abstract class RemoteSettingsHandler<S extends Settings> 
extends SettingsHandler<S> {
    async load(): Promise<SettingsResponse<S>|Error> {
        const response: Response|Error = await util.fetch_no_throw('settings')
        if(response instanceof Error){
            return response as Error;
        }
        else return this._validate_response(response);
    }

    async store(settings:S): Promise<true|Error> {
        const response:Response|Error = await util.fetch_no_throw(
            'settings', {method:'post', body:JSON.stringify(settings)}
        )
        if(response instanceof Error){
            return response as Error;
        }
        else return true;
    }
    
    async _validate_response(r:Response): Promise<SettingsResponse<S>|Error>{
        const responsedata:string = await r.text()
        const jsondata:unknown|Error = util.parse_json_no_throw(responsedata)
        if(jsondata instanceof Error)
            return new Error(`Settings response not in JSON format: ${r}`)

        if(util.is_object(jsondata)
        && util.has_property_of_type(
            jsondata, 'settings', this._validate_settings
        )
        && util.has_property_of_type(
            jsondata, 'available_models', this._validate_available_models)
        ){
            return jsondata as SettingsResponse<S>;
        }
        else return new Error(`Unexpected settings format: ${jsondata}`)
    }

    
    abstract _validate_settings(raw:unknown): S|null;

    abstract _validate_available_models(raw:unknown): AvailableModels<S>|null;
}


export class BaseSettingsHandler extends RemoteSettingsHandler<BaseSettings> {
    _validate_settings(raw: unknown): BaseSettings | null {
        return validate_settings(raw)
    }

    _validate_available_models(raw: unknown): BaseAvailableModels|null {
        return validate_available_models(raw)
    }
}


function validate_model_info(x:unknown): ModelInfo|null {
    if(util.is_object(x) && util.has_string_property(x, 'name')) {
        return x;
    }
    else return null;
}

function validate_model_info_array(x:unknown): ModelInfo[]|null {
    if(Array.isArray(x) 
    && x.every((i:unknown) => validate_model_info(i)!=null )) {
        return x;
    }
    else return null;
}


function validate_active_models(x:unknown): BaseActiveModels|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'detection', util.validate_string)) {
        return x;
    }
    else return null;
}

export function validate_available_models(x:unknown): BaseAvailableModels|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'detection', validate_model_info_array)) {
        return x;
    }
    else return null;
}

export function validate_settings(x:unknown): BaseSettings|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'active_models', validate_active_models)) {
        return x;
    } 
    else return null
}


