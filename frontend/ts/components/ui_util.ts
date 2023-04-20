import { Point, Size }                          from "../util.ts";
import { ModelInfo, find_modelinfo }            from "../logic/settings.ts";
import { AppState, InputResultPair, Result }    from "../state.ts";
import { preact, Signal, ReadonlySignal }       from "../dep.ts";


export type DragCallback = (start:Point, end:Point) => void;

/**
 * Initiate dragging for an HTML element when the user clicks and drags the mouse.
 * 
 * @param mousedown_event - The mouse event that triggers the start of dragging.
 * @param targetelement   - The parent element that contains the dragged element.
 * @param targetsize      - The size of the target element, used for calculating coordinates.
 * @param on_move         - Callback that is called every time the mouse moves while dragging.
 *                          Receives the starting point and the current point of the drag.
 * @param on_end          - Callback that is called when the drag ends. 
 *                          Receives the starting point and the end point of the drag.
 */
export function start_drag (
    mousedown_event: MouseEvent,
    targetelement:   HTMLElement,
    targetsize?:     Size,
    on_move?:        DragCallback,
    on_end?:         DragCallback,
): void {
    const start_p: Point = page2element_coordinates(
        {x:mousedown_event.pageX, y:mousedown_event.pageY},
        targetelement,
        targetsize
    )
    let move_p: Point = start_p;

    function on_mousemove(mousemove_event: MouseEvent) {
        if( (mousemove_event.buttons & 0x01) == 0 ){
            //mouse button up
            document.removeEventListener('mousemove', on_mousemove);
            document.removeEventListener('mouseup',   on_mousemove);
            
            on_end?.(start_p, move_p)
            return;
        }

        move_p = page2element_coordinates(
            {x:mousemove_event.pageX, y:mousemove_event.pageY},
            targetelement,
            targetsize
        )
        on_move?.(start_p, move_p)
    }
    document.addEventListener('mousemove', on_mousemove)
    document.addEventListener('mouseup',   on_mousemove)
}



/** Convert page coordinates to coordinates within a HTML element. 
 *  @param p       - Point in page coordinates
 *  @param element - Target HTML Element
 *  @param size    - Optional element size, by default clientWidth/clientHeight
 *  @param offset  - Optional offset to apply, by default window page offset
*/
export function page2element_coordinates(
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


export
function collect_all_classes(results: Result[], active_model?: ModelInfo): string[] {
    const labelset = new Set<string>(active_model?.properties?.known_classes);
    labelset.delete('background')
  
    for (const result of results) {
        for (const instance of result.instances ?? []) {
            labelset.add(instance.label);
        }
    }
    labelset.delete('')
    return Array.from(labelset).sort();
}


/** Collect all possible classes from current global state.  */
export function collect_all_classes_default(): string[] {
    const STATE: AppState|undefined = globalThis.STATE;    //TODO: hard-coded
    if(!STATE)
        return []
    
    const results: Result[] = STATE.files.peek().map(
        (pair: InputResultPair) => pair.$result.peek()
    )
    const model: string|undefined = STATE.settings.peek()?.active_models?.detection
    let modelinfo: ModelInfo|undefined;
    if(model) 
        modelinfo = find_modelinfo(STATE.available_models.peek()?.detection ?? [], model)

    return collect_all_classes(results, modelinfo)
}


/** Download an element to the hard drive. */
export function download_URI(uri:string, filename:string): void {
    const element:HTMLAnchorElement = document.createElement('a');
    element.setAttribute('href', uri);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

/** Download a string as a text file */
export function download_text(text:string, filename:string): void {
    return download_URI('data:text/plain;charset=utf-8,'+encodeURIComponent(text), filename)
}

export function download_blob(blob: Blob, filename:string): void {
    return download_URI(URL.createObjectURL(blob), filename);
}

export function download_file(file:File): void {
    return download_blob(file, file.name)
}


/** Return value for the CSS display property to show or hide an element
 * 
 * Usage:
 * ```tsx
 * const style = {display: boolean_to_display_css(condition)}
 * <Element style={style} />
 * ```
 */
export function boolean_to_display_css(x: boolean): 'none' | undefined {
    return x ? undefined : 'none';
}




export type MaybeHiddenProps = {
    /** Signal indicating whether the component should be visible or hidden */
    $visible:   ReadonlySignal<boolean>
}

/** Abstract component that is hidden or visible based on the $visible prop signal */
export abstract class MaybeHidden<P extends MaybeHiddenProps> extends preact.Component<P> {
    /** Return a CSS style with display property to make the component visible or not */
    get_display_css(): Record<"display", string|undefined> {
        return {
            display: boolean_to_display_css(this.props.$visible.value)
        }
    }
}



/** Type guard to remove undefined from a signal value type */
export function is_signalvalue_defined<T>(x:ReadonlySignal<T|undefined>): x is ReadonlySignal<T>;
export function is_signalvalue_defined<T>(x:Signal<T|undefined>): x is Signal<T> {
    return (x.value != undefined)
}
