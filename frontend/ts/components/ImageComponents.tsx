import { preact, JSX, signals }                  from "../dep.ts"
import type { AppFileState, ImageSize }     from "../state.ts"
import { set_image_src }                    from "../file_input.ts"
import * as styles                          from "./styles.ts"

export type InputImageProps = {
    /** Which file to display */
    file:           AppFileState;
    /** Which file(name) is currently displayed in this file table */
    active_file:    signals.ReadonlySignal<string|null>;
}


export class InputImage extends preact.Component<InputImageProps> {
    ref: preact.RefObject<HTMLImageElement> = preact.createRef()

    /** Load image as soon as it is beeing displayed in the file table, once */
    #init?: () => void;

    componentDidMount(): void {
        this.#init = signals.effect( () => {
            if(this.props.active_file.value == this.props.file.name 
                && !this.props.file.$loaded.value
                && this.ref.current) {
                    set_image_src(this.ref.current, this.props.file)
            }
        })
    }

    render(): JSX.Element {
        const css = {width: '100%'}
        return <img 
            class   =   {"input-image"} 
            onLoad  =   {this.on_load.bind(this)} 
            style   =   {{...css, ...styles.unselectable_css}}
            ref     =   {this.ref}
            draggable = {false}
        />
    }

    /** Image loading callback. Update the state. */
    on_load(): void {
        if(this.ref.current) {
            //TODO: resize if too large
            this.props.file.set_loaded(this.ref.current)
        }
    }
}


type ImageControlsProps = {
    children:       preact.ComponentChildren;
    /** The natural/original size of the displayed image */
    imagesize:      signals.ReadonlySignal<ImageSize|undefined>;
}

/** Responsible for panning and zooming of images and important for layout */
export class ImageControls extends preact.Component<ImageControlsProps> {
    scale: signals.Signal<number>               = new signals.Signal(1)
    offset:signals.Signal<{x:number, y:number}> = new signals.Signal({x:0,y:0})

    render(props:ImageControlsProps) {
        const stripes_css = {
            backgroundColor:    'rgb(240,240,240)',
            backgroundImage:    'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 7px)',
        }
        const view_box_css = {
            /** content moves around, don't show outside of the borders */
            overflow:           'hidden',
            /** act as anchor for position:absolute overlays inside */
            position:           'relative',
        
            width:              '100%',
            height:             '100%',
            display:            'flex',
            justifyContent:     'center',
            alignItems:         'center',
            marginLeft:         '2px',
            marginRight:        '2px',
        }

        const set_aspect_ratio_css = {
            /* keep aspect ratio; --imagewidth & --imageheight are set on image load */
            maxWidth:       'calc( (100vh - 120px) * var(--imagewidth) / var(--imageheight) )',
            width:          '100%',
            '--imagewidth':  props.imagesize.value?.width,
            '--imageheight': props.imagesize.value?.height,
        }
        const unselectable_css = {/* TODO */}

        
        /** Modified when image is panned or zoomed */
        /* const matrix = new DOMMatrix(
            [this.scale.value, 0, 0, this.scale.value, this.offset.value.x, this.offset.value.y]
        ) */
        //NOTE: currently not using DOMMatrix because not implemented in deno
        //TODO: fix this
        const scale:number  = this.scale.value
        const {x,y}         = this.offset.value;
        const matrix        = `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y} )`
        const transform_css = {
            transform: matrix.toString(),
        }

        return <div class="view-box stripes" style={{...stripes_css, ...view_box_css}} onDblClick={this.on_dbl_click.bind(this)}>
            {/* TODO: transform-box callbacks */}
            <div 
            class       =   "transform-box unselectable set-aspect-ratio-manually" 
            style       =   {{...set_aspect_ratio_css, ...unselectable_css, ...transform_css}}
            onWheel     =   {this.on_wheel.bind(this)}
            onMouseDown =   {this.on_mouse_down.bind(this) }
            >
                {/* prevent children from receiving inputs by default */}
                <div style="pointer-events: none">
                    { props.children }
                </div>
            </div>
        </div>
    }

    /** SHIFT+Double-Click on image: reset to default view */
    on_dbl_click(event:MouseEvent): void {
        if(!event.shiftKey)
            return;
        
        this.scale.value  = 1;
        this.offset.value = {x:0, y:0}
    }

    /** SHIFT+Mouse-Wheel on image: zoom in/out */
    on_wheel(event:WheelEvent): void {
        if(!event.shiftKey)
            return;
        event.preventDefault();

        const {x,y}         = this.offset.peek()
        const new_x: number = x * (1 - 0.1*Math.sign(event.deltaY))
        const new_y: number = y * (1 - 0.1*Math.sign(event.deltaY))
        this.offset.value   = {x: new_x, y:new_y}
        this.scale.value    = Math.max(1.0, this.scale.peek() * (1 - 0.1*Math.sign(event.deltaY)));
    }

    /** SHIFT+Mouse-Down on image: start panning */
    on_mouse_down(mousedown_event:MouseEvent): boolean {
        if(!mousedown_event.shiftKey) {
            return false;
        }

        //prevent selection of text
        mousedown_event.preventDefault();

        let click_y: number = mousedown_event.pageY;
        let click_x: number = mousedown_event.pageX;
    
        // deno-lint-ignore no-this-alias
        const _this: ImageControls = this;

        /** Callback to pan an image. Document-wide against glitches */
        function on_document_move(mousemove_event: MouseEvent): void {
            mousemove_event.stopPropagation();

            if( (mousemove_event.buttons & 0x01)==0 ){
                //mouse up
                document.removeEventListener('mousemove', on_document_move);
                return;
            }
    
            const delta_y: number = mousemove_event.pageY - click_y;
            const delta_x: number = mousemove_event.pageX - click_x;

            _this.offset.value = { 
                x: _this.offset.peek().x + delta_x,
                y: _this.offset.peek().y + delta_y,
            }

            //update click coordinates for next callback call
            click_y = mousemove_event.pageY;
            click_x = mousemove_event.pageX;
        }
        document.addEventListener('mousemove', on_document_move)

        //prevent bubbling or something like that
        return true;
    }
}


/** Main image container. May contain multiple images side-by-side. */
export function ImageContainer(props:{children:preact.ComponentChildren}): JSX.Element {
    const css = {
        display:            'flex',
        width:              '100%',
        height:             'calc(100vh - 120px)',
        alignItems:         'center',
        justifyContent:     'space-around',
    }
    return <div class="image-container" style={css}>
        { props.children }
    </div>
}
