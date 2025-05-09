import TextToSVG from "text-to-svg";
import fs from "node:fs"
import hljs from "highlight.js";
import { parse } from 'node-html-parser';
import css from "css";

const textToSVG = TextToSVG.loadSync('UbuntuMono-Regular.ttf');

const colorMap = new Map();

function loadCss(filename) {
    const cssContent = fs.readFileSync(filename, 'utf8');
    const cssAst = css.parse(cssContent);

    for (let rule of cssAst.stylesheet.rules) {
        if (rule.type === 'rule') {        
            const colorDeclaration = rule.declarations.find(d => d.property === 'color');
            if (colorDeclaration) {
                for (let selector of rule.selectors) {
                    colorMap.set(selector, colorDeclaration.value);
                }
            }                
        }
    }   

    //console.log(colorMap.entries());
}

function findColor(clazz) {
    if (colorMap.has('.'+clazz))
        return colorMap.get('.'+clazz);

    if (colorMap.has('.hljs'))
        return colorMap.get('.hljs');
    
    return '#000000';
}

function getPath(textAndClass, x, y) {
    const text = textAndClass.text;
    const color = findColor(textAndClass.class);

    const options = {x, y, fontSize: 48, anchor: 'top', attributes: {fill: color}};
    const path = textToSVG.getPath(text, options);    
    const metrics = textToSVG.getMetrics(text, options);    
    return [path, metrics.width, metrics.height];
}

function outputFile(paths, width, height, filename) {

    let svg = `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='${width}' height='${height}'>\n`;
    for(let path of paths) {     
        svg += path;
    }
    svg += "</svg>";

    fs.writeFileSync(filename, svg);
      
}

/*Returns [
    { text: 'function', class: 'hljs-keyword' },
    { text: ' ', class: '' },
    { text: 'foo', class: 'hljs-title' },
]*/
function tokenize(code, language) {
    const html = hljs.highlight(code, {language: 'ts'}).value;
    const root = parse(html);
    const tokens = tokenizeHtmlElementList(root.childNodes);
    //console.log(tokens);
    return tokens;
}

function getClass(classList) {
    for(let clazz of classList)
        if (clazz.startsWith('hljs-'))
            return clazz;

    return classList[0];
}

function tokenizeHtmlElementList(elemList) {
    const tokens = [];

    for(let elem of elemList) {
        if (elem.nodeType === 3) {
            tokens.push({ text: elem.rawText, class: '' });
        }
        else if (elem.classList && elem.classList.contains('hljs-params')) {
            tokens.push(... tokenizeHtmlElementList(elem.childNodes));
        }
        else {
            var clazz = getClass(elem.classList.value);
            tokens.push({ text: elem.innerText, class: clazz });
        }
    }

    return tokens;
}

function generatePaths(code, language, x, y) {
    x = x || 0;
    y = y || 0;
    let maxX = 0, maxY = 0;
    let initialX = x;
    const paths = [];
    for(let codeLine of code.split("\n")) {
        const tokens = tokenize(codeLine, language);
        let lastHeight = 0;
        for (let token of tokens) {
            let [path, width, height] = getPath(token, x, y);
            paths.push(path);
            x+=width;    
            if (x > maxX) {
                maxX = x;
            }
            lastHeight = height;
        }
        y = y + lastHeight;
        x = initialX
        if (y > maxY) {
            maxY = y;
        }
    }
    return [paths, maxX, maxY];
}

function splitCodeFile(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const parts = content.split("====").map(s => s.replace(/^\r?\n/, ''));
    return parts;
}

function readCodeFile(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    return content;
}

loadCss('theme.css');


/*const snippets = splitCodeFile('code.ts');
let index = 0;
for (let snippet of snippets) {
    const [paths, width, height] = generatePaths(snippet, 'ts', 0, 0);
    outputFile(paths, width, height, "output"+ (index++) + ".svg");
}*/


const snippet = readCodeFile('code-typing.ts');
let x = 0;
let y = 0;

let total_width = 0;
let total_height = 0;
let frame_width = 0;
let frame_height = 0;
let paths = [], firstPath = [];

// Get slice dimensions
[firstPath, frame_width, frame_height] = generatePaths(snippet, 'ts', x, y);

// Compute each frame
for (let i=1; i<=snippet.length; i++) {    
    const [current_paths, maxX, maxY] = generatePaths(snippet.substring(0, i), 'ts', x, y);

    if (maxX > total_width) total_width = maxX;
    if (maxY > total_height) total_height = maxY;

    if (x > 2000) {
        x = 0;
        y += frame_height;
    }
    else {
        x += frame_width;
    }

    paths.push(...current_paths);     
}

console.log("Total width: " + total_width + ", height: " + total_height + ", frame width: " + frame_width + ", height: " + frame_height);


outputFile(paths.reverse(), total_width, total_height, "output.svg");