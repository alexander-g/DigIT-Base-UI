import { preact, JSX, signals } from "../dep.ts";
import { MaybeResultState }     from "../state.ts";
import * as util                from "../util.ts";
import * as styles              from "./styles.ts"
import { black_to_transparent_css }     from "./SVGFilters.tsx";

type ResultOverlaysProps = {
    result:     signals.ReadonlySignal<MaybeResultState>;
}

/** A list of elements that display processing results */
export class ResultOverlays extends preact.Component<ResultOverlaysProps> {    
    render(props:ResultOverlaysProps): JSX.Element {
        const children: JSX.Element[] = []

        if(props.result.value?.classmap)
            children.push(
                <ImageOverlay 
                    imagename = {props.result.value.classmap}
                    visible   = {props.result.value.$visible}
                />
            )

        return <>
            { children }
        </>
    }
}





type ImageOverlayProps = {
    imagename:        string;
    visible:          signals.ReadonlySignal<boolean>;
}

/** A result overlay that displays an image (e.g. a segmentation result) */
export class ImageOverlay extends preact.Component<ImageOverlayProps> {
    img_src: signals.Signal<string|undefined> = new signals.Signal()

    render(props:ImageOverlayProps): JSX.Element {
        const display_css:Record<string, string> 
            = props.visible.value ? {} : {display:'none'}
        
        return <img 
            class       =   "overlay unselectable pixelated" 
            src         =   {this.img_src.value}  
            draggable   =   {false} 
            style       =   {{
                ...styles.overlay_css, 
                ...styles.pixelated_css,
                //...styles.unselectable_css,
                ...black_to_transparent_css,
                ...display_css,
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
