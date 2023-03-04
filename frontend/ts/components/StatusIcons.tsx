import { JSX, signals }                 from "../dep.ts";
import { AppFileState, ResultStatus }   from "../state.ts";



type StatusIconProps = {
    file:       Readonly<AppFileState>;
}


/** Icons representing the processing status of a file in each file table row */
export function FileTableStatusIcons(props:StatusIconProps): JSX.Element {
    const status: ResultStatus = props.file.$result.value.status;
    const css_unprocessed = {
        display: boolean_to_display(status == 'unprocessed')
    }
    const css_processed = {
        display: boolean_to_display(status == 'processed')
    }

    return <>
        <i class="image outline   unprocessed status icon" style={css_unprocessed}></i>
        <i class="image             processed status icon" style={css_processed}>  </i>
        <i class="yellow exclamation triangle status icon" style="display:none"></i>
        <i class="loading spinner             status icon" style="display:none"></i>
    </>
}


function boolean_to_display(x:boolean): 'none'|undefined {
    return x ? undefined : 'none';
}
