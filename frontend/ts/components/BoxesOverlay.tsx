import { JSX, signals }             from "../dep.ts";
import { Instance }                 from "../logic/boxes.ts";

type BoxesOverlayProps = {
    $instances:      signals.ReadonlySignal<readonly Instance[]>;
    //TODO: $visible (but with code re-use)
}

/** A result overlay that displays boxes */
export function BoxesOverlay(props:BoxesOverlayProps): JSX.Element {
    const boxes: JSX.Element[] = props.$instances.value.map(
        (inst:Instance) => <BoxOverlay instance={inst}/>
    )

    return (
        <div class="boxes overlay">
            { boxes }
        </div>
    )
}


/** An individual box */
function BoxOverlay(props:{instance:Instance}): JSX.Element {
    const {x0,y0,x1,y1} = props.instance.box;
    //dummy values, for testing only
    const position_css  = {
        top:    "10%",
        left:   "10%",
        width:  "20%",
        height: "30%",
    }

    return (
        <div class="box box-overlay" style={position_css}>

        </div>
    )
}

