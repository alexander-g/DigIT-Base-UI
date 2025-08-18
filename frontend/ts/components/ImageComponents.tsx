import { preact, JSX, signals, Signal }     from "../dep.ts"
import type { ImageSize, Point }            from "../util.ts"
import { ResizedImageBlob, set_image_src }  from "./file_input.ts"
import * as styles                          from "./styles.ts"
import { start_drag }                       from "./ui_util.ts";
import { InputImageFile }                   from "./state.ts";
import * as imagetools                      from "../logic/imagetools.ts"


export type InputImageProps = {
    /** Which file to display */
    inputfile:      File;
    /** Which file(name) is currently displayed in this file table */
    $active_file:   signals.ReadonlySignal<string|null>;

    /** Flag indicating that the image has been loaded. 
     *  @output To be used by parent components */
    $loaded: Signal<boolean>;

    /** The original size of the image or null if not yet loaded 
     * @output To be used by parent components*/
    $size:   Signal<ImageSize|null>;

    /** @output The original size of the image, before resizing (if resized.) */
    $og_size: Signal<ImageSize|null>;

    /** @input Optional extra CSS properties */
    $css?: Readonly< Signal< JSX.CSSProperties > >;
}


export class InputImage extends preact.Component<InputImageProps> {

    /** Ref to the HTML image element */
    ref: preact.RefObject<AutoscaleImage> = preact.createRef()

    /** Load image as soon as it is beeing displayed in the file table, once */
    #dispose_init?: () => void;

    /** Internal flag to indicate if the image has been loaded. 
     *  props.$loaded is intended as output instead. */
    #$loaded: Signal<boolean> = new Signal(false)

    /** Initate image loading only when needed */
    override componentDidMount(): void {
        this.#dispose_init = signals.effect( () => {
            if(this.props.$active_file.value == this.props.inputfile.name 
                && !this.#$loaded.value) {
                    this.load_image()
            }
        })
    }

    override componentWillUnmount(): void {
        this.#dispose_init?.()
    }

    render(): JSX.Element {
        const css = {width: '100%'}
        const extra_css:JSX.CSSProperties = this.props.$css?.value ?? {}
        return <AutoscaleImage 
            max_size = { {width:4096, height:4096} }
            jpeg_ok  = {true}
            class   =   {"input-image"} 
            onLoad  =   {this.on_load.bind(this)} 
            style   =   {{...css, ...styles.unselectable_css, ...extra_css}}
            ref     =   {this.ref}
            draggable = {false}
        />
    }

    async load_image(): Promise<void> {
        const image_element: AutoscaleImage|HTMLImageElement|null = this.ref.current;
        const htmlimage: HTMLImageElement|null = 
            (image_element instanceof AutoscaleImage)? image_element.ref.current : image_element
        //const htmlimage: HTMLImageElement|null = this.ref.current;
        const inputfile: File = this.props.inputfile;
        if(htmlimage != null) {
            let status:unknown;
            if(inputfile instanceof InputImageFile){
                status = await inputfile.set_image_src(htmlimage)
            } else {
                status = await set_image_src(htmlimage, this.props.inputfile)
            }

            if(status instanceof Error){
                // TODO
                return
            }
            if(status instanceof ResizedImageBlob)
                this.props.$og_size.value = status.og_size;
            
        }
    }

    /** Image loading callback. Update outputs for parent components. */
    on_load(): void {
        if(this.ref.current) {
            //TODO: resize if too large
            this.props.$loaded.value = true;
            this.#$loaded.value = true;
            this.props.$size.value   = {
                width:  this.ref.current.naturalWidth,
                height: this.ref.current.naturalHeight,
            }
            if(this.props.$og_size.value == null)
                this.props.$og_size.value = this.props.$size.value;
        }
    }
}


type ImageControlsProps = {
    children?:      preact.ComponentChildren;
    /** The natural/original size of the displayed image */
    $imagesize:     signals.ReadonlySignal<ImageSize|null>;

    /** Current zoom/scale of the children components. Will create one if not provided. */
    $scale?:        signals.Signal<number>;

    /** Callback for moving mouse event */
    on_mouse_move?:  (event:MouseEvent) => void;
    /** Callback for mouse click event.
     *  Will stop the default panning the return value is `true` */
    on_mouse_down?:  (event:MouseEvent) => boolean;
    /** Callback for mouse leave event, when cursor leaves image. */
    on_mouse_leave?: (event:MouseEvent) => boolean;
    /** Callback for context menu event, when user right clicks */
    on_contextmenu?: (event:MouseEvent) => boolean;
}

/** Responsible for panning and zooming of images and important for layout */
export class ImageControls extends preact.Component<ImageControlsProps> {
    /** Current zoom/scale of the children components */
    $scale: Signal<number> = this.props.$scale ?? new Signal(1);
    /** Current offset of the children components */
    $offset:Signal<Point>  = new Signal({x:0,y:0})


    /** Reference to the view box */
    ref:   preact.RefObject<HTMLDivElement>     = preact.createRef()

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
            '--imagewidth':  props.$imagesize.value?.width,
            '--imageheight': props.$imagesize.value?.height,
        }
        const unselectable_css = {/* TODO */}

        
        /** Modified when image is panned or zoomed */
        /* const matrix = new DOMMatrix(
            [this.scale.value, 0, 0, this.scale.value, this.offset.value.x, this.offset.value.y]
        ) */
        //NOTE: currently not using DOMMatrix because not implemented in deno
        //TODO: fix this
        const scale:number  = this.$scale.value
        const {x,y}         = this.$offset.value;
        const matrix        = `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y} )`
        const transform_css = {
            transform: matrix.toString(),
        }

        return (
        /** Viewbox has a fixed position. Children outside of the viewbox are not visible */
        <div 
            class       =   "view-box stripes" 
            style       =   {{...stripes_css, ...view_box_css}} 
            onDblClick  =   {this.on_dbl_click.bind(this)}
            onWheel     =   {this.on_wheel.bind(this)}
            onMouseDown =   {this.on_mouse_down.bind(this) }
            ref         =   {this.ref}
        >
            {/* Transformbox moves around on user input */}
            <div 
            class       =   "transform-box unselectable set-aspect-ratio-manually" 
            style       =   {{...set_aspect_ratio_css, ...unselectable_css, ...transform_css}}
            onMouseMove =   {this.props.on_mouse_move}
            onMouseLeave =  {this.props.on_mouse_leave}
            onContextMenu = {this.props.on_contextmenu}
            >
                {/* prevent children from receiving inputs by default */}
                <div style="pointer-events: none">
                    { props.children }
                </div>
            </div>
        </div>
        )
    }

    /** SHIFT+Double-Click on image: reset to default view */
    on_dbl_click(event:MouseEvent): void {
        if(!event.shiftKey)
            return;
        
        this.$scale.value  = 1;
        this.$offset.value = {x:0, y:0}
    }

    /** SHIFT+Mouse-Wheel on image: zoom in/out */
    on_wheel(event:WheelEvent): void {
        if(!event.shiftKey)
            return;
        event.preventDefault();

        const {x,y}         = this.$offset.peek()
        const new_x: number = x * (1 - 0.1*Math.sign(event.deltaY))
        const new_y: number = y * (1 - 0.1*Math.sign(event.deltaY))
        this.$offset.value   = {x: new_x, y:new_y}
        this.$scale.value    = Math.max(1.0, this.$scale.peek() * (1 - 0.1*Math.sign(event.deltaY)));
    }

    /** SHIFT+Mouse-Down on image: start panning */
    on_mouse_down(mousedown_event:MouseEvent): boolean {
        if(this.props.on_mouse_down?.(mousedown_event))
            return true;
        if(!mousedown_event.shiftKey)
            return false;
        if(!this.ref.current)
            return false;

        //prevent selection of text
        mousedown_event.preventDefault();

        // deno-lint-ignore no-this-alias
        const _this: ImageControls  = this;
        const start_offset: Point   = this.$offset.value

        /** Drag to pan the image */
        start_drag(
            mousedown_event,
            this.ref.current,
            undefined,
            (start:Point, end:Point) => {
                _this.$offset.value = { 
                    x: start_offset.x + (end.x - start.x),
                    y: start_offset.y + (end.y - start.y),
                }
            }
        )
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


type ImageProps = Omit<JSX.IntrinsicElements['img'], 'ref'>;
type AutoscaleImageProps = ImageProps & {
    /** @input The curent zoom level */
    $scale?: Readonly<Signal<number>>;

    /** Maximum acceptable height / width. Will scale if image exceeds this. */
    max_size: ImageSize;

    /** Whether or not JPEG compression is acceptable when scaling. */
    jpeg_ok: boolean;

}



/** An `<img>` element that scales down the image if too large, for performance.
 *  Scales up again on zoom. */
export class AutoscaleImage extends preact.Component<AutoscaleImageProps> {
    ref: preact.RefObject<HTMLImageElement> = preact.createRef()

    render(props:AutoscaleImageProps): JSX.Element {
        return <img {...props} onLoad={this.on_load} ref={this.ref} />
    }

    on_load = () => {
        //const { width:W, height:H } = this.original_size();
        const { width:W, height:H } = this.displayed_size();
        const { width:max_w, height:max_h } =  this.props.max_size
        const scale:number = Math.min(max_w / W, max_h / H, 1);
        // 1.0 is prone to infinite loop
        if(scale < 0.95){
            this.rescale_image(scale)
        }

        /** @ts-ignore */
        this.props.onLoad?.()
    }

    async rescale_image(scale:number) {
        //const { width:W, height:H } = this.original_size();
        const { width:W, height:H } = this.displayed_size();
        const new_size:ImageSize = { width: W*scale, height: H*scale }
        console.log('Scaling image to ', new_size)
        const blob:Blob|Error = 
            await imagetools.image_to_blob(this.ref.current!, new_size)
        if(blob instanceof Error){
            console.error('Rescaling failed')
            return;
        }
        set_image_src(this.ref.current!, blob)
    }


    #og_size:ImageSize|null = null;

    /** Return the size of the image before it got scaled */
    original_size(): ImageSize {
        if(this.#og_size == null){
            //const { naturalWidth:W, naturalHeight:H } = this.ref.current!
            const { width:W, height:H } = this.displayed_size();
            this.#og_size = {width:W, height:H};
        }
        return this.#og_size;
    }

    displayed_size(): ImageSize {
        const { naturalWidth:width, naturalHeight:height } = this.ref.current!
        return {width, height};
    }

    get naturalWidth(): number {
        return this.ref.current!.naturalWidth;
    }

    get naturalHeight(): number {
        return this.ref.current!.naturalHeight;
    }

}

