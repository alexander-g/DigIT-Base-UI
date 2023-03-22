import { Point, Size }              from "../util.ts";
import { ModelInfo, find_modelinfo }    from "../logic/settings.ts";
import { AppFileState, Result }     from "../state.ts";


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
    const STATE = globalThis.STATE;
    const results: Result[] = STATE.files.peek().map((f: AppFileState) => f.result)
    const model: string|undefined = STATE.settings.peek()?.active_models?.detection
    let modelinfo: ModelInfo|undefined;
    if(model) 
        modelinfo = find_modelinfo(STATE.available_models.peek()?.detection ?? [], model)

    return collect_all_classes(results, modelinfo)
}

