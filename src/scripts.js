import 'normalize.css';
import './style.css';
import * as d3 from 'd3';
import data from './data.json';
import * as topojson from 'topojson';

const width = Math.min(960, document.body.clientWidth);
let height = 480;

const SCALE = height / Math.PI;
const COORS = [width / 2, height / 2];
const CENTER = [0, 0];
const projection = d3.geoEquirectangular()
  .scale(SCALE)
  .translate(COORS)
;
const path = d3.geoPath()
  .projection(projection)
;
const graticule = d3.geoGraticule();
const svg = d3.select('body').append('svg')
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
const max = d3.max(massArray);
const median = d3.median(massArray);
const dr = DistributionRanges(0, max, median);
path.pointRadius(function (feature) {
  if (feature.type === 'Feature' && feature.geometry
      && feature.geometry.type === 'Point' && feature.properties
      && feature.properties.mass) {
    return dr(feature.properties.mass) + 2;
  }
  return 4.5;
});

svg.append('g')
  .attr('class', 'meteor-layer')
  .selectAll('.meteorites')
  .data(data.features)
  .enter().append('path')
  .attr('class', 'meteorites')
  .attr('d', path)
  .on('mouseover', function (feature) {
    const w = document.querySelector('.window');
    w.classList.remove('close');
    w.style.top = (d3.event.clientY + 20 + pageYOffset) + 'px';
    const space = width - (pageXOffset + d3.event.clientX + 200 + 20);
    w.style.left = (space > 0 ? (width - space - 220) : width - 210) + 'px';

    const {
      id, name, year, mass, recclass, reclat, reclong
    } = feature.properties;
    w.innerHTML = [
      `id: ${id}`,
      `name: ${name}`,
      `year: ${new Date(year).getFullYear()}`,
      `mass: ${mass}`,
      `class: ${recclass}`,
      `lat: ${reclat}`,
      `long: ${reclong}`
    ].map((f) => `<p class="flat">${f}</p>`).join('');
  })
  .on('mouseleave', function () {
    document.querySelector('.window').classList.add('close');
  });
;

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
;
svg.append('line')
  .attr('x1', middleX)
  .attr('y1', middleY - length)
  .attr('x2', middleX)
  .attr('y2', middleY + length)
  .attr('stroke', stroke)
;

d3.select('body').append('div').attr('class', 'window close');

const render = Render();
let scale = SCALE;
const zoom = Zoom(render);
let coors = [...COORS];
const drag = Drag(render);
let center = [...CENTER];

svg.on('wheel', function () {
    const sum =  -d3.event.deltaY * 22;
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
      zoom.reset();
    }
  })
  .on('touchstart', function () {
    d3.event.preventDefault();
    zoom.start();
    console.log(d3.event);
    drag.start({
      tx: d3.event.touches[0].clientX,
      ty: d3.event.touches[0].clientY
    });
  })
  .on('touchend', function () {
    zoom.end();
    console.log(d3.event);
    drag.drop();
  })
  .on('touchmove', function () {
    d3.event.preventDefault();
    zoom.end();
    if (drag.isDragging()) {
      drag.move({
        tx: d3.event.touches[0].clientX,
        ty: d3.event.touches[0].clientY
      });
    }
  })
  .on('mousedown', function (e) {
    d3.event.preventDefault();
    zoom.start();
    drag.start({
      tx: d3.event.clientX,
      ty: d3.event.clientY
    });
  })
  .on('mouseup', function () {
    zoom.end();
    drag.drop({
      tx: d3.event.clientX,
      ty: d3.event.clientY
    });
  })
  .on('mousemove', function () {
    zoom.end();
    if (drag.isDragging()) {
      drag.move({
        tx: d3.event.clientX,
        ty: d3.event.clientY
      });
    }
  })
;

function Render() {
  let request = requestAnimationFrame(render);

  return {
    queue(beforeRender) {
      cancelAnimationFrame(request);
      if (beforeRender) {
        request = requestAnimationFrame(function callback() {
          beforeRender();
          render();
        });
      } else {
        request = requestAnimationFrame(render);
      }
    },
    imediate() {
      requestAnimationFrame(render);
    }
  };

  function render() {
    svg.select('.graticule')
    .attr('d', path);
    svg.select('.land')
      .attr('d', path);
    svg.select('.boundary')
      .attr('d', path);
    svg.selectAll('.meteorites')
      .attr('d', path);
  }
}

function Zoom(render) {
  const ZOOM = 'ZOOM';
  const RESET = 'RESET';
  let state = ZOOM;
  let timeOut;
  let timer;

  return {
    start() {
      timer = Date.now();
      switch (state) {
        case ZOOM:
        timeOut = setTimeout(zoom, 1050);
        break;
        case RESET:
        timeOut = setTimeout(reset, 750);
        break;
      }
    },
    end() {
      clearTimeout(timeOut);
    },
    reset
  };

  function zoom() {
    render.queue(function beforeRender() {
      height = scale * Math.PI;
      scale = Math.min(scale + 3 * 22, 2000);
      projection.scale(scale);
      state = RESET;
      console.log(projection.translate());
    });
    timeOut = setTimeout(zoom, 20);
  }

  function reset() {
    render.queue(function beforeRender() {
      scale = SCALE;
      projection.scale(scale);
      center = [...CENTER];
      projection.center(CENTER);

      state = ZOOM;
    });
  }
}

function Drag(render) {
  let startPoint = {};
  let dragging = false;
  let tempPoint;

  return {
    start(point) {
      startPoint = point;
      tempPoint = startPoint;
      dragging = true;
    },
    drop(point) {
      if (!dragging) {
        return;
      }
      if (!point) {
        point = tempPoint;
      }
      coors[0] += point.tx - startPoint.tx;
      coors[1] += point.ty - startPoint.ty;
      const gradeX = height / 180;
      const gradeY = height / 160;
      const vx = COORS[0] / gradeX;
      const vy = COORS[1] / gradeY;
      center[0] += -coors[0] / gradeX + vx;
      center[1] += coors[1] / gradeY - vy;
      projection.translate(COORS);
      projection.center(center)
      render.imediate();
      coors = [...COORS];
      dragging = false;
    },
    move(point) {
      tempPoint = point;
      render.queue(function beforeRender() {
        const tempCoors = [
          COORS[0] + point.tx - startPoint.tx,
          COORS[1] + point.ty - startPoint.ty
        ];
        projection.translate(tempCoors);
      });
    },
    isDragging: () => dragging
  };
}

function DistributionRanges(min, max, median) {
  const sizes = [2, 3, 4, 5, 7, 9, 11, 13];
  const firstHalf = (median - min) / 4;
  const secondHalf = (max - median) / 4;
  const firstHalfRanges = [];
  const secondHalfRanges = [];
  for (let i = 0; i <= 4; i++) {
    firstHalfRanges.push(min + firstHalf * i);
    secondHalfRanges.push(median + secondHalf * i);
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
