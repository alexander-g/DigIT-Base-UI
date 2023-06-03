import { JSX, signals }             from "../dep.ts";
import {Input, Result, ProcessingModule} from "../logic/files.ts"
import { process_inputs }           from "./ui_util.ts";
import * as state                   from "./state.ts";




type FileTableMenuProps<I extends Input, R extends Result> = {
    /** Which items are currently displayed in the corresponding file table.
     *  These items will be processed on user request. */
    displayed_items:    readonly state.InputResultPair<I,R>[];

    /** Flag indicating that a processing operation is running somewhere. Set here. */
    $processing:        signals.Signal<boolean>;

    processingmodule:   ProcessingModule<I,R>;
}

/** A menu on top of a file table containing buttons such as "Process all" */
export function FileTableMenu<I extends Input, R extends Result>(props:FileTableMenuProps<I,R>): JSX.Element {
    const on_process_all: () => Promise<void> = async () => {
        //TODO: this should be handled somewhere else
        if(props.$processing.value)
            return;
        
        props.$processing.value = true;
        await process_inputs(props.displayed_items, props.processingmodule)
        props.$processing.value = false;
    }

    return (
        <div class="ui top attached menu" style="border-top-width:0px;">
            <ProcessAllButton 
                {...new ProcessAllButtonProps(props.$processing)} 
                on_process_all={on_process_all}
            />
        </div>
    )
}




class ProcessAllButtonProps {
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



