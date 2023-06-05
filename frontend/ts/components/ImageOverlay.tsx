import { JSX, Signal }                          from "../dep.ts";
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
    imagename:        string|null;
}

/** A result overlay that displays an image (e.g. a segmentation result) */
export class ImageOverlay<P extends ImageOverlayProps> extends ui_util.MaybeHidden<P> {
    img_src: Signal<string|undefined> = new Signal()

    render(props:P): JSX.Element {        
        return <img 
            class       =   "overlay unselectable pixelated" 
            src         =   {this.img_src.value}  
            draggable   =   {false} 
            style       =   {{
                ...styles.overlay_css, 
                ...styles.pixelated_css,
                ...black_to_transparent_css,
                ...super.get_display_css(),
            }}
        />
    }

    async componentDidMount(): Promise<void> {
        if(this.props.imagename != null)
            this.img_src.value = await fetch_image_as_blob(this.props.imagename);
    }
}


/** Request image from backend, retuning a blob object url */
export async function fetch_image_as_blob(imagename:string): Promise<string> {
    const response:Response = await fetch(util.url_for_image(imagename));
    const blob:Blob         = await response.blob()
    return URL.createObjectURL(blob)
}
