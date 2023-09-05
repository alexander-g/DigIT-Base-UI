import * as util                from "../util.ts";

export class Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;

    //TODO? convert to class and add width()/height() getters

    constructor(x0:number, y0:number, x1:number, y1:number) {
        //make sure (x0,y0) is the top-left corner
        this.x0 = x0 < x1? x0 : x1;
        this.y0 = y0 < y1? y0 : y1;
        this.x1 = x0 < x1? x1 : x0;
        this.y1 = y0 < y1? y1 : y0;
    }

    static from_array(x:[number, number, number, number]): Box {
        return new Box(...x)
    }
}


export type Instance = {
    box:    Box;
    label:  string;
}



export type FourNumbers = [number, number, number, number];

export function validate_4_number_array(x: unknown): FourNumbers|null {
    if(util.is_number_array(x)
    && x.length == 4){
        return x as FourNumbers
    }
    else return null;
}

export function is_4_number_array(x: unknown): x is FourNumbers {
    return validate_4_number_array(x) == x;
}

export function validate_4_number_arrays(x: unknown): FourNumbers[]|null {
    if(util.is_array_of_type(x, validate_4_number_array)) {
        return x
    }
    else return null;
}



export function validate_boxes(maybe_boxes:unknown): Box[]|null {
    if(maybe_boxes == undefined)
        return null;
    
    if(!Array.isArray(maybe_boxes))
        throw Error('Encountered invalid element for boxes')

    const boxes: Box[] = [];
    for(const maybe_box of maybe_boxes) {
        if(!is_4_number_array(maybe_box))
            throw Error('Encountered invalid number of coordinates for boxes')
        
        boxes.push( Box.from_array(maybe_box) )
    }
    return boxes;
}



export function validate_box(x: unknown): Box|null {
    if(util.is_object(x)
    && util.has_property_of_type(x, 'x0', util.validate_number)
    && util.has_property_of_type(x, 'y0', util.validate_number)
    && util.has_property_of_type(x, 'x1', util.validate_number)
    && util.has_property_of_type(x, 'y1', util.validate_number)){
        return x;
    } else if(is_4_number_array(x)) {
        return Box.from_array(x)
    }
    else return null;
}

export function validate_instance(x: unknown): Instance|null {
    if(util.is_object(x)
    && util.has_string_property(x, 'label')
    && util.has_property_of_type(x, 'box', validate_box)){
        return x;
    }
    else return null;
}

