import { JSX, ReadonlySignal }          from "../dep.ts";
import { Result }                       from "./state.ts";
import { ResultStatus }                 from "../logic/files.ts";
import { boolean_to_display_css }       from "./ui_util.ts";



type StatusIconProps = {
    $result: ReadonlySignal<Result>;
}


/** Icons representing the processing status of a file in each file table row */
export function FileTableStatusIcons(props:StatusIconProps): JSX.Element {
    const status: ResultStatus = props.$result.value.status;
    const css_unprocessed = {
        display: boolean_to_display_css(status == 'unprocessed')
    }
    const css_processed = {
        display: boolean_to_display_css(status == 'processed')
    }
    const css_processing = {
        display: boolean_to_display_css(status == 'processing')
    }
    const css_failed = {
        display: boolean_to_display_css(status == 'failed')
    }

    return <>
        <i class="image outline   unprocessed status icon" style={css_unprocessed}></i>
        <i class="image             processed status icon" style={css_processed}>  </i>
        <i class="yellow exclamation triangle status icon" style={css_failed}>     </i>
        <i class="loading spinner             status icon" style={css_processing}> </i>
    </>
}


