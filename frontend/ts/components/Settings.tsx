import { preact } from "../dep.ts"
import "../jquery_mock.ts"


export function SettingsModal(): preact.JSX.Element {
    return <div class="ui tiny modal" id="settings-dialog">
        <i class="close icon"></i>
        <div class="header"> Settings </div>
    
        <div class="ui form content">
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
    </div>
}


export function SettingsButton(): preact.JSX.Element {
    function on_click(): void {
        //TODO: this.load_settings();
        $('#settings-dialog').modal({onApprove: console.warn}).modal('show');
    }

    return <a class="ui simple item" id="settings-button" onClick={on_click}>
        <i class="wrench icon"></i>
        <span class="text">Settings</span>
    </a>  
}
