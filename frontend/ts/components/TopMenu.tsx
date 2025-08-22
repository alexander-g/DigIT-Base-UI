import { JSX, preact }      from "../dep.ts"
import { SettingsButton }   from "./Settings.tsx"
import { page_wide_css }    from "./styles.ts";
import { Constructor }      from "../util.ts";
import type { Settings } from "../logic/settings.ts";


function Logo(): JSX.Element {
    return <div class="header item" style="padding-top:0; padding-bottom:0">
        <img class="logo" src="logo.svg" style="width:100%; max-height:28px;" />
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
    on_change:      (files:FileList|File[]) => unknown;
    /** Passed to the accept attribute, which file types to filter */
    accept?:        string,
    /** Additional keyword arguments for the input element */
    kwargs?:        Record<string, boolean|string|number>
}

/** Single item in the file menu */
function FileMenuItem(props:FileMenuItemProps): JSX.Element {
    const callback:JSX.GenericEventHandler<HTMLInputElement> = function(event:Event){
        props.on_change((event.target as HTMLInputElement).files ?? [])
    }

    return <>
        <label for={props.id} class="ui icon item">
            <i class={ props.icon_class + " icon" }></i>
            { props.labeltext }
        </label>
        <input 
            type        =   "file" 
            id          =   { props.id }
            style       =   "display:none"
            onChange    =   { callback }
            accept      =   { props.accept }
            readonly    =   { true }
            multiple 
            {...props.kwargs}
        />
    </>
}


type FileMenuProps = {
    on_inputfiles:      (files:FileList|File[]) => unknown;
    on_inputfolder:     (files:FileList|File[]) => unknown;
    on_annotationfiles: (files:FileList|File[]) => unknown;

    /** Which file types to accept in the input file dialog */
    input_filetypes:    string[];
}


/** Menu dropdown with several items for selection of input and annotation files */
function FileMenu(props:FileMenuProps): JSX.Element {
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
                accept      =   { props.input_filetypes.join(',') } 
                on_change   =   { props.on_inputfiles }
            />

            <FileMenuItem 
                labeltext   =   "Load Input Folder"
                id          =   'input-folder'
                icon_class  =   "folder outline"
                kwargs      =   { {webkitdirectory:true, directory:true} }
                on_change   =   { props.on_inputfolder }
            />

            <div class="ui divider"></div>

            <FileMenuItem
                labeltext   =   "Load Annotations"
                id          =   'input-annotations'
                icon_class  =   "images"
                // TODO: this should be modifiable downstream
                accept      =   "application/json, application/zip, application/x-zip-compressed" 
                on_change   =   { props.on_annotationfiles }
            />

            {/* {{ filemenu_extras | indent(8) }} */}
        </div>
    </a> 
    )
}


type TopMenuProps<S extends Settings = Settings> = FileMenuProps & {
    on_open_settings: () => void;
};


/** Menu bar on the top of the page, containing file menu and settings button */
export class TopMenu extends preact.Component<TopMenuProps> {

    render(): JSX.Element {
        return <>
            <div class="ui container menu page-wide" style={page_wide_css}>
                <Logo />
                <FileMenu 
                    on_inputfiles      = {this.props.on_inputfiles}
                    on_inputfolder     = {this.props.on_inputfolder}
                    on_annotationfiles = {this.props.on_annotationfiles}
                    input_filetypes    = {this.props.input_filetypes}
                />
                <SettingsButton on_click = {this.props.on_open_settings}/>
            </div>
        </>
    }
}