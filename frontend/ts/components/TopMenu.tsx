import { JSX, preact }      from "../dep.ts"
import { SettingsButton }   from "./Settings.tsx"
import { page_wide_css }    from "./styles.ts";
import * as Settings        from "./Settings.tsx"
import * as file_input      from "../file_input.ts";
import { Constructor }      from "../util.ts";


function Logo(): JSX.Element {
    return <div class="header item" style="padding-top:0; padding-bottom:0">
        <img class="logo" src="logo.svg" />
    </div>
}

type FileMenuItemProps = {
    /** Which text to display in the menu item */
    labeltext:      string,
    /** Unique id */
    id:             string,
    /** Passed to the class attribute, should be a Fomantic icon class */
    icon_class:     string,
    /** Callback for new files */
    on_change:      JSX.GenericEventHandler<HTMLInputElement>,
    /** Passed to the accept attribute, which file types to filter */
    accept?:        string,
    /** Additional keyword arguments for the input element */
    kwargs?:        Record<string, boolean|string|number>
}

/** Single item in the file menu */
function FileMenuItem(props:FileMenuItemProps): JSX.Element {
    return <>
        <label for={props.id} class="ui icon item">
            <i class={ props.icon_class + " icon" }></i>
            { props.labeltext }
        </label>
        <input 
            type        =   "file" 
            id          =   { props.id }
            style       =   "display:none"
            onChange    =   { props.on_change }
            accept      =   { props.accept }
            multiple 
            {...props.kwargs}
        />
    </>
}

/** Menu dropdown with several items for selection of input and annotation files */
function FileMenu(): JSX.Element {
    return (
    <a class="ui simple dropdown item">
        <i class="file icon"></i>
        <span class="text">
            Files
        </span>
        <i class="dropdown icon"></i>
        <div class="ui menu">
            <FileMenuItem 
                labeltext   =   "Load Input Images"
                id          =   'input-images'
                icon_class  =   "images outline"
                accept      =   "image/jpeg, image/tiff" 
                on_change   =   { on_inputfiles_selected }
            />

            <FileMenuItem 
                labeltext   =   "Load Input Folder"
                id          =   'input-folder'
                icon_class  =   "folder outline"
                kwargs      =   { {webkitdirectory:true, directory:true} }
                on_change   =   { on_inputfolder_selected }
            />

            <div class="ui divider"></div>

            <FileMenuItem
                labeltext   =   "Load Annotations"
                id          =   'input-annotations'
                icon_class  =   "images"
                // TODO: this should be modifiable downstream
                accept      =   "application/json, application/zip, application/x-zip-compressed" 
                on_change   =   { on_annotationfiles_selected }
            />

            {/* {{ filemenu_extras | indent(8) }} */}
        </div>
    </a> 
    )
}

function on_inputfiles_selected(event:Event): void {
    file_input.load_list_of_files_default(
        (event.target as HTMLInputElement|null)?.files ?? []
    )
}

function on_inputfolder_selected(event:Event): void {
    file_input.load_inputfiles(
        (event.target as HTMLInputElement|null)?.files ?? []
    )
}

function on_annotationfiles_selected(event:Event): void {
    file_input.load_resultfiles(
        (event.target as HTMLInputElement|null)?.files ?? []
    )
}

/** Menu bar on the top of the page, containing file menu and settings button */
export class TopMenu extends preact.Component<Settings.SettingsModalProps> {
    settings_modal: preact.RefObject<Settings.SettingsModal> = preact.createRef()

    /** @virtual Overwritten downstream */
    SettingsModal: Constructor<Settings.SettingsModal>  = Settings.SettingsModal

    render(): JSX.Element {
        return <>
            <div class="ui container menu page-wide" style={page_wide_css}>
                <Logo />
                <FileMenu />
                <SettingsButton on_click={() => this.settings_modal.current?.show_modal()}/>
            </div>
            
            <this.SettingsModal
                ref                 = {this.settings_modal}
                $available_models   = {this.props.$available_models} 
                $settings           = {this.props.$settings}
                load_settings_fn    = {this.props.load_settings_fn}
            />
        </>
    }
}