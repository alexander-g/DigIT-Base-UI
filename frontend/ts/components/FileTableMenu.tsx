import { JSX, signals }             from "../dep.ts";
import * as detection               from "../logic/detection.ts";
import * as state                   from "../state.ts";




type FileTableMenuProps = {
    displayed_files:    state.InputResultPair[];
    $processing:        signals.Signal<boolean>;
}

/** A menu on top of a file table containing buttons such as "Process all" */
export function FileTableMenu(props:FileTableMenuProps): JSX.Element {
    const on_process_all: () => Promise<void> = async () => {
        //TODO: this should be handled somewhere else
        if(props.$processing.value)
            return;
        
        props.$processing.value = true;
        await detection.process_files(
            props.displayed_files.map( (x:state.InputResultPair) => x.input)
            //TODO: callbacks
        )
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
    on_cancel:      () => void      =   detection.cancel_processing_all_files;

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


/** Remove the result from a file and indicate that processing is in progress */
function mark_result_as_processing($result:signals.Signal<state.ResultState>): void {
    $result.value = new state.ResultState('processing')
}

/** Remove the result from a file and indicate that processing has failed */
function mark_result_as_failed($result:signals.Signal<state.ResultState>): void {
    $result.value = new state.ResultState('failed')
}


