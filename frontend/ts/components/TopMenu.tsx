import { JSX, preact } from "../dep.ts"
import { SettingsButton } from "./Settings.tsx"
import { page_wide_css } from "./styles.ts";
import { SettingsModal } from "./Settings.tsx"


function Logo(): JSX.Element {
    return <div class="header item" style="padding-top:0; padding-bottom:0">
        <img class="logo" src="logo.svg" />
    </div>
}


export class TopMenu extends preact.Component {
    settings_modal: preact.RefObject<SettingsModal> = preact.createRef()

    render(): JSX.Element {
        return <>
            <div class="ui container menu page-wide" style={page_wide_css}>
                <Logo />
                {/* TODO: file menu */}
                <SettingsButton on_click={() => this.settings_modal.current?.show_modal()}/>
            </div>
            
            <SettingsModal ref={this.settings_modal} />
        </>
    }
}