import { preact, JSX, ReadonlySignal }      from "../dep.ts";
import { Instance }                         from "../logic/boxes.ts";
import { ImageSize }                        from "../util.ts";

type BoxesOverlayProps = {
    $instances:      ReadonlySignal<readonly Instance[]>;
    imagesize:       ImageSize;

    /** Called when the user requested some changes to the boxes */
    on_new_instances: (x:Instance[]) => void;

    //TODO: $visible (but with code re-use)
}

/** A result overlay that displays boxes */
export function BoxesOverlay(props:BoxesOverlayProps): JSX.Element {

    function on_remove(x: Instance) {
        const instances: readonly Instance[]    = props.$instances.value;
        const index: number                     = instances.indexOf(x)

        const new_instances: Instance[] 
            = [...instances.slice(0, index), ...instances.slice(index+1)]
        props.on_new_instances(new_instances)
    }

    const boxes: JSX.Element[] = props.$instances.value.map(
        (inst:Instance) => 
            <BoxOverlay 
                instance    =   {inst} 
                imagesize   =   {props.imagesize}
                on_remove   =   {on_remove}
            />
    )

    return (
        <div class="boxes overlay">
            { boxes }
        </div>
    )
}


type BoxOverlayProps = {
    instance:       Instance,
    imagesize:      ImageSize;

    /** Called when user wants to remove a box */
    on_remove:      (x:Instance) => void;
}

/** An individual box. Contains class label, and some controls. */
class BoxOverlay extends preact.Component<BoxOverlayProps>  {
    render(props:BoxOverlayProps): JSX.Element {
        const {x0,y0,x1,y1}         = props.instance.box;
        const {width:W, height:H}   = props.imagesize;
        const position_css  = {
            left:   (x0      / W) *100 + '%',
            top:    (y0      / H) *100 + '%',
            width:  ((x1-x0) / W) *100 + '%',
            height: ((y1-y0) / H) *100 + '%',
        }
        const label:string          = props.instance.label;

        return (
            <div class="box box-overlay" style={position_css}>
                <div class="box-label-container"  data-position="left center" data-variation="mini">
                    <p class="box-label" onClick={console.trace}>
                        {label}
                    </p>

                    <select class="ui tiny search dropdown" style="display:none;"></select>
                    <i class="close red icon" title="Remove" onClick={this.on_close.bind(this)}></i>
                </div>
            </div>
        )
    }

    //on_close: JSX.MouseEventHandler<HTMLElement> = function(event:MouseEvent) {
    on_close(event:MouseEvent) {
        this.props.on_remove(this.props.instance)
    }
}


