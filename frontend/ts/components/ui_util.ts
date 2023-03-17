import { Point, Size }              from "../util.ts";


export type DragCallback = (start:Point, end:Point) => void;

/** Generic function to initiate HTML element dragging */
export function start_drag(
    mousedown_event: MouseEvent,
    targetelement:   HTMLElement,
    targetsize?:     Size,
    on_move?:        DragCallback,
    on_end?:         DragCallback,
) {
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
