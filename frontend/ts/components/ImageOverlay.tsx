import { JSX, Signal, preact }                  from "../dep.ts";
import * as util                                from "../util.ts";
import * as ui_util                             from "./ui_util.ts";
import * as styles                              from "./styles.ts"
import { black_to_transparent_css }             from "./SVGFilters.tsx";

import { SingleFileContent }                    from "./FileTable.tsx";
import { SegmentationResult }                   from "../logic/segmentation.ts";


export class SegmentationContent<R extends SegmentationResult = SegmentationResult> 
extends SingleFileContent<R> {
    result_overlays(): JSX.Element {
        return (
            <ImageOverlay 
                imagename = {this.props.$result.value.classmap}        
                $visible  = {this.$result_visible}
            />
        )
    }
}



export type ImageOverlayProps = ui_util.MaybeHiddenProps & {
    /** Image name/url to fetch that shall be overlayed */
    imagename:         string|null;
}

/** A result overlay that displays an image (e.g. a segmentation result) */
export class ImageOverlay<P extends ImageOverlayProps> extends ui_util.MaybeHidden<P> {
    //$img_src: Signal<string|undefined> = new Signal()

    ref: preact.RefObject<HTMLImageElement> = preact.createRef()

    render(props:P): JSX.Element {        
        //img.src set manually
        return <img 
            class       =   "overlay unselectable pixelated" 
            ref         =   {this.ref}
            draggable   =   {false}
            style       =   {{
                ...styles.overlay_css, 
                ...styles.pixelated_css,
                ...black_to_transparent_css,
                ...super.get_display_css(),
            }}
        />
    }

    shouldComponentUpdate(nextProps: Readonly<P>): boolean {
        const imagename:string|null = nextProps.imagename;
        if(imagename != null)
            this.set_img_src(imagename)  //no await
        
        return true;
    }

    async set_img_src(imagename:string): Promise<void> {
        if(this.ref.current != null) {
            const maybe_objurl:string|Error = await util.fetch_image_as_object_url(imagename)
            if(typeof maybe_objurl == 'string')
                this.ref.current.src = maybe_objurl;
        }
    }
}


