import { default as pt } from "perspective-transform";
import { transpose } from "./matrix";
import { getRect } from "./helpers";
const partyColor = "#DB14C1";
const canvasEle = document.getElementById("drawContainer");
const context = canvasEle.getContext("2d");
let startPosition = { x: 0, y: 0 };
let lineCoordinates = { x: 0, y: 0 };
let isDrawStart = false;
const srcCoords = [[null], [null]];
let resultBoxWidth, resultBoxHeight;

// Failing if scrolled down - update
const getClientOffset = (event) => {
  const rect = canvasEle.getBoundingClientRect();
  const { pageX, pageY } = event.touches ? event.touches[0] : event;
  const x = pageX - rect.left;
  const y = pageY - rect.top - window.scrollY;

  return { x, y };
};

const drawLine = () => {
  context.beginPath();
  context.moveTo(startPosition.x, startPosition.y);
  context.lineTo(lineCoordinates.x, lineCoordinates.y);
  context.strokeStyle = partyColor;
  context.stroke();
};

const mouseDownListener = (event) => {
  startPosition = getClientOffset(event);
  isDrawStart = true;
};

const mouseMoveListener = (event) => {
  if (!isDrawStart) return;

  lineCoordinates = getClientOffset(event);
  clearCanvas();
  drawLine();
};

const mouseupListener = (_event) => {
  isDrawStart = false;
};

const clearCanvas = () => {
  context.clearRect(0, 0, canvasEle.width, canvasEle.height);
};

canvasEle.addEventListener("mousedown", mouseDownListener);
canvasEle.addEventListener("mousemove", mouseMoveListener);
canvasEle.addEventListener("mouseup", mouseupListener);

canvasEle.addEventListener("touchstart", mouseDownListener);
canvasEle.addEventListener("touchmove", mouseMoveListener);
canvasEle.addEventListener("touchend", mouseupListener);

// ZOOM stuffs
const sourceImage = document.getElementById("card");
const sourceCanvas = document.getElementById("drawContainer");
const zoomCanvas = document.getElementById("zoomCanvas");
const zoomContext = zoomCanvas.getContext("2d");
zoomContext.imageSmoothingEnabled = false;
zoomContext.mozImageSmoothingEnabled = false;
zoomContext.webkitImageSmoothingEnabled = false;
zoomContext.msImageSmoothingEnabled = false;

function addCrosshair(ctx, c) {
  const x = c.width / 2;
  const y = c.height / 2;
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.strokeStyle = partyColor;
  ctx.stroke();
}

function pxzoom(ev) {
  const offset = 10;
  const rect = canvasEle.getBoundingClientRect();
  zoomCanvas.style.visibility = "visible";
  const scaleFactor = sourceImage.naturalWidth / sourceImage.clientWidth;
  const x = ev.layerX * scaleFactor;
  const y = ev.layerY * scaleFactor;
  zoomCanvas.style.left = ev.layerX + rect.left + offset + "px";
  zoomCanvas.style.top = ev.layerY + rect.top + window.scrollY + offset + "px";
  zoomContext.drawImage(
    sourceImage,
    Math.abs(x - 5),
    Math.abs(y - 5),
    10,
    10,
    0,
    0,
    100,
    100
  );
  addCrosshair(zoomContext, zoomCanvas);
}

sourceCanvas.addEventListener("mousemove", pxzoom, false);
sourceCanvas.addEventListener(
  "mouseout",
  (ev) => (zoomCanvas.style.visibility = "hidden")
);

const status = document.getElementById("statusBox");
function addPoints(set) {
  srcCoords[set] = [
    startPosition.x,
    startPosition.y,
    lineCoordinates.x,
    lineCoordinates.y
  ];
  const pretty = srcCoords.map((i) => i.map(Math.round));
  status.innerText = "Input Coords: " + pretty.toString();
}

const processImage = () => {
  const scaleFactor = sourceImage.naturalWidth / sourceImage.clientWidth;
  const selectRect = getRect(srcCoords);
  resultBoxWidth = selectRect.width * scaleFactor;
  resultBoxHeight = selectRect.height * scaleFactor;

  // prettier-ignore
  const restultingCoords = [
    0,                  0,
    0,                  resultBoxHeight,
    resultBoxWidth,     0,
    resultBoxWidth,     resultBoxHeight
  ];

  const scaledSource = srcCoords.flat().map((x) => x * scaleFactor);
  const perspT = pt(scaledSource, restultingCoords);
  // draw fixed image
  const resultImg = document.getElementById("result");
  resultImg.src = sourceImage.src;
  const H = perspT.coeffs;
  // prettier-ignore
  const fullMatrix = [
    [H[0],   H[1],   0, H[2]],
    [H[3],   H[4],   0, H[5]],
    [   0,      0,   1,    0],
    [H[6],   H[7],   0, H[8]]
  ]

  // prettier-ignore
  const noTranslate = [
    [H[0],   H[1],   0,    0],
    [H[3],   H[4],   0,    0],
    [   0,      0,   1,    0],
    [H[6],   H[7],   0, H[8]]
  ]

  // Show with simple CSS transform
  resultImg.style.transform = `matrix3d(${transpose(noTranslate)})`;

  // madness
  const canvas = document.createElement("canvas");
  const inScreen = document.getElementById("resultCanvas");

  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(sourceImage, 0, 0);
  getTransformedCanvas(canvas, `matrix3d(${transpose(fullMatrix)})`, [
    resultBoxWidth,
    resultBoxHeight
  ])
    .then(function (img) {
      inScreen.width = img.naturalWidth;
      inScreen.height = img.naturalHeight;
      inScreen.getContext("2d").drawImage(img, 0, 0);
    })
    .catch(console.error);
};

document
  .getElementById("firstLine")
  .addEventListener("click", () => addPoints(0));
document
  .getElementById("secondLine")
  .addEventListener("click", () => addPoints(1));

document
  .getElementById("processTransform")
  .addEventListener("click", processImage);

// This function attempts to mimic CSS 3D transforms onto a canvas
// so the result can be saved.  This does so via SVG intermediate
// Unfortunately SVG 3D is not exactly the same as CSS 3D 😢
//https://stackoverflow.com/questions/27177386/svg-matrix3d-renders-differently-in-different-browser
function getTransformedCanvas(
  canvas,
  CSSTransform,
  [iWidth, iHeight] = [null, null]
) {
  return new Promise(function (res, rej) {
    const dim = getTransformedDimensions(canvas, CSSTransform);
    const xlinkNS = "http://www.w3.org/1999/xlink",
      svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg"),
      defs = document.createElementNS(svgNS, "defs"),
      style = document.createElementNS(svgNS, "style"),
      image = document.createElementNS(svgNS, "image");
    image.setAttributeNS(xlinkNS, "href", canvas.toDataURL());
    image.setAttribute("width", canvas.width);
    image.setAttribute("height", canvas.height);
    style.innerHTML = "image{transform:" + CSSTransform + ";}";
    svg.appendChild(defs);
    defs.appendChild(style);

    svg.appendChild(image);
    svg.setAttribute("width", iWidth || dim.width);
    svg.setAttribute("height", iHeight || dim.height);
    const svgStr = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = function () {
      res(img);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(
      new Blob([svgStr], { type: "image/svg+xml" })
    );
  });
}

function getTransformedDimensions(canvas, CSSTransform) {
  const orphan = !canvas.parentNode;
  if (orphan) document.body.appendChild(canvas);
  const oldTrans = getComputedStyle(canvas).transform;
  canvas.style.transform = CSSTransform;
  const rect = canvas.getBoundingClientRect();
  canvas.style.transform = oldTrans;
  if (orphan) document.body.removeChild(canvas);
  return rect;
}

function changeImage(imgNum) {
  sourceImage.src = `/${imgNum}.jpg`;
  sourceImage.onload = () => {
    sourceCanvas.width = sourceImage.width;
    sourceCanvas.height = sourceImage.height;
  };
}

document
  .getElementById("firstImg")
  .addEventListener("click", () => changeImage(1));

document
  .getElementById("secondImg")
  .addEventListener("click", () => changeImage(2));

document
  .getElementById("thirdImg")
  .addEventListener("click", () => changeImage(3));

document
  .getElementById("fourthImg")
  .addEventListener("click", () => changeImage(4));

document
  .getElementById("fifthImg")
  .addEventListener("click", () => changeImage(5));
