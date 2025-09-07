import { JSX, Signal, preact }                  from "../dep.ts";
import * as util                                from "../util.ts";
import * as ui_util                             from "./ui_util.ts";
import * as styles                              from "./styles.ts"
import { black_to_transparent_css }             from "./SVGFilters.tsx";

import { SingleFileContent }                    from "./FileTable.tsx";
import { set_image_src }                        from "./ImageComponents.tsx";
import { type SegmentationResult }              from "../logic/segmentation.ts";
import { type InstanceSegmentationResult }      from "../logic/instancesegmentation.ts";


export class SegmentationContent<R extends SegmentationResult = SegmentationResult> 
extends SingleFileContent<R> {
    override result_overlays(): JSX.Element {
        return (
            <ImageOverlay 
                image     = {this.props.$result.value.classmap}        
                $visible  = {this.$result_visible}
            />
        )
    }
}

export class InstanceSegmentationContent<R extends InstanceSegmentationResult> 
extends SingleFileContent<R> {
    override result_overlays(): JSX.Element {
        return (
            <ImageOverlay 
                image     = {this.props.$result.value.instancemap}        
                $visible  = {this.$result_visible}
            />
        )
    }
}




export type ImageOverlayProps = ui_util.MaybeHiddenProps & {
    /** Image name/url to fetch or already loaded image file/blob that shall be overlayed */
    image: string|Blob|null;
}

/** A result overlay that displays an image (e.g. a segmentation result) */
export class ImageOverlay<P extends ImageOverlayProps> extends ui_util.MaybeHidden<P> {
    //$img_src: Signal<string|undefined> = new Signal()

    ref: preact.RefObject<HTMLImageElement> = preact.createRef()

    render(_props:P): JSX.Element {        
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

    override shouldComponentUpdate(nextProps: Readonly<P>): boolean {
        const image:string|Blob|null = nextProps.image;
        if(image != null)
            this.set_img_src(image)  //no await
        
        return true;
    }

    override componentDidMount(): void {
        if(this.props.image != null)
            this.set_img_src(this.props.image)
    }

    async set_img_src(image:string|Blob): Promise<void> {
        if(this.ref.current == null) 
            return;

        if(typeof image == 'string'){
            const blob:Blob|Error = await util.fetch_image_as_blob(image)
            if(blob instanceof Blob)
                image = blob;
        }
        set_image_src(this.ref.current, image, /*lossless=*/true)
    }
}


