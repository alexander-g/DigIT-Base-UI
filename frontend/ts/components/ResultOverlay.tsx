import { preact, JSX, signals } from "../dep.ts";
import { MaybeResult }          from "../state.ts";
import * as util                from "../util.ts";
import * as styles              from "./styles.ts"
import { black_to_transparent_css }     from "./SVGFilters.tsx";

type ResultOverlaysProps = {
    result:     signals.ReadonlySignal<MaybeResult>;
}

/** A list of elements that display processing results */
export class ResultOverlays extends preact.Component<ResultOverlaysProps> {    
    render(props:ResultOverlaysProps): JSX.Element {
        const children: JSX.Element[] = []

        if(props.result.value?.classmap)
            children.push(<ImageOverlay imagename={props.result.value.classmap}/>)

        return <>
            { children }
        </>
    }
}





type ImageOverlayProps = {
    imagename:        string;
}

/** A result overlay that displays an image (e.g. a segmentation result) */
class ImageOverlay extends preact.Component<ImageOverlayProps> {
    img_src: signals.Signal<string|undefined> = new signals.Signal()

    render(): JSX.Element {
        return <img 
            class       =   "overlay unselectable pixelated" 
            src         =   {this.img_src.value}  
            draggable   =   {false} 
            style       =   {{
                ...styles.overlay_css, 
                ...styles.pixelated_css,
                //...styles.unselectable_css,
                ...black_to_transparent_css,
            }}
        />
    }

    componentDidMount(): void {
        this.load_image(this.props.imagename);
    }

    async load_image(imagename:string): Promise<void> {
        console.log('Loading result image', imagename)
        //TODO: error handling
        const response:Response = await fetch(util.url_for_image(imagename));
        const blob:Blob         = await response.blob()
        this.img_src.value      = URL.createObjectURL(blob)
    }
}
