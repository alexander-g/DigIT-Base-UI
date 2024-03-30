import { JSX, Signal, preact, signals }         from "../dep.ts";
import * as styles                              from "./styles.ts";
import * as util                                from "../util.ts";
import * as ui_util                             from "./ui_util.ts";

type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;

type PathNode = util.Point & {
    width: number;
    color: RGBA;  //TODO: probably not per node but per path
}

type Path = PathNode[];


type PathOverlayProps = ui_util.MaybeHiddenProps & {
    //
};

export class PathOverlay<P extends PathOverlayProps> extends ui_util.MaybeHidden<P> {
    ref:preact.RefObject<SVGSVGElement> = preact.createRef()

    $paths: Signal<Path[]> = new Signal([])


    render(): JSX.Element {
        const cursor_css = {
            //cursor: props.$drawing_mode_active.value? 'crosshair' : ''
            cursor: 'crosshair'
        }

        const $polylines_svg:signals.ReadonlySignal<JSX.Element[]> 
            = signals.computed( () => paths_to_polylines_svg(this.$paths.value) )

        console.log('render')
        return (
        <svg
            class       =   "paths overlay" 
            style       =   {{ 
                pointerEvents:'all',
                ...cursor_css, 
                ...styles.overlay_css, 
                ...super.get_display_css() 
            }} 
            onMouseDown =   {this.on_mouse_down.bind(this)}
            ref         =   {this.ref}
        >
            { $polylines_svg.value }
        </svg>
        )
    }

    on_mouse_down(mouse_event:MouseEvent) {
        if(this.ref.current == null)
            return;
        //skip if shift, ctrl or alt is pressed
        if(mouse_event.ctrlKey || mouse_event.altKey || mouse_event.shiftKey)
            return;
        
        const p:util.Point = ui_util.page2element_coordinates(
            {x:mouse_event.pageX, y:mouse_event.pageY},
            this.ref.current,
            //targetsize
        )
        const node:PathNode = {...p, width:10, color:'rgba(200, 200, 200, 255)'}

        const path:Path = (this.$paths.value.pop() ?? []).concat([node]);
        this.$paths.value = this.$paths.value.concat([path])
    }

    on_keydown(event:KeyboardEvent){
        if(event.key == 'Escape'){
            this.$paths.value = this.$paths.value.concat([[]])
        } else if (event.key == 'z' && event.ctrlKey) {
            console.warn('CTRL+Z not implemented yet')
        }
        
    }
    #keydown:void = globalThis.addEventListener('keydown', this.on_keydown.bind(this))
    
}


function paths_to_polylines_svg(paths:Path[]): JSX.Element[] {
    return paths.map(path_to_polyline_svg)
}

function path_to_polyline_svg(path:Path): JSX.Element {
    const polygons:JSX.Element[] = []
    // deno-lint-ignore no-inferrable-types
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

