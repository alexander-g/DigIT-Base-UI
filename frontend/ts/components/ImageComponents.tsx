import { preact, JSX, signals, Signal }     from "../dep.ts"
import type { ImageSize, Point }            from "../util.ts"
import * as util                            from "../util.ts"
import * as styles                          from "./styles.ts"
import { start_drag }                       from "./ui_util.ts";
import { InputImageFile }                   from "./state.ts";
import * as imagetools                      from "../logic/imagetools.ts"
import { 
    load_tiff_file, 
    is_tiff_file, 
    is_bigtiff,
    read_image_size,
} from "../logic/imagetools.ts"



/** Maximum image size to display in original, scale down otherwise */
const MAX_SIZE_MEGAPIXELS = 20;
/** Maximum image height/width to display in original, scale down otherwise
 *  (Browser limit) */
const MAX_SIZE_HEIGHT_WIDTH:number = 1024 * 32 -1;




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
    ref: preact.RefObject<HTMLImageElement> = preact.createRef()

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
        return <img 
            //max_size_mp = { 20 }
            //jpeg_ok  =  { true }
            class   =   "input-image"
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
                console.error('Failed to set image src:', status.message)
                return
            }
            if(status instanceof ResizedImageFile)
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

    /** Maximum acceptable size in megapixels. Will scale if image exceeds this. */
    max_size_mp: number;

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
        const size_mp:number = W * H / 1000000
        const scale:number = Math.min( 
            Math.sqrt(this.props.max_size_mp) / Math.sqrt(size_mp), 
            1
        );
        // TODO: still check for not exceeding 30k pixels in each size!
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
        console.log(
            `Scaling image to (${new_size.width} x ${new_size.height}) (=${scale})`
        )
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




/** Set the `src` attribute of an image element as well as some other chores. */
export async function set_image_src(
    img:   HTMLImageElement, 
    input: Blob|string|null
): Promise<string|Blob|File|null|Error> {
    if(input instanceof Blob && !(input instanceof File)){
        input = new File([input], 'placeholder.png')
    }

    if(input instanceof File) {
        // get image size
        const size:ImageSize|Error = await read_image_size(input)
        if(size instanceof Error)
            return size as Error;
        
        const display_size: ImageSize = get_display_size(size)

        // if image size larger than 30k need to send to flask to handle this
        if(size.height > MAX_SIZE_HEIGHT_WIDTH || size.width > MAX_SIZE_HEIGHT_WIDTH){
            //   send to flask and resize to display size
            const response:File|Error = 
                await resize_image_via_flask(input, display_size);
            if(response instanceof Error)
                return response as Error;
            //else
            input = response;
        } else if(await is_tiff_file(input)) {
            //const new_input:Blob|null = await load_tiff_file_as_blob(input, display_size)                                   // TODO!
            const new_input:Blob|null = await load_tiff_file_as_blob(input)
            if(new_input instanceof Blob) {
                input = new File([new_input], input.name, {type: input.type});
            }
            else return new Error('Could not load TIFF file')
        }

        const url:string = URL.createObjectURL(input)
        img.style.visibility = '';
        img.addEventListener( 'load', () => URL.revokeObjectURL(url), {once:true} )
        img.src = url;
        return url;
    } else if (util.is_string(input)){
        const url = input as string;
        img.style.visibility = '';
        img.src = url;
        return url;
    } else if (input == null) {
        //hidden to prevent the browser showing a placeholder
        img.style.visibility = 'hidden';
        img.removeAttribute('src')
        return null;
    } else {
        // TODO: need to show some kind of error to the user
        return TypeError(`Cannot set image src to ${input}`)
    }
}

/** Suggest a smaller image size to display in the browser if needed */
function get_display_size(size:ImageSize): ImageSize {
    const { width:W, height:H } = size;
    
    const size_mp:number  = W * H / 1000000
    const scale_mp:number = Math.sqrt(MAX_SIZE_MEGAPIXELS) / Math.sqrt(size_mp);
    const scale_h:number  = MAX_SIZE_HEIGHT_WIDTH / H;
    const scale_w:number  = MAX_SIZE_HEIGHT_WIDTH / W;
    const scale:number = Math.min(
        scale_mp,
        scale_h,
        scale_w,
        1.0,
    )

    const display_size:ImageSize = { width: W*scale, height: H*scale }
    return display_size;
}


export 
async function load_tiff_file_as_blob(file:File, page_nr = 0): Promise<Blob|null> {
    // cannot load bigtiffs in JS at the moment, need flask to handle it
    if(await is_bigtiff(file)){
        return convert_bigtiff_via_flask(file)
    }
    const rgba: ImageData|null = await load_tiff_file(file, page_nr)
    if(rgba != null) {
        const canvas: HTMLCanvasElement = document.createElement('canvas')
        canvas.width  = rgba.width
        canvas.height = rgba.height
        
        const ctx: CanvasRenderingContext2D|null = canvas.getContext('2d')
        if(!ctx)
            return null;
        
        ctx.putImageData(rgba, 0, 0);
        return new Promise( (resolve: (x:Blob|null) => void) => {
            canvas.toBlob((blob: Blob|null )=>  resolve(blob), 'image/jpeg', 0.92);
        } )
    }
    return null;
}


/** An image blob that used to be larger. Contains its original size. */
export class ResizedImageFile extends File {
    constructor(
        public og_size:  ImageSize,
        ...args: ConstructorParameters<typeof File>
    ){
        super(...args)
    }
}


/** Send bigtiff file to flask to convert it to a smaller jpeg */
async function convert_bigtiff_via_flask(file:File): Promise<Blob|null> {
    const response:Response|Error = 
        await util.upload_file_no_throw(file, 'bigtiff')
    if(response instanceof Error)
        return null;

    const og_width: string|null = response.headers.get('X-Original-Image-Width');
    const og_height:string|null = response.headers.get('X-Original-Image-Height');
    const og_size: ImageSize = {
        width:  Number(og_width), 
        height: Number(og_height),
    }

    const blob:Blob|null = await response.blob()
    return new ResizedImageFile(og_size, [blob], file.name, {type:file.type})
}


/** Send image to flask to resize it */
async function resize_image_via_flask(
    file:     File, 
    new_size: ImageSize
): Promise<File|Error> {
    const params:Record<string, string> = {
        width:  new_size.width.toFixed(0),
        height: new_size.height.toFixed(0),
    }
    const response:Response|Error = 
        await util.upload_file_no_throw(file, 'resize_image', params)
    if(response instanceof Error)
        return response as Error;
    
    // TODO: we already have the original size, dont we
    const og_width: string|null = response.headers.get('X-Original-Image-Width');
    const og_height:string|null = response.headers.get('X-Original-Image-Height');
    const og_size: ImageSize = {
        width:  Number(og_width), 
        height: Number(og_height),
    }

    const blob:Blob|null = await response.blob()
    return new ResizedImageFile(og_size, [blob], file.name, {type:file.type})
}


