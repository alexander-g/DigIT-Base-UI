import { JSX, preact, Signal }              from "../dep.ts"
import * as util                            from "../util.ts";
import * as settings                        from "../logic/settings.ts";
import type { ModelInfo, Settings, AvailableModels }         from "../logic/settings.ts";
import { show_error_toast }                 from "./errors.ts";



export type SettingsModalProps = {
    $settings:          Signal<Settings|undefined>;
    $available_models:  Signal<AvailableModels|undefined>;
}


/** The main settings dialog */
export class SettingsModal extends preact.Component<SettingsModalProps> {
    ref: preact.RefObject<HTMLDivElement>            = preact.createRef()
    model_selection:preact.RefObject<ModelSelection> = preact.createRef()

    render(props:SettingsModalProps): JSX.Element {
        const avmodels: ModelInfo[]|undefined 
            = props.$available_models.value?.detection

        return <div class="ui tiny modal" id="settings-dialog" ref={this.ref}>
            <i class="close icon"></i>
            <div class="header"> Settings </div>

            <div class="ui form content">
                <ModelSelection 
                    active_model     = {props.$settings.value?.active_models?.detection}
                    available_models = {avmodels}
                    ref              = {this.model_selection}
                />
                <div class="ui divider"></div>
                <OkCancelButtons />
            </div>
        </div>
    }

    async show_modal(): Promise<void> {
        await settings.load_settings() //might fail
        $(this.ref.current).modal({
            onApprove: this.save_settings.bind(this)
        }).modal('show');
    }

    async save_settings(): Promise<void> {
        if(!this.model_selection.current)
            return;
        
        const model:ModelInfo|undefined = this.model_selection.current?.get_selected()
        if(!model) {
            show_error_toast('Cannot save settings: No model selected')
            return
        }

        const settings:Settings = {active_models:{detection : model.name}}
        await util.fetch_with_error(
            [new Request('settings', {method:'post', body:JSON.stringify(settings)})],
            () => {show_error_toast('Cannot save settings.')}
        )
    }
}

type ModelDropdownProps = {
    /** Which options to display in the model selection dropdown */
    available_models?: ModelInfo[];
    /** Which option is displayed in the model selection dropdown (not yet saved) */
    selected_model:    Signal<string|undefined>;
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
    shouldComponentUpdate(props: Readonly<ModelDropdownProps>): boolean {
        const dropdown_el:HTMLDivElement|null = this.dropdown_ref.current;

        if(dropdown_el){
            //update the dropdown options with available models
            type FomanticDropdownItem = {name:string, value:number, selected:boolean}
            const dropdown_items:FomanticDropdownItem[] = props?.available_models?.map(
                (m:ModelInfo, index:number) => ({
                    name        : m.name, 
                    value       : index, 
                    selected    : (m.name == props.selected_model.value ) 
                }) 
            ) ?? [] //TODO: display some error instead of empty

            $(dropdown_el).dropdown({
                values:      dropdown_items, 
                showOnFocus: false,
                onChange:    (_i:number, modelname:string) => {
                    props.selected_model.value = modelname}
                ,
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
}

/**
 * Dropdown to select a model and additiona infobox with known classes for the selected model.
 */
class ModelSelection extends preact.Component<ModelSelectionProps> {
    private dropdown_ref:preact.RefObject<ModelDropdown> = preact.createRef()
    private selected_model: Signal<string|undefined>     = new Signal()

    render(props:ModelSelectionProps): JSX.Element {
        if(this.selected_model.value == undefined)
            this.selected_model.value = props.active_model;
        
        const modelname:string|undefined = this.selected_model.value
        
        let known_classes: JSX.Element|undefined;
        if(props.available_models && modelname) {
            const active_model_info: ModelInfo|undefined
                = settings.find_modelinfo(props.available_models, modelname)
            
            if(active_model_info)
                known_classes = <KnownClasses modelinfo={active_model_info} />
        }

        return (
        <div class="field">
            <label>Active Model:</label>
            <ModelDropdown 
                available_models = {props.available_models}
                selected_model   = {this.selected_model}
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


export function OkCancelButtons(): JSX.Element {
    return <div class="ui form content">
        <div class="actions">
            <div class="ui negative button">
                Cancel
            </div>
            <div class="ui positive right labeled icon button" id="settings-ok-button">
                Save
                <i class="checkmark icon"></i>
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
