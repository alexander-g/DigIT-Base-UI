import { JSX, preact }      from "../dep.ts"
import { load_settings }    from "../logic/settings.ts";
import { type ModelInfo }   from "../logic/settings.ts";

import { STATE } from "../state.ts"; //TODO: hardcoded


/** The main settings dialog */
export function SettingsModal(): JSX.Element {
    const avmodels: string[]|undefined 
        = STATE.available_models.value?.detection?.map( (x:ModelInfo) => x.name)  //TODO: hardcoded

    return <div class="ui tiny modal" id="settings-dialog">
        <i class="close icon"></i>
        <div class="header"> Settings </div>

        <div class="ui form content">
            <ModelSelection 
            active_model={STATE.settings.value.active_models?.detection}  //TODO: hardcoded
            available_models={avmodels}
            />
            <div class="ui divider"></div>
            <OkCancelButtons />
        </div>
    </div>
}


type ModelSelectionProps = {
    /** Which options to display in the model selection dropdown */
    available_models?: string[];
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
                    <div class="item">Faster-RCNN</div>
                    <div class="item">Mask-RCNN</div>
                </div>
            </div>

        {/* TODO: class properties  */}
        
        </div>
    }

    /** Dropdown is handled by Fomantic, not preact */
    shouldComponentUpdate(props: Readonly<ModelSelectionProps>): boolean {
        const dropdown_el:HTMLDivElement|null = this.dropdown_ref.current;

        if(dropdown_el){
            type FomanticDropdownItem = {name:string, value:string, selected:boolean}
            const dropdown_items:FomanticDropdownItem[] = props?.available_models?.map(
                (m:string) => {
                    return { name:m, value:m, selected:(m == props.active_model) } 
                }
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

/** Button in the TopMenu. Opens the SettingsModal */
export function SettingsButton(): JSX.Element {
    async function on_click(): Promise<void> {
        await load_settings() //might fail //TODO: maybe move upstream?
        $('#settings-dialog').modal({onApprove: console.warn /* TODO */ }).modal('show');
    }

    return <a class="ui simple item" id="settings-button" onClick={on_click}>
        <i class="wrench icon"></i>
        <span class="text">Settings</span>
    </a>  
}
