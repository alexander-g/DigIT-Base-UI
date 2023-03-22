import { JSX, preact }                      from "../dep.ts"
import * as util                            from "../util.ts";
import { load_settings }                    from "../logic/settings.ts";
import type { ModelInfo, Settings }         from "../logic/settings.ts";
import { show_error_toast }                 from "./errors.ts";

import { STATE } from "../state.ts"; //TODO: hardcoded


/** The main settings dialog */
export class SettingsModal extends preact.Component {
    ref: preact.RefObject<HTMLDivElement>            = preact.createRef()
    model_selection:preact.RefObject<ModelSelection> = preact.createRef()

    render(): JSX.Element {
        const avmodels: ModelInfo[]|undefined 
            = STATE.available_models.value?.detection //TODO: hardcoded

        return <div class="ui tiny modal" id="settings-dialog" ref={this.ref}>
            <i class="close icon"></i>
            <div class="header"> Settings </div>

            <div class="ui form content">
                <ModelSelection 
                    active_model     = {STATE?.settings?.value?.active_models?.detection}  //TODO: hardcoded
                    available_models = {avmodels}
                    ref              = {this.model_selection}
                />
                <div class="ui divider"></div>
                <OkCancelButtons />
            </div>
        </div>
    }

    async show_modal(): Promise<void> {
        await load_settings() //might fail //TODO: maybe move upstream?
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
            [new Request('/settings', {method:'post', body:JSON.stringify(settings)})],
            () => {show_error_toast('Cannot save settings.')}
        )
    }
}

type ModelSelectionProps = {
    /** Which options to display in the model selection dropdown */
    available_models?: ModelInfo[];
    /** Which option is active in the model selection dropdown */
    active_model?:     string;
}


/** Field to select the currently active model.
 *  TODO: Displays more infos about the model if available.
 */
class ModelSelection extends preact.Component<ModelSelectionProps> {
    dropdown_ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:ModelSelectionProps): JSX.Element {
        return <div class="field">
            <label>Active Model:</label>
            <div class="ui dropdown selection" id="settings-active-model" ref={this.dropdown_ref}>
                <input type="hidden" name="active-model" />
                <i class="dropdown icon"></i>
                <div class="default text"></div>
                <div class="menu">
                    {/* NOTE: children inserted here by Fomantic */}
                </div>
            </div>

        {/* TODO: class properties  */}
        
        </div>
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
    shouldComponentUpdate(props: Readonly<ModelSelectionProps>): boolean {
        const dropdown_el:HTMLDivElement|null = this.dropdown_ref.current;

        if(dropdown_el){
            //update the dropdown options with available models
            type FomanticDropdownItem = {name:string, value:number, selected:boolean}
            const dropdown_items:FomanticDropdownItem[] = props?.available_models?.map(
                (m:ModelInfo, index:number) => ({
                    name        : m.name, 
                    value       : index, 
                    selected    : (m.name == props.active_model) 
                }) 
            ) ?? [] //TODO: display some error instead of empty

            $(dropdown_el).dropdown({
                values:      dropdown_items, 
                showOnFocus: false
            })
        }

        //only update HTML once, fomantic does the rest
        return (dropdown_el == null);
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


type SettingsButtonProps = {
    on_click?: () => void;
}

/** Button in the TopMenu. Opens the SettingsModal */
export function SettingsButton(props:SettingsButtonProps): JSX.Element {
    async function on_click(): Promise<void> {
        await load_settings() //might fail //TODO: maybe move upstream?
        $('#settings-dialog').modal({
            onApprove: console.warn /* TODO */ 
        }).modal('show');
    }

    return <a class="ui simple item" id="settings-button" onClick={props.on_click}>
        <i class="wrench icon"></i>
        <span class="text">Settings</span>
    </a>  
}
