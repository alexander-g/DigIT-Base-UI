import { preact, JSX, Signal }      from "../dep.ts";
import { Result, ResultState, InputFile, InputFileState }   from "../state.ts";
import { export_result_to_file }    from "../logic/download.ts";
import { process_files }            from "./FileTableMenu.tsx";
import * as ui_util                 from "./ui_util.ts";

type ContentMenuProps = {
    inputfile:          InputFile;
    $result:            Signal<ResultState>;

    /** Flag indicating if box drawing is activated. 
     *  If undefined no New-Box button is shown */
    box_drawing_mode?: Signal<boolean>;

    /** Additional menu items to pass to the view menu */
    view_menu_extras?: JSX.Element[];
};

/** A menu bar for every image, containing control buttons */
export function ContentMenu(props: ContentMenuProps): JSX.Element {
    let new_box_button: JSX.Element|null = null;
    if(props.box_drawing_mode)
        new_box_button = <NewBoxButton drawing_mode_active={props.box_drawing_mode}/>
    
    return (
        <div
            class = "ui bottom attached secondary icon menu"
            style = "border-top-width:0px; margin-bottom:0px;"
        >
            <PlayButton     inputfile={props.inputfile} $result={props.$result} />
            <ViewMenu       $result={props.$result} extra_items={props.view_menu_extras}/>
            { new_box_button }
            <DownloadButton inputfile={props.inputfile} $result={props.$result} />
            <HelpButton />
        </div>
    );
}




type PlayButtonProps = {
    inputfile:   InputFile;
    $result:     Signal<ResultState>;
    callback?:  (f: InputFile) => void;
};

/** Button to trigger the processing of a single input file */
function PlayButton(props: PlayButtonProps): JSX.Element {
    const callback_fn: typeof props.callback 
        = props.callback ?? ((f:InputFile) => process_files([{input:new InputFileState(f), $result:props.$result}]))
    
    //TODO: disable when processing is going on somewhere
    return (
        <a
            class           =   "process item"
            onClick         =   {() => callback_fn(props.inputfile)}
            data-tooltip    =   "Process Image"
            data-position   =   "bottom left"
        >
            <i class="play icon"></i>
        </a>
    );
}



type ViewMenuProps = {
    $result:        Signal<ResultState>;
    extra_items?:   JSX.Element[],
}

/** Button with dropdown that contains control elements regarding the presentation */
export function ViewMenu(props: ViewMenuProps): JSX.Element {
    return (
        <div class="ui simple dropdown icon item view-menu-button">
            <i class="eye icon"></i>
            <ViewMenuDropdown $result={props.$result} extra_items={props.extra_items}/>
        </div>
    );
}

function ViewMenuDropdown(props:ViewMenuProps): JSX.Element {
    return (
        <div class="menu view-menu">
            <ShowResultsCheckbox result={props.$result.value}/>
            { props.extra_items }
        </div>
    )
}


type ShowResultsCheckboxProps = {
    result:    ResultState;
}

/** A checkbox to toggle results */
class ShowResultsCheckbox extends preact.Component<ShowResultsCheckboxProps> {
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:ShowResultsCheckboxProps): JSX.Element {
        const processed:boolean = ( props.result.status == 'processed')
        const disabled:string   = processed?  '' : 'disabled'
        return (
            <div class={"ui item checkbox show-results-checkbox " + disabled} ref={this.ref}>
                <input 
                    type        = "checkbox" 
                    checked     = {props.result.$visible} 
                    onChange    = {this.on_click.bind(this)}
                />
                <label style="padding-top:2px;">Show results</label>
            </div>
        )
    }

    on_click() {
        const $visible: Signal<boolean> | undefined 
            = this.props.result.$visible
        
        if($visible)
            $visible.value = !$visible.value
    }

    componentDidMount(): void {
        //need to initialize although docs say works without javascript
        if(this.ref.current)
            $(this.ref.current).checkbox()
    }
}



type DownloadButtonProps = {
    inputfile:          InputFile;
    $result:            Signal<ResultState>;
}


/** Button to trigger the download of a single result.
 *  Disabled if the corresponding input file has not been processed yet.
 *  //TODO: also disable when processing a batch of files.
 */
export function DownloadButton(props:DownloadButtonProps): JSX.Element {
    const enabled:boolean  = (props.$result.value.status == 'processed')
    const disabled: string = enabled ? "" : "disabled";
    return (
        <a
            class           =   {"download item " + disabled}
            onClick         =   {
                () => download_single_result(props.inputfile, props.$result.peek())
            }
            data-tooltip    =   "Download Result"
            data-position   =   "bottom left"
        >
            <i class="download icon"></i>
        </a>
    );
}

/** Format the results of a single file and download */
export function download_single_result(input:InputFile, result:Result): void {
    const jsondata:File|null = export_result_to_file({input, result})
    if(jsondata)
        ui_util.download_blob(jsondata, jsondata.name)
}




type HelpButtonProps = {
    children?: preact.ComponentChildren
}

/** Not a realbutton, but a popup that displays usage information */
export class HelpButton extends preact.Component<HelpButtonProps> {
    ref: preact.RefObject<HTMLAnchorElement> = preact.createRef()

    render(): JSX.Element {
        return <>
            <a class="item help-menu-button" ref={this.ref}>
                <i class="help icon"></i>
            </a>
            <div class="ui segment flowing popup">
                <ul class="ui list">
                    <li><b>SHIFT + Drag</b> to move the image</li>
                    <li><b>SHIFT + Mouse wheel</b> to zoom</li>
                    <li><b>SHIFT + Double-click</b> to reset</li>
                    {this.props.children}
                </ul>
            </div>
        </>
    }

    /** Initialize the Fomantic popup */
    componentDidMount(): void {
        $(this.ref.current).popup({ hoverable: false });
    }
}


type NewBoxButtonProps = {
    /** When on, user can add new boxes */
    drawing_mode_active: Signal<boolean>;
}

export function NewBoxButton(props:NewBoxButtonProps): JSX.Element {
    function on_click() {
        props.drawing_mode_active.value = !props.drawing_mode_active.value;
    }
    const active_class:string = props.drawing_mode_active.value ? 'active' : '';

    return (
    <a 
        class           =   {"item new-box "+active_class} 
        onClick         =   {on_click}
        data-tooltip    =   "Add New Box" 
        data-position   =   "bottom left"
    >
      <i class="vector square icon"></i>
    </a>
    )
}
