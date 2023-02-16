import { preact, UTIF } from "./dep.ts"
import * as util        from "./util.ts"
import { STATE }        from "./state.ts"   //TODO: hard-coded

/** Event handler for file drag events */
export function on_drag(event:preact.JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault()
}

/** Event handler for file drop events */
export function on_drop(event:preact.JSX.TargetedDragEvent<HTMLElement>): void {
    event.preventDefault()
    STATE.files.set_from_files(event.dataTransfer?.files ?? [])  //TODO: hard-coded
}

export function set_image_src(img:HTMLImageElement, input:Blob|string|null): void {
    if( (input instanceof File)
     && (input.type=="image/tiff" || input.name.endsWith('.tif') || input.name.endsWith('.tiff'))) {
        load_tiff_file_as_blob(input).then( blob => set_image_src(img, blob) )
    } else if( input instanceof Blob) {
        const url:string = URL.createObjectURL(input)
        img.style.visibility = '';
        img.addEventListener( 'load', () => URL.revokeObjectURL(url), {once:true} )
        img.src = url;
        console.log('Setting image src of', img, 'to blob', input)
    } else if (util.is_string(input)){
        const url  = input as string;
        img.style.visibility = '';
        img.src   = url;
        console.log('Setting image src of', img, 'to string', input)
    } else if (input == null) {
        //hidden to prevent the browser showing a placeholder
        img.style.visibility = 'hidden';
        img.removeAttribute('src')
    } else {
        throw TypeError(`Cannot set image src to ${input}`)
    }
}

export async function load_tiff_file(file:File, page_nr = 0): Promise<ImageData|null> {
    const buffer: ArrayBuffer = await file.arrayBuffer()
    const pages: UTIF.IFD[]   = UTIF.decode(buffer)
    if(pages.length > page_nr){
        const page: UTIF.IFD    = pages[page_nr]!
        // deno-lint-ignore no-explicit-any
        const console_log:any = console.log;
        try {
            //replacing console.log because UTIF doesnt care about logging
            console.log = () => {}
            UTIF.decodeImage(buffer, page)
        } finally {
            console.log = console_log
        }
        const rgba: Uint8ClampedArray  = Uint8ClampedArray.from(UTIF.toRGBA8(page));
        if(globalThis.ImageData)
            return new ImageData(rgba, page.width, page.height)
        else
            //deno
            return {
                data:   Uint8ClampedArray.from(rgba),
                width:  page.width,
                height: page.height,
                colorSpace: 'srgb',
            }
    }
    return null;
}

export async function load_tiff_file_as_blob(file:File, page_nr = 0): Promise<Blob|null> {
    const rgba: ImageData|null = await load_tiff_file(file, page_nr)
    if(rgba != null) {
        const canvas: HTMLCanvasElement = document.createElement('canvas')
        canvas.width  = rgba.width
        canvas.height = rgba.height
        
        const ctx: CanvasRenderingContext2D|null = canvas.getContext('2d')
        if(!ctx)
            return null;
        
        ctx.putImageData(rgba, 0, 0);
        return new Promise( (resolve: any) => {
            canvas.toBlob((blob: Blob|null )=>  resolve(blob), 'image/jpeg', 0.92);
        } )
    }
    return null;
}
