import 'normalize.css';
import './style.css';
import data from './data.json';
import * as topojson from 'topojson';
import * as selection from 'd3-selection';
import { geoEquirectangular, geoPath, geoGraticule } from 'd3-geo';
import { min, max, median } from 'd3-array';
import { json } from 'd3-fetch';
import { saveRequestID, setReady, triggerError, log } from './actions';

let worker;
let logViewHeight;
if (__DEV__) {
  const Worker = require('worker-loader!./long-pooling.js');
  worker = new Worker();
  worker.addEventListener('message', function (e) {
    const { payload } = e.data;
    switch (e.data.action) {
      case triggerError:
        console.error(payload);
        worker.terminate();
      break;
      case log:
        console.log(payload);
      break;
    }
  });
  worker.addEventListener('close', function (e) {
    console.log('worker closed:', e);
  });

  logViewHeight = function () {
    const { top, bottom } = svg.node().getBoundingClientRect();
    worker.postMessage({
      action: log,
      payload: { top: top > 0? top.toFixed(2) : 0, bottom: bottom.toFixed(2) }
    });
  }
}

const d3 = Object.assign(selection, {
  geoEquirectangular, geoPath, geoGraticule, min, max, median, json
});

let width = Math.min(960, document.body.clientWidth);
let height = Math.min(480, document.body.clientHeight);

let SCALE = height / Math.PI;
let COORS = [width / 2, height / 2];
let CENTER = [0, 0];
let projection = d3.geoEquirectangular()
  .scale(SCALE)
  .translate(COORS)
;
let path = d3.geoPath()
  .projection(projection)
;
const graticule = d3.geoGraticule();
const svg = d3.select('svg')
  .attr('width', width)
  .attr('height', height)
;

svg.append('path')
  .datum(graticule)
  .attr('class', 'graticule')
  .attr('d', path)
;

d3.json('/world.json').then(function (world) {
  svg.insert("path", ".graticule")
      .datum(topojson.feature(world, world.objects.land))
      .attr("class", "land")
      .attr("d", path)
  ;
  svg.insert("path", ".graticule")
      .datum(topojson.mesh(world, world.objects.countries, (a, b) => a !== b))
      .attr("class", "boundary")
      .attr("d", path)
  ;
}).catch(error => console.error(error));

const massArray = data.features.map(f => +f.properties.mass);
const massMax = d3.max(massArray);
const massMedian = d3.median(massArray);
const dr = DistributionRanges(0, massMax, massMedian);
path.pointRadius(personalizeSize);
function personalizeSize(feature) {
  if (feature.type === 'Feature' && feature.geometry
      && feature.geometry.type === 'Point' && feature.properties
      && feature.properties.mass) {
    return dr(feature.properties.mass) + 2;
  }
  return 4.5;
}

if (__DEV__) {
  logViewHeight();
}

let displayDataActive = false;
const windowDiv = document.querySelector('.window');
svg.append('g')
  .attr('class', 'meteor-layer')
  .selectAll('.meteorites')
  .data(data.features)
  .enter().append('path')
  .attr('class', 'meteorites')
  .attr('d', path)
  .on('mouseover', showMeteoriteData)
  .on('mouseleave', function () {
    windowDiv.classList.add('close');
  })
  .on('touchstart', function () {
    displayDataActive = true;
  })
  .on('touchend', function (feature) {
    if (displayDataActive) {
      showMeteoriteData.call(this, feature);
    }
  })
;

const svgYOffset = svg.node().getBoundingClientRect().top;
function showMeteoriteData(feature) {
  windowDiv.classList.remove('close');
  const touches = d3.event.changedTouches;
  const { clientX, clientY } = touches? touches[0]: d3.event;
  const contentWidth = 210;
  const contentHeight = 250;
  const spaceRight = width - (pageXOffset + clientX + contentWidth);
  const spaceBot = height + svgYOffset - (pageYOffset + clientY + contentHeight);
  const px = 'px';
  windowDiv.style.left = spaceRight > 0?
    clientX + 20 + px :
    width - (contentWidth + 10) + px
  ;
  windowDiv.style.top = spaceBot > 0?
    clientY + 20 + px :
    height - (contentHeight + 10) + px
  ;
 
  const {
    id, name, year, mass, recclass, reclat, reclong
  } = feature.properties;
  windowDiv.innerHTML = [
    `id: ${id}`,
    `name: ${name}`,
    `year: ${new Date(year).getFullYear()}`,
    `mass: ${mass}`,
    `class: ${recclass}`,
    `lat: ${reclat}`,
    `long: ${reclong}`
  ].map((f) => `<p class="flat">${f}</p>`).join('');

  if (__DEV__) {
    const { top, bottom } = svg.node().getBoundingClientRect();
    const { availHeight, height } = screen;
    worker.postMessage({
      action: log,
      payload: {
        top: top > 0? top.toFixed(2): 0,
        bottom: bottom.toFixed(2),
        availHeight,
        height,
        clientX,
        clientY
      }
    });
  }
}

const middleY = height / 2;
const middleX = width / 2;
const length = 10;
const stroke = '#45aca0';

{ //draw center cross and windowDiv
svg.append('line')
  .attr('x1', middleX - length)
  .attr('y1', middleY)
  .attr('x2', middleX + length)
  .attr('y2', middleY)
  .attr('stroke', stroke)
  .attr('class', 'cross-center')
;
svg.append('line')
  .attr('x1', middleX)
  .attr('y1', middleY - length)
  .attr('x2', middleX)
  .attr('y2', middleY + length)
  .attr('stroke', stroke)
  .attr('class', 'cross-center')
;

d3.select('.window')
.attr('class', 'window close')
.on('touchstart', closeWindow)
.on('touchmove', closeWindow)
;
}

function closeWindow() {
  if (displayDataActive) {
    windowDiv.classList.add('close');
    displayDataActive = false;
  }
}

const render = Render();
const zoom = Zoom(render);
const drag = Drag(render);
let coors = [...COORS];
let center = [...CENTER];
let scale = SCALE;
let moveCounter = 0;
let moveTimer = 0;

{ //svg events
svg
  .on('wheel', function () {
    d3.event.preventDefault();
    const sum = -d3.event.deltaY * 22;
    scale = Math.min(2000, Math.max(40, scale + sum));
    projection.scale(scale);
    render.queue(function beforeRender() {
      height = scale * Math.PI;
    });
  })
  .on('dblclick', function () {
    if (scale === SCALE) {
      scale += 1000;
      projection.scale(scale);
      render.queue();
    } else {
      const centre = false;
      zoom.reset(centre);
    }
  })
  .on('touchstart', function () {
    d3.event.preventDefault();
    zoom.start();
    drag.start({
      tx: d3.event.touches[0].clientX,
      ty: d3.event.touches[0].clientY
    });
    if (d3.event.eventPhase === 2) {
      closeWindow();
    }
    moveCounter = 0;
    moveTimer = Date.now();
  })
  .on('touchend', motionEnd)
  .on('touchmove', function () {
    d3.event.preventDefault();
    if (!zoom.isZooming()) {
      zoom.end();
      drag.move({
        tx: d3.event.touches[0].clientX,
        ty: d3.event.touches[0].clientY
      });
    }
    closeWindow();
  })
  .on('mousedown', function (e) {
    d3.event.preventDefault();
    zoom.start();
    drag.start({
      tx: d3.event.clientX,
      ty: d3.event.clientY
    });
    moveCounter = 0;
    moveTimer = Date.now();
  })
  .on('mouseup', motionEnd)
  .on('mousemove', function () {
    if (zoom.isZooming()) {
      zoom.end();
    }
    if (drag.isDragging()) {
      drag.move({
        tx: d3.event.clientX,
        ty: d3.event.clientY
      });
    }
  })
;
}

function motionEnd() {
  zoom.end();
  render.stop();
  drag.drop();

  if (!moveCounter) return;
  moveCounter++;

  const now = Date.now();
  const moveTime = now - moveTimer;
  const fps = 1000 * moveCounter / moveTime;
  d3.select('.temp-flat').html(
    'moves ' + moveCounter +
    ' fps ' + fps.toFixed(2)
  );
  if (__DEV__) {
    worker.postMessage({ action: setReady });
  }
}

function Render() {
  let requestId = requestAnimationFrame(render);

  return {
    queue,
    stop() {
      cancelAnimationFrame(requestId);
      requestId = 0;
    }
  };

  function render() {
    svg.select('.graticule').attr('d', path);
    svg.select('.land').attr('d', path);
    svg.select('.boundary').attr('d', path);
    svg.selectAll('.meteorites').attr('d', path);

    if (__DEV__) {
      worker.postMessage({ action: saveRequestID, payload: requestId });
    }
    requestId = 0;
    moveCounter++;
  }

  function queue(beforeRender, after) {
    if (!requestId) {
      if (beforeRender && after) {
        requestId = requestAnimationFrame(() => {
          beforeRender();
          render();
          after();
        });
      } else if (beforeRender) {
        requestId = requestAnimationFrame(() => {
          beforeRender();
          render();
        });
      } else {
        requestId = requestAnimationFrame(render);
      }
    }
  }
}

function Zoom(render) {
  const STOPPED = 'STOPPED';
  const ZOOMING = 'ZOOMING';
  const RESETTING = 'RESETTING';
  let state = STOPPED;
  let timeOut;

  return {
    start() {
      switch (state) {
        case STOPPED:
        case RESETTING:
        timeOut = setTimeout(zoom, 1050);
        break;
        case ZOOMING:
        timeOut = setTimeout(resetScale, 750);
        break;
      }
    },
    end() {
      clearTimeout(timeOut);
    },
    reset: resetScale,
    isZooming: () => state === ZOOMING,
    isResetting: () => state === RESETTING
  };

  function zoom() {
    state = ZOOMING;
    render.queue(function beforeRender() {
      height = scale * Math.PI;
      scale = Math.min(scale + 3 * 22, 2000);
      projection.scale(scale);
    }, function after() {
      timeOut = setTimeout(zoom, 40);
    });
  }

  function resetScale(centre = true) {
    render.stop();
    state = RESETTING;
    render.queue(function beforeRender() {
      scale = SCALE;
      projection.scale(scale);
      height = Math.min(480, document.body.clientHeight);
    }, centre && function after() {
      timeOut = setTimeout(resetCenter, 500);
      state = STOPPED;
    });
  }

  function resetCenter() {
    state = RESETTING;
    render.queue(function beforeRender() {
      center = [...CENTER];
      projection.center(center);
    }, function after() {
      state = STOPPED;
    });
  }
}

function Drag(render) {
  let startPoint;
  let willDrag;
  let dragging;
  let lastPoint;

  return {
    start(point) {
      startPoint = point;
      lastPoint = startPoint;
      willDrag = true;
    },
    drop() {
      if (dragging) {
        coors[0] += lastPoint.tx - startPoint.tx;
        coors[1] += lastPoint.ty - startPoint.ty;
        const gradeX = height / 180;
        const gradeY = height / 160;
        const vx = COORS[0] / gradeX;
        const vy = COORS[1] / gradeY;
        center[0] += -coors[0] / gradeX + vx;
        center[1] += coors[1] / gradeY - vy;
        const center2 = [...center];
        render.queue(function beforeRender() {
          projection.translate(COORS);
          projection.center(center2);
        });
        coors = [...COORS];
        dragging = false;
      }
      willDrag = false;
      startPoint = lastPoint = null;
    },
    move(point) {
      lastPoint = point;
      dragging = true;
      const startPoint2 = Object.assign({}, startPoint);
      const point2 = Object.assign({}, lastPoint);
      render.queue(function beforeRender() {
        const tempCoors = [
          COORS[0] + point2.tx - startPoint2.tx,
          COORS[1] + point2.ty - startPoint2.ty
        ];
        projection.translate(tempCoors);
      });
    },
    isDragging: () => willDrag
  };
}

function DistributionRanges(min, massMax, massMedian) {
  const sizes = [2, 3, 4, 5, 7, 9, 11, 13];
  const firstHalf = (massMedian - min) / 4;
  const secondHalf = (massMax - massMedian) / 4;
  const firstHalfRanges = [];
  const secondHalfRanges = [];
  for (let i = 0; i <= 4; i++) {
    firstHalfRanges.push(min + firstHalf * i);
    secondHalfRanges.push(massMedian + secondHalf * i);
  }
  firstHalfRanges.pop();
  const ranges = [...firstHalfRanges, ...secondHalfRanges];
  return function getSize(mass) {
    for (let i = 0; i <= 10; i++) {
      if (ranges[i] <= mass && mass <= ranges[i + 1]) {
        return sizes[i];
      }
    }
  }
}

window.addEventListener('resize', function (e) {
  render.queue(function before() {
    closeWindow();
    width = Math.min(960, document.body.clientWidth);
    height = Math.min(480, document.body.clientHeight);
    svg
      .attr('width', width)
      .attr('height', height)
    ;
    COORS = [width / 2, height / 2];
    SCALE = height / Math.PI;
    scale = SCALE;
    projection
      .scale(scale)
      .translate(COORS);
    path = d3.geoPath()
      .projection(projection)
    ;

    svg.selectAll('.cross-center').remove();

    const middleY = height / 2;
    const middleX = width / 2;
    const length = 10;
    const stroke = '#45aca0';
    
    svg.append('line')
      .attr('x1', middleX - length)
      .attr('y1', middleY)
      .attr('x2', middleX + length)
      .attr('y2', middleY)
      .attr('stroke', stroke)
      .attr('class', 'cross-center')
    ;
    svg.append('line')
      .attr('x1', middleX)
      .attr('y1', middleY - length)
      .attr('x2', middleX)
      .attr('y2', middleY + length)
      .attr('stroke', stroke)
      .attr('class', 'cross-center')
    ;
    path.pointRadius(personalizeSize);

    if (__DEV__) {
      logViewHeight();
    }
  });
});
