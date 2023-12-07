import { JSX, signals, preact }          from "../dep.ts";
import {Input, Result, ProcessingModule, ExportType} from "../logic/files.ts"
import { process_inputs, download_file } from "./ui_util.ts";
import * as state                        from "./state.ts";
import { zip_files }                     from "../logic/zip.ts";




type DownloadAllProps = {
    items:       readonly state.InputResultPair<Input,Result>[];

    /** Flag indicating that a processing operation is running somewhere. Read-only. */
    $processing: signals.ReadonlySignal<boolean>;

    /** Callback on click */
    on_download_all?: (this:DownloadAllButton, event:MouseEvent) => void;

    /** If provided, create a submenu with additional buttons.
     *  Label of the submenu buttons is given by the key and callback is called on click */
    submenu_callbacks?: Record<string, (this:DownloadAllButton, event:MouseEvent) => void >;
}

/** Button to combine and export all processed results */
export class DownloadAllButton extends preact.Component<DownloadAllProps> {
    static defaultProps: Pick<DownloadAllProps, 'on_download_all'|'submenu_callbacks'> = {
        on_download_all:   this.on_download_all,
        submenu_callbacks: undefined,
    }

    render(props: DownloadAllProps): JSX.Element {
        //TODO: disable button if props.$processing
        let submenu:JSX.Element|null = null
        if(props.submenu_callbacks != undefined) {
            submenu = <div class="menu">
                { 
                    Object.entries(props.submenu_callbacks).map(
                        ([name, cb]:[string, (event:MouseEvent) => void]) => 
                            <div class="item" onClick={cb.bind(this)}>
                                { name }
                            </div>
                    ) 
                }
            </div>
        }

        return <>
            <div 
                class   = "ui simple dropdown download-all item"
                onClick = {props.on_download_all?.bind(this)}
            >
                <i class="download icon"></i>
                Download All
                { submenu }
            </div>
        </>
    }

    // static only to put it into defaultProps
    static async on_download_all(
        this:DownloadAllButton, _event:MouseEvent, format:ExportType = 'annotations'
    ) {
        //TODO: this should be handled somewhere else
        if(this.props.$processing.value)
           return;
        
        const all_results:Result[] = this.props.items.map( 
           (pair:state.InputResultPair<Input,Result>) => pair.$result.value 
        )    
        //TODO: show some error message to user
        if(all_results.length == 0)
            return;
    
        const ResultClass = (all_results[0]?.constructor as typeof Result|undefined)
        //TODO: show error message if empty / or disable button
        const all_exports: Record<string, File> 
            = await ResultClass?.export_combined(all_results, format) ?? {}
        const zip_archive: File|Error = await zip_files(all_exports, 'results.zip')
        if(zip_archive instanceof Error) {
           //TODO: show error message to user
           console.trace(zip_archive.message)
           return;
        }
        download_file(zip_archive)
    }
}


/** {@link DownloadAllButton} with a predefined submenu */
export class DownloadAllWithCSVAndAnnotations extends DownloadAllButton {
    static defaultProps: Pick<DownloadAllProps, 'on_download_all'|'submenu_callbacks'> = {
        on_download_all: undefined,
        submenu_callbacks: {
            'Download CSV':         this.on_download_all_csv,
            'Download Annotations': this.on_download_all,
        }
    }

    static on_download_all_csv(this:DownloadAllButton, event:MouseEvent) {
        return DownloadAllButton.on_download_all.bind(this)(event, 'statistics')
    }
}



type FileTableMenuProps<I extends Input, R extends Result> = {
    /** Which items are currently displayed in the corresponding file table.
     *  These items will be processed on user request. */
    displayed_items:    readonly state.InputResultPair<I,R>[];

    /** Flag indicating that a processing operation is running somewhere. Read+Write. */
    $processing:        signals.Signal<boolean>;

    $processingmodule:  signals.ReadonlySignal< ProcessingModule<I,R>|null >;

    /** Which DownloadButton to include.
     *  @default {@link DownloadAllButton} */
    DownloadButton:     typeof DownloadAllButton;
}

/** A menu on top of a file table containing buttons such as "Process all" */
export class FileTableMenu<I extends Input, R extends Result>
extends preact.Component<FileTableMenuProps<I,R>> {

    static defaultProps: Pick<FileTableMenuProps<Input, Result>, 'DownloadButton'> = {
        DownloadButton: DownloadAllButton,
    }

    render(props: FileTableMenuProps<I,R>): JSX.Element {
        const on_process_all: () => Promise<void> = async () => {
            //TODO: this should be handled somewhere else
            if(props.$processing.value)
                return;
            if(!props.$processingmodule.value)
                return;
            
            props.$processing.value = true;
            await process_inputs(
                props.displayed_items, props.$processingmodule.value
            )
            props.$processing.value = false;
        }

        return (
            <div class="ui top attached menu" style="border-top-width:0px;">
                <ProcessAllButton 
                    {...new ProcessAllButtonProps(props.$processing)} 
                    on_process_all={on_process_all}
                />
                <props.DownloadButton
                    items             = {props.displayed_items}
                    $processing       = {props.$processing}
                />
            </div>
        )
    }
}



class ProcessAllButtonProps {
    /** Flag indicating that a processing operation is running somewhere. Read-only. */
    $processing:    signals.ReadonlySignal<boolean>;

    on_process_all: () => void      =   () => { throw new Error('on_process_all() not set') };
    on_cancel:      () => void      =   () => {} //TODO: detection.cancel_processing_all_files;

    constructor(processing: signals.ReadonlySignal<boolean>) {
        this.$processing = processing;
    }
}

/** Button to trigger processing of all loaded files. Includes status and cancelling. */
export function ProcessAllButton(props:ProcessAllButtonProps): JSX.Element {
    const process_all_css = {
        display:    props.$processing.value?     'none'  :   undefined,
    }
    const cancel_css = {
        display:    !props.$processing.value?    'none'  :   undefined,
    }

    return (
    <>
        <a class="process-all item" onClick={props.on_process_all} style={process_all_css}>
            <i class="blue play icon"></i>
            Process All
        </a>
        <a class="processing item" style={cancel_css}>
            <i class="loading spinner icon"></i>
            {/* TODO: should display progress */}
            Processing... 
        </a>
        <a class="cancel-processing item" onClick={props.on_cancel}  style={cancel_css}>
            <i class="red times icon"></i>
            Cancel
        </a>
    </>
    )
}

ProcessAllButton.defaultprops = ProcessAllButtonProps


