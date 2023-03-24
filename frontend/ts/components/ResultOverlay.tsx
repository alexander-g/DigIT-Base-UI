import { preact, JSX, Signal, ReadonlySignal }  from "../dep.ts";
import { ResultState }                          from "../state.ts";
import * as util                                from "../util.ts";
import * as ui_util                             from "./ui_util.ts";
import * as styles                              from "./styles.ts"
import { black_to_transparent_css }             from "./SVGFilters.tsx";
import { BoxesOverlay }                         from "./BoxesOverlay.tsx";
import { Instance }                             from "../logic/boxes.ts";

type ResultOverlaysProps = {
    /** Result that should be displayed in this overlay */
    $result:     ReadonlySignal<ResultState>;

    /** Props passed to the box overlay. If undefined no box overlay is created */
    boxoverlay_props?: {
        $drawing_mode_active:       Signal<boolean>;
        /** Dimensions of the corresponding image  */
        imagesize?:                 util.ImageSize;
    }
}




/** A list of elements that display processing results */
export class ResultOverlays extends preact.Component<ResultOverlaysProps> {    
    render(props:ResultOverlaysProps): JSX.Element {
        const children: JSX.Element[] = []

        const result: ResultState = props.$result.value;
        if(result.classmap)
            children.push(
                <ImageOverlay 
                    imagename = {result.classmap}
                    $visible  = {result.$visible}
                />
            )
        
        if(props.boxoverlay_props)
            children.push(
                <BoxesOverlay 
                    $visible            = {result.$visible}
                    $instances          = {result.$instances}
                    on_new_instances    = {this.on_new_instances.bind(this)}
                    {...props.boxoverlay_props}
                />
            )

        return <>
            { children }
        </>
    }

    on_new_instances(new_instances: Instance[]) {
        this.props.$result.peek().set_instances(new_instances)
    }
}





type ImageOverlayProps = {
    imagename:        string;
    //$visible:         ReadonlySignal<boolean>;
} & ui_util.MaybeHiddenProps

/** A result overlay that displays an image (e.g. a segmentation result) */
export class ImageOverlay extends ui_util.MaybeHidden<ImageOverlayProps> {
    img_src: Signal<string|undefined> = new Signal()

    render(props:ImageOverlayProps): JSX.Element {        
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

    componentDidMount(): void {
        this.load_image(this.props.imagename);
    }

    async load_image(imagename:string): Promise<void> {
        //TODO: error handling
        const response:Response = await fetch(util.url_for_image(imagename));
        const blob:Blob         = await response.blob()
        this.img_src.value      = URL.createObjectURL(blob)
    }
}
