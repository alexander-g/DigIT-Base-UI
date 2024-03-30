import { JSX, Signal, preact, signals }         from "../dep.ts";
import * as styles                              from "./styles.ts";
import * as util                                from "../util.ts";
import * as ui_util                             from "./ui_util.ts";



type Path = util.Point[];


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

        const path:Path = (this.$paths.value.pop() ?? []).concat([p]);
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
    const points_str:string = path.map(
        (p:util.Point) => `${p.x},${p.y}`
    ).join(' ')

    return <>
    <polyline 
        stroke = "black"
        fill   = "none"
        points = {points_str}
    />
    { path.map( p => <circle r={5} cx={p.x} cy={p.y} /> ) }
    </>
}
