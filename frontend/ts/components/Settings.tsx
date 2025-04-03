import { JSX, preact, Signal, signals }              from "../dep.ts"
import * as settings                        from "../logic/settings.ts";
import type { 
    ModelInfo, 
    Settings, 
    AvailableModels,
    SettingsResponse,
}         from "../logic/settings.ts";
import { show_error_toast }                 from "./errors.ts";
import * as ui_util from "./ui_util.ts"



export
type SettingsModalProps<S extends Settings> = {
    $settings:          Signal<S|undefined>;
    $available_models:  Signal<AvailableModels<S>|undefined>;

    settingshandler:    settings.SettingsHandler<S>;
}


/** The main settings dialog */
export abstract class SettingsModal<
    S  extends Settings              = Settings<never>, 
    P  extends SettingsModalProps<S> = SettingsModalProps<S> > 
extends preact.Component<P> {
    
    ref: preact.RefObject<HTMLDivElement>            = preact.createRef()
    model_selection:preact.RefObject<ModelSelection> = preact.createRef()

    $saving: Signal<boolean> = new Signal(false);

    render(props:P): JSX.Element {
        return <div class="ui tiny modal" id="settings-dialog" ref={this.ref}>
            <i class="close icon"></i>
            <div class="header"> Settings </div>

            <div class="ui form content">
                { this.form_content() }
                <div class="ui divider"></div>
                <OkCancelButtons $saving={this.$saving}/>
            </div>
        </div>
    }

    /** @virtual The main content, what to display in the modal */
    abstract form_content(): JSX.Element[];

    async #load_settings(): Promise<true|Error> {
        const settingsresponse:SettingsResponse<S>|Error 
            = await this.props.settingshandler.load()
        if(settingsresponse instanceof Error){
            show_error_toast('Could not load settings', settingsresponse)
            return settingsresponse as Error;
        }
        this.props.$settings.value = settingsresponse.settings;
        this.props.$available_models.value = settingsresponse.available_models;
        return true;
    }

    async show_modal(): Promise<void> {
        this.$saving.value = false;
        const status: true|Error = await this.#load_settings()
        if(status instanceof Error)
            return

        $(this.ref.current).modal({
            onApprove: this.on_save_settings
        }).modal('show');
    }

    /** Get all values in the modal as set by user and convert to a Settings object 
     *  @virtual */
    abstract collect_settings_from_widgets(): S|Error;

    on_save_settings = () => {
        // no await
        this.save_settings()

        // do not close the modal yet, will close manually in save_settings()
        return false;
    }

    async save_settings(): Promise<true|Error> {
        this.$saving.value = true;
        const settings:S|Error = this.collect_settings_from_widgets()
        if(settings instanceof Error){
            console.error(settings.message)
            $(this.ref.current).modal('hide')
            return settings as Error;
        }
        
        const status:true|Error = await this.props.settingshandler.store(settings)
        if(status instanceof Error){
            show_error_toast('Could not save settings', status as Error)
        }
        await this.#load_settings()
        $(this.ref.current).modal('hide')
        return true;
    }
}


export class BaseSettingsModal extends SettingsModal<settings.BaseSettings>{
    /** @override */
    collect_settings_from_widgets(): settings.BaseSettings|Error {
        if(!this.model_selection.current)
            return new Error('Unexpected error');

        const model:ModelInfo|undefined = this.model_selection.current?.get_selected()
        if(!model) {
            //TODO: return new Error() instead
            const error = new Error('Cannot save settings: No model selected')
            show_error_toast(error.message)
            return error;
        }

        return  {active_models:{detection : model.name}}
    }

    /** @override */
    form_content(): JSX.Element[] {
        const avmodels: ModelInfo[]|undefined 
            = this.props.$available_models.value?.detection
        const activemodel: string|undefined 
            = this.props.$settings.value?.active_models?.detection

        return [
             <ModelSelection 
                active_model     = {activemodel}
                available_models = {avmodels}
                ref              = {this.model_selection}
                label            = {"Active model"}
            />
        ]
    }
}



type ModelDropdownProps = {
    /** Which options to display in the model selection dropdown */
    available_models?: ModelInfo[];
    /** Which option is displayed in the model selection dropdown (not yet saved) */
    selected_model:    string|undefined;
}


/** Field to select the currently active model.
 *  Displays more infos about the model if available.
 */
class ModelDropdown extends preact.Component<ModelDropdownProps> {
    dropdown_ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:ModelDropdownProps): JSX.Element {
        return (
            <div class="ui dropdown selection" id="settings-active-model" ref={this.dropdown_ref}>
                <input type="hidden" name="active-model" />
                <i class="dropdown icon"></i>
                <div class="default text"></div>
                <div class="menu">
                    {/* NOTE: children inserted here by Fomantic */}
                </div>
            </div>
        )
    }

    get_selected(): ModelInfo|undefined {
        const selected:number|undefined 
            = $(this.dropdown_ref.current).dropdown('get value');
        if(!selected)
            return undefined
        
        const model:ModelInfo|undefined 
            = this.props.available_models?.[selected]
        return model
    }

    /** Dropdown is handled by Fomantic, not preact */
    override shouldComponentUpdate(props: Readonly<ModelDropdownProps>): boolean {
        const dropdown_el:HTMLDivElement|null = this.dropdown_ref.current;

        if(dropdown_el){
            //update the dropdown options with available models
            type FomanticDropdownItem = {name:string, value:number, selected:boolean}
            const dropdown_items:FomanticDropdownItem[] = props.available_models?.map(
                (m:ModelInfo, index:number) => ({
                    name        : m.name, 
                    value       : index, 
                    selected    : (m.name == props.selected_model ) 
                }) 
            ) ?? [] //TODO: display some error instead of empty
            if(props.selected_model == '')
                dropdown_items.push({
                    name:     '[UNSAVED MODEL]',
                    value:    dropdown_items.length,
                    selected: true,
                })
            

            $(dropdown_el).dropdown({
                values:      dropdown_items, 
                showOnFocus: false,
                onChange:    (_i:number, modelname:string) => {
                    //props.$selected_model.value = modelname
                },
            })
        }

        //only update HTML once, fomantic does the rest
        return (dropdown_el == null);
    }
}


type ModelSelectionProps = {
    /** Which options to display in the model selection dropdown */
    available_models?: ModelInfo[];
    /** Which option is currently set in the settings (not necessarily diplayed) */
    active_model?:     string;

    /** Text to display above the dropdown */
    label:             string;
}

/** Dropdown to select a model and additiona infobox with known classes 
 *  for the selected model. */
export class ModelSelection extends preact.Component<ModelSelectionProps> {
    private dropdown_ref:preact.RefObject<ModelDropdown> = preact.createRef()
    //private $selected_model: Signal<string|undefined>    = new Signal()

    render(props:ModelSelectionProps): JSX.Element {
        //if(this.$selected_model.value == undefined)
        //    this.$selected_model.value = props.active_model;
        
        //const modelname:string|undefined = this.$selected_model.value
        const modelname:string|undefined = props.active_model;
        
        let known_classes: JSX.Element|undefined;
        if(props.available_models && modelname) {
            const active_model_info: ModelInfo|null
                = settings.find_modelinfo(props.available_models, modelname)
            
            if(active_model_info)
                known_classes = <KnownClasses modelinfo={active_model_info} />
        }

        return (
        <div class="field">
            <label>{ this.props.label }</label>
            <ModelDropdown 
                available_models = {props.available_models}
                selected_model   = {modelname}
                ref              = {this.dropdown_ref}
            />

            { known_classes }
        </div>
        )
    }

    get_selected(): ModelInfo|undefined {
        return this.dropdown_ref.current?.get_selected();
    }
}


type OkCancelButtonProps = {
    /** Optional flag indicating if to disable buttons and show a spinner */
    $saving?: Readonly<Signal<boolean>>
}

export function OkCancelButtons(props:OkCancelButtonProps): JSX.Element {
    const saving:boolean   = props.$saving?.value ?? false;
    const disabled:string  = saving? 'disabled' : '';
    const save_text:string = saving? 'Saving...' : 'Save'
    const save_icon:string = saving? 'loading spinner' : 'checkmark';
    return <div class="ui form content">
        <div class="actions">
            <div class={"ui negative button "+disabled}>
                Cancel
            </div>
            <div 
                class={"ui positive right labeled icon button "+disabled} 
                id="settings-ok-button"
            >
                { save_text }
                <i class={save_icon+" icon"}></i>
            </div>
        </div>
    </div>
}

/** A small Fomantic UI label showing the name of a known class */
function KnownClassLabel(props:{classname:string}): JSX.Element {
    return <div class="ui label"> 
        { props.classname }
    </div>
}

/** Info box listing which classes a model was trained on */
function KnownClasses(props:{modelinfo:ModelInfo}): JSX.Element {
    const known_classes_css = {
        /* scroll bar for long list of known classes */
        overflow:   'auto',
        maxHeight:  '50vh',
        paddingTop: '5px',
    }
    const known_class_labels: JSX.Element[] | undefined 
        = props.modelinfo?.properties?.known_classes.map( 
            (c:string) => <KnownClassLabel classname={c} /> 
        )
    
    if(known_class_labels)
        return (
            <div class="ui labels known-classes" style={known_classes_css}>
                <b>Known classes:</b>
                { known_class_labels }
            </div>
        )
    else
        return <></>
}




type SettingsButtonProps = {
    on_click?: () => void;
}

/** Button in the TopMenu. Opens the SettingsModal */
export function SettingsButton(props:SettingsButtonProps): JSX.Element {
    return <a class="ui simple item" id="settings-button" onClick={props.on_click}>
        <i class="wrench icon"></i>
        <span class="text">Settings</span>
    </a>  
}





type CheckboxedFieldProps = {
    children:       preact.ComponentChildren;

    /** Short text above the checkbox */
    checkbox_title: string;
    /** Text beside the checkbox */
    checkbox_label: string;
    /** State of the checkbox */
    checkbox_value: boolean
}

/** Checkbox that controls if its children are displayed */
export class CheckboxedField extends preact.Component<CheckboxedFieldProps> {
    $checkbox_value: Signal<boolean> = new Signal<boolean>(this.props.checkbox_value)
    
    render(props:CheckboxedFieldProps): JSX.Element {
        const $val:Signal<boolean> = this.$checkbox_value;
        //update the internal signal with new extern value
        //$val.value = props.checkbox_value;

        return <>
            <div class="field">
                <label>{ props.checkbox_title }</label>
                <div class="ui toggle checkbox">
                    <input 
                        type     = "checkbox" 
                        checked  = {$val} 
                        onChange = {() => $val.value = !$val.value} 
                    />
                    <label>{ props.checkbox_label }</label>
                </div>
            </div>

            <div style={{display:ui_util.boolean_to_display_css($val.value)}}>
                { props.children }
            </div>
        </>
    }

    get_value(): boolean {
        return this.$checkbox_value.value;
    }

}