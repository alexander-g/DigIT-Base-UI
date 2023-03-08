

export class Box {
    x0: number;
    y0: number;
    x1!: number;
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


export function is_number_array(x: unknown): x is number[] {
    return Array.isArray(x) && x.every(element => typeof element === "number")
}

export function is_4_number_array(x: unknown): x is [number, number, number, number] {
    return is_number_array(x) && (x.length == 4)
}



export function validate_boxes(maybe_boxes:unknown): Box[]|undefined {
    if(maybe_boxes == undefined)
        return undefined;
    
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
