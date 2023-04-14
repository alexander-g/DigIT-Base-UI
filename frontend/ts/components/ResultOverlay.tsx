import { preact, JSX, Signal, ReadonlySignal }  from "../dep.ts";
import { ResultSignal, Result }                 from "../state.ts";
import * as util                                from "../util.ts";
import * as ui_util                             from "./ui_util.ts";
import * as styles                              from "./styles.ts"
import { black_to_transparent_css }             from "./SVGFilters.tsx";
import { BoxesOverlay }                         from "./BoxesOverlay.tsx";
import { Instance }                             from "../logic/boxes.ts";

export type ResultOverlaysProps = {
    /** Result that should be displayed in this overlay */
    $result:     Readonly<ResultSignal>;

    /** Props passed to the box overlay. If undefined no box overlay is created */
    boxoverlay_props?: {
        $drawing_mode_active:       Signal<boolean>;
        /** Dimensions of the corresponding image  */
        imagesize?:                 util.ImageSize;
    }
}

/** A list of elements that display processing results */
export class ResultOverlays<P extends ResultOverlaysProps> extends preact.Component<P> {    
    render(props:P): JSX.Element {
        const children: (JSX.Element|null)[] = []

        children.push(this.maybe_create_image_overlay())
        children.push(this.maybe_create_boxoverlay())

        return <>
            { children }
        </>
    }

    /** Callback from child component reporting new instances after user input */
    on_new_instances(new_instances: Instance[]) {
        this.props.$result.set_instances(new_instances)
    }

    maybe_create_image_overlay(): JSX.Element|null {
        const $result:ResultSignal = this.props.$result
        if($result.value.classmap)
            return <ImageOverlay
                imagename = {$result.value.classmap}
                $visible  = {$result.$visible}
            />
        else return null;
    }

    maybe_create_boxoverlay(): JSX.Element|null {
        const $result:ResultSignal = this.props.$result
        if(this.props.boxoverlay_props)
            return <BoxesOverlay 
                $visible            = {$result.$visible}
                $instances          = {$result.$instances}
                on_new_instances    = {this.on_new_instances.bind(this)}
                {...this.props.boxoverlay_props}
            />
        else return null;
    }
}





export type ImageOverlayProps = {
    imagename:        string;
    //$visible:         ReadonlySignal<boolean>;
} & ui_util.MaybeHiddenProps

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
        this.img_src.value = await fetch_image_as_blob(this.props.imagename);
    }
}


/** Request image from backend, retuning a blob object url */
export async function fetch_image_as_blob(imagename:string): Promise<string> {
    const response:Response = await fetch(util.url_for_image(imagename));
    const blob:Blob         = await response.blob()
    return URL.createObjectURL(blob)
}
