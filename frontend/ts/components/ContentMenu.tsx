import { preact, JSX, Signal, signals }     from "../dep.ts";
import { Result, Input, InputResultPair }   from "./state.ts";
import { process_inputs }           from "./ui_util.ts";
import * as ui_util                 from "./ui_util.ts";
import { zip_files }                from "../logic/zip.ts";
import { ProcessingModule }         from "../logic/files.ts";

type ContentMenuProps<I extends Input, R extends Result> = InputResultPair<I,R> & {
    $processingmodule:  signals.ReadonlySignal< ProcessingModule<I,R>|null >

    /** Flag indicating whether to show the result or not. Set here. */
    $result_visible:    Readonly<Signal<boolean>>

    /** Additional buttons to display in the content menu */
    children?:          preact.ComponentChildren

    /** Menu items to show to the view menu */
    view_menu_items?:   JSX.Element[];

    /** Button with popup that displays instructions.
     *  @default {@link HelpButton } */
    help_button?:       JSX.Element;
};

/** A menu bar for every image, containing control buttons */
export function ContentMenu<I extends Input, R extends Result>(
    props: ContentMenuProps<I,R>
): JSX.Element {
    let play_button: JSX.Element|null = null;
    if(props.$processingmodule.value) 
        play_button = <PlayButton 
            inputresultpair  = {props} 
            processingmodule = {props.$processingmodule.value}
        />
    
    return (
        <div
            class = "ui bottom attached secondary icon menu"
            style = "border-top-width:0px; margin-bottom:0px;"
        >
            { play_button }
            {
                //add a ViewMenu only if there are any menu items to show
                (!props.view_menu_items?.length)
                ? null
                : <ViewMenu menu_items={props.view_menu_items}/>
            }
            {/* <ViewMenu menu_items={props.view_menu_items}/> */}
            { props.children }
            <DownloadButton $result={props.$result} />
            { props.help_button ?? <HelpButton /> }
        </div>
    );
}




type PlayButtonProps<I extends Input, R extends Result> = {
    inputresultpair:    InputResultPair<I,R>;
    
    processingmodule:   ProcessingModule<I,R>
};

/** Button to trigger the processing of a single input file */
class PlayButton<I extends Input, R extends Result> 
extends preact.Component<PlayButtonProps<I,R>> {
    render(props: PlayButtonProps<I,R>): JSX.Element {
        //TODO: disable when processing is going on somewhere
        return (
            <a
                class           =   "process item"
                onClick         =   {
                    () => process_inputs(
                        [props.inputresultpair], props.processingmodule
                    )
                }
                data-tooltip    =   "Process Image"
                data-position   =   "bottom left"
            >
                <i class="play icon"></i>
            </a>
        );
    }
}



type ViewMenuProps = {
    menu_items?:    JSX.Element[],
}

/** Button with dropdown that contains control elements regarding the presentation */
export function ViewMenu(props: ViewMenuProps): JSX.Element {
    return (
        <div class="ui simple dropdown icon item view-menu-button">
            <i class="eye icon"></i>
            <div class="menu view-menu">
                {  props.menu_items  }
            </div>
        </div>
    );
}


type CheckboxProps = {
    /** @input Flag indicating whether or not the checkbox is enabled/disabled */
    $active:    Readonly<Signal<boolean>>
    
    /** @output Flag representing whether the checkbox is checked/unchecked */
    $value:     Signal<boolean>

    /** Label text to display next to the checkbox */
    label:      string;
}

/** Generic checkbox using signals */
export class Checkbox extends preact.Component<CheckboxProps> {
    /** Ref to the <div> element acting as a Fomantic checkbox */
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:CheckboxProps): JSX.Element {
        const processed:boolean = props.$active.value;
        const disabled:string   = processed?  '' : 'disabled';

        return <div class={"ui item checkbox show-results-checkbox " + disabled} ref={this.ref}>
            <input 
                type        = "checkbox" 
                checked     = {props.$value} 
                onChange    = {this.on_click.bind(this)}
            />
            <label style="padding-top:2px;">{ this.props.label }</label>
        </div>
    }

    on_click() {
        this.props.$value.value = !this.props.$value.value
    }

    override componentDidMount(): void {
        //need to initialize although docs say works without javascript
        if(this.ref.current)
            $(this.ref.current).checkbox()
    }
}



type ShowResultsCheckboxProps = {
    /** Signal of {@link Result} whose `status` determines whether the checkbox is active */
    $result:    Readonly<Signal<Result>>;
    /** @output The value of the checkbox */
    $visible:   Signal<boolean>;
    /** @optional Text beside the checkbox @default "Show Results" */
    label?:     string;
}

/** A checkbox to toggle results */
export function ShowResultsCheckbox(props: ShowResultsCheckboxProps): JSX.Element {
    const $active: Readonly<Signal<boolean>> = signals.computed(
        () => props.$result.value.status == 'processed'
    )
    return <Checkbox
        $active     = {$active}
        $value      = {props.$visible}
        label       = {props.label ?? "Show Results"}
    />
}




type DownloadButtonProps = {
    $result:            Readonly<Signal<Result>>;
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
                () => download_single_result(props.$result.peek())
            }
            data-tooltip    =   "Download Result"
            data-position   =   "bottom left"
        >
            <i class="download icon"></i>
        </a>
    );
}

/** Format the results of a single file and download */
export async function download_single_result(result:Result): Promise<void> {
    const exportfiles:Record<string, File>|null = await result.export()
    if(!exportfiles){
        console.trace('result.export() failed')
        //TODO error message to the user?
        return;
    }
    
    const exportpaths:string[] = Object.keys(exportfiles)
    if(exportpaths.length == 1){
        //single file, download as is
        const exportfile:File = exportfiles[exportpaths[0]!]!
        ui_util.download_file( exportfile )
    } else {
        //multiple files, zip into an archive first
        const archivename         = `${result.inputname}.zip`
        const zipfile:File|Error  = await zip_files(exportfiles, archivename)
        if(zipfile instanceof Error){
            console.trace('Zipping results failed')
            //TODO: error message to the user
            return;
        }
        ui_util.download_file( zipfile )
    }
}




type HelpButtonProps = {
    children?: preact.ComponentChildren
}

/** Not a real button, but a popup that displays usage information */
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
    override componentDidMount(): void {
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
