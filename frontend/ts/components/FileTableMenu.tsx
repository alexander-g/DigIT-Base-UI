import { JSX, signals, preact }          from "../dep.ts";
import {Input, Result, ProcessingModule} from "../logic/files.ts"
import { process_inputs, download_file } from "./ui_util.ts";
import * as state                        from "./state.ts";
import { zip_files }                     from "../logic/zip.ts";



type FileTableMenuProps<I extends Input, R extends Result> = {
    /** Which items are currently displayed in the corresponding file table.
     *  These items will be processed on user request. */
    displayed_items:    readonly state.InputResultPair<I,R>[];

    /** Flag indicating that a processing operation is running somewhere. Read+Write. */
    $processing:        signals.Signal<boolean>;

    processingmodule:   ProcessingModule<I,R>;
}

/** A menu on top of a file table containing buttons such as "Process all" */
export function FileTableMenu<I extends Input, R extends Result>(
    props:FileTableMenuProps<I,R>
): JSX.Element {
    const on_process_all: () => Promise<void> = async () => {
        //TODO: this should be handled somewhere else
        if(props.$processing.value)
            return;
        
        props.$processing.value = true;
        await process_inputs(props.displayed_items, props.processingmodule)
        props.$processing.value = false;
    }

    const on_export_all: () => Promise<void> = async () => {
        //TODO: this should be handled somewhere else
        if(props.$processing.value)
            return;
        
        const all_results:R[] = props.displayed_items.map( 
            (pair:state.InputResultPair<I,R>) => pair.$result.value 
        )
        const all_exports: Record<string, File> = await export_all(all_results)
        const zip_archive: File|Error = await zip_files(all_exports, 'results.zip')
        if(zip_archive instanceof Error) {
            console.trace(zip_archive.message)
            return;
        }
        download_file( zip_archive )
    }

    return (
        <div class="ui top attached menu" style="border-top-width:0px;">
            <ProcessAllButton 
                {...new ProcessAllButtonProps(props.$processing)} 
                on_process_all={on_process_all}
            />
            <DownloadAllButton
                $processing={props.$processing}
                on_download_all={on_export_all}
            />
        </div>
    )
}

/** Export and re-organize a list of results */
export async function export_all<R extends Result>(
    results: readonly R[]
): Promise<Record<string, File>> {
    const collection: Record<string, File> = {};
    for (const result of results) {
        const exportfiles: Record<string, File> | null = await result.export()
        if (exportfiles == null)
            continue;

        if (Object.keys(exportfiles).length <= 1) {
            //single file, add directly to the list
            Object.assign(collection, exportfiles)
        } else {
            //multiple files, create a subfolder
            for (const exportfile of Object.values(exportfiles))
                collection[`${result.inputname}/${exportfile.name}`] = exportfile;
        }
    }
    return collection
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



type DownloadAllProps = {
    /** Flag indicating that a processing operation is running somewhere. Read-only. */
    $processing: signals.ReadonlySignal<boolean>;

    /** Callback on click */
    on_download_all: () => void;
}

/** Button to combine and export all processed results */  //TODO: csv / annotations
export class DownloadAllButton extends preact.Component<DownloadAllProps> {
    render(props: DownloadAllProps): JSX.Element {
        //TODO: disable button if props.$processing

        return <>
            <div class="ui simple dropdown download-all item" onClick={props.on_download_all}>
                <i class="download icon"></i>
                Download All
            </div>
        </>
    }
}

