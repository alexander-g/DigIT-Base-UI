
/** CSS to make elements (almost) fill the page horizontally */
export const page_wide_css = {width: 'calc(100% - 40px)!important'}
    

/** CSS to make elements overlay over others */
export const overlay_css = {
    position:   "absolute",
    left:       0,
    top:        0, 
    width:      "100%",
    height:     "100%",
}

/** Nearest neighbor interpolation for images */
export const pixelated_css = {
    '-ms-interpolation-mode':       'nearest-neighbor',
    'image-rendering':              'pixelated',
}

/** Prevent selection of element (FIXME: doesnt work) */
export const unselectable_css = {
    userDrag:               'none',
    userSelect:             'none',
    '-moz-user-select':     'none',
    '-webkit-user-drag':    'none',
    '-webkit-user-select':  'none',
    '-ms-user-select':      'none',
}
