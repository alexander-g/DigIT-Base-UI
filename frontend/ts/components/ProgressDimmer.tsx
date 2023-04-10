import { preact, JSX, signals }         from "../dep.ts";
import { ResultState }                  from "../state.ts";
import { ResultStatus }                 from "../logic/files.ts"
import { boolean_to_display_css }       from "./ui_util.ts";


type ProgressDimmerProps = {
    result: signals.ReadonlySignal<ResultState>;
}


/** Overlay over a FileTableContent to indicate that processing is on and to prevent race conditions */
export class ProgressDimmer extends preact.Component<ProgressDimmerProps> {
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:ProgressDimmerProps): JSX.Element {
        //whether to show the "progressing" spinner or the "failed" error message
        //TODO: use JSX instead of CSS
        const failed:boolean = (props.result.value.status == 'failed')
        const processing_css = {
            display:    boolean_to_display_css(!failed),
        }
        const failed_css = {
            display:    boolean_to_display_css(failed),
        }

        return (
            <div class="ui dimmer" ref={this.ref}>
                <div class="content processing" style={processing_css}>
                    <h2 class="ui inverted icon header">
                        <i class="spinner loading icon"></i>
                        <p>Processing...</p>
                    </h2>
                </div>
                <div class="content failed"  style={failed_css}>
                    <h2 class="ui inverted icon header">
                        <p>Processing failed</p>
                    </h2>
                    {/* TODO: optional extra  message */}
                    <p>Click to continue</p>
                </div>
            </div>
        )
    }

    /** Call fomantic to show or hide the dimmer */
    componentDidMount(): void {
        signals.effect(() => {
            const ref:HTMLDivElement|null = this.ref.current;
            if(ref == null)
                return;

            const status: ResultStatus = this.props.result.value.status;
            if(status == 'processing' || status == 'failed'){
                $(ref).dimmer({closable:(status=='failed')})
                $(ref).dimmer('show')
            } else {
                $(ref).dimmer('hide')
            }
        })
    }
}

