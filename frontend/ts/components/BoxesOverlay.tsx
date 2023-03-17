import { preact, JSX, Signal, ReadonlySignal }      from "../dep.ts";
import { Instance, Box }                    from "../logic/boxes.ts";
import { MaybeInstances }                   from "../state.ts";
import { Size, Point }                      from "../util.ts";
import * as styles                          from "./styles.ts";
import * as ui_util                         from "./ui_util.ts";

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
                (inst:Instance, index:number) => 
                    <BoxOverlay 
                        instance    =   {inst} 
                        index       =   {index}
                        imagesize   =   {props.imagesize!}
                        on_remove   =   {on_remove}
                        on_modify   =   {this.on_modify.bind(this)}
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
        
        const start_p:Point = ui_util.page2element_coordinates(
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

            move_p = ui_util.page2element_coordinates(
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

    on_modify(index:number, new_instance: Instance): void {
        const instances: MaybeInstances = this.props.$instances.peek()
        if(!instances) {
            console.trace('Trying to modify instance but instances are null')
            return;
        }
        if(index >= instances.length) {
            console.trace('Trying to modify out-of-range instance')
            return;
        }
        
        const new_instances: Instance[] 
            = [...instances.slice(0, index), new_instance, ...instances.slice(index+1)]
        this.props.on_new_instances(new_instances)
    }
}

type BoxOverlayProps = {
    instance:       Instance,
    imagesize:      Size;
    index:          number;

    /** Called when user wants to remove a box */
    on_remove:      (x:Instance) => void;

    /** Called when user wants to modify a box / label */
    on_modify:      (index:number, x:Instance) => void;
}

/** An individual box. Contains class label, and some controls. */
export class BoxOverlay extends preact.Component<BoxOverlayProps>  {
    //temporary box modifiers
    move_offset: Signal<Point>  = new Signal({x:0, y:0})
    resize_offset:Signal<Point> = new Signal({x:0, y:0})

    render(props:BoxOverlayProps): JSX.Element {
        const {x0,y0,x1,y1}         = this.compute_modified_box()
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

                <DragAnchor
                    type        = "move-anchor"
                    delta       = {this.move_offset}
                    imagesize   = {props.imagesize}
                    on_drag_end = {this.finalize_box.bind(this)}
                />

                <DragAnchor
                    type        = "resize-anchor"
                    delta       = {this.resize_offset}
                    imagesize   = {props.imagesize}
                    on_drag_end = {this.finalize_box.bind(this)}
                />
            </div>
        )
    }

    on_remove() {
        this.props.on_remove(this.props.instance)
    }

    finalize_box() {
        const new_instance: Instance = {
            box:   this.compute_modified_box(),
            label: this.props.instance.label,
        }
        this.props.on_modify(this.props.index, new_instance)
        this.move_offset.value   = {x:0, y:0}
        this.resize_offset.value = {x:0, y:0}
    }

    /** Adjust the box of the instance with modifiers */
    compute_modified_box(): Box {
        const {x0,y0,x1,y1} = this.props.instance.box;
        const offset:Point  = this.move_offset.value
        const resize:Point  = this.resize_offset.value
        return new Box(
            x0 + offset.x, 
            y0 + offset.y, 
            x1 + offset.x + resize.x, 
            y1 + offset.y + resize.y,
        )
    }
}


type DragAnchorProps = {
    type:        "move-anchor" | "resize-anchor";
    delta:       Signal<Point>;
    imagesize:   Size;
    on_drag_end: () => void;
}

class DragAnchor extends preact.Component<DragAnchorProps> {
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:DragAnchorProps): JSX.Element {
        return (
            <div 
                class       = {"drag-anchor " + props.type }
                onMouseDown = {this.on_mouse_down.bind(this)}
                ref         = {this.ref}
            >
            </div>
        )
    }

    on_mouse_down(mousedown_event:MouseEvent) {
        if(!this.ref.current?.parentElement?.parentElement)
            return;
        
        ui_util.start_drag(
            mousedown_event,
            this.ref.current.parentElement.parentElement,
            this.props.imagesize,
            (start:Point, end:Point) => { 
                this.props.delta.value = {x:end.x - start.x, y:end.y - start.y}
            },  //on_mousemove
            this.props.on_drag_end,     //on_mouseup
        )
    }
}

