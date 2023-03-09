import { JSX, signals }             from "../dep.ts";
import { Instance }                 from "../logic/boxes.ts";

type BoxesOverlayProps = {
    $instances:      signals.ReadonlySignal<Instance[]>;
    //TODO: $visible (but with code re-use)
}

/** A result overlay that displays boxes */
export function BoxesOverlay(props:BoxesOverlayProps): JSX.Element {
    const boxes: JSX.Element[] = props.$instances.value.map(
        (inst:Instance) => <BoxOverlay />
    )

    return (
        <div class="boxes overlay">
            { boxes }
        </div>
    )
}


function BoxOverlay(): JSX.Element {
    return (
        <div class="box">

        </div>
    )
}

