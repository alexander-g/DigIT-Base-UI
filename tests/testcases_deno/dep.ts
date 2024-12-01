export * as asserts from "jsr:@std/assert@1.0.8";
export * as mock    from "jsr:@std/testing@1.0.5/mock"
export * as fs      from "jsr:@std/fs@1.0.6";
export * as path    from "jsr:@std/path@1.0.8";

//export * as jsdom   from "https://dev.jspm.io/jsdom@21.1.0";
//NOTE: same as the jspm.io version above, but bundled. the jspm version does not work on github
export * as jsdom   from  "https://gist.githubusercontent.com/alexander-g/06bc3aedfd0337b47c62e9307787948a/raw/bf892ec7c7e672cf1014cd937804bff5daefc702/jsdom.bundle.js"
