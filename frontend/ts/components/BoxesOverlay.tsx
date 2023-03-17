import { preact, JSX, Signal, ReadonlySignal }      from "../dep.ts";
import { Instance, Box }                    from "../logic/boxes.ts";
import { MaybeInstances }                   from "../state.ts";
import { Size, Point }                      from "../util.ts";
import * as styles                          from "./styles.ts";

type BoxesOverlayProps = {
    $instances:      ReadonlySignal<MaybeInstances>;
    imagesize?:      Size;

    /** When on, user can add new boxes. Overlay may disable it */
    $drawing_mode_active: Signal<boolean>;

    /** Called when the user requested some changes to the boxes */
    on_new_instances: (x:Instance[]) => void;

    //TODO: $visible (but with code re-use)
}

/** A result overlay that displays boxes */
export class BoxesOverlay extends preact.Component<BoxesOverlayProps> {
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:BoxesOverlayProps): JSX.Element {
        const instances: readonly Instance[] = props.$instances.value ?? [];
        function on_remove(x: Instance) {
            const index: number = instances.indexOf(x)

            const new_instances: Instance[] 
                = [...instances.slice(0, index), ...instances.slice(index+1)]
            props.on_new_instances(new_instances)
        }

        let boxes: JSX.Element[] = []
        //imagesize undefined means the image has not been opened yet, so dont show
        if(props.imagesize != undefined)
            boxes = instances.map(
                (inst:Instance) => 
                    <BoxOverlay 
                        instance    =   {inst} 
                        imagesize   =   {props.imagesize!}
                        on_remove   =   {on_remove}
                    />
            )

        /** Display a crosshair to indicate that drawing new boxes is possible */
        const cursor_css = {
            cursor: props.$drawing_mode_active.value? 'crosshair' : ''
        }

        return (
            <div 
                class       =   "boxes overlay" 
                style       =   {{ ...cursor_css, ...styles.overlay_css }} 
                onMouseDown =   {this.on_mouse_down.bind(this)}
                ref         =   {this.ref}
            >
                { boxes }
            </div>
        )
    }

    /** Callback to initiate manually drawing a new box */
    on_mouse_down(event:MouseEvent) {
        if(!this.ref.current)
            return;
        if(!this.props.$drawing_mode_active.peek())
            return;
        
        const start_p:Point = page2element_coordinates(
            {x:event.pageX, y:event.pageY}, this.ref.current, this.props.imagesize
        );
        let move_p:Point = start_p;

        // deno-lint-ignore no-this-alias
        const _this: BoxesOverlay = this;
        function on_mousemove(mousemove_event: MouseEvent) {
            if( (mousemove_event.buttons & 0x01)==0 ){
                //mouse up
                document.removeEventListener('mousemove', on_mousemove);
                document.removeEventListener('mouseup',   on_mousemove);
                //disable drawing mode
                _this.props.$drawing_mode_active.value = false;

                _this.add_new_box(
                    Box.from_array([start_p.x, start_p.y, move_p.x, move_p.y])
                )
                return;
            }

            move_p = page2element_coordinates(
                {x:mousemove_event.pageX, y:mousemove_event.pageY},
                _this.ref.current!,
                _this.props.imagesize
            )
            
        }
        document.addEventListener('mousemove', on_mousemove)
        document.addEventListener('mouseup',   on_mousemove)
    }

    add_new_box(box:Box): void {
        //TODO: clip coordinates
        const instances: readonly Instance[] = this.props.$instances.value ?? [];
        const new_instance:  Instance = {
            box:  box,
            label: '???',
        }
        const new_instances: Instance[] = [
            ...instances, 
            new_instance,
        ]
        this.props.on_new_instances(new_instances)
    }
}

type BoxOverlayProps = {
    instance:       Instance,
    imagesize:      Size;

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
                {/* TODO: make a component of its own */}
                <div class="box-label-container"  data-position="left center" data-variation="mini">
                    <p class="box-label" onClick={console.trace}>
                        {label}
                    </p>

                    <select class="ui tiny search dropdown" style="display:none;"></select>
                    <i class="close red icon" title="Remove" onClick={this.on_remove.bind(this)}></i>
                </div>

                <DragAnchor />
            </div>
        )
    }

    on_remove() {
        this.props.on_remove(this.props.instance)
    }
}


class DragAnchor extends preact.Component {
    render(): JSX.Element {
        return <div class="drag-anchor move-anchor"></div>
    }
}



/** Convert page coordinates to coordinates within a HTML element. 
 *  @param p       - Point in page coordinates
 *  @param element - Target HTML Element
 *  @param size    - Optional element size, by default clientWidth/clientHeight
 *  @param offset  - Optional offset to apply, by default window page offset
*/
function page2element_coordinates(
    p       : Point, 
    element : HTMLElement, 
    size?   : Size, 
    offset? : Point
): Point {
    const rect:DOMRect = element.getBoundingClientRect()
    /** Absolute point, relative to the top-left corner */
    const p_rel:Point  = {
        x : (p.x  - rect.left - (offset?.x ?? window.scrollX)),
        y : (p.y  - rect.top  - (offset?.y ?? window.scrollY)),
    }
    /** Normalized point, relative to the top-left corner */
    const p_norm:Point = {
        x : (p_rel.x / rect.width), 
        y : (p_rel.y / rect.height),
    }

    /** Absolute point, within the element */
    const p_el: Point = {
        x : (p_norm.x * (size?.width  ?? element.clientWidth)),
        y : (p_norm.y * (size?.height ?? element.clientHeight)),
    }
    return p_el;
}
