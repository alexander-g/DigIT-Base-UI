import { preact, JSX, Signal, ReadonlySignal, signals }      from "../dep.ts";
import { Instance, Box }                    from "../logic/boxes.ts";
import { Size, Point, ImageSize }           from "../util.ts";
import * as styles                          from "./styles.ts";
import * as ui_util                         from "./ui_util.ts";

import { ObjectdetectionResult, MaybeInstances } from "../logic/objectdetection.ts";
import { SingleFileContent }                from "./FileTable.tsx";
import { NewBoxButton }                     from "./ContentMenu.tsx";


export class ObjectdetectionContent extends SingleFileContent<ObjectdetectionResult> {
    /** Flag indicating if box drawing is activated. 
     *  If undefined no New-Box button is shown */
    $box_drawing_mode: signals.Signal<boolean> = new signals.Signal(false)

    /** Boxes overlays */
    result_overlays(): JSX.Element {
        const $instances: ReadonlySignal<MaybeInstances> = signals.computed(
            () => this.props.$result.value.instances
        )

        return <BoxesOverlay
            $instances          =   { $instances }
            imagesize           =   { this.$imagesize.value }
            $drawing_mode_active =  { this.$box_drawing_mode }
            $visible             =  { this.$result_visible }
            on_new_instances     =  { this.on_new_instances.bind(this) }
        />
    }

    on_new_instances(new_instances:Instance[]): void {
        const old_result: ObjectdetectionResult = this.props.$result.value;
        const new_result: ObjectdetectionResult 
            = Object.assign(new ObjectdetectionResult(), old_result)
        new_result.instances = new_instances;
        this.props.$result.value = new_result;
    }

    /** Add a New-Box button to the content menu */
    content_menu_extras(): preact.JSX.Element[] {
        return [<NewBoxButton drawing_mode_active={this.$box_drawing_mode}/>]
    }
}



type BoxesOverlayProps = ui_util.MaybeHiddenProps & {
    $instances:      ReadonlySignal<MaybeInstances>;
    imagesize:       Size|null;

    /** When on, user can add new boxes. Overlay may disable it */
    $drawing_mode_active: Signal<boolean>;

    /** Called when the user requested some changes to the boxes */
    on_new_instances: (x:Instance[]) => void;
}

/** A result overlay that displays boxes */
export class BoxesOverlay extends ui_util.MaybeHidden<BoxesOverlayProps> {
    ref: preact.RefObject<HTMLDivElement> = preact.createRef()

    /** Instance of IntermediateBoxOverlay  */
    $drawing_box: Signal<JSX.Element|null> = new Signal(null)
    drawing_box_ref: preact.RefObject<IntermediateBoxOverlay> = preact.createRef()

    render(props:BoxesOverlayProps): JSX.Element {
        const instances: readonly Instance[] = props.$instances.value ?? [];
        function on_remove(x: Instance) {
            const index: number = instances.indexOf(x)

            const new_instances: Instance[] 
                = [...instances.slice(0, index), ...instances.slice(index+1)]
            props.on_new_instances(new_instances)
        }

        let boxes: JSX.Element[] = []
        //imagesize null means the image has not been opened yet, so dont show
        if(props.imagesize != null)
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
                style       =   {{ 
                    ...cursor_css, 
                    ...styles.overlay_css, 
                    ...super.get_display_css() 
                }} 
                onMouseDown =   {this.on_mouse_down.bind(this)}
                ref         =   {this.ref}
            >
                { boxes }
                { this.$drawing_box.value }
            </div>
        )
    }

    /** Callback to initiate manually drawing a new box */
    on_mouse_down(mousedown_event:MouseEvent) {
        if(!this.ref.current)
            return;
        if(!this.props.$drawing_mode_active.peek())
            return;
        
        this.$drawing_box.value 
            =   <IntermediateBoxOverlay 
                    ref       = {this.drawing_box_ref} 
                    imagesize = {this.props.imagesize!}
                />

        // deno-lint-ignore no-this-alias
        const _this: BoxesOverlay = this;

        ui_util.start_drag(
            mousedown_event,
            this.ref.current,
            this.props.imagesize ?? undefined,
            (start:Point, end:Point) => {         //on_mousemove
                _this.drawing_box_ref.current?.set_coordinates(start, end)
            },
            (start:Point, end:Point) => {         //on_mouseup
                //disable drawing mode
                _this.props.$drawing_mode_active.value = false;
                //remove the intermediate box
                _this.$drawing_box.value               = null;

                _this.add_new_box(
                    Box.from_array([start.x, start.y, end.x, end.y])
                )
            },
        )
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



type BoxOverlayBaseProps = {
    /** The original size of the displayed image. */
    imagesize:      ImageSize;
}

abstract class BoxOverlayBase<T extends BoxOverlayBaseProps = BoxOverlayBaseProps> 
extends preact.Component<T> {
    /** Return normalized coordinates a CSS dict */
    compute_position_css(box:Box): Record<string, string> {
        const {x0,y0,x1,y1}         = box;
        const {width:W, height:H}   = this.props.imagesize;
        const position_css  = {
            left:   (x0      / W) *100 + '%',
            top:    (y0      / H) *100 + '%',
            width:  ((x1-x0) / W) *100 + '%',
            height: ((y1-y0) / H) *100 + '%',
        }
        return position_css
    }
}




type BoxOverlayProps = BoxOverlayBaseProps & {
    instance:       Instance,
    index:          number;

    /** Called when user wants to remove a box */
    on_remove:      (x:Instance) => void;

    /** Called when user wants to modify a box / label */
    on_modify:      (index:number, x:Instance) => void;
}

/** An individual box. Contains class label, and some controls. */
export class BoxOverlay extends BoxOverlayBase<BoxOverlayProps>  {
    //temporary box modifiers
    move_offset:  Signal<Point> = new Signal({x:0, y:0})
    resize_offset:Signal<Point> = new Signal({x:0, y:0})

    ref:          preact.RefObject<HTMLDivElement> = preact.createRef()

    render(props:BoxOverlayProps): JSX.Element {
        const position_css: Record<string, string>  
            = this.compute_position_css(this.compute_modified_box())
        const label:string = props.instance.label;

        return (
            <div class="box box-overlay" style={position_css} ref={this.ref}>
                <LabelDropdown 
                    label       = {label} 
                    on_remove   = {() => this.props.on_remove(this.props.instance)}
                    on_change   = {this.on_new_label.bind(this)}
                />

                <DragAnchor
                    imagesize   = {props.imagesize}
                    type        = "move-anchor"
                    delta       = {this.move_offset}
                    on_drag_end = {this.finalize_box.bind(this)}
                    get_parentoverlay = {() => this.ref.current?.parentElement ?? null}
                />

                <DragAnchor
                    imagesize   = {props.imagesize}
                    type        = "resize-anchor"
                    delta       = {this.resize_offset}
                    on_drag_end = {this.finalize_box.bind(this)}
                    get_parentoverlay = {() => this.ref.current?.parentElement ?? null}
                />
            </div>
        )
    }

    on_new_label(label:string): void {
        this.props.instance.label = label;
        this.finalize_box()
    }

    finalize_box(): void {
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
    imagesize:   Size;
    /** Passed to the class attribute. */
    type:        "move-anchor" | "resize-anchor";
    /** Output value, indicates by how much the anchor has been dragged. */
    delta:       Signal<Point>;
    /** Called when anchor drag is finished */
    on_drag_end: () => void;
    /** The top HTML element that contains boxes (BoxesOverlay). Temporarily null. */
    get_parentoverlay: () => HTMLElement | null;
}


/** Control element for moving and resizing boxes */
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
        const parentoverlay: HTMLElement|null = this.props.get_parentoverlay()
        if(!parentoverlay)
            return;
        
        ui_util.start_drag(
            mousedown_event,
            parentoverlay,
            this.props.imagesize,
            (start:Point, end:Point) => { 
                this.props.delta.value = {x:end.x - start.x, y:end.y - start.y}
            },  //on_mousemove
            this.props.on_drag_end,     //on_mouseup
        )
    }
}


type LabelDropdownProps =  {
    label:      string;
    /** Called when user wants to remove a box */
    on_remove:  () => void;
    /** Called when user selects a new label for a box */
    on_change:  (new_label:string) => void;

    /** Called to provide readymade choices when user clicks on the label 
     * @note - this is currently not directly set, 
     * instead, the defaultProps is overwritten globally in {@link DetectionTab} 
     * This could lead to errors when using multiple tabs */
    collect_all_classes?: () => string[];
}

/** Textbox, input and dropdown for fast label selection */
export class LabelDropdown extends preact.Component<LabelDropdownProps> {
    static defaultProps: Pick<LabelDropdownProps, 'collect_all_classes'> = {
        collect_all_classes: () => [/*  This should be replaced */]
    }

    selectref: preact.RefObject<HTMLSelectElement>    = preact.createRef()
    labelref:  preact.RefObject<HTMLParagraphElement> = preact.createRef()

    // deno-lint-ignore no-inferrable-types
    #dropdown_initialized:boolean = false;

    render(props: LabelDropdownProps): JSX.Element {
        /** A select element that is converted by Fomantic into a dropdown.
         *  Created only once (not on updates), since Fomantic replaces it. */
        let select_element:JSX.Element|null = null;
        if(!this.#dropdown_initialized) {
            select_element = (
                <select 
                    class   = "ui tiny search dropdown" 
                    style   = "display:none;" 
                    ref     = {this.selectref}
                ></select>
            )
        }

        return (
            // TODO: tooltip text showing confidences
            <div class="box-label-container" data-position="left center" data-variation="mini">
                <p 
                    class   = "box-label" 
                    onClick = {this.convert_label_into_input.bind(this)} 
                    ref     = {this.labelref}
                >
                    {props.label}
                </p>

                { select_element }
                <i class="close red icon" title="Remove" onClick={props.on_remove}></i>
            </div>
        )
    }

    //no idea anymore how this works, better don't touch it
    convert_label_into_input() {
        if(!this.labelref.current)
            return;

        // deno-lint-ignore no-this-alias
        const _this: LabelDropdown = this;
        // deno-lint-ignore no-inferrable-types
        function save(txt:string = ''){
            if(txt.length > 0){
                _this.props.on_change(txt)
                
                //keep this; seems to prevent an error message
                $input.dropdown('unbind intent')
            }
            $label.show().css('visibility', '');
            $input.hide();
        }

        $(this.selectref.current).dropdown({
            allowAdditions:  true, 
            hideAdditions:   false, 
            forceSelection:  false, 
            selectOnKeydown: false,
            fullTextSearch:  true,
            silent:          true,
            action: (t: string) => {  save(t); },
            onHide: ()          => {  save( ); },
        });
        this.#dropdown_initialized = true;

        // deno-lint-ignore no-explicit-any
        const $label:any = $(this.labelref.current)
        // deno-lint-ignore no-explicit-any
        const $input:any = $label.closest('.box-overlay').find('.search.dropdown');

        $input.dropdown('setup menu', {
            values: this.props.collect_all_classes?.().map( 
                (v:string) => {return {name:v};} 
            ),
        });

        $label.css('visibility', 'hidden');
        $input.show()
        $input.find('input').focus().select();
    }
}




/** Temporary box as a visual aid for drawing boxes. */
class IntermediateBoxOverlay extends BoxOverlayBase {
    coordinates: Signal<Box> = new Signal(Box.from_array([0,0,0,0]))

    render(): JSX.Element {
        const position_css: Record<string, string> 
            = this.compute_position_css(this.coordinates.value)

        return <div class="box-overlay intermediate" style={{...position_css}}>
        </div>
    }

    public set_coordinates(start:Point, end:Point): void {
        this.coordinates.value = Box.from_array([start.x, start.y, end.x, end.y])
    }
}

