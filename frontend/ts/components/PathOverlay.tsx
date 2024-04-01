// deno-lint-ignore-file no-inferrable-types
import { JSX, Signal, preact, signals }         from "../dep.ts";
import * as styles                              from "./styles.ts";
import * as util                                from "../util.ts";
import * as ui_util                             from "./ui_util.ts";

type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;

type PathNode = util.Point & {
    width: number;
    //color: RGBA;  //TODO: probably not per node but per path
}

type Path = PathNode[];


//TODO: save in settings
const DEFAULT_PATH_WIDTH:number = 10;
const MAXIMUM_PATH_WIDTH:number = 50;
const MINIMUM_PATH_WIDTH:number = 1;


type PathOverlayProps = ui_util.MaybeHiddenProps & {
    //
};

export class PathOverlay<P extends PathOverlayProps> extends ui_util.MaybeHidden<P> {
    ref:preact.RefObject<SVGSVGElement> = preact.createRef()

    $paths: Signal<Path[]> = new Signal([])

    /** Last seen mouse coordinates / end point for the next edge. */
    $cursor: Signal<PathNode> = new Signal({x:0, y:0, width:DEFAULT_PATH_WIDTH});

    /** The last set node / the starting point for the next edge.
     *  If `null` a new path will be created. */
    $last_node: Signal<PathNode|null> = new Signal(null);


    render(): JSX.Element {
        const cursor_css = {
            //cursor: props.$drawing_mode_active.value? 'crosshair' : ''
            cursor: 'crosshair'
        }

        const $polylines_svg:signals.ReadonlySignal<JSX.Element[]> 
            = signals.computed( () => paths_to_polylines_svg(this.$paths.value) )

        console.log('render')
        return <>
        <svg
            class       =   "paths overlay" 
            style       =   {{ 
                pointerEvents:'all',
                ...cursor_css, 
                ...styles.overlay_css, 
                ...super.get_display_css() 
            }} 
            onMouseDown =   {this.on_mouse_down.bind(this)}
            onMouseMove =   {this.on_mouse_move}
            onWheel     =   {this.on_wheel}
            onContextMenu = {prevent_context_menu}
            ref         =   {this.ref}
        >
            { $polylines_svg.value }
            <NextEdgeIndicator $start={this.$last_node} $end={this.$cursor} />
        </svg>
        <PathOverlayCSS />
        </>
    }

    on_mouse_down(mouse_event:MouseEvent) {
        if(this.ref.current == null)
            return;
        //skip if shift, ctrl or alt is pressed
        if(mouse_event.ctrlKey || mouse_event.altKey || mouse_event.shiftKey)
            return;
        

        if(mouse_event.button == 0){
            // left button, add new node
            const node:PathNode = this.$cursor.value;
            const path:Path     = (this.$paths.value.pop() ?? []).concat([node]);
            this.$paths.value   = this.$paths.value.concat([path])
            this.$last_node.value = node;
        } else if(mouse_event.button == 2) {
            //right mouse button, stop
            mouse_event.preventDefault()
            this.#end_path()
            return false;
        }
        
    }

    on_mouse_move: JSX.MouseEventHandler<SVGSVGElement> = ((event:MouseEvent) => {
        if(event.target == null || this.ref.current == null)
            return;
        
        const p:util.Point = ui_util.page2element_coordinates(
            {x:event.pageX, y:event.pageY},
            this.ref.current,
            //targetsize
        ) ?? {x:0,y:0}
        this.$cursor.value = {...p, width:this.$cursor.value.width}
    }).bind(this)

    on_wheel: JSX.WheelEventHandler<SVGSVGElement> = ((event:WheelEvent) => {
        //skip if shift, ctrl or alt is pressed
        if(event.ctrlKey || event.altKey || event.shiftKey)
            return;
        event.preventDefault();

        const new_width:number = Math.max(
            Math.min(
                this.$cursor.value.width + 0.2 * Math.sign(event.deltaY), 
                MAXIMUM_PATH_WIDTH,
            ), MINIMUM_PATH_WIDTH
        )
        this.$cursor.value = { ...this.$cursor.value, width:new_width };

        return true;
    }).bind(this)

    on_keydown(event:KeyboardEvent){
        if(event.key == 'Escape'){
            this.#end_path()
        } else if (event.key == 'z' && event.ctrlKey) {
            console.warn('CTRL+Z not implemented yet')
        }
    }
    #keydown_event_handle:void 
        = globalThis.addEventListener('keydown', this.on_keydown.bind(this));

    #end_path(): void {
        //TODO: if(!this.$last_node.value == null)
        this.$paths.value = this.$paths.value.concat([[]])
        this.$last_node.value = null;
    }
    
}

/** Custom CSS styles */
function PathOverlayCSS(): JSX.Element {
    return <style>{`
        svg.paths.overlay circle:hover {
            cursor: pointer;
        }
    `}</style>
}



class NextEdgeIndicator extends preact.Component<{
    $start: Signal<PathNode|null>;
    $end:   Signal<PathNode>;
}> {
    render(props: NextEdgeIndicator['props']): JSX.Element {
        if(props.$start.value == null)
            return <></>
        
        return polygon_from_two_nodes(props.$start.value, props.$end.value);
    }
}

/** Callback to the `contextmenu` event, 
 *  to prevent opening the context menu on right click */
function prevent_context_menu(event:Event){
    event.preventDefault()
}


function paths_to_polylines_svg(paths:Path[]): JSX.Element[] {
    return paths.map(path_to_polyline_svg)
}

function path_to_polyline_svg(path:Path): JSX.Element {
    const polygons:JSX.Element[] = []
    for(let i:number = 1; i < path.length; i++){
        polygons.push(
            polygon_from_two_nodes(path[i-1]!, path[i]!)
        )
    }
    const circles: JSX.Element[] 
        = path.map( (p:PathNode) => <circle 
            r    = {p.width/2} 
            cx   = {p.x} 
            cy   = {p.y} 
            fill = "rgba(250, 100, 0, 64)"
            fill-opacity = {0.5}
            stroke       = "black"
        /> )

    return <>
        { polygons }
        { circles }
    </>
}

function polygon_from_two_nodes(n0:PathNode, n1:PathNode): JSX.Element {
    const direction:util.Vector = util.direction_vector(n0, n1);
    const normal:util.Vector 
        = util.normalize_vector(util.orthogonal_vector(direction));

    const p0 = {x:n0.x+normal.x/2*n0.width, y:n0.y+normal.y/2*n0.width}
    const p1 = {x:n0.x-normal.x/2*n0.width, y:n0.y-normal.y/2*n0.width}
    const p2 = {x:n1.x-normal.x/2*n1.width, y:n1.y-normal.y/2*n1.width}
    const p3 = {x:n1.x+normal.x/2*n1.width, y:n1.y+normal.y/2*n1.width}

    const points_str:string = [p0,p1,p2,p3].map(
        (p:util.Point) => `${p.x},${p.y}`
    ).join(' ')
    return <polygon 
        points = {points_str}
        stroke = "black"
        fill   = "rgba(250, 100, 0, 64)"
        fill-opacity = {0.5}
    />
}

