# DigIT-Base-UI
Base User Interface for the DigIT Projects
- [Root-Detector](https://github.com/alexander-g/Root-Detector)
- [CARROT](https://github.com/alexander-g/CARROT) (Wood Anatomy)
- [Tofsi-POST](https://github.com/alexander-g/Tofsi-POST) (Pollen)
- [BatNet](https://github.com/GabiK-bat/BatNet)

***

### Layout

Currently meant to be used as a git submodule in a downstream project.

```
RootDetector                  #downstream project
+-- base/                     #this repository
|   +-- main.py               #minimal, for standalone testing only
|   +-- backend/              #python server code
|   |   +-- ts/               #typescript backend code for building and bundling
|   |   +-- app.py            #base flask app
|   +-- frontend/             
|   |   +-- ts/               #base typescript UI code

+-- backend/                  #downstream backend extensions
|   +-- app.py                
+-- frontend/
|   +-- roots/                #downstream typescript UI extensions
+-- models/                   #pretrained models folder
+-- static/                   #served HTML/JS/CSS, recompiled dynamically
+-- cache/                    #temporary, stores images/results for processing
```
