import { JSX }          from "../dep.ts";

/** SVG filters to modify colors in result images */
export function SVGFilters(): JSX.Element {
    return <svg height="0">
        <defs>
            <filter id="black-to-transparent">
            {/* <!-- image filter to set alpha=0 where the image is black --> */}
            <feColorMatrix in="SourceGraphic"
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        255 255 255 0 0" />
            </filter>

            <filter id="white-to-red">
            <feColorMatrix in="SourceGraphic"
                type="matrix"
                values="1 1 1 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0" />
            </filter>
        </defs>
    </svg>
}


/** CSS style to set alpha=0 where image is black */
export const black_to_transparent_css = {
    filter:     "url(#black-to-transparent)"
}
